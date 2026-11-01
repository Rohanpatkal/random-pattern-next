"use client";

import { useEffect, useRef, useState } from "react";
import { convertIntoMasterArray, genarateRandome } from "../services/service";
import configValues from "../config.json";

const { height, width, boxSize } = configValues;

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const resultArray = useRef<number[][]>([]);
    const [rangeValue, setRangeValue] = useState<number>(5); //dynamic pattern size;

    function generateImage(feedback) {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const rows = Math.ceil(height);
        const cols = Math.ceil(width);

        // let feedback = 5

        // Generate one random value per box
        resultArray.current = convertIntoMasterArray(rows, cols, resultArray.current, feedback);
        let darkCount = 0;
        let whiteCount = 0;
        for (let y = 0; y < height; y += boxSize) {
            let aX = resultArray.current[y];
            for (let x = 0; x < width; x += boxSize) {
                let colerTemp = aX[x] ? "black" : "white";
                ctx.fillStyle = colerTemp;
                colerTemp == "black" ? darkCount++ : whiteCount++ //count
                ctx.fillRect(x, y, boxSize, boxSize);
            }
        }
        console.log("dark Count", darkCount, "\nwhite Count", whiteCount);
    }

    useEffect(() => {
        generateImage(5);
    }, []);

    return (
        <main className="card">
            <header className="header">
                <h1>Random Pattern Generator</h1>
                <p className="subtitle">Create a unique pattern with one click.</p>
            </header>

            <canvas id="canvas" ref={canvasRef} width={500} height={500}></canvas>

            <button id="generateButton" className="primary" onClick={generateImage}>Generate Pattern</button>

            <section className="control">
                <div className="control-row">
                    <label htmlFor="numberRange">Select pattern size</label>
                    <span id="output">{rangeValue}</span>
                </div>
                <input type="range" id="numberRange" min="1" max="10" step="1" value={rangeValue}
                    onChange={(e) => setRangeValue(Number(e.target.value))} />
            </section>

            <div className="feedback">
                <button id="good" onClick={() => generateImage(7)} className="chip good">good</button>
                <button id="avg" onClick={() => generateImage(5)} className="chip avg">avg</button>
                <button id="bad" onClick={() => generateImage(3)} className="chip bad">bad</button>
            </div>

            <p className="meta">past arrays: <span id="outputOfPastArray"></span></p>
        </main>
    );
}
