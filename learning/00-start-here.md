# 00 · Start here

A guided tour of the project. Read the files in order; each one covers one idea
and ends with small experiments to try.

| # | File | You will understand |
|---|---|---|
| 01 | [01-big-picture.md](01-big-picture.md) | What the app does and how the pieces connect |
| 02 | [02-genome.md](02-genome.md) | How 8 numbers describe a whole pattern |
| 03 | [03-rendering.md](03-rendering.md) | Noise → symmetry → cellular automaton → tiling |
| 04 | [04-scoring.md](04-scoring.md) | How a pattern gets a number between 0 and 1 |
| 05 | [05-map-elites.md](05-map-elites.md) | The evolution loop and the 8×8 archive |
| 06 | [06-learning-from-you.md](06-learning-from-you.md) | How ratings and sliders change the taste |
| 07 | [07-app-worker-storage.md](07-app-worker-storage.md) | React page, Web Worker, localStorage |
| 08 | [08-exercises.md](08-exercises.md) | Bigger challenges to test your understanding |

`SELF_LEARNING.md` in the root is the reference spec. These files are the
"why and how" walkthrough.

## Run it

```bash
npm install
npm run dev     # open http://localhost:3000
```

Keep the app open while reading: most sections say "try this in the UI".

## Glossary

| Term | Meaning |
|---|---|
| **Pattern** | A grid of cells, each dark (1) or light (0) |
| **Genome** | The recipe that draws a pattern |
| **Measure** | One 0–1 quality reading of a pattern (balance, symmetry…) |
| **Weights** | How much each measure counts — the "taste" |
| **Score** | Weighted average of measures, 0–1 |
| **Niche** | One of 64 slots: a darkness × detail combination |
| **Elite** | The best genome found so far for a niche |
| **Archive** | All 64 niches together |
| **Round / batch** | 24 children tried against the archive |
