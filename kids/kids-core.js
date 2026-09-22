// kids-core.js — PURE kindergarten domain logic (F-03): one pressure-free session core
// (no clock, no score, no win/lose — nothing accumulates) + data-driven round generators.
// No DOM, no I/O, no timers, no storage (TECH-SPEC §1.2 dependency rules).
// PRNG kernel shared with the arcade core.js: only the three exported primitives are
// imported; shuffle is a local pure Fisher–Yates (core.js's shuffle is not exported, NG1).
(function (global) {
'use strict';
const CORE = global.EXPRESS_CORE || require('../core.js');
const { mulberry32, hashSeed, randInt } = CORE;

/* ---------- local pure shuffle (Fisher–Yates over the shared rng) ---------- */
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- round seed chain (keeps Session inside its allowlisted shape: no rng field) ----------
   Each Round carries the seed that generated it; the next round's seed derives from the
   current one, so the whole sequence is a pure function of the initial seed (ST-[10]). */
function nextSeed(seed) {
  const rng = mulberry32((seed ^ 0x5BF03635) >>> 0);
  return 1 + Math.floor(rng() * 2147483646);
}

/* ---------- round generators (F-05…F-10 land as GEN entries — content, never machinery) ---------- */
const GEN = {};

/* F-05 «นับดูสิ» — N objects of one emoji + 2–4 numeral choices, exactly one correct.
   Distractors are distinct in-band values ≠ n (ST-[7]); choices order is shuffled (ST-[10]). */
GEN.count = function (rng, P, pools) {
  const n = randInt(rng, P.rangeLo, P.rangeHi);
  const emojis = pools.count.emojis;
  const emoji = emojis[Math.floor(rng() * emojis.length)];
  const others = [];
  for (let v = P.rangeLo; v <= P.rangeHi; v++) if (v !== n) others.push(v);
  const choices = shuffle(rng, [n, ...shuffle(rng, others).slice(0, P.choiceCount - 1)]);
  return {
    gameId: 'count',
    display: { kind: 'count', emoji, n },
    steps: [{ choices, correctId: n }],
  };
};

/* F-06 «จับคู่เหมือนกัน» — numeral ⇄ dots matching. Direction is round data (alternates),
   distractors are distinct values ≠ prompt value (ST-[7]). */
GEN.match = function (rng, P) {
  const value = randInt(rng, P.rangeLo, P.rangeHi);
  const direction = rng() < 0.5 ? 'toDots' : 'toNum';
  const others = [];
  for (let v = P.rangeLo; v <= P.rangeHi; v++) if (v !== value) others.push(v);
  const choices = shuffle(rng, [value, ...shuffle(rng, others).slice(0, P.cardCount - 1)]);
  return {
    gameId: 'match',
    display: { kind: 'match', direction, value },
    steps: [{ choices, correctId: value }],
  };
};

/* F-07 «ข้างไหนมากกว่า» — two variants in ONE generator (variant is display.kind data, C6):
   groups (n items per side, |L−R| ≥ minGap) / single (one item at two sizes, ratio ≥ sizeRatio).
   Question asked by icon+arrow in the view — the round only carries q. */
GEN.compare = function (rng, P, pools) {
  const isGroups = rng() < 0.5;
  if (isGroups) {
    const gi = pools.compare.groupItems;
    const item = gi[Math.floor(rng() * gi.length)];
    let a = randInt(rng, 1, P.groupMax), b = randInt(rng, 1, P.groupMax), tries = 0;
    while (Math.abs(a - b) < P.minGap && tries < 64) { a = randInt(rng, 1, P.groupMax); b = randInt(rng, 1, P.groupMax); tries++; }
    if (Math.abs(a - b) < P.minGap) { a = P.groupMax; b = 1; } // deterministic fallback (minGap ≤ groupMax−1)
    const swap = rng() < 0.5;
    const L = swap ? b : a, R = swap ? a : b;
    const more = rng() < 0.5;
    const correctId = more === (L > R) ? 'left' : 'right';
    return {
      gameId: 'compare',
      display: { kind: 'compare-groups', q: more ? 'more' : 'less', item, left: { n: L }, right: { n: R } },
      steps: [{ choices: ['left', 'right'], correctId }],
    };
  }
  const si = pools.compare.singleItems;
  const item = si[Math.floor(rng() * si.length)];
  const small = randInt(rng, 2, 6);
  const big = Math.max(small + 1, Math.ceil(small * P.sizeRatio)); // ceil keeps ratio ≥ sizeRatio (ST-[7])
  const swap = rng() < 0.5;
  const L = swap ? small : big, R = swap ? big : small;
  const bigger = rng() < 0.5;
  const correctId = bigger === (L > R) ? 'left' : 'right';
  return {
    gameId: 'compare',
    display: { kind: 'compare-single', q: bigger ? 'bigger' : 'smaller', item, left: { size: L }, right: { size: R } },
    steps: [{ choices: ['left', 'right'], correctId }],
  };
};

/* F-08 «รูปทรงน่ารัก» — two round kinds in ONE generator (C6): shape-match (find the
   identical shape) / pattern (fill the next element of a pure cycle). Band grows
   pattern length + element kinds. */
GEN.shapes = function (rng, P, pools) {
  const all = pools.shapes.shapes;
  if (rng() < 0.5) {
    const sample = all[Math.floor(rng() * all.length)];
    const others = all.filter((s) => s !== sample);
    const choices = shuffle(rng, [sample, ...shuffle(rng, others).slice(0, P.choiceCount - 1)]);
    return {
      gameId: 'shapes',
      display: { kind: 'shape-match', shape: sample },
      steps: [{ choices, correctId: sample }],
    };
  }
  const kinds = shuffle(rng, all.slice()).slice(0, P.kindsCount);
  const len = randInt(rng, P.patternLenMin, P.patternLenMax);
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(kinds[i % kinds.length]);
  const next = kinds[len % kinds.length];
  const others = all.filter((s) => s !== next);
  const choices = shuffle(rng, [next, ...shuffle(rng, others).slice(0, P.choiceCount - 1)]);
  return {
    gameId: 'shapes',
    display: { kind: 'pattern', seq },
    steps: [{ choices, correctId: next }],
  };
};

/* ---------- band resolution (F-11 — params only, C6) ---------- */
function bandParams(data, gameId, bandId) {
  const band = data.bands.find((b) => b.id === bandId);
  if (!band) throw new Error('kids-core: unknown band "' + bandId + '"');
  const params = band.params[gameId];
  if (!params) throw new Error('kids-core: no band params for "' + gameId + '"/"' + bandId + '"');
  return params;
}

function makeRound(gameId, bandId, seed, data) {
  const gen = GEN[gameId];
  if (!gen) throw new Error('kids-core: no generator for "' + gameId + '"');
  const round = gen(mulberry32(seed), bandParams(data, gameId, bandId), data.pools);
  round.seed = seed;
  return round;
}

/* ---------- Session (F-03) — allowlisted shape, in-memory only ----------
   { gameId, bandId, players, turn, round, stepIndex, placed }
   No phase field: submit()'s outcome ('step'|'pass'|'retry') is the only cartoon authority. */
function newSession(gameId, bandId, players, seed, data) {
  data = data || global.EXPRESS_KIDS_DATA;
  return {
    gameId, bandId,
    players: players === 2 ? 2 : 1,
    turn: 0,
    round: makeRound(gameId, bandId, seed, data),
    stepIndex: 0,
    placed: [],
  };
}

/* ---------- submit — the whole game loop ----------
   correct + non-final step → 'step'  (placed grows; no cartoon)
   correct + final step   → 'pass'   (new round; turn flips iff players===2)
   wrong                  → 'retry'  (round, stepIndex, placed all unchanged — same child retries) */
function submit(s, choiceId, data) {
  data = data || global.EXPRESS_KIDS_DATA;
  const step = s.round.steps[s.stepIndex];
  if (choiceId !== step.correctId) {
    return { outcome: 'retry', roundChanged: false, turnAdvanced: false };
  }
  s.placed.push(choiceId);
  if (s.stepIndex + 1 < s.round.steps.length) {
    s.stepIndex += 1;
    return { outcome: 'step', roundChanged: false, turnAdvanced: false };
  }
  const oldSeed = s.round.seed;
  s.round = makeRound(s.gameId, s.bandId, nextSeed(oldSeed), data);
  s.stepIndex = 0;
  s.placed = [];
  let turnAdvanced = false;
  if (s.players === 2) { s.turn = 1 - s.turn; turnAdvanced = true; }
  return { outcome: 'pass', roundChanged: true, turnAdvanced };
}

const KidsCore = { newSession, submit, GEN, bandParams, shuffle, nextSeed };
global.EXPRESS_KIDS_CORE = KidsCore;
if (typeof module !== 'undefined' && module.exports) module.exports = KidsCore;
})(typeof window !== 'undefined' ? window : globalThis);
