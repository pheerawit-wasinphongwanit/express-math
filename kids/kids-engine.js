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
let dealSel = null;           // S-19 tap-mode selection (item id) — ephemeral view state, cleared on every render
let dealSelEl = null;         // its chip element (selection highlight bookkeeping)
let traceWrapEl = null;       // S-22 corridor canvas (geometry anchor)
let traceDuckEl = null, traceEndEl = null, traceDots = [];
let traceLog = [];            // S-22 traversal log — mirrors session.placed[0] (progress is never reset)
let traceActive = false;      // pointer down = gliding
let traceGeo = null;          // {maxX, g, gy} — grid→pixel mapping shared by SVG viewBox and hit geometry
let pairSel = null;           // S-24 pending half of the next pair {side, id} — ephemeral view state
let pairSelEl = null;         // its chip element (selection highlight bookkeeping)

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
  dealSel = null; dealSelEl = null;
  traceWrapEl = null; traceDuckEl = null; traceEndEl = null; traceDots = [];
  traceLog = []; traceActive = false; traceGeo = null;
  pairSel = null; pairSelEl = null;
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
  else if (d.kind === 'samediff-find' || d.kind === 'samediff-odd') renderSamediff(d);
  else if (d.kind === 'shadow-match') renderShadow(d);
  else if (d.kind === 'positions') renderPositions(d);
  else if (d.kind === 'length') renderLength(d);
  else if (d.kind === 'weight') renderWeight(d);
  else if (d.kind === 'part-whole') renderPartWhole(d);
  else if (d.kind === 'equal-groups') renderEqualGroups(d);
  else if (d.kind === 'color-sort') renderColorSort(d);
  else if (d.kind === 'number-track') renderNeighbors(d);
  else if (d.kind === 'shape-hunt') renderShapeHunt(d);
  else if (d.kind === 'routine') renderRoutine(d);
  else if (d.kind === 'deal') renderDeal(d);
  else if (d.kind === 'trace') renderTrace(d);
  else if (d.kind === 'pair-off') renderPairOff(d);
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

/* S-18 «จัดตามสี» — same mechanic as S-09 with a color criterion (C6): bins are the choice
   buttons and lead with a color swatch + exemplar marker (marker ∉ members — never a member
   emoji); sent items settle faded into their bin; finish = pass cartoon only — no tally DOM
   exists (J-20, NG3). */
function renderColorSort(d) {
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
    btn.className = 'choice binBtn colorBin';
    const sw = document.createElement('span');          // color bar leads the bowl (no words needed)
    sw.className = 'swatch';
    sw.style.background = bin.swatch;
    btn.appendChild(sw);
    const icon = document.createElement('span');         // exemplar marker — never a member emoji
    icon.className = 'binIcon';
    icon.textContent = bin.marker;
    btn.appendChild(icon);
    const sent = d.items.slice(0, idx).filter((it) => it.bin === bid); // sent items settle into their bowl
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

/* S-20 «เพื่อนตัวเลข» — number track: every cell shows its numeral with a dot bar beneath
   (quantity readable without knowing words); the gap highlights and waits; choices are big
   numeral cards (J-22). */
function renderNeighbors(d) {
  const prompt = $('prompt');
  prompt.className = 'trackRow';
  prompt.innerHTML = '';
  d.track.forEach((v, i) => {
    const cell = document.createElement('span');
    cell.className = 'tCell' + (i === d.gapIndex ? ' tGap' : '');
    if (v === null) {
      cell.textContent = '?';
    } else {
      const num = document.createElement('span');
      num.className = 'tNum';
      num.textContent = v;
      const dots = document.createElement('span');
      dots.className = 'tDots';
      for (let k = 0; k < v; k++) {
        const dt = document.createElement('i');
        dt.className = 'tDot';
        dt.textContent = '•';
        dots.appendChild(dt);
      }
      cell.append(num, dots);
    }
    prompt.appendChild(cell);
  });
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const c of step.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    const inner = numeralCard(c);
    inner.classList.add('cardFill');
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(c));
    box.appendChild(btn);
  }
}

/* S-21 «ของจริงรูปทรงอะไร» — big real-object prompt + basic-shape cards (emoji fallback now,
   art set 4 = T-054 recognizability upgrade — the game never blocks on an asset, J-23). */
function renderShapeHunt(d) {
  const prompt = $('prompt');
  prompt.className = 'sampleShape';
  prompt.textContent = d.object;
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

/* S-23 «วันของหนู» — scattered routine cards + target lane; settled cards render from
   session.placed so partial progress survives a wrong placement (mirrors S-08 — J-25).
   Emoji cards now; art set 5 = T-055 upgrade (game never blocks on an asset). */
function renderRoutine(d) {
  const prompt = $('prompt');
  prompt.className = 'orderRow';
  prompt.innerHTML = '';
  const sorted = d.items.slice().sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < sorted.length; i++) {
    const slot = document.createElement('span');
    slot.className = 'oSlot';
    if (i < session.placed.length) {
      slot.textContent = sorted[i].emoji;
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
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(id));
    box.appendChild(btn);
  }
}

/* S-19 «แจกให้ครบ» — goal-state deal view (F-21): recipients as generous drop targets in
   #prompt, unheld items in #choices. inputDrag (below) gives BOTH input modes on one round —
   drag-to-place or tap-item-then-tap-recipient (Pointer Events unify touch/mouse, C4/OQ3).
   Holdings render from session.placed (latest snapshot); moving an already-placed item is
   always allowed; incomplete structures are silent in-view — no cartoon mid-course (J-21). */
function renderDeal(d) {
  dealSel = null; dealSelEl = null; // fresh render = no pending selection
  const held = new Map((session.placed[0] || []).map((p) => [p.item, p.recipient]));
  const prompt = $('prompt');
  prompt.className = 'dealWrap';
  prompt.innerHTML = '';
  const recRow = document.createElement('div');
  recRow.className = 'dealRecips';
  const recips = [];                                   // {el, id} drop-target registry
  for (const recip of d.recipients) {
    const chip = document.createElement('div');
    chip.className = 'dealRecip';
    const face = document.createElement('span');
    face.className = 'dealFace';
    face.textContent = recip.e;
    chip.appendChild(face);
    const heldHere = d.items.filter((it) => held.get(it.id) === recip.id);
    if (heldHere.length) {
      const inner = document.createElement('span');
      inner.className = 'dealHeld';
      chip.appendChild(inner);
      for (const it of heldHere) {                     // held items stay movable (J-21: ย้ายได้ตลอด)
        const h = document.createElement('span');
        h.className = 'dealHeldChip';
        h.textContent = it.e;
        inner.appendChild(h);
        dealDraggable(h, it, recips);
      }
    }
    recRow.appendChild(chip);
    recips.push({ el: chip, id: recip.id });
    chip.addEventListener('click', () => {            // genuine tap on the recipient (a drop never lands here)
      if (dealSel) dealPlace(dealSel, recip.id);
    });
  }
  prompt.appendChild(recRow);

  const box = $('choices');
  box.className = 'dealItems';
  box.innerHTML = '';
  for (const it of d.items) {
    if (held.has(it.id)) continue;                     // settled items render inside their recipient
    const chip = document.createElement('div');
    chip.className = 'dealItem';
    chip.textContent = it.e;
    box.appendChild(chip);
    dealDraggable(chip, it, recips);
  }
}

/* inputDrag (S-19) — the drag half of the deal input: pointer down on an item, follow the
   finger/mouse, drop on a recipient (generous hit rect). A release that never moved = tap
   (selection handled there). Pointer Events only; no timers; setPointerCapture keeps the
   events flowing to the item even outside its bounds. */
function dealDraggable(el, item, recips) {
  let active = false, sx = 0, sy = 0, moved = false;
  const reset = () => {
    active = false; moved = false;
    el.classList.remove('dragging', 'dragGhost');
    el.style.left = ''; el.style.top = '';
  };
  el.addEventListener('pointerdown', (ev) => {
    if (!session || !$('overlay').hidden) return;
    active = true; moved = false; sx = ev.clientX; sy = ev.clientY;
    if (el.setPointerCapture) el.setPointerCapture(ev.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (ev) => {
    if (!active) return;
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return;
    moved = true;
    el.classList.add('dragGhost');
    el.style.left = ev.clientX + 'px';
    el.style.top = ev.clientY + 'px';
  });
  el.addEventListener('pointerup', (ev) => {
    if (!active) return reset();
    const wasMoved = moved;
    reset();
    if (wasMoved) {
      const rid = hitRecipient(recips, ev.clientX, ev.clientY);
      if (rid) dealPlace(item.id, rid);
      return;
    }
    dealSelect(el, item.id);                           // no movement → tap half of the input
  });
  el.addEventListener('pointercancel', reset);
}
function hitRecipient(recips, x, y) {
  const PAD = 24;                                      // generous drop zone (no precision pressure)
  for (const r of recips) {
    const rc = r.el.getBoundingClientRect();
    if (x >= rc.left - PAD && x <= rc.right + PAD && y >= rc.top - PAD && y <= rc.bottom + PAD) {
      return r.id;
    }
  }
  return null;
}
function dealSelect(el, itemId) {
  if (dealSel === itemId) { dealSel = null; dealSelEl = null; el.classList.remove('sel'); return; } // tap again to unselect
  if (dealSelEl) dealSelEl.classList.remove('sel');
  dealSel = itemId; dealSelEl = el;
  el.classList.add('sel');
}
/* Structure submit for goal views: placements REPLACE the item's old spot (kids keep
   adjusting, J-21); the core judges the goal state — pass → cartoon, anything else stays
   silent in-view (re-render holdings from the fresh snapshot; per-action turn flips ride
   renderTurnBadge inside renderRound). */
function dealPlace(itemId, recipId) {
  if (!session || !$('overlay').hidden) return;
  const snap = (session.placed[0] || []).filter((p) => p.item !== itemId);
  snap.push({ item: itemId, recipient: recipId });
  dealSel = null;
  const r = K.submit(session, snap);
  if (r.outcome === 'pass') { showOverlay('pass', r.turnAdvanced); return; }
  renderRound();
}

/* S-22 «เดินตามเส้น» — goal-state trace view (F-24): a dashed corridor from the duck to the
   pond fills the content area; inputTrace (below) glides along it following the pointer.
   Drift = the glide pauses (duck holds, progress kept — never reset, J-24); waypoint
   reaches append to the traversal log and submit it — silent until the pond; the pond
   completes the goal → pass. Geometry is ONE mapping: the SVG viewBox and the pixel hit
   math share traceGeo, so the drawn corridor is exactly the hittable corridor. */
function renderTrace(d) {
  const w = d.waypoints;
  const maxX = w[w.length - 1].x;
  const g = maxX * 0.12, gy = 0.5;                 // grid-space padding (≈10% visual margin)
  traceGeo = { maxX, g, gy };
  traceLog = (session.placed[0] || []).slice();
  traceActive = false;
  traceDots = [];

  const prompt = $('prompt');
  prompt.className = '';
  prompt.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'traceWrap';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'traceSvg');
  svg.setAttribute('viewBox', (-g) + ' ' + (-gy) + ' ' + (maxX + 2 * g) + ' ' + (4 + 2 * gy));
  svg.setAttribute('preserveAspectRatio', 'none');
  const corridor = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  corridor.setAttribute('class', 'traceCorridor');
  corridor.setAttribute('points', w.map((p) => p.x + ',' + p.y).join(' '));
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('class', 'traceLine');
  line.setAttribute('points', w.map((p) => p.x + ',' + p.y).join(' '));
  svg.append(corridor, line);
  wrap.appendChild(svg);

  for (let i = 1; i < w.length - 1; i++) {        // mid waypoint dots light up as reached
    const dot = document.createElement('span');
    dot.className = 'traceDot' + (i < traceLog.length ? ' reached' : '');
    wrap.appendChild(dot);
    traceDots.push({ i, el: dot });
  }
  const end = document.createElement('span');
  end.className = 'traceEnd';
  end.textContent = d.end;
  wrap.appendChild(end);
  traceEndEl = end;
  const duck = document.createElement('span');
  duck.className = 'traceDuck';
  duck.textContent = d.start;
  wrap.appendChild(duck);
  traceDuckEl = duck;
  traceWrapEl = wrap;

  traceInput(wrap);
  prompt.appendChild(wrap);
  layoutTraceMarkers(w);

  const box = $('choices');
  box.className = '';
  box.innerHTML = '';                               // no choice cards — the corridor is the input
}
function tracePt(i) {
  const rc = traceWrapEl.getBoundingClientRect();
  const geo = traceGeo;
  const w = session.round.display.waypoints;
  return {
    x: ((w[i].x + geo.g) / (geo.maxX + 2 * geo.g)) * rc.width,
    y: ((w[i].y + geo.gy) / (4 + 2 * geo.gy)) * rc.height,
  };
}
function layoutTraceMarkers(w) {
  const place = (el, i) => {
    const p = tracePt(i);
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
  };
  for (const dot of traceDots) place(dot.el, dot.i);
  place(traceEndEl, w.length - 1);
  place(traceDuckEl, Math.max(0, traceLog.length - 1)); // duck waits at the furthest reached point
}

/* inputTrace (S-22) — the glide input: pointer down anywhere starts a glide; the duck follows
   the nearest point ON the path while the pointer stays inside the corridor; leaving the
   corridor = pause (duck freezes, progress kept). Reaching the next waypoint(s) in order
   appends them to the log and submits it once per event. Pointer Events only; no timers —
   drift detection is pure geometry (§6.5 timer split untouched). */
function traceInput(wrap) {
  wrap.addEventListener('pointerdown', (ev) => {
    if (!session || !$('overlay').hidden) return;
    traceActive = true;
    if (wrap.setPointerCapture) wrap.setPointerCapture(ev.pointerId);
    traceFollow(ev);
  });
  wrap.addEventListener('pointermove', (ev) => { if (traceActive) traceFollow(ev); });
  wrap.addEventListener('pointerup', () => { traceActive = false; });
  wrap.addEventListener('pointercancel', () => { traceActive = false; });
}
function traceFollow(ev) {
  if (!session || !$('overlay').hidden) return;
  const w = session.round.display.waypoints;
  const CORRIDOR = 56;                              // generous — no precision pressure beyond the task
  let best = null;                                  // nearest point on the whole polyline
  for (let i = 0; i + 1 < w.length; i++) {
    const a = tracePt(i), b = tracePt(i + 1);
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    let t = ((ev.clientX - a.x) * vx + (ev.clientY - a.y) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * vx, py = a.y + t * vy;
    const dist = Math.hypot(ev.clientX - px, ev.clientY - py);
    if (!best || dist < best.dist) best = { dist, px, py };
  }
  if (best.dist > CORRIDOR) return;                 // drift → glide pauses (nothing resets, J-24)
  traceDuckEl.style.left = best.px + 'px';
  traceDuckEl.style.top = best.py + 'px';
  let appended = false, guard = 0;
  while (traceLog.length < w.length && guard++ < 8) {
    const wp = tracePt(traceLog.length);            // next waypoint in order — jumping ahead is impossible
    if (Math.hypot(ev.clientX - wp.x, ev.clientY - wp.y) > CORRIDOR) break;
    traceLog.push(w[traceLog.length].id);
    for (const dot of traceDots) if (dot.i === traceLog.length - 1) dot.el.classList.add('reached');
    appended = true;
  }
  if (!appended) return;
  const r = K.submit(session, traceLog.slice());
  if (r.outcome === 'pass') showOverlay('pass', r.turnAdvanced); // the pond → pass cartoon
  // anything else stays silent — the glide simply continues (J-24)
}

/* S-24 «จับคู่แล้วเทียบ» — two-phase goal view (F-26): phase 1 = the pairing board — tap one
   member on each side and a hand-joined pair chip (🐟🤝🐸) joins the middle lane; invalid
   attempts (a paired member) simply never link — silent (J-26). When every possible
   cross-pair is made the leftovers bounce and phase 2 asks (S-06 pictogram) which side has
   more; groups and pair-links stay rendered from session.placed through the final question
   and any retry (J-26). inputLink = the tap-tap pairing below (Pointer-free: plain taps). */
function renderPairOff(d) {
  const phase2 = session.stepIndex === 1;
  const pairs = session.placed[0] || [];
  const pairedIds = new Set(pairs.flatMap((p) => [p.left, p.right]));
  pairSel = null; pairSelEl = null;

  const prompt = $('prompt');
  prompt.className = 'poWrap';
  prompt.innerHTML = '';
  if (phase2) prompt.appendChild(poQuestion());    // ⬆️ + ●●● = which side has MORE (S-06 family)
  const board = document.createElement('div');
  board.className = 'poBoard';
  const lane = document.createElement('div');
  lane.className = 'poLane';
  for (const p of pairs) {
    const le = d.left.find((m) => m.id === p.left);
    const re = d.right.find((m) => m.id === p.right);
    const chip = document.createElement('span');
    chip.className = 'poPair';
    chip.textContent = le.e + '🤝' + re.e;
    lane.appendChild(chip);
  }
  board.append(poCol(d.left, pairedIds, 'left', phase2), lane, poCol(d.right, pairedIds, 'right', phase2));
  prompt.appendChild(board);

  const box = $('choices');
  box.className = phase2 ? 'sides' : '';
  box.innerHTML = '';
  if (phase2) {
    for (const side of ['left', 'right']) {
      const btn = document.createElement('button');
      btn.className = 'choice side';
      const kind = document.createElement('span');
      kind.className = 'sideItem';
      kind.textContent = d[side][0].e;              // the side's kind answers the question
      btn.appendChild(kind);
      btn.addEventListener('click', () => onChoice(side));
      box.appendChild(btn);
    }
  }
}
function poCol(members, pairedIds, side, phase2) {
  const col = document.createElement('div');
  col.className = 'poCol';
  for (const m of members) {
    if (pairedIds.has(m.id)) continue;              // paired members live in the middle lane
    const chip = document.createElement('button');
    chip.className = 'poChip' + (phase2 ? ' leftover' : '');
    chip.textContent = m.e;
    chip.addEventListener('click', () => pairTap(side, m.id, chip));
    col.appendChild(chip);
  }
  return col;
}
function poQuestion() {
  const q = document.createElement('div');
  q.className = 'qbar poQ';
  const arrow = document.createElement('span');
  arrow.textContent = '⬆️';
  const mag = document.createElement('span');
  mag.className = 'qDots';
  mag.textContent = '●●●';
  q.append(arrow, mag);
  return q;
}

/* inputLink (S-24) — the pairing input: a tap on one side selects, a tap on the OTHER side
   joins the pair (any same-side retap just moves the selection). Invalid targets (already
   paired — removed from the board by construction; phase-2 leftovers) never submit. */
function pairTap(side, id, el) {
  if (!session || !$('overlay').hidden) return;
  if (session.stepIndex !== 0) return;              // phase 2: leftovers are not input anymore
  if (pairSel && pairSel.side !== side) {
    const lid = side === 'left' ? id : pairSel.id;
    const rid = side === 'right' ? id : pairSel.id;
    if (pairSelEl) pairSelEl.classList.remove('sel');
    pairSel = null; pairSelEl = null;
    pairSubmit(lid, rid);
    return;
  }
  if (pairSelEl) pairSelEl.classList.remove('sel');
  pairSel = { side, id };
  pairSelEl = el;
  el.classList.add('sel');
}
function pairSubmit(lid, rid) {
  const snap = (session.placed[0] || []).slice();
  snap.push({ left: lid, right: rid });
  const r = K.submit(session, snap);                // silent until the goal completes (J-26)
  if (r.outcome === 'pass') { showOverlay('pass', r.turnAdvanced); return; } // unreachable for pairoff (non-final goal) — future-proof
  renderRound();                                    // phase transition (step) rides stepIndex
}

/* S-11 «เหมือนกันเลย» — find-same: big sample + choice cards (tap the same kind);
   odd-one-out: ❓ + member cards (tap the different one). Both render from display.kind —
   one view, two data shapes (C6); wrong tap → same round stays (J-13). */
function renderSamediff(d) {
  const prompt = $('prompt');
  prompt.className = 'sampleShape';
  prompt.textContent = d.kind === 'samediff-find' ? d.sample : '❓';
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

/* S-12 «เงาใครเอ่ย» — big object prompt + shadow cards. Silhouettes render via the
   CSS-filter fallback now (asset upgrade = art set 1, T-051 — game never blocks on an asset). */
function renderShadow(d) {
  const prompt = $('prompt');
  prompt.className = 'sampleShape';
  prompt.textContent = d.object;
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const c of step.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    const inner = document.createElement('span');
    inner.className = 'sil';
    inner.textContent = c;
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(c));
    box.appendChild(btn);
  }
}

/* S-13 «บน–ล่าง–ใน–นอก» — the scene renders anchors (🪑 table + 📦 box) with each object placed
   by its relation; the question is a wordless pictogram (anchor glyph + orange dot in the queried
   position — C4); choices are the objects themselves (tap the one in that relation). */
function renderPositions(d) {
  const prompt = $('prompt');
  prompt.className = 'posWrap';
  prompt.innerHTML = '';
  prompt.appendChild(posQuestion(d.q, d.anchors));
  const scene = document.createElement('div');
  scene.className = 'posScene';
  const table = document.createElement('div');
  table.className = 'posStack';
  table.appendChild(posRow(d.items, 'on'));
  const a0 = document.createElement('span');
  a0.className = 'posAnchor';
  a0.textContent = d.anchors[0];
  table.appendChild(a0);
  table.appendChild(posRow(d.items, 'under'));
  scene.appendChild(table);
  const boxStack = document.createElement('div');
  boxStack.className = 'posStack';
  const wrap = document.createElement('span');
  wrap.className = 'posBoxWrap';
  const a1 = document.createElement('span');
  a1.className = 'posAnchor';
  a1.textContent = d.anchors[1];
  wrap.appendChild(a1);
  for (const it of d.items.filter((x) => x.rel === 'in')) {
    const s = document.createElement('span');
    s.className = 'posIn';
    s.textContent = it.e;
    wrap.appendChild(s);
  }
  boxStack.appendChild(wrap);
  boxStack.appendChild(posRow(d.items, 'out'));
  scene.appendChild(boxStack);
  prompt.appendChild(scene);
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
function posRow(items, rel) {
  const row = document.createElement('div');
  row.className = 'posRow';
  for (const it of items.filter((x) => x.rel === rel)) {
    const s = document.createElement('span');
    s.textContent = it.e;
    row.appendChild(s);
  }
  return row;
}
function posQuestion(rel, anchors) {
  const q = document.createElement('div');
  q.className = 'qbar posQ';
  const dot = (extra) => {
    const d = document.createElement('span');
    d.className = 'pqDot' + (extra ? ' ' + extra : '');
    return d;
  };
  const glyph = (t) => {
    const g = document.createElement('span');
    g.textContent = t;
    return g;
  };
  if (rel === 'on' || rel === 'under') {
    const st = document.createElement('div');
    st.className = 'pqStack';
    if (rel === 'on') st.append(dot(), glyph(anchors[0]));
    else st.append(glyph(anchors[0]), dot());
    q.appendChild(st);
  } else if (rel === 'in') {
    const w = document.createElement('span');
    w.className = 'pqBoxWrap';
    w.append(glyph(anchors[1]), dot('pqIn'));
    q.appendChild(w);
  } else {
    const row = document.createElement('div');
    row.className = 'pqRow';
    row.append(glyph(anchors[1]), dot());
    q.appendChild(row);
  }
  return q;
}

/* S-14 «ยาว–สั้น» — items as bars on a shared baseline, widths data-scaled by `len` so the eye
   compares instantly; the question is the S-06 pictogram family: arrow + long/short bar glyph. */
function renderLength(d) {
  const prompt = $('prompt');
  prompt.className = 'qbar';
  prompt.innerHTML = '';
  const arrow = document.createElement('span');
  arrow.textContent = '➡️';
  const mag = document.createElement('span');
  mag.className = 'lenGlyph ' + (d.q === 'longer' ? 'long' : 'short');
  prompt.append(arrow, mag);
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = 'lenRows';
  box.innerHTML = '';
  for (const id of step.choices) {
    const it = d.items.find((x) => x.id === id);
    const btn = document.createElement('button');
    btn.className = 'choice lenRow';
    const bar = document.createElement('span');
    bar.className = 'lenBar';
    bar.style.width = (30 + it.len * 12) + 'px'; // data-scaled (S-14)
    btn.appendChild(bar);
    btn.addEventListener('click', () => onChoice(id));
    box.appendChild(btn);
  }
}

/* S-15 «หนัก–เบา» — curated pair/triple as big emoji cards; the question reuses the S-06/S-14
   pictogram family: arrow + big/small dot (⬇️+● heavier · ⬆️+● lighter — no words, C4). */
function renderWeight(d) {
  const prompt = $('prompt');
  prompt.className = 'qbar';
  prompt.innerHTML = '';
  const arrow = document.createElement('span');
  arrow.textContent = d.q === 'heavier' ? '⬇️' : '⬆️';
  const mag = document.createElement('span');
  mag.className = 'qDot ' + (d.q === 'heavier' ? 'big' : 'small');
  mag.textContent = '●';
  prompt.append(arrow, mag);
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const id of step.choices) {
    const it = d.items.find((x) => x.id === id);
    const btn = document.createElement('button');
    btn.className = 'choice';
    const inner = document.createElement('span');
    inner.className = 'gShape';
    inner.textContent = it.e;
    btn.appendChild(inner);
    btn.addEventListener('click', () => onChoice(id));
    box.appendChild(btn);
  }
}

/* S-17 «ครึ่ง–เต็ม» — half picture prompt (the whole clipped along the round's cut orientation —
   clip-path fallback now, art set 3 = T-053) + whole cards; tap the complete thing the half
   belongs to. */
function renderPartWhole(d) {
  const prompt = $('prompt');
  prompt.className = 'sampleShape';
  prompt.innerHTML = '';
  const half = document.createElement('span');
  half.className = 'halfImg cut-' + d.cut;
  half.textContent = d.whole;
  prompt.appendChild(half);
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

/* S-16 «เท่ากันไหม» — sample plate + «=» + choice plates: the equals sign carries the question
   wordlessly (C4 — it is also the concept being taught); every plate is one kind so the child
   compares counts, never appearance (J-18). */
function renderEqualGroups(d) {
  const prompt = $('prompt');
  prompt.className = 'eqWrap';
  prompt.innerHTML = '';
  prompt.appendChild(plateEl(d.sample.emoji, d.sample.n, 'eqSample'));
  const eq = document.createElement('span');
  eq.className = 'eqSign';
  eq.textContent = '=';
  prompt.appendChild(eq);
  const step = session.round.steps[session.stepIndex];
  const box = $('choices');
  box.className = '';
  box.innerHTML = '';
  for (const id of step.choices) {
    const g = d.groups.find((x) => x.id === id);
    const btn = plateEl(g.emoji, g.n, 'choice');
    btn.addEventListener('click', () => onChoice(id));
    box.appendChild(btn);
  }
}
function plateEl(emoji, n, cls) {
  const el = cls === 'choice' ? document.createElement('button') : document.createElement('div');
  el.className = 'plate' + (cls === 'choice' ? ' choice' : ' eqSample');
  for (let i = 0; i < n; i++) {
    const it = document.createElement('span');
    it.className = 'plateItem';
    it.textContent = emoji;
    el.appendChild(it);
  }
  return el;
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
$('backBtn').addEventListener('click', () => {          // S-02 → S-01, no gate (OQ-C)
  const cameFromRoot = document.referrer && !document.referrer.includes('/kids/');
  if (cameFromRoot && history.length > 1) history.back(); // real in-app history from the root menu
  else location.assign('../index.html');                  // direct entry / reload / in-app browser quirk → root menu explicitly (owner report 2026-09-23)
});
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
