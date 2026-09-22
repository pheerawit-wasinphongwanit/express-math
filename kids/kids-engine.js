// kids-engine.js — BROWSER ONLY: hub + play-frame rendering, input routing, cartoon overlay.
// No game logic (that lives in kids-core.js), no storage, no network (ST-[9]).
// Timer policy (TECH-SPEC §6.5): the single permitted timer is the one cartoon-overlay
// auto-dismiss setTimeout below — display cadence, tap-to-skip; never input gating, never gameplay.
(function () {
'use strict';
const D = window.EXPRESS_KIDS_DATA;
const K = window.EXPRESS_KIDS_CORE;

let bandId = D.bands[0].id;   // OQ-E: band resets on every mode entry (fresh page load)
let session = null;           // null = at hub; 🏠 discards (nothing persists by design)
let overlayTimer = 0;         // the one setTimeout handle

function $(id) { return document.getElementById(id); }

/* ---------- hub (S-02) ---------- */
function renderBandStrip() {
  const strip = $('bandStrip');
  strip.innerHTML = '';
  for (const b of D.bands) {
    const btn = document.createElement('button');
    btn.className = 'bandBtn' + (b.id === bandId ? ' active' : '');
    btn.innerHTML = '<span class="bIcon">' + b.icon + '</span><span class="bLabel">' + b.label + '</span>';
    btn.addEventListener('click', () => { bandId = b.id; renderBandStrip(); }); // read at next session start (J-10)
    strip.appendChild(btn);
  }
}
function renderHub() {
  renderBandStrip();
  const grid = $('gameGrid');
  grid.innerHTML = '';
  for (const g of D.games) {
    const card = document.createElement('button');
    card.className = 'gameCard';
    card.innerHTML = '<span class="gIcon">' + g.icon + '</span><span class="gCaption">' + g.caption + '</span>';
    card.addEventListener('click', () => startGame(g.id)); // touch + mouse share click (OQ3)
    grid.appendChild(card);
  }
}

/* ---------- play frame (S-03) ---------- */
function startGame(gameId) {
  const seed = (((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0) || 1);
  session = K.newSession(gameId, bandId, 1, seed);
  $('hub').hidden = true;
  $('play').hidden = false;
  renderRound();
}
function goHome() {
  clearTimeout(overlayTimer);
  session = null;
  $('overlay').hidden = true;
  $('play').hidden = true;
  $('hub').hidden = false;
}
function renderRound() {
  if (!session) return;
  const d = session.round.display;
  if (d.kind === 'count') renderCount(d);
  else if (d.kind === 'match') renderMatch(d);
  else if (d.kind === 'compare-groups' || d.kind === 'compare-single') renderCompare(d);
  else goHome(); // unknown display kind → defensive home (generators own their kinds)
}
/* S-06 «ข้างไหนมากกว่า» — two large sides; the question is icon+arrow only (C4, no words):
   ⬆️+●●● = tap the side with MORE · ⬇️+● = FEWER · ⬆️+big ● = BIGGER · ⬇️+small ● = SMALLER. */
function renderCompare(d) {
  const prompt = $('prompt');
  prompt.className = 'qbar';
  prompt.innerHTML = '';
  const arrow = document.createElement('span');
  arrow.textContent = (d.q === 'more' || d.q === 'bigger') ? '⬆️' : '⬇️';
  const mag = document.createElement('span');
  if (d.q === 'more' || d.q === 'less') {
    mag.className = 'qDots';
    mag.textContent = d.q === 'more' ? '●●●' : '●';
  } else {
    mag.className = 'qDot ' + (d.q === 'bigger' ? 'big' : 'small');
    mag.textContent = '●';
  }
  prompt.append(arrow, mag);

  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = 'sides';
  box.innerHTML = '';
  for (const side of step.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice side';
    if (d.kind === 'compare-groups') {
      for (let i = 0; i < d[side].n; i++) {
        const it = document.createElement('span');
        it.className = 'sideItem';
        it.textContent = d.item;
        btn.appendChild(it);
      }
    } else {
      const it = document.createElement('span');
      it.className = 'sideItem one';
      it.textContent = d.item;
      it.style.fontSize = (44 + d[side].size * 14) + 'px';
      btn.appendChild(it);
    }
    btn.addEventListener('click', () => onChoice(side));
    box.appendChild(btn);
  }
}
/* S-05 «จับคู่เหมือนกัน» — prompt card (numeral or dots) + choice cards of the other
   representation; direction comes from round data (alternates per round). */
function renderMatch(d) {
  const prompt = $('prompt');
  prompt.className = '';
  prompt.innerHTML = '';
  prompt.appendChild(d.direction === 'toDots' ? numeralCard(d.value) : dotsCard(d.value, 'big'));
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  for (const c of step.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    const inner = d.direction === 'toDots' ? dotsCard(c, 'small') : numeralCard(c);
    inner.classList.add('cardFill');
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(c));
    box.appendChild(btn);
  }
}
function numeralCard(v) {
  const el = document.createElement('div');
  el.className = 'numeral';
  el.textContent = v;
  return el;
}
function dotsCard(v, size) {
  const el = document.createElement('div');
  el.className = 'dots ' + size;
  for (let i = 0; i < v; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = '●';
    el.appendChild(dot);
  }
  return el;
}
function renderCount(d) {
  const prompt = $('prompt');
  prompt.className = '';
  prompt.innerHTML = '';
  for (let i = 0; i < d.n; i++) {
    const s = document.createElement('span');
    s.textContent = d.emoji;
    prompt.appendChild(s);
  }
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const c of step.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = c;
    btn.addEventListener('click', () => onChoice(c));
    box.appendChild(btn);
  }
}
function onChoice(choiceId) {
  if (!session || !$('overlay').hidden) return; // overlay open → taps are skips only
  const r = K.submit(session, choiceId);
  if (r.outcome === 'step') { renderRound(); return; } // settle-in-place (multi-step games)
  showOverlay(r.outcome === 'pass' ? 'pass' : 'nudge');
}

/* ---------- cartoon overlay (F-04) — submit()'s outcome is the only pose authority ---------- */
function showOverlay(pose) {
  const ref = pose === 'pass' ? D.cartoonRefs.pass : D.cartoonRefs.nudge;
  for (const el of document.querySelectorAll('.art')) el.hidden = true;
  const art = $(ref.slice('inline:'.length));
  if (art) {
    art.hidden = false;
    art.classList.remove('pop'); void art.offsetWidth; art.classList.add('pop');
  }
  $('overlay').hidden = false;
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(dismissOverlay, D.tunables.overlayMs); // the single permitted timer
}
function dismissOverlay() {
  clearTimeout(overlayTimer);
  $('overlay').hidden = true;
  renderRound(); // pass → fresh round appears at the child's pace; retry → same round stays (J-03/J-09)
}

/* ---------- wiring ---------- */
$('backBtn').addEventListener('click', () => history.back()); // S-02 → S-01, no gate (OQ-C)
$('homeBtn').addEventListener('click', goHome);                // exit always available (OQ-D)
$('overlay').addEventListener('click', dismissOverlay);        // tap-to-skip
renderHub();
})();
