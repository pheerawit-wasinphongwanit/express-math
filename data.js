// data.js — PURE DATA: mechanical transcription of docs/story.md + docs/scope.md. No logic.
// Editing rule: change docs/story.md FIRST, then mirror here. Never code-only fixes.
(function (global) {
'use strict';

const DATA = {
  // run rules (scope: wave table; story: state table) — time graph flipped by design (issue #4): harder level = more time
  startBankSec: 45,
  maxBankSec: 75,          // cap — story.md assumed decision #5 (tuned via self-test)
  waveUpBonusSec: 8,       // level-up bonus (เลื่อนชั้น)
  wrongPenaltySec: 5,
  milestoneEvery: 10,
  milestoneBonusSec: 8,      // retuned 6→8 (self-test: mid/strong medians into 90–180 band, issue #4)
  milestoneBonusPts: 50,   // × wave
  basePts: 10,             // score per correct = basePts × wave × multiplier

  // school levels (story.md wave table, rethemed per feedback issue #4); gates = score thresholds
  waves: [
    { name: 'ประถม',   icon: '🎒', gate: 0,    addLo: 2, addHi: 20,  mulLo: 2,  mulHi: 9,  addMaxResult: 20, geoChance: 0,    rewardSec: 3, theme: '#0ea5e9',
      mix: { add: 45, sub: 35, cmp: 20 } },
    { name: 'ม.ต้น',   icon: '📱', gate: 150,  addLo: 2, addHi: 50,  mulLo: 2,  mulHi: 12, addMaxResult: 0,  geoChance: 0,    rewardSec: 4, theme: '#0d9488',
      mix: { mul: 40, div: 25, add: 10, sub: 10, cmp: 15 } },
    { name: 'ม.ปลาย',  icon: '📐', gate: 500,  addLo: 5, addHi: 99,  mulLo: 4,  mulHi: 15, addMaxResult: 0,  geoChance: 0,    rewardSec: 5, theme: '#ea580c',
      mix: { pct: 25, ooo: 20, seq: 20, mul: 15, div: 10, cmp: 10 }, pctP: [10, 20, 25, 50], pctKLo: 2, pctKHi: 12 },
    { name: 'มหาลัย', icon: '🎓', gate: 1200, addLo: 10, addHi: 199, mulLo: 12, mulHi: 19, addMaxResult: 0, geoChance: 0.25, rewardSec: 6, theme: '#dc2626',
      mix: { ooo: 30, pct: 20, seq: 20, mul: 15, div: 15 }, pctP: [10, 20, 25, 50, 75], pctKLo: 3, pctKHi: 20, oooHard: true },
  ],

  // result tiers (story.md ending→tier matrix — thresholds retuned with school-level retheme, issue #4)
  tiers: [
    { min: 0,    name: 'ผู้โดยสาร',           emoji: '🙂' },
    { min: 400,  name: 'นักเดินทางตัวจริง',   emoji: '🎫' },
    { min: 1000, name: 'พนักงานตรวจตั๋ว',     emoji: '🎟️' },
    { min: 2000, name: 'นักบิดสายด่วน',       emoji: '⚡' },
    { min: 2500, name: 'หัวรถจักร',           emoji: '🚂' },
  ],

  // compare questions: fixed 3 choices (transparent deviation, approved at scope)
  cmpChoices: ['<', '=', '>'],

  // UI copy (Thai) — budget ≤ 60 words total (scope). Audio: 4 beeps max.
  copy: {
    menu:   { title: 'ด่วนคณิต', sub: 'EXPRESS MATH', play: 'เริ่มเล่น', daily: 'ด่วนประจำวัน',
              dailyHint: 'โจทย์ชุดเดียวกันทั้งวัน เทียบคะแนนกับเพื่อนได้',
              best: 'สถิติสูงสุด', today: 'วันนี้', hint: 'ตอบถูกได้เวลา ตอบผิดเสียเวลา', feedback: '📣 ฟีดแบ็ก', study: '📚 ทบทวน',
              kids: 'อนุบาล' },
    play:   { count3: '3', count2: '2', count1: '1', go: 'ไป!', levelUp: 'เลื่อนชั้น!', levelBonusSec: '+8 วิ',
              secBonus: '+8 วิ', secPenalty: '−5 วิ',
              paused: 'หยุดชั่วคราว', tapToResume: 'แตะเพื่อเล่นต่อ' },
    result: { timeUp: 'หมดเวลา', score: 'คะแนน', newBest: 'สถิติใหม่!', correct: 'ถูก', wrong: 'ผิด',
              maxStreak: 'สตรีคสูงสุด', stationReached: 'ระดับที่ถึง', again: 'อีกรอบ', menu: 'เมนู' },
  },
  beepCount: 4, // correct / wrong / milestone+wave / gameover

  // localStorage keys (scope: 2 game keys + mute preference)
  keys: { best: 'express-math:best', dailyPrefix: 'express-math:daily:', mute: 'express-math:mute' },

  // feedback intake (story.md assumed decision #0 — shell link, not a system)
  feedbackUrl: 'https://github.com/pheerawit-wasinphongwanit/express-math/issues/new?labels=feedback&template=feedback.yml',

  // study hub (story.md assumed decision #6 — shell link, not a system)
  studyUrl: 'study/index.html',
};

global.EXPRESS_DATA = DATA;
if (typeof module !== 'undefined' && module.exports) module.exports = { DATA };
})(typeof window !== 'undefined' ? window : globalThis);
