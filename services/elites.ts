// MAP-Elites: instead of one best pattern, keep the best pattern for every
// "kind" of pattern. Kinds are a BINS × BINS grid of darkness × detail.

import { crossover, Genome, mutateGenome, Pattern, randomGenome, renderGenome } from "./genome";
import { darkRatio, measure, Measures, sameNeighbourRatio, totalScore, Weights } from "./scoring";

export const BINS = 8;
export const NICHES = BINS * BINS;

// Edge share at or above this lands in the most detailed column.
const MAX_EDGES = 0.4;
const RANDOM_UNTIL = 8; // fill this many niches with random genomes first
const RANDOM_CHANCE = 0.1;
const FAVOURITE_CHANCE = 0.2;
const CROSSOVER_CHANCE = 0.3;

export interface Elite {
    genome: Genome;
    measures: Measures;
    score: number;
}

export type Archive = (Elite | null)[];

export interface BatchResult {
    archive: Archive;
    changed: number[]; // niche indexes that got a new elite
}

export function emptyArchive(): Archive {
    return new Array<Elite | null>(NICHES).fill(null);
}

// Row = darkness (light at top), column = detail (smooth at left).
export function nicheOf(p: Pattern): number {
    const row = Math.min(BINS - 1, Math.floor(darkRatio(p) * BINS));
    const edges = 1 - sameNeighbourRatio(p);
    const col = Math.min(BINS - 1, Math.floor((edges / MAX_EDGES) * BINS));
    return row * BINS + col;
}

export function evaluate(genome: Genome, weights: Weights, rows: number, cols: number) {
    const pattern = renderGenome(genome, rows, cols);
    const measures = measure(pattern);
    return { niche: nicheOf(pattern), elite: { genome, measures, score: totalScore(measures, weights) } };
}

function filledElites(archive: Archive): Elite[] {
    return archive.filter((e): e is Elite => e !== null);
}

function chooseChild(archive: Archive, favourites: Genome[]): Genome {
    const filled = filledElites(archive);
    if (filled.length < RANDOM_UNTIL || Math.random() < RANDOM_CHANCE) return randomGenome();

    const parent = favourites.length && Math.random() < FAVOURITE_CHANCE
        ? favourites[Math.floor(Math.random() * favourites.length)]
        : filled[Math.floor(Math.random() * filled.length)].genome;

    if (Math.random() < CROSSOVER_CHANCE) {
        const other = filled[Math.floor(Math.random() * filled.length)].genome;
        return mutateGenome(crossover(parent, other));
    }
    return mutateGenome(parent);
}

// A child takes a niche if the niche is empty or the child scores higher.
export function evolveBatch(
    archive: Archive, weights: Weights, rows: number, cols: number, batch: number, favourites: Genome[],
): BatchResult {
    const next = [...archive];
    const changed = new Set<number>();
    for (let i = 0; i < batch; i++) {
        const { niche, elite } = evaluate(chooseChild(next, favourites), weights, rows, cols);
        const current = next[niche];
        if (!current || elite.score > current.score) {
            next[niche] = elite;
            changed.add(niche);
        }
    }
    return { archive: next, changed: [...changed] };
}

// Re-scores every elite after the weights or grid size change. Elites can move niches.
export function rescoreArchive(archive: Archive, weights: Weights, rows: number, cols: number): Archive {
    const next = emptyArchive();
    for (const old of filledElites(archive)) {
        const { niche, elite } = evaluate(old.genome, weights, rows, cols);
        const current = next[niche];
        if (!current || elite.score > current.score) next[niche] = elite;
    }
    return next;
}

export function archiveStats(archive: Archive) {
    const filled = filledElites(archive);
    let best: Elite | null = null;
    let total = 0;
    for (const e of filled) {
        total += e.score;
        if (!best || e.score > best.score) best = e;
    }
    return {
        best,
        mean: filled.length ? total / filled.length : 0,
        coverage: filled.length / NICHES,
    };
}
