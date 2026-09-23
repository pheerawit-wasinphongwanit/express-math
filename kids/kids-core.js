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

/* F-09 «เรียงให้ถูก» — multi-step: one step per position, pairwise-distinct sizes ⇒
   exactly one valid ordering (small→big). Correct pick settles the piece (placed grows,
   renderOrder settles from session.placed); wrong pick retries WITHOUT wiping placed (J-07). */
GEN.order = function (rng, P, pools) {
  const n = randInt(rng, P.itemCountMin, P.itemCountMax);
  const emoji = pools.order.items[Math.floor(rng() * pools.order.items.length)];
  const items = [];
  for (let i = 0; i < n; i++) items.push({ id: 'it' + i, emoji, size: i + 1 });
  const sorted = items; // ascending by size by construction
  const steps = [];
  for (let i = 0; i < n; i++) {
    const remaining = sorted.slice(i).map((it) => it.id);
    steps.push({ choices: shuffle(rng, remaining), correctId: sorted[i].id });
  }
  return {
    gameId: 'order',
    display: { kind: 'order', items: shuffle(rng, items.slice()) }, // scattered presentation copy
    steps,
  };
};

/* F-10 «จัดเข้ากลุ่ม» — multi-step: one step per item, choices = the 2 bins; every item
   belongs to exactly one bin by pool construction (unambiguous partition). Finish = pass
   cartoon only — no tally anywhere. */
GEN.sort = function (rng, P, pools) {
  const pair = pools.sort.pairs[Math.floor(rng() * pools.sort.pairs.length)];
  const n = randInt(rng, P.itemCountMin, P.itemCountMax);
  const binA = pair.bins[0], binB = pair.bins[1];
  const aPool = shuffle(rng, pair.members[binA.id].slice());
  const bPool = shuffle(rng, pair.members[binB.id].slice());
  const aTake = Math.min(aPool.length, randInt(rng, 1, n - 1)); // ≥1 item per bin
  const bTake = Math.min(bPool.length, n - aTake);
  const items = [];
  aPool.slice(0, aTake).forEach((emoji, i) => items.push({ id: 'a' + i, emoji, bin: binA.id }));
  bPool.slice(0, bTake).forEach((emoji, i) => items.push({ id: 'b' + i, emoji, bin: binB.id }));
  const chosen = shuffle(rng, items); // send order
  const steps = chosen.map((it) => ({ choices: [binA.id, binB.id], correctId: it.bin }));
  return {
    gameId: 'sort',
    display: { kind: 'sort', bins: [{ id: binA.id, icon: binA.icon }, { id: binB.id, icon: binB.icon }], items: chosen },
    steps,
  };
};

/* ---------- GOALS (v2 · TECH-SPEC §2.1) — pure predicate registry for goal steps ----------
   Goal steps (F-21/F-24/F-26 only) resolve to a GOAL STATE, not a single pick: the engine
   reports each completed action as a structure snapshot; the core judges it here.
   Purity contract: no rng, no hidden state, no DOM — deterministic (structure, round) (ST-[8](f)). */
const GOALS = {};

/* F-21 «แจกให้ครบ» — structure: [{item, recipient}, …] placements so far.
   valid: ids real, each item placed ≤ 1 time. met: every recipient holds exactly one item
   AND every item is placed (uniqueness is on the goal state, never the path — FEATURES F-21). */
GOALS['one-each'] = {
  valid(structure, round) {
    const d = round.display;
    const items = new Set(d.items.map((x) => x.id));
    const recips = new Set(d.recipients.map((x) => x.id));
    const placedItems = new Set();
    for (const p of structure) {
      if (!p || !items.has(p.item) || !recips.has(p.recipient)) return false;
      if (placedItems.has(p.item)) return false;
      placedItems.add(p.item);
    }
    return true;
  },
  met(structure, round) {
    const d = round.display;
    if (structure.length !== d.items.length) return false; // every item placed
    const held = new Map(d.recipients.map((r) => [r.id, 0]));
    for (const p of structure) held.set(p.recipient, held.get(p.recipient) + 1);
    for (const n of held.values()) if (n !== 1) return false; // every recipient exactly one
    return true;
  },
};

/* F-24 «เดินตามเส้น» — structure: ordered log of legitimately-reached waypoint ids.
   valid: log is a prefix, in order, of the round's waypoint sequence. met: log = full sequence. */
GOALS['trace'] = {
  valid(structure, round) {
    const seq = round.display.waypoints.map((w) => w.id);
    if (structure.length > seq.length) return false;
    for (let i = 0; i < structure.length; i++) if (structure[i] !== seq[i]) return false;
    return true;
  },
  met(structure, round) {
    const seq = round.display.waypoints.map((w) => w.id);
    return structure.length === seq.length && structure.every((w, i) => w === seq[i]);
  },
};

/* F-26 «จับคู่แล้วเทียบ» — structure: [{left, right}, …] cross-group pairs made so far.
   valid: members real, none reused. met: every possible cross-pair is made (min(|L|,|R|)). */
GOALS['all-paired'] = {
  valid(structure, round) {
    const d = round.display;
    const L = new Set(d.left.map((x) => x.id));
    const R = new Set(d.right.map((x) => x.id));
    const usedL = new Set(), usedR = new Set();
    for (const p of structure) {
      if (!p || !L.has(p.left) || !R.has(p.right)) return false;
      if (usedL.has(p.left) || usedR.has(p.right)) return false;
      usedL.add(p.left); usedR.add(p.right);
    }
    return true;
  },
  met(structure, round) {
    const d = round.display;
    return structure.length === Math.min(d.left.length, d.right.length);
  },
};

/* F-13 «เหมือนกันเลย» — same & different, two variants in ONE generator (variant = display.kind
   data, C6): find-same (sample + choices; exactly one choice is the sample's kind — P.attrs = how
   many OTHER kinds the distractors span) / odd-one-out (P.oddMembers conforming friends of one
   kind + exactly one deviant). Rule unambiguous by pool construction (ST-[7]). */
GEN.samediff = function (rng, P, pools) {
  const groups = pools.samediff.groups;
  const groupOf = {}; groups.forEach((g) => g.members.forEach((m) => { groupOf[m] = g.id; }));
  if (rng() < 0.5) {
    // find-same: target group + P.attrs distinct other groups; correct = another member of target
    const target = groups[Math.floor(rng() * groups.length)];
    const others = shuffle(rng, groups.filter((g) => g.id !== target.id));
    const usedGroups = others.slice(0, P.attrs); // attrs ≤ groups−1 by data construction
    const sample = target.members[Math.floor(rng() * target.members.length)];
    const sameKind = shuffle(rng, target.members.filter((m) => m !== sample))[0];
    const distractPool = [];
    usedGroups.forEach((g) => distractPool.push(...shuffle(rng, g.members.slice()).slice(0, Math.ceil((P.choiceCount - 1) / P.attrs))));
    const distractors = shuffle(rng, distractPool).slice(0, P.choiceCount - 1);
    const choices = shuffle(rng, [sameKind, ...distractors]);
    return {
      gameId: 'samediff',
      display: { kind: 'samediff-find', sample },
      steps: [{ choices, correctId: sameKind }],
    };
  }
  // odd-one-out: P.oddMembers conforming members of one kind + one deviant from another kind
  const target = groups[Math.floor(rng() * groups.length)];
  const other = shuffle(rng, groups.filter((g) => g.id !== target.id))[0];
  const conforming = shuffle(rng, target.members.slice()).slice(0, P.oddMembers);
  const deviant = other.members[Math.floor(rng() * other.members.length)];
  const items = shuffle(rng, [...conforming, deviant]);
  return {
    gameId: 'samediff',
    display: { kind: 'samediff-odd', items },
    steps: [{ choices: items, correctId: deviant }],
  };
};

/* F-14 «เงาใครเอ่ย» — object prompt + shadow cards. Pool-level silhouette uniqueness: every
   pool object carries its own profile `p` (globally distinct — ST-[7] pool check), so a round's
   members never share a shadow profile. Band: choices 2→4; littles draw distractors cross-category
   only, bigs allow same-category (profiles still distinct). One variant — kind 'shadow-match'. */
GEN.shadow = function (rng, P, pools) {
  const groups = pools.shadow.groups;
  const target = groups[Math.floor(rng() * groups.length)];
  const prompt = target.members[Math.floor(rng() * target.members.length)].e;
  let distract;
  if (P.sameCategory) {
    distract = groups.flatMap((g) => g.members.map((m) => m.e)).filter((e) => e !== prompt);
  } else {
    distract = groups.filter((g) => g.id !== target.id).flatMap((g) => g.members.map((m) => m.e));
  }
  const choices = shuffle(rng, [prompt, ...shuffle(rng, distract).slice(0, P.choiceCount - 1)]);
  return {
    gameId: 'shadow',
    display: { kind: 'shadow-match', object: prompt },
    steps: [{ choices, correctId: prompt }],
  };
};

/* F-15 «บน–ล่าง–ใน–นอก» — spatial positions. Every scene is a bijection onto the four relations
   (each object holds exactly one relation, each relation exactly one member); the round activates
   a P.relations-sized subset and asks one relation — tap THE object in it (choices = scene objects).
   Distractors sit in the other ACTIVE relations by construction (ST-[7]). */
GEN.positions = function (rng, P, pools) {
  const set = pools.positions.itemSets[Math.floor(rng() * pools.positions.itemSets.length)];
  const rels = shuffle(rng, ['on', 'under', 'in', 'out']).slice(0, P.relations);
  const items = set.filter((it) => rels.includes(it.rel));
  const q = rels[Math.floor(rng() * rels.length)];
  const correct = items.find((it) => it.rel === q);
  const choices = shuffle(rng, items.map((it) => it.e));
  return {
    gameId: 'positions',
    display: { kind: 'positions', anchors: pools.positions.anchors, items, q },
    steps: [{ choices, correctId: correct.e }],
  };
};

/* F-16 «ยาว–สั้น» — length comparison on a common baseline. Lengths are synthesized positive
   integers with pairwise ratio ≥ band minimum (littles ≥ 1.5× — no near-ties; mirrors F-07):
   each next length ≥ max(prev+1, ceil(prev×ratio)) so sorted-neighbor ratios imply all pairs.
   Exactly one longest and one shortest by distinctness; the question icon asks longer/shorter. */
GEN.length = function (rng, P) {
  const lens = [];
  let cur = randInt(rng, 2, 5);
  lens.push(cur);
  while (lens.length < P.items) {
    cur = Math.max(cur + 1, Math.ceil(cur * P.ratio)) + randInt(rng, 0, 2);
    lens.push(cur);
  }
  const items = shuffle(rng, lens.map((len, i) => ({ id: 'l' + i, len })));
  const q = rng() < 0.5 ? 'longer' : 'shorter';
  const target = q === 'longer' ? Math.max(...lens) : Math.min(...lens);
  const correctId = items.find((it) => it.len === target).id;
  return {
    gameId: 'length',
    display: { kind: 'length', q, items },
    steps: [{ choices: items.map((it) => it.id), correctId }],
  };
};

/* F-17 «หนัก–เบา» — weight comparison on curated contrastive classes only (heavy→light ranked
   pool; no near-equal pairs like apple vs orange — content discipline, owner spot-review rides
   T-052). Rounds draw items from distinct classes with rank gap ≥ band minimum (littles ≥2,
   bigs ≥1), so the in-round ranking is strict; exactly one heaviest/lightest (ST-[7]). */
GEN.weight = function (rng, P, pools) {
  const classes = pools.weight.classes;                     // index 0 = heaviest
  const shuffled = shuffle(rng, classes.map((_, i) => i));
  const picked = [];
  for (const i of shuffled) {
    if (picked.every((j) => Math.abs(i - j) >= P.minRankGap)) picked.push(i);
    if (picked.length === P.items) break;
  }
  for (let i = 0; i < classes.length && picked.length < P.items; i++) {
    if (picked.every((j) => Math.abs(i - j) >= P.minRankGap)) picked.push(i); // deterministic completion
  }
  const items = shuffle(rng, picked.map((ci) => ({ id: 'w' + ci, e: classes[ci].e })));
  const q = rng() < 0.5 ? 'heavier' : 'lighter';
  const bestRank = q === 'heavier' ? Math.min(...picked) : Math.max(...picked);
  const correctId = items.find((it) => it.e === classes[bestRank].e).id;
  return {
    gameId: 'weight',
    display: { kind: 'weight', q, items },
    steps: [{ choices: items.map((it) => it.id), correctId }],
  };
};

/* F-19 «ครึ่ง–เต็ม» — part–whole matching. The pool's half↔whole mapping is a bijection by
   construction (a half IS the whole clipped along the round's cut orientation — clip-path now,
   art set 3 = T-053); exactly one matching whole among choices, distractor wholes belong to
   other halves. Cut orientation is a band param: littles vertical only → bigs add h/d. */
GEN.partwhole = function (rng, P, pools) {
  const wholes = pools.partwhole.wholes;
  const target = wholes[Math.floor(rng() * wholes.length)];
  const cut = P.cuts[Math.floor(rng() * P.cuts.length)];
  const others = wholes.filter((w) => w !== target);
  const choices = shuffle(rng, [target, ...shuffle(rng, others).slice(0, P.choiceCount - 1)]);
  return {
    gameId: 'partwhole',
    display: { kind: 'part-whole', whole: target, cut },
    steps: [{ choices, correctId: target }],
  };
};

/* F-18 «เท่ากันไหม» — equal-groups matching. The sample is one group of n items; choices are
   groups of other kinds (distinct emojis within the round, none equal to the sample's) so the
   child compares cardinality, not appearance. Exactly one choice holds n; every distractor
   differs by ≥ band gap (littles ≥2 — no near-ties, mirrors F-07/F-16 discipline). */
GEN.equalgroups = function (rng, P, pools) {
  const items = shuffle(rng, pools.equalgroups.items);
  const n = randInt(rng, P.rangeLo, P.rangeHi);
  const others = [];
  for (let v = P.rangeLo; v <= P.rangeHi; v++) if (Math.abs(v - n) >= P.minGap) others.push(v);
  const values = shuffle(rng, others).slice(0, P.choiceCount - 1);
  const groups = [n, ...values].map((count, i) => ({ id: 'g' + i, emoji: items[i + 1], n: count }));
  const correctId = groups[0].id;                                  // groups[0] is the equal one by construction
  return {
    gameId: 'equalgroups',
    display: { kind: 'equal-groups', sample: { emoji: items[0], n }, groups },
    steps: [{ choices: shuffle(rng, groups.map((g) => g.id)), correctId }],
  };
};

/* F-20 «จัดตามสี» — sort machinery, color criterion (C6): one step per item, choices = the
   round's color bins (band-count subset of the pool). Every item carries exactly one color by
   pool construction; bins lead with a swatch + exemplar marker (marker ∉ members). Finish =
   pass cartoon only — no tally anywhere (mirrors F-10). */
GEN.colorsort = function (rng, P, pools) {
  const colors = shuffle(rng, pools.colorsort.colors).slice(0, P.binCount);
  const n = randInt(rng, P.itemCountMin, P.itemCountMax);
  const take = colors.map(() => 1);                              // ≥ 1 item per bin
  let left = n - colors.length, ci = 0;
  while (left > 0 && ci < 100) {                                 // spread extras over bins with capacity
    if (colors[ci % colors.length].members.length > take[ci % colors.length]) {
      take[ci % colors.length] += 1; left -= 1;
    }
    ci += 1;
  }
  const items = [];
  colors.forEach((c, i) => {
    shuffle(rng, c.members.slice()).slice(0, take[i])
      .forEach((emoji, k) => items.push({ id: 'c' + i + 'k' + k, emoji, bin: c.id }));
  });
  const chosen = shuffle(rng, items);                            // send order
  const steps = chosen.map((it) => ({ choices: colors.map((c) => c.id), correctId: it.bin }));
  return {
    gameId: 'colorsort',
    display: { kind: 'color-sort', bins: colors.map((c) => ({ id: c.id, swatch: c.swatch, marker: c.marker })), items: chosen },
    steps,
  };
};

/* F-22 «เพื่อนตัวเลข» — number track 1..L with one missing cell. littles lose the END cell
   (n±1 — the cell after the last shown neighbor); bigs lose an INTERIOR cell sitting between
   two shown neighbors. Every shown numeral carries its dot pattern in the view (quantity
   readable without knowing words); distractor numerals ≠ n, pairwise distinct, in band range. */
GEN.neighbors = function (rng, P) {
  const len = randInt(rng, P.trackMin, P.trackMax);
  const gapIndex = P.interior ? randInt(rng, 1, len - 2) : len - 1;
  const n = gapIndex + 1;
  const track = [];
  for (let v = 1; v <= len; v++) track.push(v === n ? null : v);
  const others = [];
  for (let v = 1; v <= P.trackMax; v++) if (v !== n) others.push(v);
  const choices = shuffle(rng, [n, ...shuffle(rng, others).slice(0, P.choiceCount - 1)]);
  return {
    gameId: 'neighbors',
    display: { kind: 'number-track', track, gapIndex, n },
    steps: [{ choices, correctId: n }],
  };
};

/* F-23 «ของจริงรูปทรงอะไร» — real-object → basic-shape. The pool's object→shape mapping is a
   function (one shape per object — pool data); exactly one correct shape among choices,
   distractor shapes distinct (ST-[7]). Emoji stand in now — art set 4 = recognizability
   upgrade (T-054, owner spot-review rides it); the game never blocks on an asset. */
GEN.shapehunt = function (rng, P, pools) {
  const kinds = shuffle(rng, pools.shapehunt.shapes.slice()).slice(0, P.kindsCount);
  const correct = kinds[Math.floor(rng() * kinds.length)];
  const ofKind = pools.shapehunt.objects.filter((o) => o.s === correct);
  const object = ofKind[Math.floor(rng() * ofKind.length)];
  const distractors = shuffle(rng, kinds.filter((s) => s !== correct)).slice(0, P.choiceCount - 1);
  const choices = shuffle(rng, [correct, ...distractors]);
  return {
    gameId: 'shapehunt',
    display: { kind: 'shape-hunt', object: object.e },
    steps: [{ choices, correctId: correct }],
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
   CHOICE step (v1, verbatim semantics):
   correct + non-final step → 'step'  (placed grows; no cartoon)
   correct + final step   → 'pass'   (new round; turn flips iff players===2)
   wrong                  → 'retry'  (round, stepIndex, placed all unchanged — same child retries)
   GOAL step (v2 — answer is a structure snapshot, not a choice id):
   malformed / fabricated → 'incomplete' (defensive: nothing at all changes)
   valid + goal not met   → 'incomplete' (silent: no cartoon, no penalty; placed ← latest snapshot;
                            turn flips iff handoff 'per-action' — an accepted action, J-21/J-26)
   valid + met, non-final → 'step'   (placed keeps the snapshot — F-26 pairs persist into phase 2)
   valid + met, final     → 'pass'   (new round; flip iff 'per-action' already flipped, else iff
                            players===2 — exactly one flip, never two: no-double-flip R12) */
function submit(s, answer, data) {
  data = data || global.EXPRESS_KIDS_DATA;
  const step = s.round.steps[s.stepIndex];
  if (step.goal !== undefined) return submitGoal(s, step, answer, data);
  if (answer !== step.correctId) {
    return { outcome: 'retry', roundChanged: false, turnAdvanced: false };
  }
  s.placed.push(answer);
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

function submitGoal(s, step, structure, data) {
  const judge = GOALS[step.goal];
  if (!judge || !Array.isArray(structure) || !judge.valid(structure, s.round)) {
    return { outcome: 'incomplete', roundChanged: false, turnAdvanced: false }; // fabricated → nothing changes
  }
  s.placed = [structure]; // latest accepted snapshot replaces (view renders live state itself)
  const perAction = step.handoff === 'per-action' && s.players === 2;
  let turnAdvanced = false;
  if (perAction) { s.turn = 1 - s.turn; turnAdvanced = true; } // accepted action flips exactly once
  if (!judge.met(structure, s.round)) {
    return { outcome: 'incomplete', roundChanged: false, turnAdvanced };
  }
  if (s.stepIndex + 1 < s.round.steps.length) {
    s.stepIndex += 1;
    return { outcome: 'step', roundChanged: false, turnAdvanced }; // snapshot stays in placed (F-26)
  }
  s.round = makeRound(s.gameId, s.bandId, nextSeed(s.round.seed), data);
  s.stepIndex = 0;
  s.placed = [];
  if (!perAction && s.players === 2) { s.turn = 1 - s.turn; turnAdvanced = true; } // on-pass flips here
  return { outcome: 'pass', roundChanged: true, turnAdvanced };
}

const KidsCore = { newSession, submit, GEN, GOALS, bandParams, shuffle, nextSeed };
global.EXPRESS_KIDS_CORE = KidsCore;
if (typeof module !== 'undefined' && module.exports) module.exports = KidsCore;
})(typeof window !== 'undefined' ? window : globalThis);
