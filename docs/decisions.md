# Game Decisions

> game-idea-grill (Stage 1) — settled 2026-09-18 · working title **«ด่วนคณิต EXPRESS MATH»**
> Genre: **pure arcade math game** (commute, score-chasing) — NOT a story game

## Decisions
<!-- numbered, one line each, in tree order -->

1. โครงเกม = pure arcade math (A) — ไม่มี story wrapper; emotion เป้าหมายคือความแม่น/flow ไม่ใช่ narrative takeaway
2. Core emotion = flow/streak rush — ตอบถูกต่อเนื่อง คอมโบขึ้น "one more run"
3. Player & session = มือถือ portrait มือเดียว · run 60–120 วิ · session 5–15 นาที · หยุดกลางคันได้ (interrupt-friendly)
4. Input = แตะคำตอบ 4 ตัวเลือกเท่านั้น — ไม่มี typing
5. เนื้อหาคณิต v1 = บวกลบคูณหาร + เทียบ/เติมลำดับเลข · ความยาก ramp เป็น wave ตามคะแนน · ไม่ adaptive (systems น้อย [RF-0002])
6. Meta/replay = localStorage: best score + daily run (seed รายวันเดียวกันทุกเครื่อง) — ไม่มี backend/account
7. Presentation = typography-first ตัวเลขใหญ่ + emoji feedback + WebAudio beep ปิดได้ — ไม่ใช้รูปหนัก [RF-0002]
8. Tech = single self-contained zero-dep HTML (เปิดจาก file:// หรือ GitHub Pages ก็ได้ [RF-0002])
9. Run-end = time-bank countdown — เริ่ม ~45 วิ · ถูก +2–4 วิ (ตาม wave) · ผิด −5 วิ + รีเซ็ตสตรีค · จบเมื่อเวลาหมด
10. Scoring = คะแนนฐาน × wave × ตัวคูณสตรีค (1→8, ผิดรีเซ็ต) + โบนัส milestone ทุก 10 ถูกติด
11. ภาษา UI = ไทยล้วน ป้ายน้อยชิ้น · EN toggle → cut list
12. Working title + flavor = «ด่วนคณิต EXPRESS MATH» ธีมรถไฟเบา ๆ (wave = สถานีถัดไป, streak = รถไม่หยุด) — ปรับได้ตอน scope
13. Offline = ยอมรับ "ต้องมีเน็ตตอนโหลดหน้า" ใน v1 · PWA offline → cut list แถวหน้าสุด

**Pipeline adaptation (ผลจากข้อ 1):** `game-scope` ใช้ systems/content budget แทน storylet budget; `game-story-design` ถูกแทนด้วย feedback-loop + wave-curve design; ไม่มี ending matrix (แทนด้วย score/wave design) — บอกทุกจุดที่เปลี่ยน ไม่ลอยข้ามเงียบ ๆ

## Assumptions not yet validated
<!-- what game-scope MUST enforce or check -->

- โจทย์ v1: จำนวนเต็มบวกล้วน · หารต้องลงตัว · ไม่มีค่าลบ/ทศนิยม
- ตัวเลือกหลอก = near-miss (±1, ผลจากการคำนวณผิดแบบจริง) — ต้องมี generator rule ชัด
- จับเวลาหยุดอัตโนมัติเมื่อแท็บถูกซ่อน/สลับ (visibilitychange)
- daily run รีเซ็ตเที่ยงคืนตามเวลาท้องถิ่นของเครื่องผู้เล่น
- ตัวเลข time-bank (45/+2–4/−5) ทำให้ run จริงอยู่ในกรอบ 60–120 วิ — **ต้องพิสูจน์ด้วย playtest**
- ค่าต่อ wave (วินาทีต่อโจทย์, ช่วงตัวเลข operand) = งานของ game-scope ต้องล็อกเป็นตาราง
- ปุ่มคำตอบ 4 ช่องเอื้อมถึงมือเดียวได้จริงบนจอมือถือ (thumb zone)
- "ต้องมีเน็ตตอนโหลด" ไม่เจ็บพอให้ต้องดึง PWA ขึ้นจาก cut list — ตัดสินหลังเล่นจริง

## Killed ideas & why

- Story wrapper รอบ arcade คณิต / story game ที่ใช้คณิตเป็นกลไก (Q1) — การอ่านระหว่างเดินทางคือ friction; session สั้น เก็บ emotion แบบ narrative ไม่ไหว
- Zen/no-timer mode (Q2) — แบน ไม่มี hook ให้สะสม; ไม่เกิด "one more run"
- โจทย์คิดนานแบบ brainy (Q2) — เหมาะกับโต๊ะ ไม่ใช่รถแกว่ง → cut list เป็น mode ถัดไป ไม่ใช่ v1
- พิมพ์ตัวเลข/keypad (Q4) — อุปสรรคบนรถที่แกว่ง; ความยากให้มาทางตัวเลือกหลอกแทน
- Adaptive difficulty (Q5) — เกิน systems budget v1 [RF-0002]
- EN language toggle (Q11) / PWA offline (Q13) — cut list ทั้งคู่ ยังไม่ kill ถาว ไว้หลัง playtest
