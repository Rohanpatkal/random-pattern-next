# 06 · Learning from you — ratings and taste

Files: `services/scoring.ts` (`adjustWeights`), `app/page.tsx` (`rate`)

Evolution runs on its own. Your input changes **what it aims for** — the
weights — not the patterns directly.

## What each rating does (`rate()` in page.tsx)

| Rating | Weights | Favourites | Archive |
|---|---|---|---|
| **good (1)** | nudge toward this pattern's strengths | added (max 10) | rescored next round |
| **avg (2)** | unchanged | — | counted only |
| **bad (3)** | nudge away from its strengths | — | its niche is emptied, then rescored |

## The weight update

```ts
weight[m] += direction * 0.3 * (measure[m] - 0.5)    // clamped to 0..3
```

- `measure - 0.5`: above-average measures go one way, below-average the other.
- `direction`: +1 good, −1 bad.
- `0.3`: learning rate — small steps, so one click can't wreck the taste.

Example, 👍 a pattern with symmetry 0.9, shapes 0.2:
symmetry +0.12, shapes −0.09.

This is a very small version of **preference learning**: no model is
trained, the user's choices directly steer an objective.

## Favourites
Good genomes are kept and used as parents 20% of the time, so the search
spends more effort near what you like, not just weighting it higher.

## Sliders
The **Taste** sliders write the same `weights` directly. Ratings and sliders
are two ways to edit one thing.

## Try it
1. Reset. Rate 10 symmetric patterns **good** and 10 noisy ones **bad**.
2. Watch the Taste sliders move after each click.
3. Evolve 50 — the gallery should lean toward what you liked.

## Check yourself
1. Why does avg not change the weights?
2. Why delete a bad pattern from its niche instead of just lowering weights?
3. What happens if you rate the same pattern "good" 30 times?

Next: [07-app-worker-storage.md](07-app-worker-storage.md)
