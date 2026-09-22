# docs/kids.md — โหมดอนุบาล (kindergarten mode) · content source of truth

> **Editing rule (docs-first):** this file owns kindergarten content. Change it FIRST, then mirror into `kids/kids-data.js` — never code-only edits (same rule as `data.js` ↔ `docs/story.md`).
> Architecture & contracts: TECH-SPEC (iso/spec-breakdown-express-math-kids-20260922-0708) · Pressure-free core: no timer, no score, no win/lose, unlimited retry — feedback is the cartoon pair only [G3, NG3].

## Game registry (F-02)

| id | icon | caption (for parents) | co-play (S-10) | skill |
|---|---|---|---|---|
| count | 🍊 | นับดูสิ | – | นับจำนวน (F-05) |
| match | 🎴 | จับคู่เหมือนกัน | – | จำนวน↔สัญลักษณ์ (F-06) |
| compare | 🐟 | ข้างไหนมากกว่า | ✔ (round-1 co-play game, OQ-B) | มาก–น้อย / ใหญ่–เล็ก (F-07) |
| shapes | 🔺 | รูปทรงน่ารัก | – | รูปทรง + แบบรูป (F-08) |
| order | 🦆 | เรียงให้ถูก | – | การเรียงลำดับ (F-09, multi-step) |
| sort | 🧺 | จัดเข้ากลุ่ม | – | จัดหมวดหมู่ (F-10, multi-step) |

## Age bands (F-11) — params-only difficulty (a band switch changes only generator params)

| game · param | littles 🐣 (น้องเล็ก 3–4) | bigs 🐥 (น้องใหญ่ 5–6) |
|---|---|---|
| count — range × choices | 1–3 × 3 | 1–10 × 4 |
| match — value range × cards | 1–3 × 3 | 1–10 × 4 |
| compare — groups max · minGap · size ratio | 6 · **2** (no near-ties) · 1.5× | 6 · 1 · 1.25× |
| shapes — pattern length · kinds · choices | 3 · 2 · 3 | 4–5 · 3 · 4 |
| order — items | 2–3 | 3–4 |
| sort — items per round | 3 | 4–6 |

Band is read at session start; manual icon picker on the hub (OQ-A); resets every mode entry (OQ-E — nothing persists, NG3).

## Item pools (content only)

- **count** emojis: 🍊 🍎 🍓 🍌 🍇 🐥 🐟 🎈 ⭐ 🍪
- **compare** groups: 🐟 🐥 🍓 🧸 · singles (two sizes): 🎈 🍩 🍊 ⭐
- **shapes** elements: 🔺 🟢 ⬛ ⭐ 🟡 🔵 (patterns are pure cycles: element *i* = kinds[*i* mod *k*])
- **order** characters (same character, distinct sizes): 🦆 🐢 🐝
- **sort** category pairs (unambiguous 2-bin partition):
  - 🧺 basket (fruits): 🍌 🍎 🍓 🍇 🍊 ↔ 🌾 meadow (animals): 🐥 🐰 🐟 🐸 🐝
  - ☁️ sky: 🕊️ ✈️ 🎈 🪁 🌈 ↔ 🌊 sea: 🐠 🐙 🐋 🦀 ⛵

## Copy (Thai, for parents — kids screens are icon-led; budget ≤ 40 words, ST-[9])

- Chooser (S-10): **คนเดียว** / **สองคน**
- Handoff (F-12 pass-and-play): **ส่งไม้ต่อ**

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
