import { Pattern } from "./genome";

// Novelty from 3.0 is gone: the MAP-Elites archive keeps patterns varied instead.
export type Measure = "balance" | "symmetry" | "structure" | "complexity" | "shapes";
export type Measures = Record<Measure, number>;
export type Weights = Record<Measure, number>;

export const MEASURES: Measure[] = ["balance", "symmetry", "structure", "complexity", "shapes"];

export const DEFAULT_WEIGHTS: Weights = {
    balance: 1,
    symmetry: 1,
    structure: 1.5,
    complexity: 1,
    shapes: 1,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function darkRatio({ data }: Pattern): number {
    let dark = 0;
    for (let i = 0; i < data.length; i++) dark += data[i];
    return data.length ? dark / data.length : 0;
}

// Darkness close to 50% scores best; flat inside 40-60%.
function balance(p: Pattern): number {
    return clamp01(1 - Math.max(0, Math.abs(darkRatio(p) - 0.5) - 0.1) / 0.4);
}

// Average of left-right and top-bottom mirror matches. Random noise ≈ 0.
function symmetry({ rows, cols, data }: Pattern): number {
    let h = 0;
    let v = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const c = data[y * cols + x];
            if (c === data[y * cols + cols - 1 - x]) h++;
            if (c === data[(rows - 1 - y) * cols + x]) v++;
        }
    }
    const n = rows * cols || 1;
    return clamp01(((h + v) / (2 * n) - 0.5) * 2);
}

// Share of right/down neighbour pairs that match. Random noise ≈ 0.5.
export function sameNeighbourRatio({ rows, cols, data }: Pattern): number {
    let same = 0;
    let pairs = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const c = data[y * cols + x];
            if (x + 1 < cols) { pairs++; if (c === data[y * cols + x + 1]) same++; }
            if (y + 1 < rows) { pairs++; if (c === data[(y + 1) * cols + x]) same++; }
        }
    }
    return pairs ? same / pairs : 0;
}

function structure(p: Pattern): number {
    return clamp01((sameNeighbourRatio(p) - 0.5) * 2);
}

// Edge density around 15% is "detailed but not chaotic".
function complexity(p: Pattern): number {
    const edges = 1 - sameNeighbourRatio(p);
    return clamp01(1 - Math.abs(edges - 0.15) / 0.15);
}

// Rewards a handful of clear dark regions and penalises dust (tiny specks).
function shapes({ rows, cols, data }: Pattern): number {
    const seen = new Uint8Array(rows * cols);
    const stack = new Int32Array(rows * cols);
    let regions = 0;
    let dustCells = 0;
    let darkCells = 0;

    for (let start = 0; start < data.length; start++) {
        if (seen[start] || !data[start]) continue;

        let size = 0;
        let top = 0;
        seen[start] = 1;
        stack[top++] = start;
        while (top) {
            const i = stack[--top];
            const x = i % cols;
            size++;
            const neighbours = [
                i >= cols ? i - cols : -1,
                i < data.length - cols ? i + cols : -1,
                x > 0 ? i - 1 : -1,
                x < cols - 1 ? i + 1 : -1,
            ];
            for (const n of neighbours) {
                if (n >= 0 && !seen[n] && data[n]) {
                    seen[n] = 1;
                    stack[top++] = n;
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

export function measure(p: Pattern): Measures {
    return {
        balance: balance(p),
        symmetry: symmetry(p),
        structure: structure(p),
        complexity: complexity(p),
        shapes: shapes(p),
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
