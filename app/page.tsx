"use client";

import { useEffect, useRef, useState } from "react";
import { archiveStats, BINS, Elite, evaluate, NICHES } from "../services/elites";
import { describeGenome, Genome, mutateGenome, Pattern, randomGenome, renderGenome } from "../services/genome";
import { adjustWeights, Measure, MEASURES } from "../services/scoring";
import {
    FAVOURITES_LENGTH, LearnerState, loadState, Rating, resetState, saveState, SCORE_HISTORY_LENGTH, ScorePoint, sizeKey,
} from "../services/service";
import type { EvolveRequest, EvolveResponse } from "../workers/evolve.worker";
import configValues from "../config.json";

const { height, width, defaultCellSize, historyLength } = configValues;

const INK = "#0D1B2A";
const PAPER = "#FFFFFF";
const EMPTY = "#F5F8FC";
const EVOLVE_ROUNDS = 50;
const BATCH = 24; // patterns tried per round
const SAVE_EVERY = 10;
const GALLERY_TILE = 40; // px per niche in the gallery
const GALLERY_SIZE = GALLERY_TILE * BINS;

interface HistoryItem {
    src: string;
    rating: Rating;
}

interface Shown {
    elite: Elite;
    niche: number | null; // archive slot it came from, if any
}

function ScoreChart({ points }: { points: ScorePoint[] }) {
    if (points.length < 2) return <p className="hint">Run evolution to see the score chart.</p>;
    const w = 300;
    const h = 64;
    const line = (key: keyof ScorePoint) =>
        points.map((p, i) => `${(i / (points.length - 1)) * w},${h - p[key] * h}`).join(" ");
    return (
        <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
            aria-label="Best score, mean score and coverage per round">
            <polyline points={line("coverage")} className="chart-coverage" />
            <polyline points={line("mean")} className="chart-avg" />
            <polyline points={line("best")} className="chart-best" />
        </svg>
    );
}

// Draws a pattern scaled to fit a w×h box at (ox, oy).
function paint(ctx: CanvasRenderingContext2D, p: Pattern, ox: number, oy: number, w: number, h: number) {
    const cw = w / p.cols;
    const ch = h / p.rows;
    ctx.fillStyle = PAPER;
    ctx.fillRect(ox, oy, w, h);
    ctx.fillStyle = INK;
    for (let y = 0; y < p.rows; y++) {
        for (let x = 0; x < p.cols; x++) {
            if (p.data[y * p.cols + x]) ctx.fillRect(ox + x * cw, oy + y * ch, Math.ceil(cw), Math.ceil(ch));
        }
    }
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const galleryRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<LearnerState | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const remainingRef = useRef(0); // rounds left; Infinity in auto mode
    const rescoreRef = useRef(false);

    const [cellSize, setCellSize] = useState<number>(defaultCellSize);
    const [shown, setShown] = useState<Shown | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [running, setRunning] = useState<"off" | "batch" | "auto">("off");
    const [, forceRender] = useState(0);

    const rows = Math.ceil(height / cellSize);
    const cols = Math.ceil(width / cellSize);
    const state = stateRef.current;
    const stats = state ? archiveStats(state.archive) : null;

    function showElite(elite: Elite, niche: number | null) {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) paint(ctx, renderGenome(elite.genome, rows, cols), 0, 0, width, height);
        setShown({ elite, niche });
    }

    function showGenome(genome: Genome) {
        const s = stateRef.current;
        if (!s) return;
        showElite(evaluate(genome, s.weights, rows, cols).elite, null);
    }

    function drawGallery(niches: number[]) {
        const ctx = galleryRef.current?.getContext("2d");
        const s = stateRef.current;
        if (!ctx || !s) return;
        for (const i of niches) {
            const ox = (i % BINS) * GALLERY_TILE;
            const oy = Math.floor(i / BINS) * GALLERY_TILE;
            const elite = s.archive[i];
            if (elite) {
                paint(ctx, renderGenome(elite.genome, rows, cols), ox, oy, GALLERY_TILE, GALLERY_TILE);
            } else {
                ctx.fillStyle = EMPTY;
                ctx.fillRect(ox, oy, GALLERY_TILE, GALLERY_TILE);
            }
            ctx.strokeStyle = PAPER;
            ctx.strokeRect(ox + 0.5, oy + 0.5, GALLERY_TILE - 1, GALLERY_TILE - 1);
        }
    }

    const allNiches = () => Array.from({ length: NICHES }, (_, i) => i);

    function newPattern() {
        const s = stateRef.current;
        if (!s) return;
        const filled = s.archive.filter((e): e is Elite => e !== null);
        showGenome(filled.length ? mutateGenome(filled[Math.floor(Math.random() * filled.length)].genome) : randomGenome());
    }

    function rate(rating: Rating) {
        const s = stateRef.current;
        if (!s || !shown || running !== "off") return;
        const { elite, niche } = shown;

        if (rating === "good") {
            s.favourites = [elite.genome, ...s.favourites].slice(0, FAVOURITES_LENGTH);
            s.weights = adjustWeights(s.weights, elite.measures, 1);
            rescoreRef.current = true;
        } else if (rating === "bad") {
            s.weights = adjustWeights(s.weights, elite.measures, -1);
            rescoreRef.current = true;
            if (niche !== null && s.archive[niche] === elite) {
                s.archive[niche] = null;
                drawGallery([niche]);
            }
        }
        s.ratings[rating]++;
        saveState(s);

        const src = canvasRef.current?.toDataURL("image/png");
        if (src) setHistory((h) => [{ src, rating }, ...h].slice(0, historyLength));

        newPattern();
        forceRender((n) => n + 1);
    }

    function requestRound() {
        const s = stateRef.current;
        const worker = workerRef.current;
        if (!s || !worker) return;
        const request: EvolveRequest = {
            archive: s.archive,
            weights: s.weights,
            favourites: s.favourites,
            rows,
            cols,
            batch: BATCH,
            rescore: rescoreRef.current || s.archiveSize !== sizeKey(rows, cols),
        };
        rescoreRef.current = false;
        worker.postMessage(request);
    }

    function onRound(e: MessageEvent<EvolveResponse>) {
        const s = stateRef.current;
        if (!s) return;
        s.archive = e.data.archive;
        s.archiveSize = sizeKey(rows, cols);
        s.batches++;
        const st = archiveStats(s.archive);
        s.scoreHistory = [...s.scoreHistory, { best: st.best?.score ?? 0, mean: st.mean, coverage: st.coverage }]
            .slice(-SCORE_HISTORY_LENGTH);
        if (s.batches % SAVE_EVERY === 0) saveState(s);

        drawGallery(e.data.rescored ? allNiches() : e.data.changed);
        const latest = e.data.changed[e.data.changed.length - 1];
        if (latest !== undefined) showElite(s.archive[latest]!, latest);
        forceRender((n) => n + 1);

        remainingRef.current--;
        if (remainingRef.current > 0) requestRound();
        else stopEvolving();
    }

    function startEvolving(mode: "batch" | "auto") {
        remainingRef.current = mode === "auto" ? Infinity : EVOLVE_ROUNDS;
        setRunning(mode);
        requestRound();
    }

    function stopEvolving() {
        remainingRef.current = 0; // the round in flight finishes, then stops
        setRunning("off");
        if (stateRef.current) saveState(stateRef.current);
    }

    function setWeight(m: Measure, value: number) {
        const s = stateRef.current;
        if (!s) return;
        s.weights = { ...s.weights, [m]: value };
        rescoreRef.current = true;
        saveState(s);
        forceRender((n) => n + 1);
    }

    function reset() {
        if (!window.confirm("Forget everything the generator has learned?")) return;
        stopEvolving();
        stateRef.current = resetState();
        setHistory([]);
        drawGallery(allNiches());
        newPattern();
        forceRender((n) => n + 1);
    }

    function onGalleryClick(e: React.MouseEvent<HTMLCanvasElement>) {
        const s = stateRef.current;
        if (!s || running !== "off") return;
        const rect = e.currentTarget.getBoundingClientRect();
        const col = Math.floor(((e.clientX - rect.left) / rect.width) * BINS);
        const row = Math.floor(((e.clientY - rect.top) / rect.height) * BINS);
        const niche = row * BINS + col;
        const elite = s.archive[niche];
        if (elite) showElite(elite, niche);
    }

    function downloadPng() {
        const src = canvasRef.current?.toDataURL("image/png");
        if (!src) return;
        const a = document.createElement("a");
        a.href = src;
        a.download = "pattern.png";
        a.click();
    }

    // The worker is created once; its message handler is refreshed every render
    // so it always sees the current cell size.
    useEffect(() => {
        const worker = new Worker(new URL("../workers/evolve.worker.ts", import.meta.url));
        workerRef.current = worker;
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        if (workerRef.current) workerRef.current.onmessage = onRound;
    });

    useEffect(() => {
        if (!stateRef.current) stateRef.current = loadState();
        stopEvolving();
        drawGallery(allNiches());
        const best = archiveStats(stateRef.current.archive).best;
        if (best) showGenome(best.genome);
        else newPattern();
        forceRender((n) => n + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cellSize]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === "1") rate("good");
            else if (e.key === "2") rate("avg");
            else if (e.key === "3") rate("bad");
            else if (e.key === " ") {
                e.preventDefault();
                if (running === "off") newPattern();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const busy = running !== "off";

    return (
        <main className="app">
            <section className="stage">
                <header className="header">
                    <h1>Random Pattern Generator</h1>
                    <p className="subtitle">Evolves pattern recipes on its own. Rate them to steer its taste.</p>
                </header>

                <div className="canvas-wrap">
                    <canvas id="canvas" ref={canvasRef} width={width} height={height}></canvas>
                </div>

                <div className="stage-footer">
                    <p className="meta">
                        {shown ? <>
                            <strong>{describeGenome(shown.elite.genome)}</strong> · Score: <strong>{Math.round(shown.elite.score * 100)}</strong>
                        </> : "…"}
                    </p>
                    <div className="feedback">
                        <button className="chip good" disabled={busy} onClick={() => rate("good")}>good <kbd>1</kbd></button>
                        <button className="chip avg" disabled={busy} onClick={() => rate("avg")}>avg <kbd>2</kbd></button>
                        <button className="chip bad" disabled={busy} onClick={() => rate("bad")}>bad <kbd>3</kbd></button>
                        <button className="chip" disabled={busy} onClick={newPattern}>new <kbd>Space</kbd></button>
                        <button className="chip" onClick={downloadPng}>PNG</button>
                    </div>
                </div>
            </section>

            <aside className="panel">
                <section className="panel-section">
                    <h2 className="section-title">Self-learning</h2>
                    <div className="evolve-buttons">
                        <button className="primary" disabled={busy} onClick={() => startEvolving("batch")}>
                            {running === "batch" ? `Evolving… ${remainingRef.current}` : `Evolve ${EVOLVE_ROUNDS}`}
                        </button>
                        {running === "auto"
                            ? <button className="secondary" onClick={stopEvolving}>Stop</button>
                            : <button className="secondary" disabled={busy} onClick={() => startEvolving("auto")}>Auto</button>}
                    </div>
                    <ScoreChart points={state?.scoreHistory ?? []} />
                    <p className="hint">
                        <span className="legend-best">■</span> best <span className="legend-avg">■</span> mean{" "}
                        <span className="legend-coverage">■</span> coverage
                    </p>
                </section>

                <section className="panel-section stats">
                    <div><span>{state?.batches ?? 0}</span>rounds</div>
                    <div><span>{Math.round((stats?.coverage ?? 0) * 100)}%</span>coverage</div>
                    <div><span>{Math.round((stats?.best?.score ?? 0) * 100)}</span>best score</div>
                </section>

                <section className="panel-section">
                    <h2 className="section-title">Elites gallery</h2>
                    <div className="gallery-wrap">
                        <span className="axis axis-y">darker ↓</span>
                        <canvas ref={galleryRef} className="gallery" width={GALLERY_SIZE} height={GALLERY_SIZE}
                            onClick={onGalleryClick} aria-label="Best pattern for each darkness and detail level" />
                        <span className="axis axis-x">more detail →</span>
                    </div>
                    <p className="hint">Best pattern for each kind. Click one to view and rate it.</p>
                </section>

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
                    <p className="hint">Recipes work at any size; the gallery is re-scored on the next round.</p>
                </section>

                <section className="panel-section stats">
                    <div><span>{state ? `${state.ratings.good}/${state.ratings.avg}/${state.ratings.bad}` : "0/0/0"}</span>good/avg/bad</div>
                    <div><span>{state?.favourites.length ?? 0}</span>favourites</div>
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
