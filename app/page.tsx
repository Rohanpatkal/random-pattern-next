"use client";

import { useEffect, useRef, useState } from "react";
import { generatePattern, Grid, Style } from "../services/array";
import { evolveStep } from "../services/evolve";
import { bestStyle, confidence, learnFromRating, pickStyle, Rating, updateStyleScore } from "../services/learning";
import { adjustWeights, Measure, MEASURES, measure, Measures, totalScore } from "../services/scoring";
import {
    getArchive, getModel, LearnerState, loadState, modelKey, resetState, saveState, SCORE_HISTORY_LENGTH, ScorePoint,
} from "../services/service";
import configValues from "../config.json";

const { height, width, defaultCellSize, historyLength } = configValues;

const INK = "#0D1B2A";
const PAPER = "#FFFFFF";
const EVOLVE_BATCH = 50;
const SAVE_EVERY = 10;

interface HistoryItem {
    src: string;
    rating: Rating;
}

function describeStyle(style: Style | null): string {
    if (!style) return "not learned yet";
    return `${style.symmetry} · smooth ${style.smoothing}`;
}

function ScoreChart({ points }: { points: ScorePoint[] }) {
    if (points.length < 2) return <p className="hint">Run evolution to see the score chart.</p>;
    const w = 300;
    const h = 80;
    const line = (key: keyof ScorePoint) =>
        points.map((p, i) => `${(i / (points.length - 1)) * w},${h - p[key] * h}`).join(" ");
    return (
        <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
            aria-label="Best and average score per generation">
            <polyline points={line("avg")} className="chart-avg" />
            <polyline points={line("best")} className="chart-best" />
        </svg>
    );
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<LearnerState | null>(null);
    const patternRef = useRef<Grid>([]);
    const measuresRef = useRef<Measures | null>(null);
    const remainingRef = useRef(0); // generations left to evolve; Infinity in auto mode
    const frameRef = useRef<number | null>(null);

    const [cellSize, setCellSize] = useState<number>(defaultCellSize);
    const [style, setStyle] = useState<Style | null>(null);
    const [score, setScore] = useState<number | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [running, setRunning] = useState<"off" | "batch" | "auto">("off");
    const [, forceRender] = useState(0);

    const rows = Math.ceil(height / cellSize);
    const cols = Math.ceil(width / cellSize);
    const state = stateRef.current;

    function draw(pattern: Grid) {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = INK;
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[y].length; x++) {
                if (pattern[y][x]) ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    function show(pattern: Grid, shownStyle: Style, measures: Measures, shownScore: number) {
        patternRef.current = pattern;
        measuresRef.current = measures;
        setStyle(shownStyle);
        setScore(shownScore);
        draw(pattern);
    }

    function generate() {
        const s = stateRef.current;
        if (!s) return;
        const nextStyle = pickStyle(s.styleScores);
        const pattern = generatePattern(getModel(s, rows, cols), nextStyle);
        const measures = measure(pattern, getArchive(s, rows, cols));
        s.generations++;
        saveState(s);
        show(pattern, nextStyle, measures, totalScore(measures, s.weights));
        forceRender((n) => n + 1);
    }

    function rate(rating: Rating) {
        const s = stateRef.current;
        if (!s || !style || !patternRef.current.length || running !== "off") return;

        s.models[modelKey(rows, cols)] = learnFromRating(getModel(s, rows, cols), patternRef.current, rating);
        s.styleScores = updateStyleScore(s.styleScores, style, rating);
        if (measuresRef.current && rating !== "avg") {
            s.weights = adjustWeights(s.weights, measuresRef.current, rating === "good" ? 1 : -1);
        }
        s.ratings[rating]++;

        const src = canvasRef.current?.toDataURL("image/png");
        if (src) setHistory((h) => [{ src, rating }, ...h].slice(0, historyLength));

        generate();
    }

    function evolveFrame() {
        const s = stateRef.current;
        if (!s || remainingRef.current <= 0) {
            stopEvolving();
            return;
        }
        const key = modelKey(rows, cols);
        s.evolveGenerations++;
        const out = evolveStep({
            model: getModel(s, rows, cols),
            styleScores: s.styleScores,
            weights: s.weights,
            archive: getArchive(s, rows, cols),
            generation: s.evolveGenerations,
        });
        s.models[key] = out.model;
        s.archives[key] = out.archive;
        s.styleScores = out.styleScores;
        s.scoreHistory = [...s.scoreHistory, { best: out.best.score, avg: out.avgScore }].slice(-SCORE_HISTORY_LENGTH);
        if (s.evolveGenerations % SAVE_EVERY === 0) saveState(s);

        show(out.best.pattern, out.best.style, out.best.measures, out.best.score);
        forceRender((n) => n + 1);

        remainingRef.current--;
        frameRef.current = requestAnimationFrame(evolveFrame);
    }

    function startEvolving(mode: "batch" | "auto") {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        remainingRef.current = mode === "auto" ? Infinity : EVOLVE_BATCH;
        setRunning(mode);
        frameRef.current = requestAnimationFrame(evolveFrame);
    }

    function stopEvolving() {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        remainingRef.current = 0;
        setRunning("off");
        if (stateRef.current) saveState(stateRef.current);
    }

    function setWeight(m: Measure, value: number) {
        const s = stateRef.current;
        if (!s) return;
        s.weights = { ...s.weights, [m]: value };
        saveState(s);
        forceRender((n) => n + 1);
    }

    function reset() {
        if (!window.confirm("Forget everything the generator has learned?")) return;
        stopEvolving();
        stateRef.current = resetState();
        setHistory([]);
        generate();
    }

    useEffect(() => {
        if (!stateRef.current) stateRef.current = loadState();
        stopEvolving();
        generate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cellSize]);

    useEffect(() => () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    }, []);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === "1") rate("good");
            else if (e.key === "2") rate("avg");
            else if (e.key === "3") rate("bad");
            else if (e.key === " ") {
                e.preventDefault();
                if (running === "off") generate();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const model = state ? getModel(state, rows, cols) : null;
    const busy = running !== "off";

    return (
        <main className="app">
            <section className="stage">
                <header className="header">
                    <h1>Random Pattern Generator</h1>
                    <p className="subtitle">Evolves patterns on its own. Rate them to steer its taste.</p>
                </header>

                <div className="canvas-wrap">
                    <canvas id="canvas" ref={canvasRef} width={width} height={height}></canvas>
                </div>

                <div className="stage-footer">
                    <p className="meta">
                        Style: <strong>{describeStyle(style)}</strong>
                        {score !== null && <> · Score: <strong>{Math.round(score * 100)}</strong></>}
                    </p>
                    <div className="feedback">
                        <button className="chip good" disabled={busy} onClick={() => rate("good")}>good <kbd>1</kbd></button>
                        <button className="chip avg" disabled={busy} onClick={() => rate("avg")}>avg <kbd>2</kbd></button>
                        <button className="chip bad" disabled={busy} onClick={() => rate("bad")}>bad <kbd>3</kbd></button>
                        <button className="chip" disabled={busy} onClick={generate}>new <kbd>Space</kbd></button>
                    </div>
                </div>
            </section>

            <aside className="panel">
                <section className="panel-section">
                    <h2 className="section-title">Self-learning</h2>
                    <div className="evolve-buttons">
                        <button className="primary" disabled={busy} onClick={() => startEvolving("batch")}>
                            {running === "batch" ? `Evolving… ${remainingRef.current}` : `Evolve ${EVOLVE_BATCH}`}
                        </button>
                        {running === "auto"
                            ? <button className="secondary" onClick={stopEvolving}>Stop</button>
                            : <button className="secondary" disabled={busy} onClick={() => startEvolving("auto")}>Auto</button>}
                    </div>
                    <ScoreChart points={state?.scoreHistory ?? []} />
                    <p className="hint"><span className="legend-best">■</span> best <span className="legend-avg">■</span> average</p>
                </section>

                <section className="panel-section stats">
                    <div><span>{state?.evolveGenerations ?? 0}</span>evolved</div>
                    <div><span>{state ? `${state.ratings.good}/${state.ratings.avg}/${state.ratings.bad}` : "0/0/0"}</span>good/avg/bad</div>
                    <div><span>{model ? Math.round(confidence(model) * 100) : 0}%</span>confidence</div>
                </section>
                <p className="hint">Favourite style: <strong>{describeStyle(state ? bestStyle(state.styleScores) : null)}</strong></p>

                <section className="panel-section">
                    <h2 className="section-title">Taste</h2>
                    <div className="weights">
                        {MEASURES.map((m) => (
                            <div key={m} className="weight-row">
                                <label htmlFor={`w-${m}`}>{m}</label>
                                <input type="range" id={`w-${m}`} min="0" max="3" step="0.25"
                                    value={state?.weights[m] ?? 1} onChange={(e) => setWeight(m, Number(e.target.value))} />
                                <span className="weight-value">{(state?.weights[m] ?? 1).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="panel-section">
                    <div className="control-row">
                        <label htmlFor="numberRange">Cell size</label>
                        <span id="output">{cellSize}px · {rows}×{cols}</span>
                    </div>
                    <input type="range" id="numberRange" min="2" max="20" step="1" value={cellSize}
                        onChange={(e) => setCellSize(Number(e.target.value))} />
                </section>

                {history.length > 0 && (
                    <section className="panel-section">
                        <h2 className="section-title">Recently rated</h2>
                        <div className="history">
                            {history.map((item, i) => (
                                <img key={i} className={`thumb ${item.rating}`} src={item.src}
                                    alt={`${item.rating} pattern`} title={item.rating} />
                            ))}
                        </div>
                    </section>
                )}

                <button className="link" onClick={reset}>Reset learning</button>
            </aside>
        </main>
    );
}
