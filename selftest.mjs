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
  // shadow pool data invariants (F-14 — pool-level silhouette uniqueness: every object carries
  // its own globally-distinct profile; cross-category distractors must suffice for bigs choiceCount)
  {
    const all = KIDS.pools.shadow.groups.flatMap((g) => g.members);
    ok(new Set(all.map((m) => m.e)).size === all.length, 'shadow pool: object emojis distinct');
    ok(new Set(all.map((m) => m.p)).size === all.length, 'shadow pool: silhouette profiles distinct (pool-level uniqueness)');
    const minGroup = Math.min(...KIDS.pools.shadow.groups.map((g) => g.members.length));
    ok(all.length - minGroup >= 4, `shadow pool: cross-category distractors suffice for choiceCount 4 (${all.length - minGroup} available)`);
  }
  // positions scene data invariants (F-15 — every scene a bijection onto on/under/in/out;
  // object emojis distinct within a scene so taps are unambiguous)
  ok(KIDS.pools.positions.anchors.length === 2, 'positions pool: table + box anchors present');
  for (const [si, set] of KIDS.pools.positions.itemSets.entries()) {
    ok(set.length === 4 && new Set(set.map((it) => it.rel)).size === 4, `positions scene ${si + 1}: covers on/under/in/out exactly once (bijection)`);
    ok(new Set(set.map((it) => it.e)).size === set.length, `positions scene ${si + 1}: object emojis distinct`);
  }
  // weight pool data invariants (F-17 — curated ranking strict: class emojis distinct so each
  // round maps injectively to ranks; pool feasible for both bands' gap requirements)
  {
    const cls = KIDS.pools.weight.classes;
    ok(new Set(cls.map((c) => c.e)).size === cls.length, 'weight pool: class emojis distinct (strict ranking decodable)');
    for (const b of KIDS.bands) {
      const P = b.params.weight;
      ok(cls.length >= (P.items - 1) * P.minRankGap + 1, `weight pool: feasible for band «${b.id}» (${P.items} items, gap ≥${P.minRankGap}, ${cls.length} classes)`);
    }
  }
  // partwhole pool data invariants (F-19 — half↔whole bijection by construction: wholes distinct;
  // pool deep enough for bigs choiceCount; cut vocabulary v/h/d only)
  {
    const ws = KIDS.pools.partwhole.wholes;
    ok(new Set(ws).size === ws.length, 'partwhole pool: wholes distinct (half↔whole bijection)');
    ok(ws.length >= 4, `partwhole pool: ≥ 4 wholes for bigs choiceCount (${ws.length})`);
    const cuts = new Set(KIDS.bands.flatMap((b) => b.params.partwhole.cuts));
    ok([...cuts].every((c) => ['v', 'h', 'd'].includes(c)), 'partwhole cuts: v/h/d vocabulary only');
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
    samediff(r, P) {
      const d = r.display, st = r.steps[0];
      const groups = KIDS.pools.samediff.groups;
      const groupOf = {};
      groups.forEach((g) => g.members.forEach((m) => { groupOf[m] = g.id; }));
      if (r.steps.length !== 1) return 'steps≠1';
      if (d.kind === 'samediff-find') {
        if (st.choices.length !== P.choiceCount) return 'choiceCount';
        const sampleG = groupOf[d.sample];
        if (!sampleG) return 'sample not in pool';
        if (st.choices.includes(d.sample)) return 'sample among choices';
        const inG = st.choices.filter((c) => groupOf[c] === sampleG);
        if (inG.length !== 1 || inG[0] !== st.correctId) return 'same-kind uniqueness';
        const distGroups = new Set(st.choices.filter((c) => groupOf[c] !== sampleG).map((c) => groupOf[c]));
        if (distGroups.size !== P.attrs) return 'varying attrs';
        if ([...distGroups].some((g) => g === sampleG || g === undefined)) return 'distractor group invalid';
        return null;
      }
      if (d.kind === 'samediff-odd') {
        if (d.items.length !== P.oddMembers + 1) return 'members count';
        if (JSON.stringify(st.choices.slice().sort()) !== JSON.stringify(d.items.slice().sort())) return 'choices≠items';
        const devG = groupOf[st.correctId];
        const conf = d.items.filter((m) => m !== st.correctId);
        if (conf.length < 3) return 'conforming < 3';
        if (!conf.every((m) => groupOf[m] === groupOf[conf[0]]) || groupOf[conf[0]] === devG) return 'deviant classification';
        return null;
      }
      return 'kind';
    },
    shadow(r, P) {
      if (r.display.kind !== 'shadow-match') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display, st = r.steps[0];
      if (st.choices.length !== P.choiceCount) return 'choiceCount';
      const groups = KIDS.pools.shadow.groups;
      const catOf = {}, byE = {};
      groups.forEach((g) => g.members.forEach((m) => { catOf[m.e] = g.id; byE[m.e] = m; }));
      if (!byE[d.object]) return 'prompt not in pool';
      if (st.correctId !== d.object) return 'correct≠prompt object';
      const profs = st.choices.map((e) => (byE[e] ? byE[e].p : undefined));
      if (profs.some((p) => !p)) return 'choice not in pool';
      if (new Set(profs).size !== profs.length) return 'silhouette profile clash in round';
      if (!P.sameCategory && st.choices.some((e) => e !== d.object && catOf[e] === catOf[d.object])) return 'littles: same-category distractor';
      return null;
    },
    positions(r, P) {
      if (r.display.kind !== 'positions') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display, st = r.steps[0];
      if (!['on', 'under', 'in', 'out'].includes(d.q)) return 'q';
      if (d.items.length !== P.relations) return 'relation set size';
      const rels = d.items.map((it) => it.rel);
      if (new Set(rels).size !== rels.length) return 'relation not exactly-one-member';
      if (!rels.includes(d.q)) return 'queried relation absent from scene';
      if (new Set(d.items.map((it) => it.e)).size !== d.items.length) return 'dup object emoji';
      if (JSON.stringify(st.choices.slice().sort()) !== JSON.stringify(d.items.map((it) => it.e).sort())) return 'choices≠scene objects';
      if (st.correctId !== d.items.find((it) => it.rel === d.q).e) return 'correct ≠ queried-relation member';
      return null;
    },
    length(r, P) {
      if (r.display.kind !== 'length') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display, st = r.steps[0];
      if (!['longer', 'shorter'].includes(d.q)) return 'q';
      if (d.items.length !== P.items) return 'item count';
      const lens = d.items.map((it) => it.len);
      if (!lens.every((l) => Number.isInteger(l) && l > 0)) return 'len domain';
      const asc = lens.slice().sort((a, b) => a - b);
      for (let i = 1; i < asc.length; i++) if (asc[i] / asc[i - 1] < P.ratio) return 'pairwise ratio < band min (near-tie)';
      const target = d.q === 'longer' ? Math.max(...lens) : Math.min(...lens);
      if (st.correctId !== d.items.find((it) => it.len === target).id) return 'correct ≠ ' + d.q + ' item';
      if (JSON.stringify(st.choices.slice().sort()) !== JSON.stringify(d.items.map((it) => it.id).sort())) return 'choices≠items';
      return null;
    },
    weight(r, P) {
      if (r.display.kind !== 'weight') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display, st = r.steps[0];
      if (!['heavier', 'lighter'].includes(d.q)) return 'q';
      if (d.items.length !== P.items) return 'item count';
      const cls = KIDS.pools.weight.classes;
      const rankOf = {};
      cls.forEach((c, i) => { rankOf[c.e] = i; });                  // 0 = heaviest
      const ranks = d.items.map((it) => rankOf[it.e]);
      if (ranks.some((x) => x === undefined)) return 'item not curated';
      if (new Set(ranks).size !== ranks.length) return 'rank tie (not strict)';
      const asc = ranks.slice().sort((a, b) => a - b);
      for (let i = 1; i < asc.length; i++) if (asc[i] - asc[i - 1] < P.minRankGap) return 'rank gap < band min';
      const bestRank = d.q === 'heavier' ? Math.min(...ranks) : Math.max(...ranks);
      if (st.correctId !== d.items.find((it) => rankOf[it.e] === bestRank).id) return 'correct ≠ ' + d.q + ' item';
      if (JSON.stringify(st.choices.slice().sort()) !== JSON.stringify(d.items.map((it) => it.id).sort())) return 'choices≠items';
      return null;
    },
    partwhole(r, P) {
      if (r.display.kind !== 'part-whole') return 'kind';
      if (r.steps.length !== 1) return 'steps≠1';
      const d = r.display, st = r.steps[0];
      if (st.choices.length !== P.choiceCount) return 'choiceCount';
      if (!KIDS.pools.partwhole.wholes.includes(d.whole)) return 'whole not in pool';
      if (!P.cuts.includes(d.cut)) return 'cut not in band set';
      if (st.correctId !== d.whole) return 'correct≠matching whole';
      if (!st.choices.every((c) => KIDS.pools.partwhole.wholes.includes(c))) return 'choice not curated';
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
          if (st.goal !== undefined) {
            // goal steps (dormant until F-21/F-24/F-26 register — TECH-SPEC §2.2 note)
            if (!KC.GOALS[st.goal]) { bad++; why.add('unknown goal ' + st.goal); }
            const need = { 'one-each': ['items', 'recipients'], 'trace': ['waypoints'], 'all-paired': ['left', 'right'] }[st.goal] || [];
            for (const k of need) if (!Array.isArray(r.display[k])) { bad++; why.add('goal display missing ' + k); }
          } else {
            if (new Set(st.choices).size !== st.choices.length) { bad++; why.add('dup choice'); }
            if (st.choices.filter((c) => c === st.correctId).length !== 1) { bad++; why.add('correct≠1'); }
          }
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
      if (g.id === 'samediff') ok(seenKinds.size === 2, `${g.id}/${b.id}: both variants occur over ${N7} rounds (J-13)`);
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

  // (f) goal-step contract — synthetic goal fixtures (T-021 discipline; real goal gens land in M7)
  const fxg = { games: [{ id: 'gfx' }, { id: 'gfx1' }], bands: [{ id: 'fxb', params: { gfx: {}, gfx1: {} } }], pools: {} };
  const pairFix = () => [
    { item: 'i0', recipient: 'r0' }, { item: 'i1', recipient: 'r1' }, { item: 'i2', recipient: 'r2' },
  ];
  KC.GEN.gfx = function () { // 2 steps: goal (per-action) then choice — proves the phase transition
    return { gameId: 'gfx', display: { kind: 'gfx', items: [{ id: 'i0' }, { id: 'i1' }, { id: 'i2' }],
             recipients: [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }] },
             steps: [{ goal: 'one-each', handoff: 'per-action' }, { choices: ['x', 'y'], correctId: 'x' }] };
  };
  KC.GEN.gfx1 = function () { // 1 goal step, on-pass default — proves final-step met → pass
    return { gameId: 'gfx1', display: { kind: 'gfx1', waypoints: [{ id: 'w0' }, { id: 'w1' }, { id: 'w2' }] },
             steps: [{ goal: 'trace' }] };
  };
  {
    // (f1) 50 valid-but-incomplete submits → silent incomplete; round identical; placed = latest snapshot
    const s = KC.newSession('gfx', 'fxb', 1, 701, fxg);
    const before = roundJson(s);
    let allSilent = true;
    for (let i = 0; i < 50; i++) {
      const partial = [{ item: 'i0', recipient: 'r0' }, { item: 'i1', recipient: 'r1' }];
      const r = KC.submit(s, partial, fxg);
      if (r.outcome !== 'incomplete' || r.roundChanged || r.turnAdvanced) allSilent = false;
    }
    ok(allSilent, '(f1) 50 incomplete submits → silent incomplete, no round/turn change');
    ok(roundJson(s) === before && s.stepIndex === 0, '(f1) round JSON + stepIndex identical');
    ok(JSON.stringify(s.placed) === JSON.stringify([[{ item: 'i0', recipient: 'r0' }, { item: 'i1', recipient: 'r1' }]]), '(f1) placed = latest accepted snapshot');
    ok(KC.submit(s, pairFix(), fxg).outcome === 'step', '(f1) session still usable after 50 incompletes (unlimited)');
  }
  {
    // (f2) goal met at NON-final step → 'step'; snapshot persists into the next phase (F-26 shape)
    const s = KC.newSession('gfx', 'fxb', 1, 702, fxg);
    const r = KC.submit(s, pairFix(), fxg);
    ok(r.outcome === 'step' && s.stepIndex === 1, '(f2) goal-met non-final → step, stepIndex advances');
    ok(JSON.stringify(s.placed) === JSON.stringify([pairFix()]), '(f2) structure snapshot persists in placed (J-26 pairs stay)');
    ok(KC.submit(s, 'x', fxg).outcome === 'pass', '(f2) phase transition completes to pass');
  }
  {
    // (f3) goal met at FINAL step → pass + fresh round (single-step on-pass fixture)
    const s = KC.newSession('gfx1', 'fxb', 1, 703, fxg);
    const old = roundJson(s);
    const r = KC.submit(s, ['w0', 'w1', 'w2'], fxg);
    ok(r.outcome === 'pass' && r.roundChanged && roundJson(s) !== old, '(f3) goal-met final → pass + new round');
    ok(s.placed.length === 0 && s.stepIndex === 0, '(f3) fresh round resets placed/stepIndex');
  }
  {
    // (f4) fabricated / malformed structures → defensive incomplete, NOTHING changes
    const s = KC.newSession('gfx', 'fxb', 1, 704, fxg);
    KC.submit(s, [{ item: 'i0', recipient: 'r0' }], fxg);
    const before = roundJson(s);
    const placedBefore = JSON.stringify(s.placed);
    const junk = [
      [{ item: 'zz', recipient: 'r0' }],                                  // fabricated item id
      [{ item: 'i0', recipient: 'rx' }],                                  // fabricated recipient id
      [{ item: 'i0', recipient: 'r1' }, { item: 'i0', recipient: 'r2' }],  // item placed twice
      'w0', 42, null, {}, [['i0', 'r0']],                                 // malformed shapes
    ];
    let allDefensive = true;
    for (const j of junk) {
      const r = KC.submit(s, j, fxg);
      if (r.outcome !== 'incomplete' || r.roundChanged || r.turnAdvanced) allDefensive = false;
    }
    ok(allDefensive, '(f4) fabricated/malformed structures → defensive incomplete');
    ok(roundJson(s) === before && s.stepIndex === 0 && JSON.stringify(s.placed) === placedBefore,
       '(f4) round/stepIndex/placed untouched by junk');
  }
  {
    // (f5) GOALS statelessness — double evaluation + before/after submits give identical verdicts
    const s = KC.newSession('gfx', 'fxb', 1, 705, fxg);
    const g = KC.GOALS['one-each'];
    const partial = [{ item: 'i0', recipient: 'r0' }];
    const v1 = g.valid(partial, s.round), m1 = g.met(partial, s.round);
    ok(v1 === g.valid(partial, s.round) && m1 === g.met(partial, s.round) && v1 === true && m1 === false,
       '(f5) double evaluation → identical verdicts');
    for (let i = 0; i < 5; i++) KC.submit(s, partial, fxg);
    ok(g.valid(partial, s.round) === v1 && g.met(partial, s.round) === m1, '(f5) verdicts unchanged after submits (no hidden state)');
    const tr = { display: { waypoints: [{ id: 'w0' }, { id: 'w1' }] } };
    ok(KC.GOALS.trace.valid(['w0'], tr) === true && KC.GOALS.trace.met(['w0'], tr) === false &&
       KC.GOALS.trace.valid(['w1'], tr) === false && KC.GOALS.trace.met(['w0', 'w1'], tr) === true,
       '(f5) trace predicate: prefix-in-order / full-log semantics');
    const pr = { display: { left: [{ id: 'l0' }, { id: 'l1' }], right: [{ id: 'r0' }] } };
    ok(KC.GOALS['all-paired'].valid([{ left: 'l0', right: 'r0' }], pr) === true &&
       KC.GOALS['all-paired'].met([{ left: 'l0', right: 'r0' }], pr) === true &&
       KC.GOALS['all-paired'].valid([{ left: 'l0', right: 'r0' }, { left: 'l0', right: 'rx' }], pr) === false,
       '(f5) all-paired predicate: min(|L|,|R|) + no reuse');
  }

  // (g) handoff-mode contract — per-action vs on-pass · no double flip · solo never flips
  {
    // (g1) per-action flips on ACCEPTED actions only — never on malformed/rejected
    const s = KC.newSession('gfx', 'fxb', 2, 801, fxg);
    ok(s.turn === 0, '(g1) start turn 0');
    KC.submit(s, [{ item: 'zz', recipient: 'r0' }], fxg);
    ok(s.turn === 0, '(g1) malformed action flips nothing');
    let r = KC.submit(s, [{ item: 'i0', recipient: 'r0' }], fxg); // accepted, incomplete
    ok(r.outcome === 'incomplete' && r.turnAdvanced && s.turn === 1, '(g1) accepted placement flips (J-21)');
    r = KC.submit(s, [{ item: 'i0', recipient: 'r0' }, { item: 'i1', recipient: 'r1' }], fxg);
    ok(r.turnAdvanced && s.turn === 0, '(g1) next accepted placement flips back');
  }
  {
    // (g2) no-double-flip on the goal-completing action (R12)
    const s = KC.newSession('gfx', 'fxb', 2, 802, fxg);
    KC.submit(s, [{ item: 'i0', recipient: 'r0' }, { item: 'i1', recipient: 'r1' }], fxg); // turn → 1
    const before = s.turn;
    const r = KC.submit(s, pairFix(), fxg);
    ok(r.outcome === 'step' && r.turnAdvanced === true && s.turn === 1 - before, '(g2) completing action flips EXACTLY once');
    const before2 = s.turn;
    const p = KC.submit(s, 'x', fxg); // following choice step final → pass flips once (choice path)
    ok(p.outcome === 'pass' && p.turnAdvanced && s.turn === 1 - before2, '(g2) following choice pass flips once');
  }
  {
    // (g3) on-pass goal steps flip ONLY at pass (F-24 trace semantics)
    const s = KC.newSession('gfx1', 'fxb', 2, 803, fxg);
    let r = KC.submit(s, ['w0'], fxg);
    ok(r.outcome === 'incomplete' && !r.turnAdvanced && s.turn === 0, '(g3) on-pass: incomplete glide flips nothing');
    r = KC.submit(s, ['w0', 'w1'], fxg);
    ok(r.outcome === 'incomplete' && !r.turnAdvanced && s.turn === 0, '(g3) on-pass: nothing until the line completes');
    r = KC.submit(s, ['w0', 'w1', 'w2'], fxg);
    ok(r.outcome === 'pass' && r.turnAdvanced && s.turn === 1, '(g3) on-pass: flips exactly once at pass');
  }
  {
    // (g4) solo never flips
    const s = KC.newSession('gfx', 'fxb', 1, 804, fxg);
    let flipped = false;
    const submits = [
      [{ item: 'i0', recipient: 'r0' }],
      [{ item: 'i0', recipient: 'r0' }, { item: 'i1', recipient: 'r1' }],
      pairFix(), // → step
      'x',       // → pass
      [{ item: 'i0', recipient: 'r0' }], // fresh round, still silent
    ];
    for (const a of submits) {
      const r = KC.submit(s, a, fxg);
      if (r.turnAdvanced || s.turn !== 0) flipped = true;
    }
    ok(!flipped, '(g4) solo (players=1) never flips across outcomes');
  }

  delete KC.GEN.fx; // fixture never leaks into registry parity (ST-[6])
  delete KC.GEN.gfx; delete KC.GEN.gfx1; // goal fixtures too (T-021)
  ok(!('fx' in KC.GEN) && !('gfx' in KC.GEN) && !('gfx1' in KC.GEN), 'fixture generators cleaned up');
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
  for (const f of KIDS.families) kidsTokens.push(...f.label.split(/\s+/).filter(Boolean)); // zone labels count (ST-[11])
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

  // every generator display.kind ↔ an engine view branch (T-020's manual 8/8 walk, made mechanical)
  // PENDING_VIEWS: generator tasks land before their view task — entry removed when the view lands
  // (M4 discipline: the mechanical scan must stay green at every commit, never red mid-pair)
  const PENDING_VIEWS = [];
  const KC2 = require('./kids/kids-core.js');
  const kinds = new Set();
  for (const g of KIDS.games) {
    if (PENDING_VIEWS.includes(g.id)) continue;
    for (const b of KIDS.bands) {
      const P = KC2.bandParams(KIDS, g.id, b.id);
      const rng = Core.mulberry32(Core.hashSeed('kinds:' + g.id + ':' + b.id));
      for (let i = 0; i < 40; i++) kinds.add(KC2.GEN[g.id](rng, P, KIDS.pools).display.kind);
    }
  }
  const noView = [...kinds].filter((k) => !engSrc.includes("'" + k + "'"));
  ok(noView.length === 0, `every display.kind has an engine view ${noView.length ? '(missing: ' + noView.join(', ') + ')' : '(' + kinds.size + '/' + kinds.size + ' kinds' + (PENDING_VIEWS.length ? ', ' + PENDING_VIEWS.length + ' pending view' : '') + ')'}`);

  // art-ref fallback scan (TECH-SPEC §6.4/§6.5): every asset: ref in kids-data.js must carry its
  // zero-dep fallback in markup — the art block holds an <svg> the img-error path reveals, so the
  // game never blocks on a missing asset (M5 gate: fallback walk with art-gated views present)
  const kidsDataSrc = fs.readFileSync(path.join(kidsDir, 'kids-data.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(kidsDir, 'index.html'), 'utf8');
  const refs = [...kidsDataSrc.matchAll(/asset:([\w./-]+)/g)].map((m) => m[1]);
  ok(refs.length > 0, 'art-ref scan: asset refs present (cartoon pair)');
  for (const ref of refs) {
    const stem = path.basename(ref).replace(/\.\w+$/, '');
    const at = htmlSrc.indexOf('id="art-' + stem + '"');
    ok(at >= 0, `art ref ${ref}: fallback block art-${stem} present in markup`);
    if (at >= 0) ok(htmlSrc.slice(at, htmlSrc.indexOf('</div>', at)).includes('<svg'), `art-${stem}: inline <svg> fallback inside the block`);
  }

  // docs/kids.md ↔ kids-data.js sync (docs-first editing rule, TECH-SPEC §2.2)
  const docs = fs.readFileSync(path.join(path.dirname(process.argv[1]), 'docs', 'kids.md'), 'utf8');
  const need = [];
  for (const g of KIDS.games) need.push(g.id, g.caption);
  for (const b of KIDS.bands) need.push(b.id, b.label);
  for (const f of KIDS.families) need.push(f.id, f.label); // families sync (ST-[9] v2 clause)
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

/* ---------- 11. hub & zones (kids ST-[11] — FEATURES-OQ-D default board) ---------- */
console.log('\n[11] Hub & zones (kids ST-[11])');
{
  const { KIDS } = require('./kids/kids-data.js');
  ok(Array.isArray(KIDS.families) && KIDS.families.length === 5, `exactly 5 families (${KIDS.families.length})`);
  const famIds = new Set(KIDS.families.map((f) => f.id));
  ok(new Set([...famIds]).size === 5, 'family ids distinct');
  const members = Object.fromEntries(KIDS.families.map((f) => [f.id, []]));
  let orphans = 0;
  for (const g of KIDS.games) {
    if (!members[g.family]) { orphans++; continue; }
    members[g.family].push(g);
  }
  ok(orphans === 0, `every game's family resolves (${orphans} orphan)`);
  const total = KIDS.families.reduce((a, f) => a + members[f.id].length, 0);
  ok(total === KIDS.games.length, `Σ zone membership = registry size (${total} = ${KIDS.games.length}, each game exactly one zone)`);
  for (const f of KIDS.families) {
    ok(members[f.id].length >= 1, `zone «${f.id}»: ≥ 1 game (${members[f.id].length})`);
    ok(!members[f.id].some((g) => g.icon === f.icon), `zone «${f.id}»: marker ${f.icon} ∉ member game icons (marker∉members)`);
    ok(typeof f.label === 'string' && f.label.length > 0, `zone «${f.id}»: Thai label present`);
  }
}

/* ---------- summary ---------- */
console.log(`\n===== SELF-TEST: ${pass} passed, ${fail} failed, ${warn} warn =====`);
process.exit(fail === 0 ? 0 : 1);
