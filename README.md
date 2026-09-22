# ด่วนคณิต EXPRESS MATH 🚂

Zero-dependency mobile-first arcade math game (Thai UI). Answer 4-choice math questions
against a time-bank clock: correct answers add seconds, wrong answers cost 5s + your streak.
Ride through 4 stations (waves) of rising difficulty; chase your best score and the daily run.

## Run

Open `web/index.html` in any browser (works offline from `file://`, no build step, no CDN).
For a local server: `python3 -m http.server` in the repo root → http://localhost:8000/

## Test

```bash
node selftest.mjs
```

Checks generator invariants (unique choices, non-negative integers, exact division,
near-miss distractors), daily-seed determinism, tier reachability + run-length bands via
player simulations, multiplier math, and the UI copy budget.

## Docs

- `docs/decisions.md` — concept grill (stage 1)
- `docs/scope.md` — scope contract: budgets, systems, non-goals, cut list
- `docs/story.md` — design data: waves, generator recipes, result tiers, feedback loop
- `docs/kids.md` — kindergarten mode (โหมดอนุบาล) content source of truth: game registry, bands, pools, copy
- `docs/build.md` — build log & deviations
