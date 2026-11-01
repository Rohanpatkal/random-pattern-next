# 08 · Exercises

Work on a branch (`git switch -c learning/my-experiments`) so you can throw
changes away. Ordered from easy to hard.

## Warm-up
1. **Bigger archive.** Change `BINS` to 12 in `elites.ts`. What happens to
   coverage speed and the gallery?
2. **Batch size.** Set `BATCH = 100` in `page.tsx`. Does quality per round go
   up? Does the UI stay smooth?
3. **Mutation strength.** In `mutateGenome`, change `1 + floor(rand()*2)` to
   `1 + floor(rand()*5)`. Faster or slower progress? Why?

## Medium
4. **New measure: `density`.** Reward patterns that are ~30% dark. Add it to
   `Measure`, `MEASURES`, `DEFAULT_WEIGHTS`, and `measure()`. The slider
   appears automatically — why?
5. **New symmetry: `diagonal`.** Only mirror across the diagonal. Add it to
   `Symmetry`, `SYMMETRIES`, and `applySymmetry`.
6. **Different niche axes.** Replace "detail" with "number of regions"
   (reuse the flood fill). How does the gallery change?

## Hard
7. **Colour.** Add a `palette` gene (index into a list of colour pairs) and
   use it in `paint()`. Should colour affect the score?
8. **Export a genome.** Add a button that copies the shown genome as JSON,
   and an input that loads one. Then share patterns between browsers.
9. **Measure the speed-up.** Time `evolveBatch` for 24 children at cell size
   2 vs 20 with `performance.now()` inside the worker. Which function is
   the hot spot? (Hint: count loops in `measure`.)

## Answers to "check yourself" — think first, then verify in the code
- 02.2 `birth = 0`: light cells never turn dark; passes only shrink shapes.
- 03.1 Without wrapping, the tile edges differ and seams show when tiled.
- 04.1 About 0 — chance matches are subtracted.
- 05.2 `0`: no fresh randomness, can get stuck. `1`: pure random search, no learning.
- 06.3 Weights saturate at 0 or 3; favourites fill with copies.
- 07.1 It changes many times per second; refs avoid re-rendering for every field.
