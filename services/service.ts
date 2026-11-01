import { createGrid, Grid } from "./array";
import { Rating, StyleScores } from "./learning";

const STORAGE_KEY = "pattern-learner:v2";

export interface LearnerState {
    models: Record<string, Grid>; // one probability model per grid size
    styleScores: StyleScores;
    generations: number;
    ratings: Record<Rating, number>;
}

export function emptyState(): LearnerState {
    return { models: {}, styleScores: {}, generations: 0, ratings: { good: 0, avg: 0, bad: 0 } };
}

export function loadState(): LearnerState {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...emptyState(), ...JSON.parse(raw) };
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
