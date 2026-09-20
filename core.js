// core.js — PURE game logic: PRNG, question generators, run state machine. No DOM, no I/O.
// Tests (selftest.mjs) exercise exactly these functions — the engine only renders.
(function (global) {
'use strict';

/* ---------- deterministic PRNG (mulberry32) + string seed hash ---------- */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const gcd = (a, b) => b ? gcd(b, a % b) : a;
function pickWeighted(rng, mix) {
  const keys = Object.keys(mix);
  let total = 0; for (const k of keys) total += mix[k];
  let r = rng() * total;
  for (const k of keys) { r -= mix[k]; if (r < 0) return k; }
  return keys[keys.length - 1];
}
function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickDistractors(rng, correct, candidates) {
  // near-miss rule (story.md): distinct, ≠ correct, all ≥ 0; regenerate (retry) handled by caller count
  const uniq = [];
  for (const c of candidates) {
    if (Number.isInteger(c) && c >= 0 && c !== correct && !uniq.includes(c)) uniq.push(c);
    if (uniq.length === 3) break;
  }
  while (uniq.length < 3) {
    const c = correct + (uniq.length + 1) * (rng() < 0.5 ? 1 : -1) - uniq.length;
    if (c >= 0 && c !== correct && !uniq.includes(c)) uniq.push(c); else uniq.push(correct + uniq.length + 4);
  }
  return uniq.slice(0, 3);
}

/* ---------- question generators (recipes from docs/story.md) ---------- */
// Question = { type, prompt, choices, correctIndex, meta:{a,b,answer} }

function buildChoices(rng, correct, candidates) {
  const ds = pickDistractors(rng, correct, candidates);
  const all = shuffle(rng, [correct, ...ds]);
  return { choices: all, correctIndex: all.indexOf(correct) };
}

function genAdd(rng, w) {
  let a, b;
  do { a = randInt(rng, w.addLo, w.addHi); b = randInt(rng, w.addLo, w.addHi); }
  while (w.addMaxResult && a + b > w.addMaxResult);
  const c = a + b;
  const { choices, correctIndex } = buildChoices(rng, c, [c + 1, c - 1, c + 2, c - 2, c + 10, c - 10, (a + 1) + b]);
  return { type: 'add', prompt: `${a} + ${b} = ?`, choices, correctIndex, meta: { a, b, answer: c } };
}
function genSub(rng, w) {
  let a = randInt(rng, w.addLo, w.addHi), b = randInt(rng, w.addLo, w.addHi);
  if (a < b) [a, b] = [b, a]; // a > b always
  if (a === b) a += 1;
  const c = a - b;
  const { choices, correctIndex } = buildChoices(rng, c, [c + 1, c - 1, c + 2, c - 2, c + 10, a - (b - 1), a - (b + 1)]);
  return { type: 'sub', prompt: `${a} − ${b} = ?`, choices, correctIndex, meta: { a, b, answer: c } };
}
function genMul(rng, w) {
  const a = randInt(rng, w.mulLo, w.mulHi), b = randInt(rng, w.mulLo, w.mulHi);
  const c = a * b;
  const { choices, correctIndex } = buildChoices(rng, c, [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, c + a, c - a, c + b]);
  return { type: 'mul', prompt: `${a} × ${b} = ?`, choices, correctIndex, meta: { a, b, answer: c } };
}
function genDiv(rng, w) {
  // exact division only: build from b × c = a
  const b = randInt(rng, w.mulLo, w.mulHi), c = randInt(rng, w.mulLo, w.mulHi);
  const a = b * c;
  const { choices, correctIndex } = buildChoices(rng, c, [c + 1, c - 1, c + 2, c + b, c - b]);
  return { type: 'div', prompt: `${a} ÷ ${b} = ?`, choices, correctIndex, meta: { a, b, answer: c } };
}
function genSeq(rng, w) {
  let terms, next, d, cands;
  if (rng() < w.geoChance) { // geometric ×2 (W4 only)
    const s = randInt(rng, 1, 5);
    terms = [s, s * 2, s * 4, s * 8]; next = s * 16; d = s;
    cands = [next + 1, next - 1, next + 2, next - 2, next + 4];
  } else { // arithmetic
    d = [2, 3, 4, 5, 6, 10][randInt(rng, 0, 5)];
    const s = randInt(rng, 1, 12);
    terms = [s, s + d, s + 2 * d, s + 3 * d]; next = s + 4 * d;
    cands = [next + 1, next - 1, next + d, next - d, next + 2 * d];
  }
  const { choices, correctIndex } = buildChoices(rng, next, cands);
  return { type: 'seq', prompt: `${terms.join(', ')}, ?`, choices, correctIndex, meta: { d, answer: next } };
}
function genCmp(rng, w) {
  // A ⬜ B, small expressions, usually |A−B| ≤ 3 (near-miss by construction)
  const mk = () => {
    const form = randInt(rng, 0, 3);
    if (form === 0) { const n = randInt(rng, 2, 15); return { text: `${n}`, val: n }; }
    if (form === 1) { const a = randInt(rng, 2, 12), b = randInt(rng, 2, 12); return { text: `${a} + ${b}`, val: a + b }; }
    if (form === 2) { const a = randInt(rng, 2, 12), b = randInt(rng, 2, 12); return { text: `${a} × ${b}`, val: a * b }; }
    let a = randInt(rng, 6, 15), b = randInt(rng, 2, 5); return { text: `${a} − ${b}`, val: a - b };
  };
  let A = mk(), B = mk(), tries = 0;
  while (Math.abs(A.val - B.val) > 3 && tries < 20) { A = mk(); B = mk(); tries++; }
  const answer = A.val < B.val ? '<' : A.val > B.val ? '>' : '=';
  const choices = ['<', '=', '>'];
  return { type: 'cmp', prompt: `${A.text} ⬜ ${B.text}`, choices, correctIndex: choices.indexOf(answer), meta: { a: A.val, b: B.val, answer } };
}
function genPct(rng, w) {
  // percent of n — always integer: p% of (k × 100/gcd(p,100)) = k×p×100/gcd /100…
  // n = k × (100/g), answer = p × n / 100 (integer by construction). W4 adds p=75.
  const p = w.pctP[randInt(rng, 0, w.pctP.length - 1)];
  const k = randInt(rng, w.pctKLo, w.pctKHi);
  const n = k * (100 / gcd(p, 100));
  const c = (p * n) / 100;
  const { choices, correctIndex } = buildChoices(rng, c, [c + 1, c - 1, c + 5, c - 5, c + k, c - k, c + 10]);
  return { type: 'pct', prompt: `${p}% ของ ${n} = ?`, choices, correctIndex, meta: { p, n, k, answer: c } };
}
function genOoo(rng, w) {
  // order of operations — W3: a + b × c (precedence trap (a+b)×c); W4: a × b − c × d (sign trap)
  if (w.oooHard) {
    let a, b, c, d, ans;
    do {
      a = randInt(rng, w.mulLo, w.mulHi); b = randInt(rng, w.mulLo, w.mulHi);
      c = randInt(rng, w.mulLo, w.mulHi); d = randInt(rng, w.mulLo, w.mulHi);
      ans = a * b - c * d;
    } while (ans < 0);
    const { choices, correctIndex } = buildChoices(rng, ans, [ans + 1, ans - 1, a * b + c * d, ans + b, ans - d, ans + 5]);
    return { type: 'ooo', prompt: `${a} × ${b} − ${c} × ${d} = ?`, choices, correctIndex, meta: { a, b, c, d, answer: ans } };
  }
  const a = randInt(rng, 2, 20), b = randInt(rng, 2, 9), c = randInt(rng, 2, 9);
  const ans = a + b * c;
  const { choices, correctIndex } = buildChoices(rng, ans, [(a + b) * c, a * b + c, ans + 1, ans - 1, ans + b, ans + c]);
  return { type: 'ooo', prompt: `${a} + ${b} × ${c} = ?`, choices, correctIndex, meta: { a, b, c, answer: ans } };
}

const GENERATORS = { add: genAdd, sub: genSub, mul: genMul, div: genDiv, seq: genSeq, cmp: genCmp, pct: genPct, ooo: genOoo };

function makeQuestion(rng, waveCfg, forcedType) {
  const type = forcedType || pickWeighted(rng, waveCfg.mix);
  return GENERATORS[type](rng, waveCfg);
}

/* ---------- run state machine (System #2 — one transition set) ---------- */
function multiplierFrom(streak) { return Math.min(8, 1 + Math.floor(streak / 5)); }
function waveIndexFor(score, waves) {
  let idx = 0;
  for (let i = 0; i < waves.length; i++) if (score >= waves[i].gate) idx = i;
  return idx;
}
function tierFor(score, tiers) {
  let t = tiers[0];
  for (const tier of tiers) if (score >= tier.min) t = tier;
  return t;
}
function newRun(D) {
  return { bank: D.startBankSec, score: 0, streak: 0, maxStreak: 0, mult: 1, wave: 0,
           correct: 0, wrong: 0, over: false, questionsAsked: 0 };
}
function tick(s, D, dtSec) {
  if (s.over) return;
  s.bank -= dtSec;
  if (s.bank <= 0) { s.bank = 0; s.over = true; }
}
// applyAnswer: correct answers use the wave config in effect BEFORE the answer;
// multiplier rises WITH the new streak (streak 5 → this answer scores ×2).
function applyAnswer(s, D, correct) {
  const events = [];
  const w = D.waves[s.wave];
  if (correct) {
    s.correct += 1; s.streak += 1;
    if (s.streak > s.maxStreak) s.maxStreak = s.streak;
    const newMult = multiplierFrom(s.streak);
    if (newMult > s.mult) { events.push('multup'); }
    s.mult = newMult;
    s.score += D.basePts * (s.wave + 1) * s.mult;
    s.bank = Math.min(D.maxBankSec, s.bank + w.rewardSec);
    if (s.correct % D.milestoneEvery === 0) {
      s.bank = Math.min(D.maxBankSec, s.bank + D.milestoneBonusSec);
      s.score += D.milestoneBonusPts * (s.wave + 1);
      events.push('milestone');
    }
  } else {
    s.wrong += 1; s.streak = 0; s.mult = 1;
    s.bank = Math.max(0, s.bank - D.wrongPenaltySec);
    events.push('wrong');
  }
  const nw = waveIndexFor(s.score, D.waves);
  if (nw > s.wave) {
    s.wave = nw; events.push('waveup');
    s.bank = Math.min(D.maxBankSec, s.bank + (D.waveUpBonusSec || 0)); // เลื่อนชั้น = เติมเวลา (issue #4)
  }
  if (s.bank <= 0) { s.bank = 0; s.over = true; events.push('over'); }
  return events;
}

const Core = { hashSeed, mulberry32, randInt, pickWeighted, makeQuestion, GENERATORS,
              multiplierFrom, waveIndexFor, tierFor, newRun, tick, applyAnswer };

global.EXPRESS_CORE = Core;
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
