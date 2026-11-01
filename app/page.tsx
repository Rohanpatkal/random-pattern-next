"use client";

import { useEffect, useRef, useState } from "react";
import { generatePattern, Grid, Style } from "../services/array";
import { bestStyle, confidence, learnFromRating, pickStyle, Rating, updateStyleScore } from "../services/learning";
import { getModel, LearnerState, loadState, modelKey, resetState, saveState } from "../services/service";
import configValues from "../config.json";

const { height, width, defaultCellSize, historyLength } = configValues;

const INK = "#0D1B2A";
const PAPER = "#FFFFFF";

interface HistoryItem {
    src: string;
    rating: Rating;
}

function describeStyle(style: Style | null): string {
    if (!style) return "not learned yet";
    return `${style.symmetry} · smooth ${style.smoothing}`;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<LearnerState | null>(null);
    const patternRef = useRef<Grid>([]);
    const [cellSize, setCellSize] = useState<number>(defaultCellSize);
    const [style, setStyle] = useState<Style | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [stats, setStats] = useState({ generations: 0, good: 0, avg: 0, bad: 0, confidence: 0, best: "" });

    const rows = Math.ceil(height / cellSize);
    const cols = Math.ceil(width / cellSize);

    function refreshStats(state: LearnerState) {
        setStats({
            generations: state.generations,
            ...state.ratings,
            confidence: confidence(getModel(state, rows, cols)),
            best: describeStyle(bestStyle(state.styleScores)),
        });
    }

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

    function generate() {
        const state = stateRef.current;
        if (!state) return;
        const nextStyle = pickStyle(state.styleScores);
        const pattern = generatePattern(getModel(state, rows, cols), nextStyle);
        patternRef.current = pattern;
        state.generations++;
        saveState(state);
        setStyle(nextStyle);
        draw(pattern);
        refreshStats(state);
    }

    function rate(rating: Rating) {
        const state = stateRef.current;
        if (!state || !style || !patternRef.current.length) return;

        state.models[modelKey(rows, cols)] = learnFromRating(getModel(state, rows, cols), patternRef.current, rating);
        state.styleScores = updateStyleScore(state.styleScores, style, rating);
        state.ratings[rating]++;

        const src = canvasRef.current?.toDataURL("image/png");
        if (src) setHistory((h) => [{ src, rating }, ...h].slice(0, historyLength));

        generate();
    }

    function reset() {
        if (!window.confirm("Forget everything the generator has learned?")) return;
        stateRef.current = resetState();
        setHistory([]);
        generate();
    }

    useEffect(() => {
        if (!stateRef.current) stateRef.current = loadState();
        generate();
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
                generate();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    return (
        <main className="card">
            <header className="header">
                <h1>Random Pattern Generator</h1>
                <p className="subtitle">Rate patterns and the generator learns what you like.</p>
            </header>

            <canvas id="canvas" ref={canvasRef} width={width} height={height}></canvas>

            <p className="meta">Current style: <strong>{describeStyle(style)}</strong></p>

            <div className="feedback">
                <button className="chip good" onClick={() => rate("good")}>good <kbd>1</kbd></button>
                <button className="chip avg" onClick={() => rate("avg")}>avg <kbd>2</kbd></button>
                <button className="chip bad" onClick={() => rate("bad")}>bad <kbd>3</kbd></button>
            </div>

            <button id="generateButton" className="primary" onClick={generate}>Skip / New Pattern <kbd>Space</kbd></button>

            <section className="control">
                <div className="control-row">
                    <label htmlFor="numberRange">Cell size</label>
                    <span id="output">{cellSize}px</span>
                </div>
                <input type="range" id="numberRange" min="2" max="20" step="1" value={cellSize}
                    onChange={(e) => setCellSize(Number(e.target.value))} />
                <p className="hint">Each cell size has its own learned model ({rows}×{cols} cells).</p>
            </section>

            <section className="stats">
                <div><span>{stats.generations}</span>generated</div>
                <div><span>{stats.good}/{stats.avg}/{stats.bad}</span>good/avg/bad</div>
                <div><span>{Math.round(stats.confidence * 100)}%</span>confidence</div>
            </section>
            <p className="meta">Favourite style so far: <strong>{stats.best}</strong></p>

            {history.length > 0 && (
                <section>
                    <h2 className="section-title">Recently rated</h2>
                    <div className="history">
                        {history.map((item, i) => (
                            <figure key={i} className={`thumb ${item.rating}`}>
                                <img src={item.src} alt={`${item.rating} pattern`} />
                                <figcaption>{item.rating}</figcaption>
                            </figure>
                        ))}
                    </div>
                </section>
            )}

            <button className="link" onClick={reset}>Reset learning</button>
        </main>
    );
}
