import { generatePattern, Grid, Style } from "./array";
import { learnFromElites, pickStyle, StyleScores, styleKey, updateStyleReward } from "./learning";
import { measure, Measures, totalScore, Weights } from "./scoring";

export const POPULATION = 30;
export const ELITE_FRACTION = 0.2;
export const ARCHIVE_SIZE = 8;
export const ARCHIVE_EVERY = 5; // generations

export interface Candidate {
    pattern: Grid;
    style: Style;
    measures: Measures;
    score: number;
}

export interface EvolveInput {
    model: Grid;
    styleScores: StyleScores;
    weights: Weights;
    archive: Grid[];
    generation: number;
}

export interface EvolveOutput {
    model: Grid;
    styleScores: StyleScores;
    archive: Grid[];
    best: Candidate;
    avgScore: number;
}

// One generation: sample → score → keep the elite → learn from them.
export function evolveStep(input: EvolveInput): EvolveOutput {
    const candidates: Candidate[] = [];
    for (let i = 0; i < POPULATION; i++) {
        const style = pickStyle(input.styleScores);
        const pattern = generatePattern(input.model, style);
        const measures = measure(pattern, input.archive);
        candidates.push({ pattern, style, measures, score: totalScore(measures, input.weights) });
    }
    candidates.sort((a, b) => b.score - a.score);

    const eliteCount = Math.max(1, Math.round(POPULATION * ELITE_FRACTION));
    const elites = candidates.slice(0, eliteCount);
    const model = learnFromElites(input.model, elites.map((c) => c.pattern));

    // Each style learns from the average score it achieved this generation.
    const byStyle = new Map<string, { style: Style; total: number; count: number }>();
    for (const c of candidates) {
        const key = styleKey(c.style);
        const entry = byStyle.get(key) ?? { style: c.style, total: 0, count: 0 };
        entry.total += c.score;
        entry.count++;
        byStyle.set(key, entry);
    }
    let styleScores = input.styleScores;
    for (const { style, total, count } of byStyle.values()) {
        styleScores = updateStyleReward(styleScores, style, total / count);
    }

    const best = candidates[0];
    const archive = input.generation % ARCHIVE_EVERY === 0
        ? [best.pattern, ...input.archive].slice(0, ARCHIVE_SIZE)
        : input.archive;

    const avgScore = candidates.reduce((s, c) => s + c.score, 0) / candidates.length;
    return { model, styleScores, archive, best, avgScore };
}
