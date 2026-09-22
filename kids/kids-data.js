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
  ],

  // Age bands (F-11, UX S-02) — params-only difficulty: a band switch changes only the
  // params object handed to the generator (C6 — no machinery). Read at session start.
  bands: [
    { id: 'littles', icon: '🐣', label: 'น้องเล็ก 3–4',
      params: {
        count: { rangeLo: 1, rangeHi: 3, choiceCount: 3 },   // UX P1: นับ 1–3
        match: { rangeLo: 1, rangeHi: 3, cardCount: 3 },
      } },
    { id: 'bigs', icon: '🐥', label: 'น้องใหญ่ 5–6',
      params: {
        count: { rangeLo: 1, rangeHi: 10, choiceCount: 4 },
        match: { rangeLo: 1, rangeHi: 10, cardCount: 4 },
      } },
  ],

  // Item pools — content only.
  pools: {
    count: { emojis: ['🍊', '🍎', '🍓', '🍌', '🍇', '🐥', '🐟', '🎈', '⭐', '🍪'] },
  },

  // Co-play / hub copy lands here as it is added (kids copy budget ≤ 40 words, ST-[9]).
  copy: {},

  // Cartoon pair (F-04) — M1 ships the owner-reviewed inline-SVG pair; refs point at the
  // inline <svg> element ids in kids/index.html. Generated art (M3) swaps refs to assets/.
  cartoonRefs: { pass: 'inline:art-pass', nudge: 'inline:art-nudge' },

  // Tunables (display cadence only — never gameplay).
  tunables: { overlayMs: 1600 },
};

global.EXPRESS_KIDS_DATA = KIDS;
if (typeof module !== 'undefined' && module.exports) module.exports = { KIDS };
})(typeof window !== 'undefined' ? window : globalThis);
