# Self-learning (4.0)

The generator improves its patterns without anyone rating them. It evolves
small **recipes** (genomes), scores the patterns they draw, and keeps the best
recipe for each **kind** of pattern. What it learns is saved in the browser,
so the next visit continues from where it stopped.

User ratings are still available. They are optional and tune the taste.

## What changed from 3.0

| 3.0 | 4.0 | Why |
|---|---|---|
| Learned one chance per cell | Evolves a recipe (genome) | A recipe learns shapes, not positions; it works at any cell size |
| One model per cell size | One archive for all sizes | Recipes don't depend on grid size; the archive is re-scored when the size changes |
| Kept the top 6 of 30, then forgot them | MAP-Elites archive: best per kind | Keeps a varied set of good patterns instead of one look |
| Novelty measure (8 past patterns) | Removed | The archive keeps variety on its own |
| Nested `number[][]` arrays on the page's main thread | Flat `Uint8Array` in a Web Worker | About 4× faster per pattern, and the page never freezes |
| About 100 KB per model in localStorage | A few KB of genomes | localStorage is enough; IndexedDB is not needed |

## The genome (`services/genome.ts`)

A genome is 8 numbers that fully describe a pattern:

| Gene | Range | Effect |
|---|---|---|
| `seed` | any | Starting noise. The same seed always gives the same noise |
| `density` | 0.2–0.8 | Share of cells that start dark |
| `noise` | 0.02–0.25 | Size of the noise blobs, as a fraction of the tile |
| `birth` | 9-bit mask | A light cell turns dark when its number of dark neighbours is in this set |
| `survive` | 9-bit mask | A dark cell stays dark when its number of dark neighbours is in this set |
| `passes` | 0–6 | How many times the birth/survive rule runs |
| `symmetry` | none, mirror, quad, kaleido | How the tile is mirrored |
| `tiles` | 1–4 | How many times the tile repeats per side |

The rule is written like Game of Life notation. `B5678/S45678` is the 3.0
majority rule: born with 5 or more dark neighbours, survives with 4 or more.

### Drawing a genome: `renderGenome(genome, rows, cols)`
1. Work out the tile size: the grid divided by `tiles`.
2. Make smooth noise (bilinear value noise) from `seed`. Cells below `density` start dark.
3. Apply `symmetry`.
4. Run the birth/survive rule `passes` times. Edges wrap, so the tile repeats seamlessly.
5. Repeat the tile across the whole grid.

### Changing genomes
- `mutateGenome` changes one or two genes a little: nudges a number, flips one rule bit, or picks a new symmetry.
- `crossover` builds a child by taking each gene from one parent or the other.
- New genomes start near the majority rule, with up to 2 flipped bits, so they are rarely pure chaos.

## The archive: MAP-Elites (`services/elites.ts`)

The archive is an 8 × 8 grid of 64 **niches**. Each pattern is sorted into one niche by two properties:
- **Row: darkness.** The share of dark cells, light at the top and dark at the bottom.
- **Column: detail.** The share of neighbouring cells that differ (edges), from 0 to 40% or more, smooth on the left and detailed on the right.

Each niche keeps only its highest-scoring recipe, called its **elite**.

### One round: `evolveBatch()`, 24 children
For each child:
1. **Choose a parent.**
   - While fewer than 8 niches are filled, use a random new genome.
   - Otherwise there is a 10% chance of a random genome.
   - Otherwise there is a 20% chance of using a favourite (a genome you rated "good").
   - Otherwise use a random elite from the archive.
2. **Make the child.** 30% of the time, cross the parent with another elite, then mutate. Otherwise only mutate.
3. **Score it.** Draw the child, measure it, score it, and find its niche.
4. **Place it.** If the niche is empty, or the child beats the current elite, the child takes the niche.

Because each niche only competes with itself, the archive stays varied: a
great dark, detailed pattern never pushes out a great light, smooth one.

### Re-scoring: `rescoreArchive()`
When the weights change, or the cell size changes, every elite is redrawn and
scored again. It may move to a different niche. This happens at the start of
the next round.

## Scoring (`services/scoring.ts`)

These are the same measures as 3.0, without novelty. They work on flat arrays.

| Measure | Rewards |
|---|---|
| balance | 40–60% of cells dark |
| symmetry | Left-right and top-bottom mirror matches (random noise ≈ 0) |
| structure | Neighbouring cells that match (shapes rather than noise) |
| complexity | About 15% edges |
| shapes | 3–20 clear dark regions, with few specks under 4 cells |

`score = Σ(measure × weight) / Σ weights`. The default weights are 1, except
structure, which is 1.5.

## Ratings (optional)

| Rating | Effect |
|---|---|
| good | The genome joins the **favourites** (up to 10), which are used as parents 20% of the time. The weights move toward this pattern's strengths |
| avg | Counted only |
| bad | The weights move away from this pattern's strengths. If it came from the gallery, it is removed from its niche |

Any change to the weights re-scores the archive on the next round.

## Web Worker (`workers/evolve.worker.ts`)

The page sends the archive, weights, favourites, grid size and batch size. The
worker runs one round and sends back the new archive and the list of niches
that changed. The page then:
- redraws only those gallery tiles
- shows the newest elite
- updates the chart
- requests the next round

Only genomes are sent between the page and the worker, never pixel grids, so
the messages stay small.

## Using it

| Control | Does |
|---|---|
| **Evolve 50** | Runs 50 rounds of 24 children |
| **Auto** / **Stop** | Keeps evolving until stopped. The round in progress finishes first |
| Chart | Best score (blue), mean score (grey) and coverage (green, dashed) over the last 200 rounds |
| Elites gallery | The 64 niches. Click a tile to view and rate it |
| Taste sliders | Change the measure weights |
| Cell size | Any size works; the archive is re-scored on the next round |
| PNG | Downloads the current pattern |
| Reset learning | Clears everything, including saved 3.0 and 1.0 data |

**Coverage** is the share of the 64 niches that have an elite.

## Measured (Node, 100 × 100 grid, default weights)

| Rounds | Best | Mean | Coverage |
|---|---|---|---|
| 20 | 0.905 | 0.727 | 75% |
| 60 | 0.915 | 0.730 | 86% |
| 100 | 0.915 | 0.746 | 86% |

One round of 24 patterns takes about 18 ms. In 3.0, one round of 30 took
about 85 ms.

**Known issue for 4.1:** the best elites are almost always `quad` or `kaleido`
with 4 × 4 tiles. Symmetry and tiling produce mirror matches automatically, so
the symmetry measure rewards them for free. 4.1 should give credit only for
symmetry the style did not force.

## Tuning

| Setting | File | Effect |
|---|---|---|
| `BINS` | `services/elites.ts` | Archive resolution (8 → 64 niches) |
| `MAX_EDGES` | `services/elites.ts` | Edge share that counts as fully detailed |
| `RANDOM_CHANCE`, `FAVOURITE_CHANCE`, `CROSSOVER_CHANCE` | `services/elites.ts` | How parents are chosen and children made |
| Gene ranges, mutation steps | `services/genome.ts` | What recipes are possible, and how far children move from their parents |
| `BATCH`, `EVOLVE_ROUNDS` | `app/page.tsx` | Children per round, and rounds per "Evolve" click |
| `DEFAULT_WEIGHTS` | `services/scoring.ts` | Starting taste |

## Files

- `services/genome.ts`: the genome, drawing it, mutation and crossover
- `services/elites.ts`: the MAP-Elites archive, one evolution round, re-scoring and stats
- `services/scoring.ts`: the measures and the weighted score
- `services/service.ts`: saved state (archive, weights, favourites, history)
- `workers/evolve.worker.ts`: runs rounds off the main thread
- `app/page.tsx`: the canvas, gallery, controls and chart

Removed from 3.0: `services/array.ts`, `services/learning.ts`, `services/evolve.ts`.

## Roadmap

- **4.1:** learn the scoring from ratings (logistic regression), add pairwise
  "A or B?" rating, measure compressibility and multi-scale structure, and stop
  rewarding symmetry the style forced.
- **4.2:** colour palettes, a seamless-tile preview, and SVG export.
