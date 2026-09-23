// kids-data.js — PURE DATA for kindergarten mode (โหมดอนุบาล): game registry, bands,
// item pools, copy, cartoon refs, tunables. No logic (TECH-SPEC §1.2/§2).
// Editing rule: docs/kids.md is the content source of truth — change docs FIRST, then mirror here.
(function (global) {
'use strict';

const KIDS = {
  // GameSpec registry — every id must have a GEN in kids-core.js and params in every band (ST-[6]),
  // and a family that exists in families (ST-[11]). coPlay:true flags the solo/together chooser (S-10).
  games: [
    { id: 'count', icon: '🍊', caption: 'นับดูสิ', family: 'number', coPlay: false },
    { id: 'match', icon: '🎴', caption: 'จับคู่เหมือนกัน', family: 'number', coPlay: false },
    { id: 'compare', icon: '🐟', caption: 'ข้างไหนมากกว่า', family: 'compare', coPlay: true },   // round-1 co-play game (OQ-B)
    { id: 'shapes', icon: '🔺', caption: 'รูปทรงน่ารัก', family: 'shape', coPlay: false },
    { id: 'order', icon: '🦆', caption: 'เรียงให้ถูก', family: 'arrange', coPlay: false },
    { id: 'sort', icon: '🧺', caption: 'จัดเข้ากลุ่ม', family: 'arrange', coPlay: false },
    { id: 'samediff', icon: '🪞', caption: 'เหมือนกันเลย', family: 'visual', coPlay: false },
    { id: 'shadow', icon: '🌑', caption: 'เงาใครเอ่ย', family: 'visual', coPlay: false },
    { id: 'positions', icon: '📍', caption: 'บน–ล่าง–ใน–นอก', family: 'visual', coPlay: false },
    { id: 'length', icon: '📏', caption: 'ยาว–สั้น', family: 'compare', coPlay: false },
    { id: 'weight', icon: '⚖️', caption: 'หนัก–เบา', family: 'compare', coPlay: false },
    { id: 'partwhole', icon: '🌓', caption: 'ครึ่ง–เต็ม', family: 'visual', coPlay: false },
    { id: 'equalgroups', icon: '🍒', caption: 'เท่ากันไหม', family: 'number', coPlay: false },
    { id: 'colorsort', icon: '🎨', caption: 'จัดตามสี', family: 'arrange', coPlay: false },
    { id: 'neighbors', icon: '🧮', caption: 'เพื่อนตัวเลข', family: 'number', coPlay: false },
  ],

  // Hub zones (F-02, FEATURES-OQ-D default: single scrolling board, 5 skill-family zones).
  // Marker icon is the family's own — never a member game's icon (ST-[11]).
  families: [
    { id: 'number', icon: '🔢', label: 'เลขและปริมาณ' },
    { id: 'compare', icon: '🆚', label: 'เปรียบเทียบ' },
    { id: 'shape', icon: '🔷', label: 'รูปทรงและแบบรูป' },
    { id: 'visual', icon: '👀', label: 'มองภาพ' },
    { id: 'arrange', icon: '🧩', label: 'จัดและเรียง' },
  ],

  // Age bands (F-11, UX S-02) — params-only difficulty: a band switch changes only the
  // params object handed to the generator (C6 — no machinery). Read at session start.
  bands: [
    { id: 'littles', icon: '🐣', label: 'น้องเล็ก 3–4',
      params: {
        count: { rangeLo: 1, rangeHi: 3, choiceCount: 3 },   // UX P1: นับ 1–3
        match: { rangeLo: 1, rangeHi: 3, cardCount: 3 },
        compare: { groupMax: 6, minGap: 2, sizeRatio: 1.5 },   // no near-ties (F-07)
        shapes: { patternLenMin: 3, patternLenMax: 3, kindsCount: 2, choiceCount: 3 },
        order: { itemCountMin: 2, itemCountMax: 3 },
        sort: { itemCountMin: 3, itemCountMax: 3 },
        samediff: { choiceCount: 3, oddMembers: 3, attrs: 1 },
        shadow: { choiceCount: 2, sameCategory: false },   // littles: cross-category distractors only
        positions: { relations: 2 },
        length: { items: 2, ratio: 1.5 },                   // no near-ties (F-16, mirrors F-07 discipline)
        weight: { items: 2, minRankGap: 2 },                 // curated contrastive classes only (F-17)
        partwhole: { choiceCount: 2, cuts: ['v'] },           // littles: vertical cut only (F-19)
        equalgroups: { rangeLo: 1, rangeHi: 5, choiceCount: 3, minGap: 2 }, // no near-ties (F-18)
        colorsort: { binCount: 2, itemCountMin: 4, itemCountMax: 4 },        // 2 color bowls (F-20)
        neighbors: { trackMin: 3, trackMax: 5, choiceCount: 3, interior: false }, // littles: gap at the end (F-22)
      } },
    { id: 'bigs', icon: '🐥', label: 'น้องใหญ่ 5–6',
      params: {
        count: { rangeLo: 1, rangeHi: 10, choiceCount: 4 },
        match: { rangeLo: 1, rangeHi: 10, cardCount: 4 },
        compare: { groupMax: 6, minGap: 1, sizeRatio: 1.25 },
        shapes: { patternLenMin: 4, patternLenMax: 5, kindsCount: 3, choiceCount: 4 },
        order: { itemCountMin: 3, itemCountMax: 4 },
        sort: { itemCountMin: 4, itemCountMax: 6 },
        samediff: { choiceCount: 5, oddMembers: 4, attrs: 2 },
        shadow: { choiceCount: 4, sameCategory: true },    // bigs: same-category allowed, profiles stay distinct
        positions: { relations: 4 },
        length: { items: 3, ratio: 1.25 },
        weight: { items: 3, minRankGap: 1 },
        partwhole: { choiceCount: 4, cuts: ['v', 'h', 'd'] }, // bigs add horizontal + diagonal cuts
        equalgroups: { rangeLo: 1, rangeHi: 10, choiceCount: 3, minGap: 1 },
        colorsort: { binCount: 3, itemCountMin: 5, itemCountMax: 6 },        // 3 bowls, more items (F-20)
        neighbors: { trackMin: 6, trackMax: 10, choiceCount: 4, interior: true }, // bigs: interior gap (F-22)
      } },
  ],

  // Item pools — content only.
  pools: {
    count: { emojis: ['🍊', '🍎', '🍓', '🍌', '🍇', '🐥', '🐟', '🎈', '⭐', '🍪'] },
    compare: {
      groupItems: ['🐟', '🐥', '🍓', '🧸'],   // groups variant: n items per side
      singleItems: ['🎈', '🍩', '🍊', '⭐'],   // single variant: one item, two sizes
    },
    shapes: { shapes: ['🔺', '🟢', '⬛', '⭐', '🟡', '🔵'] },   // shape element pool
    order: { items: ['🦆', '🐢', '🐝'] },                     // same character, distinct sizes
    sort: {                                                   // category pairs — unambiguous 2-bin partitions
      pairs: [
        { bins: [{ id: 'fruits', icon: '🍉' }, { id: 'animals', icon: '🐾' }],
          members: { fruits: ['🍌', '🍎', '🍓', '🍇', '🍊'], animals: ['🐥', '🐰', '🐟', '🐸', '🐝'] } },
        { bins: [{ id: 'sky', icon: '☁️' }, { id: 'sea', icon: '🌊' }],
          members: { sky: ['🕊️', '✈️', '🎈', '🪁', '🌈'], sea: ['🐠', '🐙', '🐋', '🦀', '⛵'] } },
      ],
    },
    samediff: {                                                // attribute groups — round rule «same kind» (F-13)
      groups: [
        { id: 'fruits', members: ['🍓', '🍎', '🍇', '🍒', '🍍'] },
        { id: 'animals', members: ['🐰', '🐷', '🐔', '🐭', '🐸'] },
        { id: 'vehicles', members: ['🚗', '🚌', '🚲', '🚂', '🛴'] },
        { id: 'toys', members: ['🧸', '🎲', '🥁', '🪀', '🎈'] },
      ],
    },
    shadow: {                                                  // object↔shadow pairs (F-14) — `p` = silhouette profile,
      groups: [                                                // globally distinct across the pool (ST-[7] pool-level check);
        { id: 'animals', members: [                            // rendering = CSS-filter silhouette now, art set 1 = T-051
          { e: '🐘', p: 'elephant' }, { e: '🦒', p: 'giraffe' },
          { e: '🐧', p: 'penguin' }, { e: '🦋', p: 'butterfly' } ] },
        { id: 'vehicles', members: [
          { e: '🚗', p: 'car' }, { e: '🚲', p: 'bike' },
          { e: '🚁', p: 'heli' }, { e: '🚢', p: 'boat' } ] },
        { id: 'fruits', members: [
          { e: '🍌', p: 'banana' }, { e: '🍍', p: 'pineapple' },
          { e: '🍇', p: 'grapes' }, { e: '🍈', p: 'melon' } ] },
        { id: 'toys', members: [
          { e: '🧸', p: 'bear' }, { e: '🎈', p: 'balloon' },
          { e: '🪁', p: 'kite' }, { e: '🎲', p: 'dice' } ] },
      ],
    },
    positions: {                                               // scene pools (F-15) — every scene a bijection onto
      anchors: ['🪑', '📦'],                                    // on/under/in/out (one object per relation)
      itemSets: [
        [{ e: '🐱', rel: 'on' }, { e: '🐭', rel: 'under' }, { e: '⚽', rel: 'in' }, { e: '🦆', rel: 'out' }],
        [{ e: '🧸', rel: 'on' }, { e: '🐶', rel: 'under' }, { e: '👕', rel: 'in' }, { e: '🪁', rel: 'out' }],
        [{ e: '🍎', rel: 'on' }, { e: '🐰', rel: 'under' }, { e: '🎁', rel: 'in' }, { e: '🚗', rel: 'out' }],
      ],
    },
    weight: {                                                   // curated weight classes, heavy→light (F-17) —
      classes: [                                                // contrastive only, no near-equal pairs;
        { id: 'c4', e: '🐘' }, { id: 'c3', e: '🚗' }, { id: 'c2', e: '🍉' },   // owner spot-review rides T-052 (R15)
        { id: 'c1', e: '🍎' }, { id: 'c0', e: '🪶' },
      ],
    },
    partwhole: {                                                // half↔whole bijection pool (F-19) — half = the whole
      wholes: ['🍕', '🍉', '🍪', '🌭', '🥕', '🥨'],             // clip-path cut per round `cut`; art set 3 = T-053
    },
    equalgroups: {                                              // group items (F-18) — one kind per group, all kinds
      items: ['🍒', '🍓', '🍊', '🍇', '🫐', '🍪', '🧁', '🐟'],  // distinct in a round (+ ≠ sample): compare counts, not looks
    },
    colorsort: {                                                // color bowls (F-20) — same machinery as sort, color
      colors: [                                                 // criterion; bins lead with swatch + exemplar marker
        { id: 'red', swatch: '#E5484D', marker: '🍓', members: ['🍅', '🌹', '🍒', '🦀', '🍎'] },
        { id: 'yellow', swatch: '#F2B33D', marker: '⭐', members: ['🍌', '🌻', '🧀', '🌽', '🍋'] },
        { id: 'green', swatch: '#30A46C', marker: '🌲', members: ['🥑', '🥦', '🐢', '🥒', '🍏'] },
      ],                                                        // (marker ∉ members — mirrors sort bin rule)
    },
  },

  // Co-play / hub copy lands here as it is added (kids copy budget ≤ 40 words, ST-[9]).
  copy: {
    solo: 'คนเดียว',      // S-10 chooser labels (for parents; icons lead)
    together: 'สองคน',
    handoff: 'ส่งไม้ต่อ',   // pass-and-play handoff banner (icon-led)
    pass: 'เก่งมาก!',       // F-04 overlay caption (owner bug report 2026-09-22)
    nudge: 'ลองอีกครั้งนะ',  // encouraging, never scolding (OQ4)
    binLabel: { fruits: 'ผลไม้', animals: 'สัตว์', sky: 'ฟ้า', sea: 'ทะเล' }, // F-10 sort bin labels (for parents; owner feedback 2026-09-22)
  },

  // Cartoon pair (F-04) — generated pair (owner-reviewed via artbrief.json flow) is primary;
  // the owner-reviewed inline-SVG pair stays as automatic fallback if an asset fails to load.
  cartoonRefs: { pass: 'asset:assets/pass.jpg', nudge: 'asset:assets/nudge.jpg' },

  // Tunables (display cadence only — never gameplay).
  tunables: {
    overlayMs: 1600,
    handoffExtraMs: 1000,                          // co-play pass cartoon lingers longer (same single timer)
    playerIcons: ['🧒', '🧑'],                      // turn indicator icons — parity, not identities
  },
};

global.EXPRESS_KIDS_DATA = KIDS;
if (typeof module !== 'undefined' && module.exports) module.exports = { KIDS };
})(typeof window !== 'undefined' ? window : globalThis);
