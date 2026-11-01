import { Grid } from "./array";

export type Measure = "balance" | "symmetry" | "structure" | "complexity" | "shapes" | "novelty";
export type Measures = Record<Measure, number>;
export type Weights = Record<Measure, number>;

export const MEASURES: Measure[] = ["balance", "symmetry", "structure", "complexity", "shapes", "novelty"];

export const DEFAULT_WEIGHTS: Weights = {
    balance: 1,
    symmetry: 1,
    structure: 1.5,
    complexity: 1,
    shapes: 1,
    novelty: 1,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Darkness close to 50% scores best; flat inside 40-60%.
function balance(grid: Grid): number {
    let dark = 0;
    let total = 0;
    for (const row of grid) for (const c of row) { dark += c; total++; }
    const d = total ? dark / total : 0;
    return clamp01(1 - Math.max(0, Math.abs(d - 0.5) - 0.1) / 0.4);
}

// Average of left-right and top-bottom mirror matches. Random noise ≈ 0.
function symmetry(grid: Grid): number {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    let h = 0;
    let v = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (grid[y][x] === grid[y][cols - 1 - x]) h++;
            if (grid[y][x] === grid[rows - 1 - y][x]) v++;
        }
    }
    const n = rows * cols || 1;
    return clamp01(((h + v) / (2 * n) - 0.5) * 2);
}

// Share of right/down neighbour pairs that match. Random noise ≈ 0.5.
function sameNeighbourRatio(grid: Grid): number {
    let same = 0;
    let pairs = 0;
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (x + 1 < grid[y].length) { pairs++; if (grid[y][x] === grid[y][x + 1]) same++; }
            if (y + 1 < grid.length) { pairs++; if (grid[y][x] === grid[y + 1][x]) same++; }
        }
    }
    return pairs ? same / pairs : 0;
}

function structure(grid: Grid): number {
    return clamp01((sameNeighbourRatio(grid) - 0.5) * 2);
}

// Edge density around 15% is "detailed but not chaotic".
function complexity(grid: Grid): number {
    const edges = 1 - sameNeighbourRatio(grid);
    return clamp01(1 - Math.abs(edges - 0.15) / 0.15);
}

// Rewards a handful of clear dark regions and penalises dust (tiny specks).
function shapes(grid: Grid): number {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const seen = new Uint8Array(rows * cols);
    const stack: number[] = [];
    let regions = 0;
    let dustCells = 0;
    let darkCells = 0;

    for (let start = 0; start < rows * cols; start++) {
        const sy = Math.floor(start / cols);
        const sx = start % cols;
        if (seen[start] || !grid[sy][sx]) continue;

        let size = 0;
        seen[start] = 1;
        stack.push(start);
        while (stack.length) {
            const i = stack.pop()!;
            const y = Math.floor(i / cols);
            const x = i % cols;
            size++;
            const neighbours = [
                y > 0 ? i - cols : -1,
                y < rows - 1 ? i + cols : -1,
                x > 0 ? i - 1 : -1,
                x < cols - 1 ? i + 1 : -1,
            ];
            for (const n of neighbours) {
                if (n >= 0 && !seen[n] && grid[Math.floor(n / cols)][n % cols]) {
                    seen[n] = 1;
                    stack.push(n);
                }
            }
        }

        darkCells += size;
        if (size < 4) dustCells += size;
        else regions++;
    }

    if (!regions) return 0;
    const countScore = Math.min(regions / 3, 1) * (regions > 20 ? 20 / regions : 1);
    const dust = darkCells ? dustCells / darkCells : 0;
    return clamp01(countScore * (1 - dust));
}

// Fraction of differing cells between two same-size grids.
export function distance(a: Grid, b: Grid): number {
    let diff = 0;
    let total = 0;
    for (let y = 0; y < a.length; y++) {
        for (let x = 0; x < a[y].length; x++) {
            if (a[y][x] !== b[y]?.[x]) diff++;
            total++;
        }
    }
    return total ? diff / total : 1;
}

// Distance to the closest archived pattern; 25%+ different counts as fully new.
function novelty(grid: Grid, archive: Grid[]): number {
    if (!archive.length) return 1;
    const closest = Math.min(...archive.map((a) => distance(grid, a)));
    return clamp01(closest / 0.25);
}

export function measure(grid: Grid, archive: Grid[]): Measures {
    return {
        balance: balance(grid),
        symmetry: symmetry(grid),
        structure: structure(grid),
        complexity: complexity(grid),
        shapes: shapes(grid),
        novelty: novelty(grid, archive),
    };
}

// Weighted average, 0..1.
export function totalScore(measures: Measures, weights: Weights): number {
    let sum = 0;
    let weightSum = 0;
    for (const m of MEASURES) {
        sum += measures[m] * weights[m];
        weightSum += weights[m];
    }
    return weightSum ? sum / weightSum : 0;
}

// A human rating nudges the weights toward what that pattern was strong at.
export function adjustWeights(weights: Weights, measures: Measures, direction: 1 | -1, rate = 0.3): Weights {
    const next = { ...weights };
    for (const m of MEASURES) {
        next[m] = Math.round(Math.min(3, Math.max(0, next[m] + direction * rate * (measures[m] - 0.5))) * 100) / 100;
    }
    return next;
}
