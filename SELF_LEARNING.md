# Self-learning

The generator can improve its patterns without anyone rating them. It makes many
candidates, scores them with built-in rules (its "taste"), and learns from the
best ones. What it learns is saved in the browser, so the next visit carries on
from where it stopped.

User ratings are still available. They are optional and also tune the taste.

## How one generation works

`services/evolve.ts` → `evolveStep()`

1. **Sample.** Make 30 candidate patterns (`POPULATION`) from the current model.
   Each candidate uses a style (symmetry + smoothing) chosen by `pickStyle`.
2. **Score.** Score each candidate with `measure()` and `totalScore()` from
   `services/scoring.ts`.
3. **Select.** Keep the top 20% (`ELITE_FRACTION`), which is 6 patterns.
4. **Learn.**
   - `learnFromElites()` moves each cell's chance of being dark 10% of the
     way toward the elites' average for that cell.
   - It then pulls every cell 0.5% back toward 50%, so the model never
     freezes on one pattern.
   - Each style's score is updated with the average score it reached in
     this generation.
5. **Archive.** Every 5 generations, the best pattern is added to an archive of
   the last 8 top patterns. The novelty measure uses this archive.

This is the cross-entropy method: sample, keep the best, and move the
distribution toward them.

## The model

- One value per cell: the chance (5%–95%) that the cell is dark.
- New models start at 50% everywhere.
- Each cell size has its own model, saved under its grid size (for example `100x100`).

## Scoring (the "taste")

Each measure returns 0–1. The total score is the weighted average of all
measures. You can change the weights with the sliders (0–3).

| Measure | Rewards | How |
|---|---|---|
| balance | Neither empty nor solid | Full score when 40–60% of cells are dark |
| symmetry | Mirror symmetry | Left-right and top-bottom matches, rescaled so random noise ≈ 0 |
| structure | Shapes rather than noise | Share of neighbouring cells that match, rescaled so noise ≈ 0 |
| complexity | Detailed but not chaotic | Peaks when about 15% of neighbour pairs differ (edges) |
| shapes | A few clear regions, no dust | Flood fill counts dark regions; best with 3–20 regions; specks under 4 cells count against it |
| novelty | Not repeating itself | Difference from the closest archived pattern; 25% or more different = 1 |

Default weights: `structure` 1.5, all others 1.

## Ratings (optional)

- **good / avg / bad** still update the model directly (`learnFromRating`).
- **good** also raises the weight of measures the pattern scored well on, and
  lowers the weight of those it scored poorly on (`adjustWeights`).
- **bad** does the opposite.
- **avg** does not change the weights.

Over time, the self-scoring moves closer to your own taste.

## Using it

| Control | Does |
|---|---|
| **Evolve 50** | Runs 50 generations, one per animation frame, and shows the best pattern each time |
| **Auto** / **Stop auto** | Keeps evolving until stopped |
| Score chart | Best (blue) and average (grey) score for the last 200 generations |
| Taste sliders | Change the measure weights; these apply from the next generation |
| Reset learning | Clears models, archives, style scores, weights and history |

Progress is saved every 10 generations, and whenever evolution stops.

## What to expect

- Scores usually rise quickly in the first 10–20 generations.
- After that, scores often dip slightly. Once the model settles on a look, new
  candidates resemble the archive, so their novelty score drops. This keeps
  the patterns changing instead of repeating one design. Lower the **novelty**
  weight if you want the generator to settle down.
- Speed: one generation of a 100×100 grid takes about 85 ms. Small cell sizes
  (2–3 px) give larger grids and evolve more slowly.

## Tuning

| Setting | File | Effect |
|---|---|---|
| `POPULATION` | `services/evolve.ts` | More candidates give better choices but run slower |
| `ELITE_FRACTION` | `services/evolve.ts` | Lower values make it pickier but less varied |
| `rate`, `decay` in `learnFromElites` | `services/learning.ts` | How fast it learns, and how fast it forgets |
| `ARCHIVE_SIZE`, `ARCHIVE_EVERY` | `services/evolve.ts` | How long novelty "remembers" past patterns |
| `DEFAULT_WEIGHTS` | `services/scoring.ts` | Starting taste |

## Files

- `services/scoring.ts`: the measures, the weighted score, and rating-based weight changes
- `services/evolve.ts`: one self-learning generation
- `services/learning.ts`: model updates (`learnFromElites`, `learnFromRating`) and style choice and scores
- `services/array.ts`: pattern sampling, symmetry and smoothing
- `services/service.ts`: saved state (models, archives, weights, score history)
- `app/page.tsx`: the controls, the chart and the drawing

## Possible next steps

- Evolve the generator's rules themselves (cellular-automaton rules, noise
  settings) instead of only per-cell chances.
- Run evolution in a Web Worker so very small cell sizes don't slow the page.
