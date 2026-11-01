# 04 · Scoring — turning "looks good" into a number

File: `services/scoring.ts`

The computer can't see, so "good" is approximated by 5 measures, each 0–1.

## The measures

| Measure | Counts | Best when |
|---|---|---|
| **balance** | dark share | 40–60% dark |
| **symmetry** | mirror matches (left↔right, top↔bottom) | perfect mirror |
| **structure** | neighbour pairs that match | large solid areas |
| **complexity** | edges = 1 − matching pairs | about 15% edges |
| **shapes** | connected dark regions (flood fill) | 3–20 clear blobs, no specks |

## The "remove the chance baseline" trick
Random noise already matches its mirror/neighbour ~50% of the time. So:

```ts
score = clamp01((matchRatio - 0.5) * 2)
```

50% → 0, 100% → 1. Only *real* order earns points.

## Measures that pull against each other
- **structure** wants zero edges (one solid blob).
- **complexity** wants ~15% edges.
- **balance** forbids all-black or all-white.

Together they pull toward "clear shapes with some detail". If one measure
dominated, evolution would exploit it (e.g. plain black squares). Designing
measures that check each other is the core skill here.

## Shapes: flood fill
For each unvisited dark cell, push it on a stack, pop, count, push its dark
up/down/left/right neighbours. One loop = one region.
Regions under 4 cells are **dust** and reduce the score.

## Combining: weighted average

```
score = Σ(measure × weight) / Σ(weight)
```

Default weights are all 1 except `structure = 1.5`. Dividing by total weight
keeps the score in 0–1 whatever the weights are.

## Worked example
Measures: balance 1, symmetry 0.8, structure 0.7, complexity 0.6, shapes 0.5
Default weights → (1 + 0.8 + 1.05 + 0.6 + 0.5) / 5.5 = **0.72** → shows "72".

## Try it
- Drag **symmetry** to 3 and the others to 0, then Evolve 50. The gallery
  fills with kaleido/quad patterns.
- Drag **complexity** to 3 only — note how mazes appear on the right side.

## Check yourself
1. What score does random static get on symmetry and structure? Why?
2. Why does `balance` use a flat zone (40–60%) instead of exactly 50%?
3. Could a pattern score 1.0 on everything? Why not?

Next: [05-map-elites.md](05-map-elites.md)
