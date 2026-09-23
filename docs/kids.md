# docs/kids.md — โหมดอนุบาล (kindergarten mode) · content source of truth

> **Editing rule (docs-first):** this file owns kindergarten content. Change it FIRST, then mirror into `kids/kids-data.js` — never code-only edits (same rule as `data.js` ↔ `docs/story.md`).
> Architecture & contracts: TECH-SPEC (iso/spec-breakdown-express-math-kids-20260922-0708) · Pressure-free core: no timer, no score, no win/lose, unlimited retry — feedback is the cartoon pair only [G3, NG3].

## Game registry (F-02)

| id | icon | caption (for parents) | co-play (S-10) | skill | family (zone) |
|---|---|---|---|---|---|
| count | 🍊 | นับดูสิ | – | นับจำนวน (F-05) | number |
| match | 🎴 | จับคู่เหมือนกัน | – | จำนวน↔สัญลักษณ์ (F-06) | number |
| compare | 🐟 | ข้างไหนมากกว่า | ✔ (round-1 co-play game, OQ-B) | มาก–น้อย / ใหญ่–เล็ก (F-07) | compare |
| shapes | 🔺 | รูปทรงน่ารัก | – | รูปทรง + แบบรูป (F-08) | shape |
| order | 🦆 | เรียงให้ถูก | – | การเรียงลำดับ (F-09, multi-step) | arrange |
| sort | 🧺 | จัดเข้ากลุ่ม | – | จัดหมวดหมู่ (F-10, multi-step) | arrange |
| samediff | 🪞 | เหมือนกันเลย | – | เหมือน–ต่าง (F-13) | visual |
| shadow | 🌑 | เงาใครเอ่ย | – | จับคู่เงา (F-14) | visual |
| positions | 📍 | บน–ล่าง–ใน–นอก | – | ตำแหน่งเชิงพื้นที่ (F-15) | visual |
| length | 📏 | ยาว–สั้น | – | ความยาว (F-16) | compare |
| weight | ⚖️ | หนัก–เบา | – | น้ำหนัก (F-17) | compare |
| partwhole | 🌓 | ครึ่ง–เต็ม | – | ส่วน–ทั้งหมด (F-19) | visual |

## Hub zones (F-02 · FEATURES-OQ-D default: single scrolling board, 5 skill-family zones)

| zone id | marker | label (for parents) | games (✓ = registered; others = wave-2 plan) |
|---|---|---|---|
| number | 🔢 | เลขและปริมาณ | count ✓ · match ✓ · equalgroups · deal · neighbors |
| compare | 🆚 | เปรียบเทียบ | compare ✓ · length ✓ · weight ✓ · pairoff |
| shape | 🔷 | รูปทรงและแบบรูป | shapes ✓ · shapehunt |
| visual | 👀 | มองภาพ | samediff ✓ · shadow ✓ · positions ✓ · partwhole ✓ |
| arrange | 🧩 | จัดและเรียง | order ✓ · sort ✓ · colorsort · trace · routine |

Zone marker = the family's marker icon — never any member game's icon (ST-[11], mirrors the sort-bin marker∉members rule). Membership covers exactly the registered games.

## Age bands (F-11) — params-only difficulty (a band switch changes only generator params)

| game · param | littles 🐣 (น้องเล็ก 3–4) | bigs 🐥 (น้องใหญ่ 5–6) |
|---|---|---|
| count — range × choices | 1–3 × 3 | 1–10 × 4 |
| match — value range × cards | 1–3 × 3 | 1–10 × 4 |
| compare — groups max · minGap · size ratio | 6 · **2** (no near-ties) · 1.5× | 6 · 1 · 1.25× |
| shapes — pattern length · kinds · choices | 3 · 2 · 3 | 4–5 · 3 · 4 |
| order — items | 2–3 | 3–4 |
| sort — items per round | 3 | 4–6 |
| samediff — find choices · odd members · varying attrs | 3 · 3 · 1 | 5 · 4 · 2 |
| shadow — เงา choices · หมวดตัวลวง | 2 · ต่างหมวด (cross) | 4 · หมวดเดียวกันได้ (profile ยังต่าง) |
| positions — ความสัมพันธ์ในฉาก (= จำนวนตัวเลือก) | 2 | 4 |
| length — ชิ้น · อัตราส่วนคู่ขั้นต่ำ | 2 · ≥1.5× (no near-ties) | 3 · ≥1.25× |
| weight — ชิ้น · ช่องห่าง class ขั้นต่ำ | 2 · ≥2 | 3 · ≥1 |
| partwhole — การ์ด · ทิศทางผ่า | 2 · ตั้ง (v) | 4 · ตั้ง/นอน/เฉียง (v/h/d) |

Band is read at session start; manual icon picker on the hub (OQ-A); resets every mode entry (OQ-E — nothing persists, NG3).

## Item pools (content only)

- **count** emojis: 🍊 🍎 🍓 🍌 🍇 🐥 🐟 🎈 ⭐ 🍪
- **compare** groups: 🐟 🐥 🍓 🧸 · singles (two sizes): 🎈 🍩 🍊 ⭐
- **shapes** elements: 🔺 🟢 ⬛ ⭐ 🟡 🔵 (patterns are pure cycles: element *i* = kinds[*i* mod *k*])
- **order** characters (same character, distinct sizes): 🦆 🐢 🐝
- **sort** category pairs (unambiguous 2-bin partition; bin icon = category marker, never duplicates a member emoji — owner feedback 2026-09-22: 🧺/🌾 read as «basket vs rice» and confused both kids and parents):
  - 🍉 fruits **ผลไม้**: 🍌 🍎 🍓 🍇 🍊 ↔ 🐾 animals **สัตว์**: 🐥 🐰 🐟 🐸 🐝
  - ☁️ sky **ฟ้า**: 🕊️ ✈️ 🎈 🪁 🌈 ↔ 🌊 sea **ทะเล**: 🐠 🐙 🐋 🦀 ⛵ (place-based pair: things that go up vs things that live in water)
- **samediff** attribute groups (F-13 — the round's rule is «same kind»; each group is a crisp, unambiguous kind for 3–6 y.o.):
  - fruits: 🍓 🍎 🍇 🍒 🍍 · animals: 🐰 🐷 🐔 🐭 🐸 · vehicles: 🚗 🚌 🚲 🚂 🛴 · toys: 🧸 🎲 🥁 🪀 🎈
  - *find-same*: sample + choices; exactly one choice is the sample's kind, distractors differ — `varying attrs` = how many OTHER kinds the distractors come from (1 → 2 in bigs, so bigs choices span 3 kinds). *odd-one-out*: ≥3 conforming friends of one kind + exactly one deviant (members 3 → 4 in bigs).
- **shadow** คู่ของ↔เงา (F-14 — 4 หมวด × 4 ชิ้น; `p` = silhouette profile ของชิ้นนั้น ใช้ตรวจ pool-level uniqueness; เรนเดอร์เงา = CSS-filter fallback, อัปเกรด art ชุดเงาที่ T-051 — รอ owner spot-review ร่วมกับ art นั้น [R15]):
  - animals: 🐘 `elephant` · 🦒 `giraffe` · 🐧 `penguin` · 🦋 `butterfly`
  - vehicles: 🚗 `car` · 🚲 `bike` · 🚁 `heli` · 🚢 `boat`
  - fruits: 🍌 `banana` · 🍍 `pineapple` · 🍇 `grapes` · 🍈 `melon`
  - toys: 🧸 `bear` · 🎈 `balloon` · 🪁 `kite` · 🎲 `dice`
  - อีโมจิและ profile ต้องไม่ซ้ำทั้ง pool (16 ชิ้น 16 profile — ST-[7]) · littles ตัวลวงมาจากหมวดอื่นเสมอ (cross) · bigs อนุญาตหมวดเดียวกันแต่ profile ยังต่าง
- **positions** ฉากบน–ล่าง–ใน–นอก (F-15 — anchors = 🪑 โต๊ะ + 📦 กล่อง; ทุกฉากเป็น bijection ลง on/under/in/out ครบ 4 ความสัมพันธ์ ชิ้นละหนึ่ง — ST-[7]):
  - 🐱 on · 🐭 under · ⚽ in · 🦆 out
  - 🧸 on · 🐶 under · 👕 in · 🪁 out
  - 🍎 on · 🐰 under · 🎁 in · 🚗 out
  - รอบหยิบ subset ตามจำนวนความสัมพันธ์ของ band (2→4) แล้วสุ่มถาม 1 ความสัมพันธ์ — แตะ *ตัวของ* ที่อยู่ในความสัมพันธ์นั้น
- **length** ยาว–สั้น (F-16 — ไม่มี pool: ความยาวสังเคราะห์เป็นจำนวนเต็มบวก ให้ pairwise ratio ≥ ขั้นต่ำของ band เสมอ ไม่มีคู่เฉียด; เรนเดอร์ = แท่ง data-scaled วางขนานบนแนวฐานร่วม)
- **weight** คลาสน้ำหนักคัดแล้ว เรียงหนัก→เบา (F-17 — curated contrastive เท่านั้น ห้ามคู่เฉียดแบบ แอปเปิ้ล–ส้ม; รอ owner spot-review ร่วม art ชุด 2 ที่ T-052 [R15]):
  - 🐘 elephant · 🚗 car · 🍉 watermelon · 🍎 apple · 🪶 feather (5 คลาส — rank ตามลำดับ)
  - รอบหยิบชิ้นจากคลาสต่างกันแบบช่องห่าง rank ≥ ขั้นต่ำของ band (littles ≥2, bigs ≥1) — ranking ภายในรอบ strict เสมอ
- **partwhole** ครึ่ง↔เต็ม (F-19 — wholes 6 ชิ้น คู่ครึ่ง↔เต็มเป็น bijection โดยโครงสร้าง clip-path: ครึ่ง = ตัวของเต็มถูกผ่าตามทิศ; อัปเกรด art ชุด 3 ที่ T-053 — รอ owner review [R15]):
  - 🍕 · 🍉 · 🍪 · 🌭 · 🥕 · 🥨
  - โจทย์ = ครึ่ง (ผ่าตาม `cut` ของรอบ) · ตัวเลือก = ของเต็ม · ทิศผ่าเป็น band param: littles ตั้ง (v) เท่านั้น → bigs เพิ่ม นอน (h) / เฉียง (d)

## Copy (Thai, for parents — kids screens are icon-led; budget ≤ 40 words, ST-[9])

- Chooser (S-10): **คนเดียว** / **สองคน**
- Handoff (F-12 pass-and-play): **ส่งไม้ต่อ**
- Overlay captions (F-04, owner bug report 2026-09-22 — cartoon pair alone read as "no message"; images stay textless by artbrief): pass **เก่งมาก!** / nudge **ลองอีกครั้งนะ** (encouraging, never scolding — OQ4)
- Sort bin labels (F-10, owner feedback 2026-09-22 — small label under each bin icon so parents can verbalize the rule): **ผลไม้** / **สัตว์** / **ฟ้า** / **ทะเล**

## Tunables (display cadence only — never gameplay)

| key | value | meaning |
|---|---|---|
| overlayMs | 1600 | cartoon auto-dismiss (single permitted timer, tap-to-skip) |
| handoffExtraMs | 1000 | co-play pass cartoon lingers longer (same single timer) |
| playerIcons | 🧒 / 🧑 | turn indicator — parity, not identities |

## Cartoon pair (F-04)

- Primary: generated pair via `kids/artbrief.json` (mcp-image, gemini-3-pro-image, 2026-09-22) — `assets/pass.jpg` (cheering) / `assets/nudge.jpg` (encouraging wave + heart).
- Fallback: owner-approved inline-SVG pair embedded in `kids/index.html` — shows automatically if an asset fails to load.
- Both poses must read **encouraging**; nudge is never disappointed/scolding (OQ4 ruling) — every pair change requires owner review before merge [RF-0002].
