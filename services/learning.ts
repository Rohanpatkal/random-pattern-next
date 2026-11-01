import { Grid, SMOOTHING_LEVELS, SYMMETRIES, Style } from "./array";

export type Rating = "good" | "avg" | "bad";

export interface StyleScore {
    score: number; // running average reward, 0..1
    tries: number;
}

export type StyleScores = Record<string, StyleScore>;

const MIN_P = 0.05;
const MAX_P = 0.95;

// How strongly each rating moves the model.
const LEARNING_RATE: Record<Rating, number> = { good: 0.15, avg: 0.03, bad: 0.1 };
const REWARD: Record<Rating, number> = { good: 1, avg: 0.5, bad: 0 };

// Good/avg pull each cell's probability toward what was shown; bad pushes it away.
export function learnFromRating(model: Grid, pattern: Grid, rating: Rating): Grid {
    const rate = LEARNING_RATE[rating];
    return model.map((row, y) =>
        row.map((p, x) => {
            const shown = pattern[y][x];
            const target = rating === "bad" ? 1 - shown : shown;
            const next = p + rate * (target - p);
            return Math.round(Math.min(MAX_P, Math.max(MIN_P, next)) * 1000) / 1000;
        })
    );
}

// 0 = still random, 1 = fully decided on every cell.
export function confidence(model: Grid): number {
    let total = 0;
    let count = 0;
    for (const row of model) {
        for (const p of row) {
            total += Math.abs(p - 0.5) * 2;
            count++;
        }
    }
    return count ? total / count : 0;
}

export function styleKey(style: Style): string {
    return `${style.symmetry}-${style.smoothing}`;
}

export function allStyles(): Style[] {
    return SYMMETRIES.flatMap((symmetry) => SMOOTHING_LEVELS.map((smoothing) => ({ symmetry, smoothing })));
}

export function bestStyle(scores: StyleScores): Style | null {
    let best: Style | null = null;
    let bestScore = -1;
    for (const style of allStyles()) {
        const s = scores[styleKey(style)];
        if (s && s.score > bestScore) {
            best = style;
            bestScore = s.score;
        }
    }
    return best;
}

// Epsilon-greedy: usually pick the best-rated style, sometimes explore a new one.
export function pickStyle(scores: StyleScores, epsilon = 0.25): Style {
    const styles = allStyles();
    const untried = styles.filter((s) => !scores[styleKey(s)]);
    if (untried.length && Math.random() < 0.5) return untried[Math.floor(Math.random() * untried.length)];
    const best = bestStyle(scores);
    if (!best || Math.random() < epsilon) return styles[Math.floor(Math.random() * styles.length)];
    return best;
}

export function updateStyleScore(scores: StyleScores, style: Style, rating: Rating): StyleScores {
    return updateStyleReward(scores, style, REWARD[rating]);
}

// Moving average; never slower than 5% so old opinions can still change.
export function updateStyleReward(scores: StyleScores, style: Style, reward: number): StyleScores {
    const key = styleKey(style);
    const prev = scores[key] ?? { score: 0.5, tries: 0 };
    const tries = prev.tries + 1;
    const score = prev.score + (reward - prev.score) * Math.max(1 / tries, 0.05);
    return { ...scores, [key]: { score, tries } };
}

// Self-learning: pull each cell toward the average of the elite patterns,
// then decay slightly toward 0.5 so the model never freezes on one pattern.
export function learnFromElites(model: Grid, elites: Grid[], rate = 0.1, decay = 0.005): Grid {
    if (!elites.length) return model;
    return model.map((row, y) =>
        row.map((p, x) => {
            let mean = 0;
            for (const e of elites) mean += e[y][x];
            mean /= elites.length;
            let next = p + rate * (mean - p);
            next += decay * (0.5 - next);
            return Math.round(Math.min(MAX_P, Math.max(MIN_P, next)) * 1000) / 1000;
        })
    );
}
