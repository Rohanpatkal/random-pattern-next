# 03 · Rendering — from genome to pixels

File: `services/genome.ts` → `renderGenome(g, rows, cols)`

## The pipeline

```
 tile size = grid / tiles
      │
      ▼
 1. noiseTile       smooth random blobs, thresholded at density
      ▼
 2. applySymmetry   mirror the tile
      ▼
 3. runAutomaton    birth/survive rule, `passes` times
      ▼
 4. repeat tile     fill the full rows × cols grid
```

## The grid format
A pattern is a flat `Uint8Array`: cell `(x, y)` is `data[y * cols + x]`.
Flat typed arrays are much faster than `number[][]` (one memory block, no
nested arrays).

## Step 1 · Value noise
Pure per-cell randomness looks like TV static. To get blobs:
1. Make a **coarse** grid of random numbers (one per `scale` cells).
2. For each fine cell, **blend** the 4 surrounding coarse values
   (bilinear interpolation: blend horizontally, then vertically).
3. If the blended value `< density` → dark.

Bigger `noise` gene → bigger `scale` → bigger blobs.

## Step 2 · Symmetry
Each output cell copies from a "source" cell:
- **mirror**: right half copies left half.
- **quad**: also bottom copies top → 4-way.
- **kaleido**: quad + swap x/y across the diagonal → 8-way.

## Step 3 · Cellular automaton
For every cell, count the 8 neighbours, then:

```ts
const rule = alive ? g.survive : g.birth;
next = (rule >> n) & 1;
```

Neighbours **wrap around** the edges (`(x - 1 + tw) % tw`), so the tile
joins seamlessly when repeated. With the majority rule, each pass smooths
noise into rounder, cleaner shapes — like erosion.

## Step 4 · Tiling
`data[y*cols+x] = tile[(y % th) * tw + (x % tw)]` — modulo repeats the tile.

## Try it
Set `passes` to see the effect — temporarily add to `newPattern()` in
`app/page.tsx`:

```ts
showGenome({ ...randomGenome(), passes: 0 });   // raw noise
showGenome({ ...randomGenome(), passes: 6 });   // heavily smoothed
```

## Check yourself
1. Why must automaton edges wrap if `tiles > 1`?
2. What would `density = 0.8` with the majority rule tend to produce?
3. Why is the tile at least 4×4 (`Math.max(4, …)`)?

Next: [04-scoring.md](04-scoring.md)
