# 01 · The big picture

## One-sentence summary
The app **breeds recipes for black-and-white patterns**, keeps the best recipe
for each kind of pattern, and lets you nudge what "best" means by rating.

No ML library is used. It is all plain TypeScript: a random number generator,
a few grid loops, and a simple evolutionary algorithm.

## Files

```
app/page.tsx              UI: canvas, buttons, gallery, sliders (React, client-side)
workers/evolve.worker.ts  Runs evolution in a background thread
services/genome.ts        Genome type, random/mutate/crossover, renderGenome()
services/scoring.ts       5 measures, totalScore(), adjustWeights()
services/elites.ts        MAP-Elites archive: nicheOf(), evolveBatch(), rescoreArchive()
services/service.ts       LearnerState + save/load in localStorage
config.json               Canvas size (500×500), default cell size, history length
```

## The data flow

```
           ┌───────────── genome.ts ─────────────┐
 Genome ──►│ renderGenome() ─► Pattern (Uint8Array)│
           └──────────────────────┬──────────────┘
                                  ▼
                          scoring.ts measure()  ──►  5 measures
                                  │                      │
                                  │             totalScore(weights)
                                  ▼                      ▼
                          elites.ts nicheOf()          score
                                  └──────── slot ◄───────┘
                                  "keep if empty or better"
```

One **round** = do that 24 times. **Evolve 50** = 50 rounds. **Auto** = forever.

## Dependency direction
`genome` ← `scoring` ← `elites` ← `service` / `worker` ← `page`.
Lower files never import higher ones. That is why the algorithm files can run
in a Worker: they know nothing about React or the DOM.

## Try it
1. Click **Evolve 50** and watch the gallery fill from empty.
2. Watch the chart: *coverage* (filled niches) rises fast, *best* rises slowly.
3. Click a gallery tile — notice the top-left tiles are light and smooth,
   bottom-right ones are dark and busy.

Next: [02-genome.md](02-genome.md)
