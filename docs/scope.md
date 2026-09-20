# Game Scope — ด่วนคณิต EXPRESS MATH

> game-scope (Stage 2) · adapted สำหรับ arcade ตาม `game/decisions.md` · canon [RF-0002]
> Contract rule: build อาจไป **ต่ำกว่า** budget ได้ แต่ **เกินไม่ได้เด็ดขาด**

## Done state (one sentence + playtest definition of shipped)

**หนึ่งประโยค:** เกมคณิต arcade บนมือถือ — แตะตอบโจทย์ 4 ตัวเลือกกับนาฬิกา time-bank, run ละ 90–180 วิ ไต่ระดับ 4 ชั้นเรียน (🎒ประถม→📱ม.ต้น→📐ม.ปลาย→🎓มหาลัย), เก็บสถิติสูงสุด + ด่วนประจำวันไว้ในเครื่อง, เปิดจากไฟล์ HTML เดียว zero-dep ได้ทั้งมือถือ/เดสก์ท็อป

**"Shipped" = playtest ผ่านทั้งหมด:**
1. ผู้เล่นจริง (เจ้าของเกม) เล่นจบ ≥1 run บนมือถือจนเวลาหมด — run ยาวเข้ากรอบ 90–180 วิ
2. Best score บันทึก/โชว์ถูก · เปิด daily run ซ้ำวันเดียวกันได้โจทย์ชุดเดียวกัน (seed จากวันที่)
3. สลับแท็บกลาง run → เวลาหยุดอัตโนมัติ กลับมาเล่นต่อได้
4. Self-test ในไฟล์ (generator invariants) 100% เขียว

## Rule of halves (บันทึกไว้ตรงไปตรงมา)

Draft แรก: 10 ชนิดโจทย์ · 10 waves · 3 modes → ครึ่งแรก: 5 · 5 · 2 → ครึ่งสอง: 3 · 3 · 1
**ผลล็อกจริง:** ชนิดโจทย์ 6 (ตามสัญญา decisions.md ข้อ 5 — ไม่ใช่ scope ใหม่) · waves 4 · modes 2 (เล่น自由 + daily — ทั้งคู่ติดสัญญา decisions.md ข้อ 6) — คือสิ่งที่ต่ำกว่า draft ครึ่งหนึ่ง และทุกอย่างนอกสัญญาถูกครึ่งจนเหลือ 0

## Budgets

| Dimension | Budget (v1) |
|---|---|
| Playtime | run 90–180 วิ (เดิม 60–120 — ขยายพร้อมรีเมธไต่ระดับ, issue #4) · session 5–15 นาที (~3–6 runs + daily) |
| Waves (ระดับชั้น) | 4: 🎒ประถม · 📱ม.ต้น · 📐ม.ปลาย · 🎓มหาลัย |
| ชนิดโจทย์ | 8 (เดิม 6 — เพิ่มพร้อมรีเมธ, issue #4): บวก ลบ คูณ หาร-lงตัว เทียบ เติมลำดับ ร้อยละ ลำดับการคำนวณ |
| Screens | 3: เมนู · เล่น · ผล |
| UI copy ไทย | ≤ 60 คำ |
| SFX | ≤ 4 beeps (WebAudio, ปิดได้, จำสถานะ mute) |
| Meta/persistence | localStorage 2 keys (`best`, `daily:<YYYY-MM-DD>`) |
| Endings | — (n/a สำหรับ arcade: แทนด้วย score/best) |

## Systems allowed (≤2, named)

1. **Question & distractor generator** — deterministic PRNG (seed ได้) + 6 ชนิดโจทย์ + near-miss distractors + operand range ตาม wave
2. **Run-state mechanic** — state machine เดียว: time-bank + streak multiplier + wave progression + score อัปเดตจาก transition ถูก/ผิด

**Shell (scaffolding ไม่ใช่ system, มี cap แข็ง):** 3 screens · localStorage read/write ตรง ๆ · beep player — ห้ามงอกเกิน cap

## Wave table + กติกาตัวเลข (ล็อก ณ scope — ปรับตัวเลขได้หลัง playtest ถ้า run หลุดกรอบ 60–120 วิ)

| Wave | Operand | ถูกได้เวลา | เงื่อนไขเข้า wave |
|---|---|---|---|
| 1 🎒 ประถม | +,−: 2–20 (ผลลัพธ์ ≤ 20) · ×,÷: 2–9 | +3 วิ | เริ่มเกม |
| 2 📱 ม.ต้น | +,−: 2–50 · ×,÷: 2–12 (ตารางสูตรคูณ) | +4 วิ | คะแนน ≥ 150 |
| 3 📐 ม.ปลาย | +,−: 5–99 · ×,÷: 4–15 · ร้อยละ k 2–12 | +5 วิ | ≥ 500 |
| 4 🎓 มหาลัย | +,−: 10–199 · ×,÷: 12–19 · ลำดับการคำนวณ a×b−c×d · ร้อยละ k 3–20 (+p75) | +6 วิ | ≥ 1,200 |

- เริ่ม run: เวลา 45 วิ · ผิด: −5 วิ + รีเซ็ตสตรีค · milestone ทุก 10 ถูกติด: +8 วิ + โบนัส 50×wave คะแนน · **เลื่อนชั้น (wave-up): +8 วิ** · เพดานเวลา 75 วิ — กราฟเวลารุ่งขึ้นตามความยาก (feedback issue #4: ยากขึ้น = ได้เวลามากขึ้น)
- คะแนน/ข้อ = 10 × wave × multiplier · multiplier = 1 + ⌊streak/5⌋ สูงสุด 8 (ถูกติดต่อเนื่องทุก 5 ข้อ +1)
- โจทย์: จำนวนเต็มบวกล้วน · หาร-lงตัวเท่านั้น · ตัวเลือกไม่ซ้ำ ต้อง ≥ 0 ทั้งหมด
- Near-miss distractors (กฎเหมือนกันทุกชนิด): ผลจาก "คิดพลาดจริง" เช่น a×(b±1), (a±1)×b, ±1, ±2, ±10, a÷(d±1), ลำดับผิดเครื่องหมาย diff — แล้ว regenerate ถ้าชนกัน/ติดลบ
- **เบี่ยงสัญญาแห่งเดียว (โปร่งใส):** โจทย์ชนิด "เทียบ" ให้ 3 ตัวเลือก (<, =, >) ตามธรรมชาติของคำถาม — input ยัง tap-only ตาม decisions.md ข้อ 4 เสมอ

## Non-goals (ชัดเจนว่า "ไม่ทำ" ไม่ใช่ลืม)

- ไม่มีเนื้อเรื่อง/บทสนทนา/ตัวละคร (decisions.md ข้อ 1)
- ไม่มี accounts, backend, leaderboard ออนไลน์
- ไม่มี typing/keypad, ไม่มีค่าลบ/ทศนิยม/เศษส่วน
- ไม่มี adaptive difficulty, ไม่มี tutorial (มีบรรทัดใบ้เดียวบนเมนู)
- ไม่มีรูปภาพ/AI art — typography + emoji เท่านั้น
- ไม่มี settings screen (ปุ่ม mute ประจำเมนู/หน้าเล่น)
- ไม่มีปุ่ม pause มือ (auto-pause จาก visibilitychange เท่านั้น)
- ไม่มี EN / localization

## Cut list (ดึงขึ้นมาได้เฉพาะเมื่อเกมเสร็จก่อนงบ)

0. **ชุด art เบา 4–7 ภาพ** (hero เมนู + แบนเนอร์ 4 สถานี + มาสคอต) — user เลือก A ไว้ก่อน แล้วกลับมาปรับทีหลัง (2026-09-18); ตอนดึงขึ้นมาต้องถาม art style ก่อนเสมอ [RF-0002 art pipeline]

1. PWA offline (service-worker cache) — แถวหน้าสุดตาม decisions.md ข้อ 13
2. แชร์การ์ดคะแนน daily (Web Share API)
3. EN language toggle
4. Brainy puzzle mode (โจทย์คิดนาน)
5. Adaptive difficulty
6. Haptic feedback (navigator.vibrate)
7. ปุ่ม pause มือ + หน้า pause
8. ปฏิทิน streak รายสัปดาห์ · สถิติย้อนหลัง

## Done checklist

- [ ] Single self-contained HTML เปิดจาก file:// ได้ทั้งมือถือ (portrait, thumb-zone) และเดสก์ท็อป [RF-0002]
- [ ] Generator 8 ชนิด: ตัวเลือกไม่ซ้ำ · ไม่ติดลบ · หาร-lงตัว · ร้อยละคำตอบเป็นจำนวนเต็ม · ลำดับการคำนวณเคารพลำดับเลขคณิต — พิสูจน์ด้วย self-test ในไฟล์
- [ ] Deterministic seed: daily run วันเดียวกัน = ลำดับโจทย์เดียวกันทุกเครื่อง
- [ ] Time-bank 45 / +3–6 ตามระดับ / เลื่อนชั้น +8 / −5 / milestone +8 / เพดาน 75 — run จริงอยู่ใน 90–180 วิ (playtest ยืนยัน)
- [ ] Multiplier 1→8 ทุก 5 ถูกติด · รีเซ็ตเมื่อผิด · คะแนน = 10×wave×multiplier (+โบนัส milestone)
- [ ] Wave thresholds 150 / 500 / 1,200 ทำงานถูก + เลื่อนชั้นได้ +8 วิ (capped 75)
- [ ] localStorage: `best` + `daily:<date>` · mute จำได้
- [ ] Auto-pause เมื่อ visibilitychange กลาง run
- [ ] UI ไทย ≤ 60 คำ · beeps ≤ 4 · ไม่มี asset ภายนอก
- [ ] Playtest ผู้เล่นจริงผ่านครบ 4 ข้อของนิยาม shipped ด้านบน
