import type { Vector } from '$classes';

export const ISLAMIC_NOISE = {
    spatialScale: 0.05,
    timeScale: 0.005,
    stretch: 2,
    shapeExponent: 0.55,
};

const shape = (n: number): number => {
    const y = (n - 0.5) * ISLAMIC_NOISE.stretch + 0.5;
    const d = 2 * (y - 0.5);
    const curved = 0.5 + 0.5 * Math.sign(d) * Math.pow(Math.abs(d), ISLAMIC_NOISE.shapeExponent);
    return Math.min(1, Math.max(0, curved));
};

export const islamicAngleAt = (
    ctx: { noise: (x: number, y: number, z: number) => number; frameCount: number },
    p: Vector
): number => {
    const raw = ctx.noise(
        p.x * ISLAMIC_NOISE.spatialScale + 1000,
        p.y * ISLAMIC_NOISE.spatialScale + 1000,
        ctx.frameCount * ISLAMIC_NOISE.timeScale,
    );
    return shape(raw) * Math.PI;
};

export const islamicAnglesForHalfways = (
    ctx: { noise: (x: number, y: number, z: number) => number; frameCount: number },
    halfways: Vector[]
): number[] => {
    return halfways.map(h => islamicAngleAt(ctx, h));
};
