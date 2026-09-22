// selftest.mjs — zero-dependency Node checker. Run: node web/selftest.mjs
// Adapted from game-build-kit's graph walker for an arcade game:
// instead of storylet/ending reachability we prove GENERATOR invariants,
// daily-seed determinism, and TIER reachability + run-length bands via simulation.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DATA } = require('./data.js');
const Core = require('./core.js');

let pass = 0, fail = 0, warn = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ FAIL: ${label} ${extra}`); }
};

/* ---------- 1. generator invariants ---------- */
console.log('\n[1] Generator invariants (2,000 questions per wave)');
const N = 2000;
for (let w = 0; w < DATA.waves.length; w++) {
  const rng = Core.mulberry32(1000 + w);
  const cfg = DATA.waves[w];
  let bad = 0;
  for (let i = 0; i < N; i++) {
    const q = Core.makeQuestion(rng, cfg);
    if (q.type === 'cmp') {
      if (q.choices.length !== 3 || new Set(q.choices).size !== 3) bad++;
      const expect = q.meta.a < q.meta.b ? '<' : q.meta.a > q.meta.b ? '>' : '=';
      if (q.choices[q.correctIndex] !== expect) bad++;
    } else {
      if (q.choices.length !== 4 || new Set(q.choices).size !== 4) bad++;
      if (!q.choices.every((c) => Number.isInteger(c) && c >= 0)) bad++;
      if (q.choices[q.correctIndex] !== q.meta.answer) bad++;
      if (q.type === 'div' && (q.meta.a % q.meta.b !== 0 || q.meta.answer !== q.meta.a / q.meta.b)) bad++;
      if (q.type === 'add' && cfg.addMaxResult && q.meta.answer > cfg.addMaxResult) bad++;
      if (q.type === 'pct' && ((q.meta.p * q.meta.n) % 100 !== 0 || q.meta.answer !== (q.meta.p * q.meta.n) / 100)) bad++;
      if (q.type === 'ooo') {
        const m = q.meta;
        const expect = m.d !== undefined ? m.a * m.b - m.c * m.d : m.a + m.b * m.c;
        if (m.answer !== expect || expect < 0) bad++;
      }
    }
    if (q.prompt.includes('NaN') || q.prompt.includes('undefined')) bad++;
  }
  ok(bad === 0, `wave ${w + 1} (${cfg.name}): 0 invariant violations over ${N}`, `(${bad} bad)`);
}

/* ---------- 2. daily-seed determinism ---------- */
console.log('\n[2] Determinism: same seed → identical question sequence');
{
  const run = (seed) => {
    const rng = Core.mulberry32(seed);
    const out = [];
    let s = Core.newRun(DATA);
    for (let i = 0; i < 100 && !s.over; i++) {
      const q = Core.makeQuestion(rng, DATA.waves[s.wave]);
      out.push(q.prompt + '|' + q.choices.join(','));
      Core.applyAnswer(s, DATA, rng() < 0.9);
    }
    return out;
  };
  const a = run(Core.hashSeed('express-math:2026-09-18'));
  const b = run(Core.hashSeed('express-math:2026-09-18'));
  const c = run(Core.hashSeed('express-math:2026-09-19'));
  ok(JSON.stringify(a) === JSON.stringify(b), 'same date seed → identical sequence');
  ok(JSON.stringify(a) !== JSON.stringify(c) || a.length < 100, 'different date seed → different sequence');
}

/* ---------- 3. multiplier math ---------- */
console.log('\n[3] Multiplier: 1 + floor(streak/5), cap 8; reset on wrong');
{
  ok(Core.multiplierFrom(0) === 1 && Core.multiplierFrom(4) === 1, 'streak 0–4 → ×1');
  ok(Core.multiplierFrom(5) === 2 && Core.multiplierFrom(9) === 2, 'streak 5–9 → ×2');
  ok(Core.multiplierFrom(35) === 8 && Core.multiplierFrom(999) === 8, 'capped at ×8');
  const s = Core.newRun(DATA);
  for (let i = 0; i < 7; i++) Core.applyAnswer(s, DATA, true);
  Core.applyAnswer(s, DATA, false);
  ok(s.streak === 0 && s.mult === 1, 'wrong answer resets streak + multiplier');
  ok(s.bank === Math.max(0, Math.min(DATA.maxBankSec, DATA.startBankSec + 7 * DATA.waves[0].rewardSec) - DATA.wrongPenaltySec), 'bank math: rewards (capped) then −5 penalty');
}

/* ---------- 3b. level-up bonus (เลื่อนชั้น +8 วิ, capped) ---------- */
console.log('\n[3b] Level-up bonus: crossing a gate grants waveUpBonusSec, capped at maxBankSec');
{
  const s = Core.newRun(DATA);
  s.score = DATA.waves[1].gate - 10; s.wave = 0; // one correct answer will cross the gate
  const before = s.bank;
  const events = Core.applyAnswer(s, DATA, true);
  ok(events.includes('waveup'), 'crossing gate 150 fires waveup');
  ok(s.wave === 1, 'wave advances to ม.ต้น');
  ok(s.bank === Math.min(DATA.maxBankSec, before + DATA.waves[0].rewardSec + DATA.waveUpBonusSec), 'bank += reward + level-up bonus (capped)');
}

/* ---------- 4. simulation: tier reachability + run-length bands ---------- */
console.log('\n[4] Player simulations (300 seeds each) — time models reflect school-level difficulty');
const MODELS = [
  { name: 'weak   (acc .60)',            acc: 0.60, base: 5.0, perWave: 0.8 },
  { name: 'mid    (acc .85, ~4.2s ป.ถม → ~12s มหาลัย)', acc: 0.85, base: 4.2, perWave: 2.6 },
  { name: 'strong (acc .97, ~3.0s ป.ถม → ~13s มหาลัย)', acc: 0.97, base: 3.0, perWave: 3.0 },
];
function simulate(model, seed) {
  const rng = Core.mulberry32(seed);
  const s = Core.newRun(DATA);
  let t = 0;
  while (!s.over) {
    const elapsed = model.base + s.wave * model.perWave + rng() * 1.5;
    Core.tick(s, DATA, elapsed);
    if (s.over) break;
    Core.applyAnswer(s, DATA, rng() < model.acc);
    t += elapsed;
  }
  return { t, score: s.score, wave: s.wave, tier: DATA.tiers.indexOf(Core.tierFor(s.score, DATA.tiers)) };
}
const results = {};
const med = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
for (const m of MODELS) {
  const runs = [];
  for (let i = 0; i < 300; i++) runs.push(simulate(m, 7919 * i + 13));
  results[m.name] = runs;
  const ts = runs.map((r) => r.t);
  console.log(`  · ${m.name}: median run ${med(ts).toFixed(0)}s · scores ${Math.min(...runs.map(r => r.score))}–${Math.max(...runs.map(r => r.score))} · best level ${Math.max(...runs.map(r => r.wave)) + 1}/4`);
  ok(Math.max(...ts) <= 200, `${m.name}: no run exceeds 200s (max ${Math.max(...ts).toFixed(0)}s)`);
}
ok(med(results[MODELS[0].name].map(r => r.t)) >= 40, 'weak model survives ≥ 40s (median — precedent: weak may end below band, scope band is for typical runs)');
ok(med(results[MODELS[1].name].map(r => r.t)) >= 90 && med(results[MODELS[1].name].map(r => r.t)) <= 180, 'mid model median in [90,180]s');
ok(med(results[MODELS[2].name].map(r => r.t)) >= 90 && med(results[MODELS[2].name].map(r => r.t)) <= 180, 'strong model median in [90,180]s');
{
  const all = Object.values(results).flat();
  for (let ti = 0; ti < DATA.tiers.length; ti++) {
    ok(all.some((r) => r.tier === ti), `tier T${ti + 1} (${DATA.tiers[ti].name}) reached by some simulated player`);
  }
  ok(results[MODELS[2].name].some((r) => r.wave === 3), 'strong model reaches มหาลัย (gate 1,200)');
  ok(results[MODELS[0].name].every((r) => r.tier <= 1), 'weak model never exceeds T2 (no fake achievement)');
}

/* ---------- 4b. rising time graph (issue #4 contract) ---------- */
console.log('\n[4b] Time graph rises with difficulty (rewardSec strictly increasing across levels)');
{
  const rs = DATA.waves.map((w) => w.rewardSec);
  ok(rs[0] < rs[1] && rs[1] < rs[2] && rs[2] < rs[3], `rewards rise ป.ถม→มหาลัย (${rs.join(' < ')})`);
  ok(DATA.waveUpBonusSec > 0, `level-up grants +${DATA.waveUpBonusSec}s`);
}

/* ---------- 5. budgets (scope contract) ---------- */
console.log('\n[5] Budgets (docs/scope.md)');
{
  const tokens = [];
  const collect = (o) => { for (const v of Object.values(o)) typeof v === 'string' ? tokens.push(...v.split(/\s+/).filter(Boolean)) : collect(v); };
  collect(DATA.copy);
  for (const w of DATA.waves) tokens.push(...w.name.split(/\s+/));
  for (const t of DATA.tiers) tokens.push(...t.name.split(/\s+/));
  ok(tokens.length <= 60, `UI copy ≤ 60 words (${tokens.length})`);
  ok(DATA.beepCount <= 4, `beeps ≤ 4 (${DATA.beepCount})`);
  ok(DATA.waves.length === 4, 'exactly 4 levels (scope)');
  ok(Object.keys(Core.GENERATORS).length === 8, '8 question types (scope, issue #4)');
  ok(DATA.tiers.length === 5, '5 result tiers');
}

/* ---------- 6. registry completeness (kids ST-[6]) ---------- */
console.log('\n[6] Registry completeness (kids)');
{
  const { KIDS } = require('./kids/kids-data.js');
  const KC = require('./kids/kids-core.js');
  ok(KIDS.bands.length >= 2, '≥ 2 bands ship (F-11)');
  const genKeys = new Set(Object.keys(KC.GEN));
  for (const g of KIDS.games) {
    ok(genKeys.has(g.id), `registry «${g.id}» ↔ GEN key`);
    genKeys.delete(g.id);
    for (const b of KIDS.bands) {
      ok(!!b.params[g.id] && typeof b.params[g.id] === 'object', `«${g.id}» has params row in band «${b.id}»`);
    }
  }
  ok(genKeys.size === 0, `no orphan GEN keys (${[...genKeys].join(', ') || 'none'})`);
}

/* ---------- 7. generator invariants — 2,000 rounds per game per band (kids ST-[7]) ---------- */
console.log('\n[7] Generator invariants (kids — 2,000 rounds/game/band)');
{
  const { KIDS } = require('./kids/kids-data.js');
  const KC = require('./kids/kids-core.js');
  const N7 = 2000;

  // sort pair data invariants (owner feedback 2026-09-22 — bin icon must be a category
  // marker a kid can decode: never duplicates a member emoji; pools partition cleanly)
  for (const pair of KIDS.pools.sort.pairs) {
    const [a, b] = pair.bins.map((x) => x.id);
    const A = pair.members[a], B = pair.members[b];
    ok(A.length > 0 && B.length > 0, `sort pair ${a}/${b}: both member pools non-empty`);
    ok(A.filter((e) => B.includes(e)).length === 0, `sort pair ${a}/${b}: member pools disjoint`);
    for (const bin of pair.bins) ok(!A.concat(B).includes(bin.icon), `sort bin ${bin.id}: icon ${bin.icon} is not a member emoji`);
  }
  // per-game invariant predicates (return a reason string on violation, null when clean)
  const INVARIANTS = {
    count(r, P) {
      if (r.display.kind !== 'count') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      if (r.display.n < P.rangeLo || r.display.n > P.rangeHi) return 'n out of band';
      const st = r.steps[0];
      if (st.correctId !== r.display.n) return 'correctId≠n';
      if (st.choices.length !== P.choiceCount) return 'choiceCount';
      if (!st.choices.every((c) => Number.isInteger(c) && c >= P.rangeLo && c <= P.rangeHi)) return 'out-of-band choice';
      return null;
    },
    match(r, P) {
      if (r.display.kind !== 'match') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display;
      if (d.direction !== 'toDots' && d.direction !== 'toNum') return 'direction';
      if (d.value < P.rangeLo || d.value > P.rangeHi) return 'value out of band';
      const st = r.steps[0];
      if (st.correctId !== d.value) return 'correctId≠value';
      if (st.choices.length !== P.cardCount) return 'cardCount';
      if (!st.choices.every((c) => Number.isInteger(c) && c >= P.rangeLo && c <= P.rangeHi)) return 'out-of-band choice';
      return null;
    },
    compare(r, P) {
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display, st = r.steps[0];
      if (JSON.stringify(st.choices) !== JSON.stringify(['left', 'right'])) return 'choices';
      if (d.kind === 'compare-groups') {
        if (!['more', 'less'].includes(d.q)) return 'q';
        if (d.left.n < 1 || d.left.n > P.groupMax || d.right.n < 1 || d.right.n > P.groupMax) return 'n range';
        if (Math.abs(d.left.n - d.right.n) < P.minGap) return 'minGap';
        const expect = d.q === 'more' ? (d.left.n > d.right.n ? 'left' : 'right') : (d.left.n < d.right.n ? 'left' : 'right');
        if (st.correctId !== expect) return 'correct side';
        return null;
      }
      if (d.kind === 'compare-single') {
        if (!['bigger', 'smaller'].includes(d.q)) return 'q';
        const hi = Math.max(d.left.size, d.right.size), lo = Math.min(d.left.size, d.right.size);
        if (hi / lo < P.sizeRatio) return 'size ratio';
        const expect = d.q === 'bigger' ? (d.left.size > d.right.size ? 'left' : 'right') : (d.left.size < d.right.size ? 'left' : 'right');
        if (st.correctId !== expect) return 'correct side';
        return null;
      }
      return 'kind';
    },
    shapes(r, P) {
      if (r.steps.length !== 1) return 'steps≠1';
      const st = r.steps[0];
      if (st.choices.length !== P.choiceCount) return 'choiceCount';
      if (r.display.kind === 'shape-match') {
        if (st.correctId !== r.display.shape) return 'correct≠sample';
        return null;
      }
      if (r.display.kind === 'pattern') {
        const seq = r.display.seq, k = P.kindsCount;
        if (seq.length < P.patternLenMin || seq.length > P.patternLenMax) return 'len';
        if (new Set(seq).size !== k) return 'distinct kinds';
        for (let i = k; i < seq.length; i++) if (seq[i] !== seq[i - k]) return 'periodicity';
        if (st.correctId !== seq[seq.length - k]) return 'next≠period';
        return null;
      }
      return 'kind';
    },
    order(r, P) {
      const d = r.display;
      if (d.kind !== 'order') return 'kind';
      if (d.items.length < P.itemCountMin || d.items.length > P.itemCountMax) return 'count';
      if (new Set(d.items.map((it) => it.size)).size !== d.items.length) return 'size ties (one valid ordering)';
      if (r.steps.length !== d.items.length) return 'steps≠items';
      const sorted = d.items.slice().sort((a, b) => a.size - b.size);
      for (let i = 0; i < r.steps.length; i++) {
        const st = r.steps[i];
        const remaining = sorted.slice(i).map((it) => it.id).sort();
        if (JSON.stringify(st.choices.slice().sort()) !== JSON.stringify(remaining)) return 'step choices';
        if (st.correctId !== sorted[i].id) return 'step correct';
      }
      return null;
    },
    sort(r, P) {
      const d = r.display;
      if (d.kind !== 'sort') return 'kind';
      const binIds = d.bins.map((b) => b.id).sort();
      if (binIds.length !== 2 || new Set(binIds).size !== 2) return 'bins';
      if (d.items.length < P.itemCountMin || d.items.length > P.itemCountMax) return 'count';
      if (new Set(d.items.map((it) => it.emoji)).size !== d.items.length) return 'dup items';
      const perBin = {};
      for (const it of d.items) {
        if (!binIds.includes(it.bin)) return 'item bin invalid (partition)';
        perBin[it.bin] = (perBin[it.bin] || 0) + 1;
      }
      if (Object.keys(perBin).length !== 2) return 'empty bin';
      if (r.steps.length !== d.items.length) return 'steps≠items';
      for (let i = 0; i < r.steps.length; i++) {
        if (JSON.stringify(r.steps[i].choices.slice().sort()) !== JSON.stringify(binIds)) return 'step choices';
        if (r.steps[i].correctId !== d.items[i].bin) return 'step correct';
      }
      return null;
    },
  };
  for (const g of KIDS.games) {
    const gen = KC.GEN[g.id];
    ok(typeof gen === 'function', `${g.id}: generator exists`);
    if (typeof gen !== 'function') continue;
    for (const b of KIDS.bands) {
      const P = KC.bandParams(KIDS, g.id, b.id);
      const rng = Core.mulberry32(Core.hashSeed(`kids:${g.id}:${b.id}`));
      let bad = 0; const why = new Set(); const dirs = new Set(); const seenKinds = new Set();
      for (let i = 0; i < N7; i++) {
        const r = gen(rng, P, KIDS.pools);
        if (r.display && r.display.direction) dirs.add(r.display.direction);
        if (r.display && typeof r.display.kind === 'string') seenKinds.add(r.display.kind);
        if (r.steps.length < 1) { bad++; why.add('no steps'); }
        for (const st of r.steps) {
          if (new Set(st.choices).size !== st.choices.length) { bad++; why.add('dup choice'); }
          if (st.choices.filter((c) => c === st.correctId).length !== 1) { bad++; why.add('correct≠1'); }
        }
        const j = JSON.stringify(r.display);
        if (j.includes('undefined') || j.includes('NaN')) { bad++; why.add('NaN/undefined display'); }
        const reason = INVARIANTS[g.id] && INVARIANTS[g.id](r, P);
        if (reason) { bad++; why.add(reason); }
      }
      ok(bad === 0, `${g.id}/${b.id}: 0 violations over ${N7} rounds ${why.size ? '(' + [...why].join('; ') + ')' : ''}`);
      if (g.id === 'match') ok(dirs.size === 2, `${g.id}/${b.id}: both directions occur over ${N7} rounds (J-04)`);
      if (g.id === 'compare') ok(seenKinds.size === 2, `${g.id}/${b.id}: both variants occur over ${N7} rounds (J-05)`);
      if (g.id === 'shapes') ok(seenKinds.size === 2, `${g.id}/${b.id}: both round kinds occur over ${N7} rounds (J-06)`);
    }
  }
}

/* ---------- 8. F-03 session contract (kindergarten core, ST-[8] a–e) ---------- */
console.log('\n[8] F-03 session contract (kids core)');
{
  const KC = require('./kids/kids-core.js');
  // Synthetic 2-step fixture generator + fixture data — proves the submit machinery
  // generator-agnostically (DEV-PLAN T-004); deleted again before ST-[6] runs.
  const fxData = { games: [{ id: 'fx' }], bands: [{ id: 'fxb', params: { fx: {} } }], pools: {} };
  let fxN = 0;
  KC.GEN.fx = function () {
    fxN += 1;
    return { gameId: 'fx', display: { kind: 'fx', n: fxN },
             steps: [{ choices: ['a', 'b'], correctId: 'a' }, { choices: ['c', 'd'], correctId: 'c' }] };
  };
  const roundJson = (s) => JSON.stringify(s.round);

  // (a) 50 consecutive wrong submits → always retry; round identical, placed unchanged; still usable
  {
    const s = KC.newSession('fx', 'fxb', 1, 101, fxData);
    const before = roundJson(s);
    let allRetry = true;
    for (let i = 0; i < 50; i++) {
      const r = KC.submit(s, 'b', fxData);
      if (r.outcome !== 'retry' || r.roundChanged || r.turnAdvanced) allRetry = false;
    }
    ok(allRetry, '(a) 50 wrong submits → outcome always retry, no round/turn change');
    ok(roundJson(s) === before && s.stepIndex === 0 && s.placed.length === 0, '(a) round JSON identical, stepIndex/placed untouched');
    ok(KC.submit(s, 'a', fxData).outcome === 'step', '(a) session still usable after 50 wrong (unlimited retry)');
  }

  // (b) correct at final step → pass, roundChanged, new round ≠ old
  {
    const s = KC.newSession('fx', 'fxb', 1, 202, fxData);
    const old = roundJson(s);
    KC.submit(s, 'a', fxData);
    const r = KC.submit(s, 'c', fxData);
    ok(r.outcome === 'pass' && r.roundChanged && !r.turnAdvanced, '(b) final-step correct → pass + roundChanged, no turn flip solo');
    ok(roundJson(s) !== old, '(b) new round differs from old');
  }

  // (c) multi-step: mid-step correct → step + placed grows; wrong mid-pick → retry KEEPING placed
  {
    const s = KC.newSession('fx', 'fxb', 1, 303, fxData);
    const r1 = KC.submit(s, 'a', fxData);
    ok(r1.outcome === 'step' && s.placed.join('') === 'a' && s.stepIndex === 1, '(c) mid-step correct → step, placed grows, no pass');
    const r2 = KC.submit(s, 'd', fxData);
    ok(r2.outcome === 'retry' && s.placed.join('') === 'a' && s.stepIndex === 1, '(c) wrong mid-pick → retry keeping placed (J-07)');
    ok(KC.submit(s, 'c', fxData).outcome === 'pass', '(c) recovers from mid-retry to pass');
  }

  // (d) co-play: turn flips ONLY on pass
  {
    const s = KC.newSession('fx', 'fxb', 2, 404, fxData);
    KC.submit(s, 'b', fxData); KC.submit(s, 'b', fxData);
    ok(s.turn === 0, '(d) wrong submits never advance turn');
    KC.submit(s, 'a', fxData);
    const p2 = KC.submit(s, 'c', fxData);
    ok(p2.outcome === 'pass' && p2.turnAdvanced && s.turn === 1, '(d) turn advances on pass (2-player)');
    KC.submit(s, 'b', fxData);
    ok(s.turn === 1, '(d) retry keeps the same player');
    KC.submit(s, 'a', fxData);
    const p4 = KC.submit(s, 'c', fxData);
    ok(p4.turnAdvanced && s.turn === 0, '(d) turn alternates back');
  }

  // (e) state-shape allowlist — deep key scan; no accumulation keys, no function values
  {
    const s = KC.newSession('fx', 'fxb', 2, 505, fxData);
    KC.submit(s, 'a', fxData); // mid-step state
    const allowed = ['gameId', 'bandId', 'players', 'turn', 'round', 'stepIndex', 'placed'];
    ok(Object.keys(s).every((k) => allowed.includes(k)), '(e) session keys ⊆ allowlist');
    const FORBIDDEN = ['score', 'streak', 'timer', 'bank', 'time', 'lives', 'attempts', 'tries', 'best', 'total', 'stars', 'unlocked', 'phase', 'points', 'correct', 'wrong', 'delay', 'elapsed', 'counter'];
    const seen = new Set();
    (function walk(o) {
      for (const [k, v] of Object.entries(o)) {
        seen.add(k);
        if (typeof v === 'function') seen.add('§fn');
        else if (v && typeof v === 'object') walk(v);
      }
    })(s);
    const hits = [...seen].filter((k) => FORBIDDEN.includes(k.toLowerCase()));
    ok(hits.length === 0, '(e) no accumulation keys anywhere in session graph');
    ok(!seen.has('§fn'), '(e) no function values (no tick/clock)');
    ok(Object.keys(s.round).every((k) => ['gameId', 'seed', 'display', 'steps'].includes(k)), '(e) round keys ⊆ {gameId,seed,display,steps}');
  }

  // (c-real) multi-step on a REAL generator (order): placed never wiped on wrong mid-pick (J-07)
  {
    const s = KC.newSession('order', 'littles', 1, 606);
    const st1 = s.round.steps[0];
    const r1 = KC.submit(s, st1.correctId);
    ok(r1.outcome === 'step' && s.placed.length === 1, '(c-real) order: correct pick → step + placed grows');
    const cur = s.round.steps[s.stepIndex];
    const wrong = cur.choices.find((c) => c !== cur.correctId);
    const r2 = KC.submit(s, wrong);
    ok(r2.outcome === 'retry' && s.placed.length === 1 && s.stepIndex === 1, '(c-real) order: wrong mid-pick → retry KEEPING placed (J-07)');
    let passed = false, guard = 0;
    while (!passed && guard++ < 20) {
      if (KC.submit(s, s.round.steps[s.stepIndex].correctId).outcome === 'pass') passed = true;
    }
    ok(passed && s.stepIndex === 0 && s.placed.length === 0, '(c-real) order: completes to pass; fresh round resets placed');
  }

  delete KC.GEN.fx; // fixture never leaks into registry parity (ST-[6])
  ok(!('fx' in KC.GEN), 'fixture generator cleaned up');
}

/* ---------- 9. budgets & hygiene (kindergarten mode) ---------- */
console.log('\n[9] Budgets & hygiene (kids mode · TECH-SPEC §6.5)');
{
  // root arcade copy — live counter: 46 @ e8961ff + menu.kids «อนุบาล» = 47 ≤ 60 (C3 [PS-0005])
  const tokens = [];
  const collect = (o) => { for (const v of Object.values(o)) typeof v === 'string' ? tokens.push(...v.split(/\s+/).filter(Boolean)) : collect(v); };
  collect(DATA.copy);
  for (const w of DATA.waves) tokens.push(...w.name.split(/\s+/));
  for (const t of DATA.tiers) tokens.push(...t.name.split(/\s+/));
  ok(tokens.length === 47, `root copy live counter = 47 (46 + menu.kids «อนุบาล»)`);
  ok(tokens.length <= 60, `root copy ≤ 60 words (${tokens.length})`);

  // kids copy ≤ 40 words (C4-derived guard): game captions + band labels + KIDS.copy
  const { KIDS } = require('./kids/kids-data.js');
  const kidsTokens = [];
  for (const g of KIDS.games) kidsTokens.push(...g.caption.split(/\s+/).filter(Boolean));
  for (const b of KIDS.bands) kidsTokens.push(...b.label.split(/\s+/).filter(Boolean));
  (function collect(o) { for (const v of Object.values(o)) typeof v === 'string' ? kidsTokens.push(...v.split(/\s+/).filter(Boolean)) : collect(v); })(KIDS.copy);
  ok(kidsTokens.length <= 40, `kids copy ≤ 40 words (${kidsTokens.length})`);

  // kids/*.js hygiene: no storage, no network, no clock (NG2/NG3 + timer split — setInterval banned forever)
  const fs = require('node:fs'); const path = require('node:path');
  const kidsDir = path.join(path.dirname(process.argv[1]), 'kids');
  const FORBIDDEN = ['localStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'setInterval'];
  const hits = [];
  for (const f of fs.readdirSync(kidsDir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(kidsDir, f), 'utf8');
    for (const tok of FORBIDDEN) if (src.includes(tok)) hits.push(f + ':' + tok);
  }
  ok(hits.length === 0, `kids/*.js free of storage/network/clock tokens ${hits.length ? '(' + hits.join(', ') + ')' : ''}`);

  // every renderer that rebuilds #choices must clear it first (bug class: renderMatch
  // forgot the clear and choices accumulated every round — owner report 2026-09-22)
  const engSrc = fs.readFileSync(path.join(kidsDir, 'kids-engine.js'), 'utf8');
  const noClear = [];
  let fn = null, usesChoices = false, clearsBox = false;
  for (const line of engSrc.split('\n').concat('function __end__() {')) {
    const m = line.match(/^function (\w+)/);
    if (m) {
      if (fn && usesChoices && !clearsBox) noClear.push(fn);
      fn = m[1]; usesChoices = false; clearsBox = false;
    }
    if (/\$\('choices'\)/.test(line)) usesChoices = true;
    if (/box\.innerHTML = ''/.test(line)) clearsBox = true;
  }
  ok(noClear.length === 0, `renderers clear #choices before rebuild ${noClear.length ? '(' + noClear.join(', ') + ' missing)' : '(all clear)'}`);

  // docs/kids.md ↔ kids-data.js sync (docs-first editing rule, TECH-SPEC §2.2)
  const docs = fs.readFileSync(path.join(path.dirname(process.argv[1]), 'docs', 'kids.md'), 'utf8');
  const need = [];
  for (const g of KIDS.games) need.push(g.id, g.caption);
  for (const b of KIDS.bands) need.push(b.id, b.label);
  (function collect(o) { for (const v of Object.values(o)) typeof v === 'string' ? need.push(v) : collect(v); })(KIDS.copy);
  const missDocs = [...new Set(need.filter((s) => !docs.includes(s)))];
  ok(missDocs.length === 0, `docs/kids.md ↔ kids-data.js in sync ${missDocs.length ? '(missing: ' + missDocs.join(', ') + ')' : ''}`);
  const readme = fs.readFileSync(path.join(path.dirname(process.argv[1]), 'README.md'), 'utf8');
  ok(readme.includes('docs/kids.md'), 'README.md points at docs/kids.md');
}

/* ---------- 10. determinism (kids core + local shuffle, ST-[10]) ---------- */
console.log('\n[10] Determinism (kids core)');
{
  const KC = require('./kids/kids-core.js');
  // local shuffle: pure + deterministic
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const s1 = KC.shuffle(Core.mulberry32(42), src);
  ok(JSON.stringify(src) === '[1,2,3,4,5,6,7,8]', 'shuffle does not mutate its input');
  const s2 = KC.shuffle(Core.mulberry32(42), [1, 2, 3, 4, 5, 6, 7, 8]);
  ok(JSON.stringify(s1) === JSON.stringify(s2), 'shuffle: same seed → identical order');
  ok(JSON.stringify(s1) !== JSON.stringify(src), 'shuffle: order actually changes (seed 42)');

  // same seed → identical round sequence for every shipped game (incl. shuffled choices)
  const { KIDS } = require('./kids/kids-data.js');
  for (const g of KIDS.games) {
    if (typeof KC.GEN[g.id] !== 'function') continue; // games not yet landed skip silently
    for (const b of KIDS.bands) {
      const run = (seed) => {
        const s = KC.newSession(g.id, b.id, 1, seed);
        const out = [JSON.stringify(s.round)];
        for (let i = 0; i < 25; i++) {
          const st = s.round.steps[s.stepIndex];
          if (KC.submit(s, st.correctId).outcome === 'pass') out.push(JSON.stringify(s.round));
        }
        return out;
      };
      ok(JSON.stringify(run(7001)) === JSON.stringify(run(7001)), `${g.id}/${b.id}: same seed → identical round sequence`);
      ok(JSON.stringify(run(7001)) !== JSON.stringify(run(7002)), `${g.id}/${b.id}: different seed → different sequence`);
    }
  }
}

/* ---------- summary ---------- */
console.log(`\n===== SELF-TEST: ${pass} passed, ${fail} failed, ${warn} warn =====`);
process.exit(fail === 0 ? 0 : 1);
