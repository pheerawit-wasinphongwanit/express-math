// data.js — PURE DATA: mechanical transcription of docs/story.md + docs/scope.md. No logic.
// Editing rule: change docs/story.md FIRST, then mirror here. Never code-only fixes.
(function (global) {
'use strict';

const DATA = {
  // run rules (scope: wave table; story: state table)
  startBankSec: 45,
  maxBankSec: 50,          // cap — story.md assumed decision #1 (tuned via self-test)
  wrongPenaltySec: 5,
  milestoneEvery: 10,
  milestoneBonusSec: 6,
  milestoneBonusPts: 50,   // × wave
  basePts: 10,             // score per correct = basePts × wave × multiplier

  // waves (scope wave table + story.md wave mix); gates = score thresholds
  waves: [
    { name: 'สถานีแรก',   gate: 0,    addLo: 2, addHi: 20,  mulLo: 2, mulHi: 9,  addMaxResult: 20, geoChance: 0,    rewardSec: 4, theme: '#0ea5e9',
      mix: { add: 45, sub: 35, cmp: 20 } },
    { name: 'ต่างจังหวะ', gate: 150,  addLo: 2, addHi: 50,  mulLo: 3, mulHi: 12, addMaxResult: 0,  geoChance: 0,    rewardSec: 3, theme: '#0d9488',
      mix: { add: 20, sub: 15, mul: 45, cmp: 20 } },
    { name: 'ทางแยก',    gate: 500,  addLo: 5, addHi: 99,  mulLo: 4, mulHi: 15, addMaxResult: 0,  geoChance: 0,    rewardSec: 2, theme: '#ea580c',
      mix: { mul: 30, div: 30, seq: 20, add: 10, sub: 5, cmp: 5 } },
    { name: 'ปลายทาง',   gate: 1200, addLo: 10, addHi: 199, mulLo: 6, mulHi: 19, addMaxResult: 0, geoChance: 0.25, rewardSec: 1, theme: '#dc2626',
      mix: { mul: 30, div: 30, seq: 25, cmp: 15 } },
  ],

  // result tiers (story.md ending→tier matrix)
  tiers: [
    { min: 0,    name: 'ผู้โดยสาร',           emoji: '🙂' },
    { min: 300,  name: 'นักเดินทางตัวจริง',   emoji: '🎫' },
    { min: 900,  name: 'พนักงานตรวจตั๋ว',     emoji: '🎟️' },
    { min: 1500, name: 'นักบิดสายด่วน',       emoji: '⚡' },
    { min: 2600, name: 'หัวรถจักร',           emoji: '🚂' },
  ],

  // compare questions: fixed 3 choices (transparent deviation, approved at scope)
  cmpChoices: ['<', '=', '>'],

  // UI copy (Thai) — budget ≤ 60 words total (scope). Audio: 4 beeps max.
  copy: {
    menu:   { title: 'ด่วนคณิต', sub: 'EXPRESS MATH', play: 'เริ่มเล่น', daily: 'ด่วนประจำวัน',
              best: 'สถิติสูงสุด', today: 'วันนี้', hint: 'ตอบถูกได้เวลา ตอบผิดเสียเวลา', feedback: '📣 ฟีดแบ็ก' },
    play:   { count3: '3', count2: '2', count1: '1', go: 'ไป!', nextStation: 'สถานีถัดไป',
              secBonus: '+6 วิ', secPenalty: '−5 วิ',
              paused: 'หยุดชั่วคราว', tapToResume: 'แตะเพื่อเล่นต่อ' },
    result: { timeUp: 'หมดเวลา', score: 'คะแนน', newBest: 'สถิติใหม่!', correct: 'ถูก', wrong: 'ผิด',
              maxStreak: 'สตรีคสูงสุด', stationReached: 'สถานีที่ถึง', again: 'อีกรอบ', menu: 'เมนู' },
  },
  beepCount: 4, // correct / wrong / milestone+wave / gameover

  // localStorage keys (scope: 2 game keys + mute preference)
  keys: { best: 'express-math:best', dailyPrefix: 'express-math:daily:', mute: 'express-math:mute' },

  // feedback intake (story.md assumed decision #0 — shell link, not a system)
  feedbackUrl: 'https://github.com/pheerawit-wasinphongwanit/express-math/issues/new?labels=feedback&template=feedback.yml',
};

global.EXPRESS_DATA = DATA;
if (typeof module !== 'undefined' && module.exports) module.exports = { DATA };
})(typeof window !== 'undefined' ? window : globalThis);
