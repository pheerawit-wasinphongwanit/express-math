# Game Design — ด่วนคณิต EXPRESS MATH
### (Stage 3: game-story-design → adapted เป็น systems & feedback design ตาม game/decisions.md)

> แหล่งความจริงสำหรับ build: ไฟล์นี้ + `game/scope.md` — แก้อะไรต้องแก้ที่นี่ก่อน ห้าม code-only edits
> Canon [RF-0002]: explicit trigger ทุก outcome · no dead ends · จำกัด systems

## Premise recap (2 lines)
เกมคณิต arcade ธีมรถไฟสายด่วน: แตะตอบโจทย์ให้ทัน before นาฬิกา time-bank หมด — ถูก = รถวิ่งต่อ, ผิด = เบรกหนัก
ทะลุ 4 สถานี (waves) เก็บสถิติสูงสุด + ด่วนประจำวัน (seed วันที่)

## Ending matrix → **Result-tier matrix** (arcade adaptation: "ending" = อันดับจบ run)

| id | ชื่อ (ธีมรถไฟ) | tone | trigger (คะแนน) | foreshadowed by |
|---|---|---|---|---|
| T1 | ผู้โดยสาร 🙂 | อบอุ่น กำลังใจ | < 300 | จบที่ W1–W2 |
| T2 | นักเดินทางตัวจริง 🎫 | พอใจ | 300–899 | ถึง W2–W3 |
| T3 | พนักงานตรวจตั๋ว 🎟️ | ภูมิใจ | 900–1,799 | ถึง W3 มั่นคง |
| T4 | นักบิดสายด่วน ⚡ | มันส์สุดขีด | 1,800–2,999 | W4 + streak ≥ 20 |
| T5 | หัวรถจักร 🚂 | ตำนาน | ≥ 3,000 | W4 + streak ≥ 35 (mult 8) |
| ★ | แต๊ะ! สถิติใหม่ 🎉 | เปรี้ยวปลายลิ้น | any tier + ทำลาย `best` | overlay บน result ปกติ |

**No dead ends:** run จบจากเวลาหมดเสมอ → ตกหนึ่ง tier พอดีเสมอ · ทุก tier พิสูจน์ reach ได้ใน playthrough matrix ล่าง

## Spine (run structure — anchors / tight vs open)

```
BOOT → เมนู (open: เล่นเรื่อยๆ / ด่วนประจำวัน + best + mute)
→ นับถอย 3-2-1 (tight, 1.5s)
→ W1 (open: วงตอบโจทย์ player-paced) → [คะแนน ≥150] interstitial "สถานีถัดไป" (tight, 1.5s)
→ W2 (open) → [≥500] → W3 (open) → [≥1,200] → W4 (open, จนเวลาหมด)
→ GAME OVER → หน้าผล (tight) → อีก run / กลับเมนู
```

## Waves (≈ chapters): goal + question mix + สิ่งที่ต่างจาก wave ก่อน

| Wave | goal รู้สึกได้ | mix โจทย์ | เปลี่ยนจากก่อนหน้า |
|---|---|---|---|
| 1 สถานีแรก | อุ่นเครื่อง มั่นใจ | + 45% · − 35% · เทียบ 20% | — (เลขเล็ก ตอบไว) |
| 2 ต่างจังหวะ | คูณเข้ามา เร่งขึ้น | + 20% · − 15% · × 45% · เทียบ 20% | operand ใหญ่ขึ้น, reward 45→เปลี่ยนตามตาราง scope |
| 3 ทางแยก | หาร + ลำดับ ต้องคิด | × 30% · ÷ 30% · ลำดับ 20% · + − 15% · เทียบ 5% | โจทย์ 2 ชนิดใหม่ |
| 4 ปลายทาง | โหมดเทพ | × 30% · ÷ 30% · ลำดับ 25% · เทียบ 15% | ลำดับเรขาคณิต (×2) โผล่, เลขใหญ่สุด |

## Qualities → **Run-state table** (ทั้งหมดอยู่ใน System #2 ตัวเดียว)

| ตัวแปร | ความหมาย | start | range | เปลี่ยนเมื่อ | อ่านโดย |
|---|---|---|---|---|---|
| timeBank | เวลาคงเหลือ | 45 วิ | [0, **90**] | ถูก +wReward · ผิด −5 · milestone +8 · ไหล −1/วิ | จบเกมที่ 0 · แถบเวลา |
| score | คะแนนสะสม | 0 | [0,∞) | ถูก +10×wave×mult · milestone +50×wave | wave gate · tier · best |
| streak | ถูกติดต่อ | 0 | [0,∞) | ถูก +1 · ผิด → 0 | multiplier · milestone |
| multiplier | ตัวคูณ | 1 | [1,8] | = 1+⌊streak/5⌋ cap 8 | คะแนน · UI |
| wave | สถานีปัจจุบัน | 1 | [1,4] | score ผ่าน gate 150/500/1,200 | operand · mix · reward |
| correct/wrong | สถิติรอบ | 0 | [0,∞) | ทุกคำตอบ | หน้าผล |

**เหตุผลที่เป็น system เดียว:** ทุกตัวแปรถูกอัปเดตโดย transition เดียวกัน (ตอบถูก/ตอบผิด/tick) — เหมือน storylet engine มี qualities หลายตัวใน state machine เดียว

## Question anatomy + generator recipes (build เขียนตามนี่ verbatim)

```js
Question = { type, prompt, choices[3–4], correctIndex, rewardSec }
// choices: ตัวเลือกไม่ซ้ำ ต้อง ≥0 ทั้งหมด · correctIndex สุ่มตำแหน่ง · สุ่มด้วย PRNG ที่ seed ได้ (daily = seed("YYYY-MM-DD"))
```

| type | สูตรโจทย์ | near-miss distractors (เลือก 3 ที่ distinct ≠ คำตอบ, ≥0; ชนกัน → regenerate) |
|---|---|---|
| บวก | a+b (range ตาม wave) | a+b±1, ±2, ±10, (a+1)+b |
| ลบ | a−b (a>b) | a−b±1, ±2, ±10, a−(b∓1) |
| คูณ | a×b | a×(b±1), (a±1)×b, a×b±a, a×b±b |
| หาร-lงตัว | สร้างจาก b×c=a แล้วถาม a÷b | c±1, c±2, c+b, c−b |
| ลำดับ | เลขคณิต d∈{2..6,10} โชว์ 4 ที ถามที่ 5 · W4: บางครั้ง ×2 เรขาคณิต | next±1, next±d, next+2d |
| เทียบ | A ⬜ B โดย A,B เป็น expression เล็ก และมัก |A−B|≤3 | ตัวเลือกคงที่ 3 ช่อง: <, =, > |

## Feedback loop (หัวใจส่ง emotion "flow/streak")

| เหตุการณ์ | ปฏิกิริยาบนจอ + เสียง |
|---|---|
| ตอบถูก | ปุ่มเขียว flash · score ลอยขึ้น · ตัวนับ streak เต้น · beep#1 สั้นสูง |
| multiplier ขึ้น (ทุก 5 ถูกติด) | แบนเนอร์ "คูณ x N!" · beep#1 พิทช์สูงขึ้นตาม tier |
| milestone ทุก 10 ถูกติด | "+8 วิ ⚡" burst · แถบเวลาเขียวกระพริบ · beep#3 |
| ตอบผิด | จอสั่น · ❌ บนปุ่มที่ถูก · "−5 วิ" แดงบนแถบเวลา · streak เป็นเส้นประ · beep#2 ต่ำ |
| wave-up | interstitial "🚉 สถานีถัดไป" · สีธีมเปลี่ยน · beep#3 |
| เวลาหมด | สั่นหนัก · beep#4 · slow fade → หน้าผล (คะแนนใหญ่ → tier → สถิติย่อ: ถูก/ผิด, streak สูงสุด, สถานี) · ปุ่ม "อีก run" ใหญ่สุด |

**Budget ที่ใช้:** UI copy ไทย ≈ เมนู 20 + เล่น 12 + ผล 18 + events 8 = **58/60 คำ** · beeps 4/4 (ถูก/ผิด/milestone-wave/จบ)

## Playthrough matrix (พิสูจน์ทุก tier reach ได้)

| run ตัวอย่าง | พฤติกรรม | ผลคร่าว | จบที่ |
|---|---|---|---|
| "ป้าตาขี้เกียจ" | W1 ตอบ ~7 วิ/ข้อ ผิดบ่อย | ~12 ข้อ ใน ~70 วิ · คะแนน ~120 | T1 (<300) ✓ |
| "ลูกไล่แท็กซี่" | W1–W2 แม่น แล้วพังที่หาร W3 | ~28 ข้อ · streak สูงสุด ~12 · ~600 | T2 ✓ |
| "เด็กเทพคณิต" | W1–W4 streak 40+ mult 8 | W4: 10×4×8=320/ข้อ · ~3,400 | T5 ✓ + สถิติใหม่ ★ |

## Replay-depth / variety check
Free run: seed สุ่มใหม่ + ปริมาณโจทย์ที่ต่างกันได้ต่อ wave > 1,000 รูปแบบ (operand space × types × ตำแหน่งคำตอบ) → ซ้ำรู้สึกไม่ซ้ำ · Daily: seed คงที่ต่อวัน**โดยตั้งใจ** (คุยโชว์กันได้) · ความลึก replay = best-chasing + daily streak

## Assumed decisions (ใหม่จาก stage นี้ — ค้านได้)
1. **เพดาน timeBank = 90 วิ** (ใหม่): กัน player แม่นมากสะสมเวลาไม่รู้จบ — ทำให้ run จบแน่นอน
2. ลำดับเรขาคณิต (×2) โผล่เฉพาะ W4 — ยังนับเป็น type "เติมลำดับ" ชนิดเดิม
3. เกณฑ์ tier (300/900/1,800/3,000) ปรับได้หลัง playtest จริง
4. เทียบใช้ 3 ตัวเลือก (เบี่ยงสัญญาที่ user ให้ไฟเขียวแล้วระหว่าง scope)
