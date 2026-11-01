# 05 · MAP-Elites — evolving many kinds of good

File: `services/elites.ts`

## The problem with "keep the single best"
A normal genetic algorithm converges: everything becomes copies of one
winner. Boring, and stuck if that winner is a local peak.

## The MAP-Elites idea
Split the space into **niches** by *what a pattern is like*, and keep the
best **per niche**. Patterns only compete with similar patterns.

Here the map is 8 × 8 = 64 niches:

```
             detail (edges 0% → 40%+) →
  light   ┌──┬──┬──┬──┬──┬──┬──┬──┐
    │     │  │  │  │  │  │  │  │  │
 darkness ├──┼──┼──┼──┼──┼──┼──┼──┤
    ▼     │  …  one elite per cell  │
  dark    └──┴──┴──┴──┴──┴──┴──┴──┘
```

```ts
row = floor(darkRatio * 8)
col = floor((edges / 0.4) * 8)     // capped at 7
niche = row * 8 + col
```

The axes (what kind) are separate from the score (how good). That split is
the key idea.

## One round (`evolveBatch`, 24 children)

```
for 24 times:
    child  = chooseChild()
    niche, score = evaluate(child)
    if archive[niche] empty or score > archive[niche].score:
        archive[niche] = child          ← "elite"
```

### `chooseChild` — explore vs exploit

| Situation | Child |
|---|---|
| Fewer than 8 niches filled | random (bootstrap) |
| 10% chance | random (keep exploring) |
| otherwise | parent = a favourite (20%) or a random elite |
| …then 30% | `mutate(crossover(parent, other elite))` |
| …else | `mutate(parent)` |

## Rescoring
When weights or grid size change, old scores are stale. `rescoreArchive`
re-evaluates every elite into a fresh archive. An elite can **move niche**
(a different grid size changes its darkness/edges) or lose its niche to
another elite.

## Stats
- **coverage** = filled / 64 — diversity found
- **mean** = average elite score — overall quality
- **best** = top score

## Try it
- Reset learning, Evolve 50, and watch coverage on the chart. Some corners
  (very dark + very smooth) may stay empty — the genome can't easily make them.
- Change cell size: the next round rescores and the gallery reshuffles.

## Check yourself
1. Why does a mediocre pattern survive if it is the only one in its niche?
2. What would happen with `RANDOM_CHANCE = 0`? With `1`?
3. Why are the niche axes *not* among the score measures' targets?

Read more: Mouret & Clune 2015, *Illuminating search spaces by mapping elites*.

Next: [06-learning-from-you.md](06-learning-from-you.md)
