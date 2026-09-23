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
let pendingGame = null;       // game awaiting the solo/together choice (S-10)

function $(id) { return document.getElementById(id); }

/* ---------- hub (S-02) — FEATURES-OQ-D default: one scrolling board, 5 skill-family zones ---------- */
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
  const board = $('gameGrid');
  board.innerHTML = '';
  for (const fam of D.families) {
    const games = D.games.filter((g) => g.family === fam.id);
    if (!games.length) continue; // a zone renders only when it has registered games (never near-empty)
    const zone = document.createElement('section');
    zone.className = 'zone';
    const head = document.createElement('div');
    head.className = 'zoneHead';
    head.innerHTML = '<span class="zIcon">' + fam.icon + '</span><span class="zLabel">' + fam.label + '</span>';
    zone.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'zoneGrid';
    for (const g of games) {
      const card = document.createElement('button');
      card.className = 'gameCard';
      card.innerHTML = '<span class="gIcon">' + g.icon + '</span><span class="gCaption">' + g.caption + '</span>';
      card.addEventListener('click', () => startGame(g.id)); // touch + mouse share click (OQ3)
      grid.appendChild(card);
    }
    zone.appendChild(grid);
    board.appendChild(zone);
  }
}

/* ---------- play frame (S-03) ---------- */
function startGame(gameId) {
  const game = D.games.find((g) => g.id === gameId);
  if (game && game.coPlay) {          // S-10 chooser only for flagged games (OQ-G: chosen at game start)
    pendingGame = gameId;
    $('hub').hidden = true;
    $('chooser').hidden = false;
    return;
  }
  beginSession(gameId, 1);            // solo is the default full experience (F-12)
}
function beginSession(gameId, players) {
  pendingGame = null;
  const seed = (((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0) || 1);
  session = K.newSession(gameId, bandId, players, seed); // band = mode owner's (OQ-F)
  $('chooser').hidden = true;
  $('hub').hidden = true;
  $('play').hidden = false;
  renderRound();
}
function goHome() {
  clearTimeout(overlayTimer);
  session = null;
  pendingGame = null;
  $('overlay').hidden = true;
  $('chooser').hidden = true;
  $('play').hidden = true;
  $('hub').hidden = false;
}
function renderRound() {
  if (!session) return;
  renderTurnBadge();
  const d = session.round.display;
  if (d.kind === 'count') renderCount(d);
  else if (d.kind === 'match') renderMatch(d);
  else if (d.kind === 'compare-groups' || d.kind === 'compare-single') renderCompare(d);
  else if (d.kind === 'shape-match' || d.kind === 'pattern') renderShapes(d);
  else if (d.kind === 'order') renderOrder(d);
  else if (d.kind === 'sort') renderSort(d);
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
  box.innerHTML = '';
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
  showOverlay(r.outcome === 'pass' ? 'pass' : 'nudge', r.turnAdvanced);
}

/* S-07 «รูปทรงน่ารัก» — shape-match (sample + choices) or pattern row with a trailing ?.
   Both render from display.kind — one view, two data shapes (C6). */
function renderShapes(d) {
  const prompt = $('prompt');
  prompt.className = '';
  prompt.innerHTML = '';
  if (d.kind === 'shape-match') {
    prompt.className = 'sampleShape';
    prompt.textContent = d.shape;
  } else {
    prompt.className = 'patternRow';
    for (const s of d.seq) {
      const el = document.createElement('span');
      el.className = 'pItem';
      el.textContent = s;
      prompt.appendChild(el);
    }
    const q = document.createElement('span');
    q.className = 'pItem qmark';
    q.textContent = '?';
    prompt.appendChild(q);
  }
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const c of step.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    const inner = document.createElement('span');
    inner.className = 'gShape';
    inner.textContent = c;
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(c));
    box.appendChild(btn);
  }
}

/* S-08 «เรียงให้ถูก» — scattered pieces (choices) + target row of slots; settled pieces
   render from session.placed so partial progress survives a wrong pick (J-07). */
function renderOrder(d) {
  const prompt = $('prompt');
  prompt.className = 'orderRow';
  prompt.innerHTML = '';
  const sorted = d.items.slice().sort((a, b) => a.size - b.size);
  for (let i = 0; i < sorted.length; i++) {
    const slot = document.createElement('span');
    slot.className = 'oSlot';
    if (i < session.placed.length) {
      slot.textContent = sorted[i].emoji;
      slot.style.fontSize = (26 + sorted[i].size * 10) + 'px';
      slot.classList.add('settled');
    } else {
      slot.textContent = i === session.placed.length ? '?' : '';
    }
    prompt.appendChild(slot);
  }
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const id of step.choices) {
    const it = d.items.find((x) => x.id === id);
    const btn = document.createElement('button');
    btn.className = 'choice';
    const inner = document.createElement('span');
    inner.className = 'oItem';
    inner.textContent = it.emoji;
    inner.style.fontSize = (30 + it.size * 14) + 'px';
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(id));
    box.appendChild(btn);
  }
}

/* S-09 «จัดเข้ากลุ่ม» — current item big + waiting items as REAL items (never counts);
   bins are the two choice buttons and show sent items faded inside. Finish = pass
   cartoon only — no tally DOM exists (J-08, NG3). */
function renderSort(d) {
  const prompt = $('prompt');
  prompt.className = 'sortPrompt';
  prompt.innerHTML = '';
  const idx = session.stepIndex;
  const cur = d.items[idx];
  const curEl = document.createElement('span');
  curEl.className = 'sCur';
  curEl.textContent = cur.emoji;
  prompt.appendChild(curEl);
  const waiting = d.items.slice(idx + 1);
  if (waiting.length) {
    const row = document.createElement('span');
    row.className = 'sWaiting';
    for (const it of waiting) {
      const s = document.createElement('span');
      s.textContent = it.emoji;
      row.appendChild(s);
    }
    prompt.appendChild(row);
  }
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = 'sides';
  box.innerHTML = '';
  for (const bid of step.choices) {
    const bin = d.bins.find((b) => b.id === bid);
    const btn = document.createElement('button');
    btn.className = 'choice binBtn';
    const icon = document.createElement('span');
    icon.className = 'binIcon';
    icon.textContent = bin.icon;
    btn.appendChild(icon);
    const label = document.createElement('span'); // small label so parents can verbalize the rule
    label.className = 'binLabel';
    label.textContent = D.copy.binLabel[bid];
    btn.appendChild(label);
    const sent = d.items.slice(0, idx).filter((it) => it.bin === bid); // sent items settle into their bin
    if (sent.length) {
      const inner = document.createElement('span');
      inner.className = 'binItems';
      inner.textContent = sent.map((it) => it.emoji).join(' ');
      btn.appendChild(inner);
    }
    btn.addEventListener('click', () => onChoice(bid));
    box.appendChild(btn);
  }
}

/* ---------- co-play (F-12) — turn indicator + icon handoff; no per-player anything ---------- */
function renderTurnBadge() {
  const badge = $('turnBadge');
  if (session && session.players === 2) {
    badge.hidden = false;
    badge.textContent = D.tunables.playerIcons[session.turn]; // current turn icon (parity, not identity)
  } else {
    badge.hidden = true;
  }
}

/* ---------- cartoon overlay (F-04) — submit()'s outcome is the only pose authority ---------- */
function showOverlay(pose, turnAdvanced) {
  const art = $('art-' + pose); // asset ref backs the <img>; inline SVG auto-falls-back
  for (const el of document.querySelectorAll('.art')) el.hidden = el !== art;
  if (art) {
    art.hidden = false;
    art.classList.remove('pop'); void art.offsetWidth; art.classList.add('pop');
  }
  const caption = $('artCaption'); // caption rides the same overlay + the same single timer
  caption.textContent = D.copy[pose];
  caption.hidden = false;
  const handoff = $('handoff'); // icon handoff rides the same overlay + the same single timer
  handoff.hidden = true;
  handoff.innerHTML = '';
  if (pose === 'pass' && turnAdvanced) {
    handoff.hidden = false;
    handoff.innerHTML = '<span>🔁</span><span>' + D.tunables.playerIcons[session.turn] + '</span>' +
                        '<span class="hLabel">' + D.copy.handoff + '</span>';
  }
  $('overlay').hidden = false;
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(dismissOverlay,
    D.tunables.overlayMs + (pose === 'pass' && turnAdvanced ? D.tunables.handoffExtraMs : 0));
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
$('chooserBackBtn').addEventListener('click', () => { pendingGame = null; $('chooser').hidden = true; $('hub').hidden = false; });
$('soloBtn').addEventListener('click', () => beginSession(pendingGame, 1));
$('togetherBtn').addEventListener('click', () => beginSession(pendingGame, 2));
$('soloBtn').querySelector('.cLabel').textContent = D.copy.solo;
$('togetherBtn').querySelector('.cLabel').textContent = D.copy.together;

// Cartoon pair wiring (F-04): asset refs are primary; the reviewed inline-SVG pair is the
// automatic fallback when an asset is missing (TECH-SPEC §6.4 — game never blocks).
for (const pose of ['pass', 'nudge']) {
  const el = $('art-' + pose);
  const img = el.querySelector('img');
  const svg = el.querySelector('svg');
  const ref = pose === 'pass' ? D.cartoonRefs.pass : D.cartoonRefs.nudge;
  if (ref.startsWith('asset:') && img && svg) {
    svg.hidden = true;
    img.addEventListener('error', () => { img.hidden = true; svg.hidden = false; }, { once: true });
    img.src = ref.slice('asset:'.length);
    if (img.complete && img.naturalWidth === 0) { img.hidden = true; svg.hidden = false; }
  }
}
renderHub();
})();
