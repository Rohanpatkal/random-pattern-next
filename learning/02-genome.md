# 02 · The genome — a recipe, not a picture

File: `services/genome.ts`

## Why a recipe?
Earlier versions (1.0–3.0) learned per-cell values, so what they learned was
tied to one grid size. A **genome** stores *how to draw*, so the same genome
works at 25×25 or 250×250. It is also tiny — a few numbers instead of
thousands of cells.

## The 8 genes

```ts
interface Genome {
    seed: number;      // which random noise to start from
    density: number;   // 0.2..0.8  share of cells that start dark
    noise: number;     // 0.02..0.25 blob size
    birth: number;     // 9-bit mask
    survive: number;   // 9-bit mask
    passes: number;    // 0..6
    symmetry: "none" | "mirror" | "quad" | "kaleido";
    tiles: number;     // 1..4
}
```

## Bitmasks for rules (the trickiest gene)
A cell has 0–8 dark neighbours. A 9-bit number stores "yes/no" for each count.

```
bit:      8 7 6 5 4 3 2 1 0
birth = 0b1 1 1 1 0 0 0 0 0   → born with 5,6,7,8 neighbours
```

Reading it: `(mask >> n) & 1` is 1 if count `n` is in the set.
`describeGenome` prints this as `B5678/S45678` (Game of Life notation).

## Seeded randomness
`seededRandom(seed)` is **mulberry32**, a tiny hash-based generator.
`Math.random()` gives different numbers each time; `seededRandom(42)` gives
the *same* sequence every time. That is what makes a genome reproducible.

## Three ways to make genomes

| Function | Use | How |
|---|---|---|
| `randomGenome()` | Exploration | Random values; rules start near the majority rule with 0–2 bits flipped |
| `mutateGenome(p)` | Small steps | Copies `p`, changes 1–2 genes a little |
| `crossover(a, b)` | Mixing | Each gene from `a` or `b`, 50/50 |

Starting rules near `B5678/S45678` matters: fully random rules mostly produce
static or solid black. Biased starts give interesting results more often.

## Try it
- Press **Space** repeatedly: each new pattern is a mutation of an elite.
  Read the label (e.g. `quad · 2×2 tiles · B5678/S45678 × 3`) and see how
  it changes.
- In a browser console mentally decode `B4678/S35678`: what changed vs majority?

## Check yourself
1. Why can one genome be drawn at any cell size?
2. What does `birth = 0` mean? (Hint: no count triggers birth.)
3. Why does `mutateGenome` copy with `{ ...parent }` first?

Next: [03-rendering.md](03-rendering.md)
