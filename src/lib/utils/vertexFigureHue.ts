import { map } from "./math";

export const canonicalizeVertexFigure = (ns: number[]): number[] => {
    if (ns.length === 0) return [];
    const candidates: number[][] = [];
    const k = ns.length;
    for (let i = 0; i < k; i++) {
        const rot: number[] = [];
        for (let j = 0; j < k; j++) rot.push(ns[(i + j) % k]);
        candidates.push(rot);
        candidates.push([...rot].reverse());
    }
    candidates.sort((a, b) => {
        for (let i = 0; i < k; i++) {
            if (a[i] !== b[i]) return a[i] - b[i];
        }
        return 0;
    });
    return candidates[0];
};

export const vertexFigureHue = (ns: number[]): number => {
    const canon = canonicalizeVertexFigure(ns);
    let h = 2166136261 >>> 0;
    for (const n of canon) {
        h ^= n;
        h = Math.imul(h, 16777619) >>> 0;
    }
    const avgN = canon.reduce((a, b) => a + b, 0) / Math.max(canon.length, 1);
    const base = map(Math.log(avgN), Math.log(3), Math.log(12), 0, 300);
    const jitter = (h % 3600) / 3600 * 360;
    return (base + jitter) % 360;
};
