// Runs evolution off the main thread so the page stays responsive.

import { Archive, BatchResult, evolveBatch, rescoreArchive } from "../services/elites";
import { Genome } from "../services/genome";
import { Weights } from "../services/scoring";

export interface EvolveRequest {
    archive: Archive;
    weights: Weights;
    favourites: Genome[];
    rows: number;
    cols: number;
    batch: number;
    rescore: boolean; // weights or grid size changed since the archive was scored
}

export type EvolveResponse = BatchResult & { rescored: boolean };

self.onmessage = (e: MessageEvent<EvolveRequest>) => {
    const { weights, favourites, rows, cols, batch, rescore } = e.data;
    const archive = rescore ? rescoreArchive(e.data.archive, weights, rows, cols) : e.data.archive;
    const result = evolveBatch(archive, weights, rows, cols, batch, favourites);
    const response: EvolveResponse = { ...result, rescored: rescore };
    self.postMessage(response);
};
