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

/* ---------- 4. simulation: tier reachability + run-length bands ---------- */
console.log('\n[4] Player simulations (300 seeds each)');
const MODELS = [
  { name: 'weak   (acc .60, ~6.7s/q)', acc: 0.60, base: 6.0, perWave: 0.4 },
  { name: 'mid    (acc .85, ~4.9s/q)', acc: 0.85, base: 4.2, perWave: 0.5 },
  { name: 'strong (acc .97, ~3.9s/q)', acc: 0.97, base: 3.2, perWave: 0.6 },
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
  console.log(`  · ${m.name}: median run ${med(ts).toFixed(0)}s · scores ${Math.min(...runs.map(r => r.score))}–${Math.max(...runs.map(r => r.score))} · best wave ${Math.max(...runs.map(r => r.wave)) + 1}/4`);
  ok(Math.max(...ts) <= 150, `${m.name}: no run exceeds 150s (max ${Math.max(...ts).toFixed(0)}s)`);
}
ok(med(results[MODELS[0].name].map(r => r.t)) >= 40, 'weak model survives ≥ 40s (median)');
ok(med(results[MODELS[1].name].map(r => r.t)) >= 60 && med(results[MODELS[1].name].map(r => r.t)) <= 125, 'mid model median in [60,125]s');
ok(med(results[MODELS[2].name].map(r => r.t)) >= 60 && med(results[MODELS[2].name].map(r => r.t)) <= 125, 'strong model median in [60,125]s');
{
  const all = Object.values(results).flat();
  for (let ti = 0; ti < DATA.tiers.length; ti++) {
    ok(all.some((r) => r.tier === ti), `tier T${ti + 1} (${DATA.tiers[ti].name}) reached by some simulated player`);
  }
  ok(results[MODELS[2].name].some((r) => r.wave === 3), 'strong model reaches wave 4 (gate 1,200)');
  ok(results[MODELS[0].name].every((r) => r.tier <= 1), 'weak model never exceeds T2 (no fake achievement)');
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
  ok(DATA.waves.length === 4, 'exactly 4 waves (scope)');
  ok(Object.keys(DATA.waves[0].mix).length <= 6 && Object.keys(Core.GENERATORS).length === 6, '6 question types, no more');
  ok(DATA.tiers.length === 5, '5 result tiers');
}

/* ---------- summary ---------- */
console.log(`\n===== SELF-TEST: ${pass} passed, ${fail} failed, ${warn} warn =====`);
process.exit(fail === 0 ? 0 : 1);
