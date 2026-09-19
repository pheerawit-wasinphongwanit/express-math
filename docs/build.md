# Build Log — ด่วนคณิต EXPRESS MATH

## What shipped (files + how to run)

```
index.html    # shell + full CSS (screens, themes, feedback animations) — open in any browser
data.js       # PURE DATA: waves/mixes/tiers/copy — mechanical transcription of docs/story.md
core.js       # PURE LOGIC: PRNG, 6 question generators, run state machine — no DOM
engine.js     # browser runtime: screens, time-bank timer, feedback, audio (4 beeps), daily, auto-pause
selftest.mjs  # node selftest.mjs — zero-dep verification gate
docs/             # decisions.md, scope.md, story.md (design source of truth, synced from nexus-agent/game/)
```

Run: open `index.html` (works offline from `file://`) or serve the repo root and visit `/web/`.
Remote: `https://github.com/pheerawit-wasinphongwanit/express-math` (SSH URL failed — no SSH key in build env; pushed via HTTPS).

## Self-test results

```
===== SELF-TEST: 29 passed, 0 failed, 0 warn =====
[1] generator invariants: 4 waves × 2,000 questions — 0 violations
[2] determinism: same date seed → identical sequence; different day → different
[3] multiplier math: 1+⌊streak/5⌋ cap 8, reset on wrong, bank math (capped)
[4] simulations (300 seeds × 3 models):
    weak   (acc .60, ~6.7s/q): median 48s · scores 0–540   · best wave 3/4
    mid    (acc .85, ~4.9s/q): median 93s · scores 10–1920  · best wave 4/4
    strong (acc .97, ~3.9s/q): median 122s · scores 390–2840 · best wave 4/4
    → every tier T1–T5 reachable; strong hits wave 4; weak never exceeds T2
[5] budgets: UI copy 38/60 words · beeps 4/4 · 4 waves · 6 types · 5 tiers
```

## Changelog

**Menu daily-mode explainer (2026-09-19, player question via feedback):** player asked how ด่วนประจำวัน differs from เริ่มเล่น → added one-line hint under the daily button (copy `menu.dailyHint` in data.js, `#dailyHint` subnote in index.html, wired in renderMenu). Copy budget 42/60 ✓ · self-test 29/29 ✓. No rule/data change — pure copy/UI.

## Playtest notes & fixes

**Tuning round 1 (self-test driven, before any human play):**
- strong model survived 158s median (over the 60–120s band) → tuned **through story.md first**, then data.js: bank cap 90→50s, W3/W4 rewards 3/2→2/1s, milestone +8→+6s → strong median 122s ✓
- after shortening runs, T5 (≥3,000) became unreachable (strong max 2,840) → tier thresholds T4/T5 1,800/3,000→1,500/2,600 (story.md assumed decision #3 allows this)

**Human playtest: PENDING** — shipped checklist (docs/scope.md) requires: full run ends by timeout in 60–120s feel, best saved, daily reproducible same-day, auto-pause on tab switch, thumb-zone reach.

## Deviations from story.md (each with reason)

1. **File layout** — `story.js` (storylet contract) → `data.js` (arcade data) + new `core.js` (pure logic, DOM-free). Reason: arcade adaptation agreed in `decisions.md`; core/UI separation lets `selftest.mjs` exercise the exact runtime logic (Clean Architecture).
2. **Timer drains during answer feedback flash** (350–800ms) but freezes during countdown/wave interstitial/pause. Reason: engine ruling consistent with the spine — tight scripted sections don't drain; open answering sections do.
3. **multup feedback** = streak-badge bump + rising beep pitch, not a banner overlay. Reason: overlay collided with the next question (multup fires exactly when the loop continues); copy word 'คูณ' removed (38/60 budget), story.md feedback table updated.
4. **Haptics not implemented** — `navigator.vibrate` is on the scope cut list (#6); contract honored.
5. **localStorage uses 3 keys** (`best`, `daily:<date>`, `mute`) — story.md checklist already required mute persistence; scope's "2 keys" covered the game-progress keys only.
6. Tier table + wave rewards differ from scope's original numbers — legitimized via story.md tuning clauses (assumed decisions #1/#3), scope synced.

## Hosting

- Repo made **public** (user decision — GitHub Pages on private repos needs Pro) via API.
- GitHub Pages: branch `main`, root `/` — API constraint: branch-source only serves `/` or `/docs`, so game files moved from `web/` to repo root (commit `refactor: move game files...`); design docs stay in `docs/` (unpublished).
- Live: https://pheerawit-wasinphongwanit.github.io/express-math/ — all 4 files verified HTTP 200.

## Feedback intake (2026-09-18, user request)

- Channel: GitHub Issues — form `.github/ISSUE_TEMPLATE/feedback.yml` (ประเภท/รายละเอียด/เครื่อง)
- In-game: ปุ่ม 📣 ฟีดแบ็กบนเมนู → เปิดหน้า new-issue พร้อม template (story.md assumed decision #0, shell link ไม่ใช่ system)
- Background service: `.github/workflows/feedback.yml` — ทำงานทันทีเมื่อ issue ถูกสร้าง (GitHub Actions = infra ของ GitHub รันตลอด ไม่ผูกกับเครื่อง agent): ติด label + ตอบกลับขอบคุณ + ส่งแจ้งเตือน Telegram ถึงเจ้าของ
- E2E test: issue #1 → run 12s → label ✓ comment ✓ · issue 2 → telegram HTTP 200 ✓ (secrets set 2026-09-18)
- Triage round 2026-09-18 (PM): both [test] issues passed — owner confirmed Telegram receipt for #2. Closed same round with resolution comments (#1, #2) after PAT granted Issues write; feedback queue empty.
