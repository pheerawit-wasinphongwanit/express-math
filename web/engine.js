// engine.js — browser runtime only: rendering, input, audio, timing.
// ALL game logic lives in core.js; ALL content lives in data.js (docs/story.md is the source of truth).
(function () {
'use strict';
const D = window.EXPRESS_DATA, C = window.EXPRESS_CORE, K = D.keys;
const $ = (id) => document.getElementById(id);
const CP = D.copy;

/* ---------------- state ---------------- */
let S = null;            // run state (core.newRun)
let rng = null;
let mode = 'free';       // 'free' | 'daily'
let q = null;            // current question
let locked = false;      // answer lock during feedback flash
let freeze = true;       // timer frozen during countdown / interstitial / pause
let timerId = null, lastT = 0;
let overlayMode = null;  // 'count' | 'wave' | 'pause' | null
let muted = false;

/* ---------------- audio: exactly 4 beeps ---------------- */
let actx = null;
function tone(freq, dur, delay = 0, vol = 0.12) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* audio unavailable — game stays fully playable */ }
}
const beep = {
  correct: () => tone(480 + 40 * (S ? S.mult : 1), 0.09),
  wrong: () => tone(160, 0.22, 0, 0.16),
  milestone: () => { tone(660, 0.09); tone(990, 0.12, 0.09); },
  over: () => { tone(330, 0.16); tone(220, 0.3, 0.15); },
};

/* ---------------- helpers ---------------- */
const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* private mode: play without saves */ } },
};
function show(name) {
  for (const s of ['menu', 'play', 'result']) $(s).hidden = s !== name;
}
function applyTheme() {
  const w = D.waves[S ? S.wave : 0];
  document.documentElement.style.setProperty('--theme', w.theme);
  if (S) $('station').textContent = `🚉 ${w.name}`;
}
function overlay(html, mode) {
  overlayMode = mode;
  const el = $('overlay');
  el.innerHTML = html || '';
  el.hidden = !html;
}
function renderMenu() {
  $('t_title').textContent = CP.menu.title;
  $('t_sub').textContent = CP.menu.sub;
  $('playBtn').textContent = CP.menu.play;
  $('dailyBtn').textContent = CP.menu.daily;
  $('t_hint').textContent = CP.menu.hint;
  const best = store.get(K.best) || 0;
  const today = store.get(K.dailyPrefix + dateKey());
  $('menuStats').innerHTML =
    `<span>${CP.menu.best} <b>${best}</b></span>` +
    (today !== null ? `<span>${CP.menu.today} <b>${today}</b></span>` : '');
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
}

/* ---------------- HUD ---------------- */
function renderHUD() {
  $('score').textContent = S.score;
  $('streakBadge').textContent = S.streak >= 5 ? `🔥${S.streak} ×${S.mult}` : (S.streak > 0 ? `🔥${S.streak}` : '');
  $('streakBadge').classList.toggle('hot', S.streak >= 10);
}
function renderTime() {
  const pct = Math.max(0, Math.min(100, (S.bank / D.maxBankSec) * 100));
  $('timefill').style.width = pct + '%';
  $('timebar').classList.toggle('low', S.bank <= 10);
}
function floatMsg(txt, cls) {
  const el = cls === 'time' ? $('timeDelta') : $('float');
  el.textContent = txt;
  el.className = cls === 'time' ? '' : '';
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (cls === 'time') el.classList.add(txt.startsWith('+') ? 'plus' : 'minus');
}

/* ---------------- run lifecycle ---------------- */
function initAudio() {
  // iOS: AudioContext must be created/resumed inside a user gesture
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { /* audio unavailable */ }
}
function startRun(m) {
  mode = m;
  initAudio();
  S = C.newRun(D);
  rng = m === 'daily'
    ? C.mulberry32(C.hashSeed('express-math:' + dateKey()))
    : C.mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  show('play');
  applyTheme();
  renderHUD(); renderTime();
  countdown();
}
function countdown() {
  freeze = true; locked = true;
  const steps = [CP.play.count3, CP.play.count2, CP.play.count1, CP.play.go];
  let i = 0;
  overlay(`<div class="big">${steps[0]}</div>`, 'count');
  tone(440, 0.07);
  const iv = setInterval(() => {
    i++;
    if (i < steps.length) {
      overlay(`<div class="big">${steps[i]}</div>`, 'count');
      tone(440 + i * 120, 0.07);
    } else {
      clearInterval(iv);
      overlay(null, null);
      freeze = false; locked = false;
      nextQuestion();
      startTimer();
    }
  }, 500);
}
function startTimer() {
  lastT = performance.now();
  timerId = setInterval(() => {
    if (freeze || S.over) { lastT = performance.now(); return; }
    const now = performance.now();
    C.tick(S, D, (now - lastT) / 1000);
    lastT = now;
    renderTime();
    if (S.over) endRun();
  }, 100);
}
function stopTimer() { clearInterval(timerId); timerId = null; }

function nextQuestion() {
  q = C.makeQuestion(rng, D.waves[S.wave]);
  $('question').textContent = q.prompt;
  const box = $('choices');
  box.innerHTML = '';
  q.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = c;
    b.addEventListener('click', () => answer(i));
    box.appendChild(b);
  });
  locked = false;
}

function answer(i) {
  if (locked || S.over || freeze) return;
  locked = true;
  const correct = i === q.correctIndex;
  const before = S.score;
  const events = C.applyAnswer(S, D, correct);
  const btns = [...$('choices').children];
  btns[i].classList.add(correct ? 'good' : 'bad');
  if (!correct) btns[q.correctIndex].classList.add('reveal');

  if (correct) {
    beep.correct();
    const gained = S.score - before;
    floatMsg(events.includes('multup') ? `+${gained} ×${S.mult}!` : '+' + gained);
  } else {
    beep.wrong();
    floatMsg(CP.play.secPenalty, 'time');
  }
  if (events.includes('milestone')) {
    beep.milestone();
    floatMsg(CP.play.secBonus + ' ⚡', 'time');
  }
  if (events.includes('multup')) {
    const b = $('streakBadge');
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
  renderHUD(); renderTime();

  if (S.over) { setTimeout(endRun, 700); return; }
  if (events.includes('waveup')) {
    freeze = true;
    const w = D.waves[S.wave];
    overlay(`<div class="big">🚉</div><div class="banner">${CP.play.nextStation}</div><div class="note">${w.name}</div>`, 'wave');
    beep.milestone();
    setTimeout(() => {
      overlay(null, null);
      applyTheme();
      freeze = false;
      nextQuestion();
    }, 1500);
    return;
  }
  setTimeout(() => { if (!S.over) nextQuestion(); }, correct ? 350 : 800);
}

function endRun() {
  if (!S) return;
  stopTimer();
  beep.over();

  const tier = C.tierFor(S.score, D.tiers);
  const key = mode === 'daily' ? K.dailyPrefix + dateKey() : K.best;
  const prev = Number(store.get(key) || 0);
  const isBest = S.score > prev;
  if (isBest) store.set(key, S.score);

  $('t_timeup').textContent = CP.result.timeUp;
  $('finalScore').textContent = S.score;
  $('newBest').hidden = !isBest;
  $('newBest').textContent = CP.result.newBest;
  $('tier').innerHTML = `<span class="emoji">${tier.emoji}</span> ${tier.name}`;
  $('stats').innerHTML =
    `<span>${CP.result.correct} <b>${S.correct}</b></span>` +
    `<span>${CP.result.wrong} <b>${S.wrong}</b></span>` +
    `<span>${CP.result.maxStreak} <b>${S.maxStreak}</b></span>` +
    `<span>${CP.result.stationReached} <b>${S.wave + 1}/4</b></span>`;
  $('againBtn').textContent = CP.result.again;
  $('menuBtn').textContent = CP.result.menu;
  overlay(null, null);
  show('result');
  S = null;
}

/* ---------------- auto-pause (visibility) ---------------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S && !S.over && !$('play').hidden && overlayMode !== 'count') {
    freeze = true;
    overlay(`<div class="big">⏸</div><div class="banner">${CP.play.paused}</div><div class="note">${CP.play.tapToResume}</div>`, 'pause');
  }
});

/* ---------------- input ---------------- */
$('playBtn').addEventListener('click', () => startRun('free'));
$('dailyBtn').addEventListener('click', () => startRun('daily'));
$('againBtn').addEventListener('click', () => startRun(mode));
$('menuBtn').addEventListener('click', () => { renderMenu(); show('menu'); });
$('muteBtn').addEventListener('click', () => {
  muted = !muted;
  store.set(K.mute, muted ? '1' : '0');
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
});
$('overlay').addEventListener('click', () => {
  if (overlayMode === 'pause') { overlay(null, null); freeze = false; lastT = performance.now(); }
});
document.addEventListener('keydown', (e) => {
  if ($('play').hidden || !q || locked || freeze) return;
  const n = Number(e.key);
  if (n >= 1 && n <= q.choices.length) answer(n - 1);
});

/* ---------------- boot ---------------- */
muted = store.get(K.mute) === '1';
renderMenu();
show('menu');
})();
