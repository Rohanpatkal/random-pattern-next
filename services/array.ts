export type Grid = number[][];
export type Symmetry = "none" | "mirror" | "quad" | "kaleido";

export interface Style {
    symmetry: Symmetry;
    smoothing: number; // number of cellular-automaton passes
}

export const SYMMETRIES: Symmetry[] = ["none", "mirror", "quad", "kaleido"];
export const SMOOTHING_LEVELS = [0, 1, 2, 3];

export function createGrid(rows: number, cols: number, fill: number): Grid {
    return Array.from({ length: rows }, () => new Array<number>(cols).fill(fill));
}

// Each cell becomes 1 with the probability stored in the model.
export function sampleGrid(model: Grid): Grid {
    return model.map((row) => row.map((p) => (Math.random() < p ? 1 : 0)));
}

export function applySymmetry(grid: Grid, symmetry: Symmetry): Grid {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const out = grid.map((row) => [...row]);
    if (symmetry === "none") return out;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let sx = x < cols / 2 ? x : cols - 1 - x;
            let sy = symmetry === "mirror" || y < rows / 2 ? y : rows - 1 - y;
            // Kaleido also mirrors across the diagonal (square grids only).
            if (symmetry === "kaleido" && rows === cols && sx > sy) [sx, sy] = [sy, sx];
            out[y][x] = grid[sy][sx];
        }
    }
    return out;
}

// Majority rule over the 8 neighbours: turns noise into blobs and shapes.
export function smooth(grid: Grid, passes: number): Grid {
    let current = grid;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    for (let pass = 0; pass < passes; pass++) {
        const next = createGrid(rows, cols, 0);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let alive = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        alive += current[(y + dy + rows) % rows][(x + dx + cols) % cols];
                    }
                }
                next[y][x] = alive > 4 ? 1 : alive < 4 ? 0 : current[y][x];
            }
        }
        current = next;
    }
    return current;
}

export function generatePattern(model: Grid, style: Style): Grid {
    return smooth(applySymmetry(sampleGrid(model), style.symmetry), style.smoothing);
}
