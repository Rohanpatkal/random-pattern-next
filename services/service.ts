import { Archive, emptyArchive, NICHES } from "./elites";
import { Genome } from "./genome";
import { DEFAULT_WEIGHTS, Weights } from "./scoring";

export type Rating = "good" | "avg" | "bad";

// v4 state is a few KB of genomes, so localStorage is enough (no IndexedDB needed).
const STORAGE_KEY = "pattern-learner:v4";
export const SCORE_HISTORY_LENGTH = 200;
export const FAVOURITES_LENGTH = 10;

export interface ScorePoint {
    best: number;
    mean: number;
    coverage: number;
}

export interface LearnerState {
    archive: Archive;
    archiveSize: string; // grid size the archive was scored at, e.g. "100x100"
    weights: Weights;
    favourites: Genome[]; // genomes rated "good"; used more often as parents
    batches: number;
    scoreHistory: ScorePoint[];
    ratings: Record<Rating, number>;
}

export function emptyState(): LearnerState {
    return {
        archive: emptyArchive(),
        archiveSize: "",
        weights: { ...DEFAULT_WEIGHTS },
        favourites: [],
        batches: 0,
        scoreHistory: [],
        ratings: { good: 0, avg: 0, bad: 0 },
    };
}

export function loadState(): LearnerState {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            const state: LearnerState = { ...emptyState(), ...saved, weights: { ...DEFAULT_WEIGHTS, ...saved.weights } };
            if (state.archive.length !== NICHES) state.archive = emptyArchive();
            return state;
        }
    } catch {
        // Corrupt or blocked storage: start fresh.
    }
    return emptyState();
}

export function saveState(state: LearnerState): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage full or blocked: keep learning in memory only.
    }
}

export function resetState(): LearnerState {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem("pattern-learner:v2"); // 3.0 data
        window.localStorage.removeItem("masterArray"); // 1.0 data
    } catch {}
    return emptyState();
}

export function sizeKey(rows: number, cols: number): string {
    return `${rows}x${cols}`;
}
