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
