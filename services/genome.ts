// A genome is a small recipe for a pattern. The same genome can be drawn at
// any grid size, so what is learned is the look, not where each pixel goes.

export type Symmetry = "none" | "mirror" | "quad" | "kaleido";
export const SYMMETRIES: Symmetry[] = ["none", "mirror", "quad", "kaleido"];

export interface Genome {
    seed: number; // starting noise
    density: number; // 0.2..0.8, share of cells that start dark
    noise: number; // 0.02..0.25, noise blob size as a fraction of the tile
    birth: number; // 9-bit mask: light cell turns dark with n dark neighbours
    survive: number; // 9-bit mask: dark cell stays dark with n dark neighbours
    passes: number; // 0..6 cellular-automaton passes
    symmetry: Symmetry;
    tiles: number; // 1..4 repeats per side
}

// Flat grid: cell (x, y) is data[y * cols + x], 1 = dark.
export interface Pattern {
    rows: number;
    cols: number;
    data: Uint8Array;
}

// Majority rule from 3.0: born with 5+ dark neighbours, survive with 4+.
const MAJORITY_BIRTH = 0b111100000;
const MAJORITY_SURVIVE = 0b111110000;

// Small seeded random number generator (mulberry32), so a genome always draws the same pattern.
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pick = <T,>(items: T[], rand: () => number) => items[Math.floor(rand() * items.length)];

function randomSeed(rand: () => number): number {
    return Math.floor(rand() * 2 ** 32);
}

function flipBit(mask: number, rand: () => number): number {
    return mask ^ (1 << Math.floor(rand() * 9));
}

export function randomGenome(rand: () => number = Math.random): Genome {
    let birth = MAJORITY_BIRTH;
    let survive = MAJORITY_SURVIVE;
    // Start near the majority rule; a few flipped bits give new behaviour without pure chaos.
    for (let i = Math.floor(rand() * 3); i > 0; i--) birth = flipBit(birth, rand);
    for (let i = Math.floor(rand() * 3); i > 0; i--) survive = flipBit(survive, rand);

    return {
        seed: randomSeed(rand),
        density: 0.2 + rand() * 0.6,
        noise: 0.02 + rand() * 0.23,
        birth,
        survive,
        passes: Math.floor(rand() * 7),
        symmetry: pick(SYMMETRIES, rand),
        tiles: 1 + Math.floor(rand() * 4),
    };
}

// Usually changes one or two genes a little.
export function mutateGenome(parent: Genome, rand: () => number = Math.random): Genome {
    const g = { ...parent };
    const changes = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < changes; i++) {
        switch (Math.floor(rand() * 8)) {
            case 0: g.seed = randomSeed(rand); break;
            case 1: g.density = clamp(g.density + (rand() - 0.5) * 0.15, 0.2, 0.8); break;
            case 2: g.noise = clamp(g.noise * (0.7 + rand() * 0.6), 0.02, 0.25); break;
            case 3: g.birth = flipBit(g.birth, rand); break;
            case 4: g.survive = flipBit(g.survive, rand); break;
            case 5: g.passes = clamp(g.passes + (rand() < 0.5 ? -1 : 1), 0, 6); break;
            case 6: g.symmetry = pick(SYMMETRIES, rand); break;
            case 7: g.tiles = clamp(g.tiles + (rand() < 0.5 ? -1 : 1), 1, 4); break;
        }
    }
    return g;
}

// Each gene comes from one parent or the other.
export function crossover(a: Genome, b: Genome, rand: () => number = Math.random): Genome {
    const from = <K extends keyof Genome>(key: K): Genome[K] => (rand() < 0.5 ? a[key] : b[key]);
    return {
        seed: from("seed"),
        density: from("density"),
        noise: from("noise"),
        birth: from("birth"),
        survive: from("survive"),
        passes: from("passes"),
        symmetry: from("symmetry"),
        tiles: from("tiles"),
    };
}

// Smooth random noise (bilinear value noise), thresholded at the genome's density.
function noiseTile(g: Genome, th: number, tw: number): Uint8Array {
    const rand = seededRandom(g.seed);
    const scale = Math.max(1, g.noise * tw);
    const gw = Math.ceil(tw / scale) + 2;
    const gh = Math.ceil(th / scale) + 2;
    const coarse = new Float32Array(gw * gh);
    for (let i = 0; i < coarse.length; i++) coarse[i] = rand();

    const tile = new Uint8Array(th * tw);
    for (let y = 0; y < th; y++) {
        const fy = y / scale;
        const iy = Math.floor(fy);
        const ty = fy - iy;
        for (let x = 0; x < tw; x++) {
            const fx = x / scale;
            const ix = Math.floor(fx);
            const tx = fx - ix;
            const top = coarse[iy * gw + ix] * (1 - tx) + coarse[iy * gw + ix + 1] * tx;
            const bottom = coarse[(iy + 1) * gw + ix] * (1 - tx) + coarse[(iy + 1) * gw + ix + 1] * tx;
            tile[y * tw + x] = top * (1 - ty) + bottom * ty < g.density ? 1 : 0;
        }
    }
    return tile;
}

function applySymmetry(tile: Uint8Array, th: number, tw: number, symmetry: Symmetry): Uint8Array {
    if (symmetry === "none") return tile;
    const out = new Uint8Array(tile.length);
    for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
            let sx = x < tw / 2 ? x : tw - 1 - x;
            let sy = symmetry === "mirror" || y < th / 2 ? y : th - 1 - y;
            // Kaleido also mirrors across the diagonal (square tiles only).
            if (symmetry === "kaleido" && th === tw && sx > sy) [sx, sy] = [sy, sx];
            out[y * tw + x] = tile[sy * tw + sx];
        }
    }
    return out;
}

// Edges wrap, so the finished tile repeats seamlessly.
function runAutomaton(tile: Uint8Array, th: number, tw: number, g: Genome): Uint8Array {
    let current = tile;
    for (let pass = 0; pass < g.passes; pass++) {
        const next = new Uint8Array(current.length);
        for (let y = 0; y < th; y++) {
            const up = ((y - 1 + th) % th) * tw;
            const mid = y * tw;
            const down = ((y + 1) % th) * tw;
            for (let x = 0; x < tw; x++) {
                const left = (x - 1 + tw) % tw;
                const right = (x + 1) % tw;
                const n =
                    current[up + left] + current[up + x] + current[up + right] +
                    current[mid + left] + current[mid + right] +
                    current[down + left] + current[down + x] + current[down + right];
                const rule = current[mid + x] ? g.survive : g.birth;
                next[mid + x] = (rule >> n) & 1;
            }
        }
        current = next;
    }
    return current;
}

export function renderGenome(g: Genome, rows: number, cols: number): Pattern {
    const th = Math.max(4, Math.ceil(rows / g.tiles));
    const tw = Math.max(4, Math.ceil(cols / g.tiles));
    let tile = noiseTile(g, th, tw);
    tile = applySymmetry(tile, th, tw, g.symmetry);
    tile = runAutomaton(tile, th, tw, g);

    const data = new Uint8Array(rows * cols);
    for (let y = 0; y < rows; y++) {
        const ty = (y % th) * tw;
        for (let x = 0; x < cols; x++) data[y * cols + x] = tile[ty + (x % tw)];
    }
    return { rows, cols, data };
}

function ruleText(mask: number): string {
    let s = "";
    for (let n = 0; n <= 8; n++) if ((mask >> n) & 1) s += n;
    return s || "-";
}

export function describeGenome(g: Genome): string {
    return `${g.symmetry} · ${g.tiles}×${g.tiles} tiles · B${ruleText(g.birth)}/S${ruleText(g.survive)} × ${g.passes}`;
}
