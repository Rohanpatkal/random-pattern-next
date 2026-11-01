# 07 · App, worker and storage

Files: `app/page.tsx`, `workers/evolve.worker.ts`, `services/service.ts`

## Why a Web Worker?
One round renders and scores 24 patterns — heavy loops. On the main thread
the page would freeze. A Worker is a separate thread; the page sends it a
message and gets the result back.

```
page.tsx                          evolve.worker.ts
requestRound() ── postMessage ──►  onmessage:
   {archive, weights, favourites,     rescore? → rescoreArchive()
    rows, cols, batch, rescore}       evolveBatch()
onRound()    ◄── postMessage ──    {archive, changed, rescored}
   save, redraw changed tiles,
   requestRound() again if rounds remain
```

Only data crosses the boundary (it is copied), which is why the services
are pure functions with no DOM access.

Created with:
```ts
new Worker(new URL("../workers/evolve.worker.ts", import.meta.url))
```
Next.js/webpack sees this pattern and bundles the worker file.

## State in page.tsx
- `stateRef` (`useRef`) holds `LearnerState` — mutable, changes every round.
  Mutating a ref doesn't re-render, so `forceRender(n => n + 1)` triggers
  the UI update when needed.
- `useState` is used for UI-only values: `cellSize`, `shown`, `running`, `history`.
- `remainingRef`: rounds left (`Infinity` for Auto). Stop sets it to 0; the
  round in flight finishes and the loop ends.
- `rescoreRef`: set when weights change, sent with the next round.

## Drawing
`paint()` fills a white rect, then a dark rect per dark cell. The gallery
redraws only the `changed` niches each round (or all after a rescore).

## Storage (`service.ts`)
- Key `pattern-learner:v4` in `localStorage` — just JSON.
- Saved every 10 rounds, on stop, and after each rating/slider change.
- `loadState` merges saved data over defaults, so new fields don't break old saves.
- All access is in `try/catch`: private mode or full storage → learn in memory.
- `archiveSize` records the grid size scores were computed at; a mismatch
  triggers a rescore.

## Keyboard
`1` good · `2` avg · `3` bad · `Space` new pattern.

## Check yourself
1. Why is `LearnerState` in a ref and not in `useState`?
2. What happens if you close the tab mid-Auto? What's lost?
3. Why does the `onmessage` handler get reassigned every render?

Next: [08-exercises.md](08-exercises.md)
