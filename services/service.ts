import { createGrid, Grid } from "./array";
import { Rating, StyleScores } from "./learning";
import { DEFAULT_WEIGHTS, Weights } from "./scoring";

const STORAGE_KEY = "pattern-learner:v2";
export const SCORE_HISTORY_LENGTH = 200;

export interface ScorePoint {
    best: number;
    avg: number;
}

export interface LearnerState {
    models: Record<string, Grid>; // one probability model per grid size
    archives: Record<string, Grid[]>; // recent top patterns per grid size, for novelty
    styleScores: StyleScores;
    weights: Weights;
    generations: number; // patterns shown to the user
    evolveGenerations: number; // self-learning generations run
    scoreHistory: ScorePoint[];
    ratings: Record<Rating, number>;
}

export function emptyState(): LearnerState {
    return {
        models: {},
        archives: {},
        styleScores: {},
        weights: { ...DEFAULT_WEIGHTS },
        generations: 0,
        evolveGenerations: 0,
        scoreHistory: [],
        ratings: { good: 0, avg: 0, bad: 0 },
    };
}

export function loadState(): LearnerState {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            return { ...emptyState(), ...saved, weights: { ...DEFAULT_WEIGHTS, ...saved.weights } };
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
        window.localStorage.removeItem("masterArray"); // old v1 data
    } catch {}
    return emptyState();
}

export function modelKey(rows: number, cols: number): string {
    return `${rows}x${cols}`;
}

export function getModel(state: LearnerState, rows: number, cols: number): Grid {
    return state.models[modelKey(rows, cols)] ?? createGrid(rows, cols, 0.5);
}

export function getArchive(state: LearnerState, rows: number, cols: number): Grid[] {
    return state.archives[modelKey(rows, cols)] ?? [];
}
