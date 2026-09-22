// kids-data.js — PURE DATA for kindergarten mode (โหมดอนุบาล): game registry, bands,
// item pools, copy, cartoon refs, tunables. No logic (TECH-SPEC §1.2/§2).
// Editing rule: docs/kids.md is the content source of truth — change docs FIRST, then mirror here.
(function (global) {
'use strict';

const KIDS = {
  // GameSpec registry — every id must have a GEN in kids-core.js and params in every band (ST-[6]).
  // coPlay:true flags the solo/together chooser (S-10); none in M1.
  games: [
    { id: 'count', icon: '🍊', caption: 'นับดูสิ', coPlay: false },
    { id: 'match', icon: '🎴', caption: 'จับคู่เหมือนกัน', coPlay: false },
    { id: 'compare', icon: '🐟', caption: 'ข้างไหนมากกว่า', coPlay: true },   // round-1 co-play game (OQ-B)
    { id: 'shapes', icon: '🔺', caption: 'รูปทรงน่ารัก', coPlay: false },
    { id: 'order', icon: '🦆', caption: 'เรียงให้ถูก', coPlay: false },
    { id: 'sort', icon: '🧺', caption: 'จัดเข้ากลุ่ม', coPlay: false },
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
      } },
    { id: 'bigs', icon: '🐥', label: 'น้องใหญ่ 5–6',
      params: {
        count: { rangeLo: 1, rangeHi: 10, choiceCount: 4 },
        match: { rangeLo: 1, rangeHi: 10, cardCount: 4 },
        compare: { groupMax: 6, minGap: 1, sizeRatio: 1.25 },
        shapes: { patternLenMin: 4, patternLenMax: 5, kindsCount: 3, choiceCount: 4 },
        order: { itemCountMin: 3, itemCountMax: 4 },
        sort: { itemCountMin: 4, itemCountMax: 6 },
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
        { bins: [{ id: 'basket', icon: '🧺' }, { id: 'meadow', icon: '🌾' }],
          members: { basket: ['🍌', '🍎', '🍓', '🍇', '🍊'], meadow: ['🐥', '🐰', '🐟', '🐸', '🐝'] } },
        { bins: [{ id: 'sky', icon: '☁️' }, { id: 'sea', icon: '🌊' }],
          members: { sky: ['🕊️', '✈️', '🎈', '🪁', '🌈'], sea: ['🐠', '🐙', '🐋', '🦀', '⛵'] } },
      ],
    },
  },

  // Co-play / hub copy lands here as it is added (kids copy budget ≤ 40 words, ST-[9]).
  copy: {
    solo: 'คนเดียว',      // S-10 chooser labels (for parents; icons lead)
    together: 'สองคน',
    handoff: 'ส่งไม้ต่อ',   // pass-and-play handoff banner (icon-led)
  },

  // Cartoon pair (F-04) — M1 ships the owner-reviewed inline-SVG pair; refs point at the
  // inline <svg> element ids in kids/index.html. Generated art (M3) swaps refs to assets/.
  cartoonRefs: { pass: 'inline:art-pass', nudge: 'inline:art-nudge' },

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
