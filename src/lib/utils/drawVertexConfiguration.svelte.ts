import type { VertexConfiguration } from '$classes/algorithm/VertexConfiguration.svelte';

/**
 * Converts HSB (0-360, 0-100, 0-100) to HSL for CSS
 */
export function hsbToHsl(h: number, s: number, b: number): { h: number; s: number; l: number } {
    s /= 100;
    b /= 100;
    const l = b * (1 - s / 2);
    const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
    return { h, s: sl * 100, l: l * 100 };
}

/**
 * Draws a VertexConfiguration to a 2D canvas context.
 * Centers and scales the polygons to fit the canvas.
 */
export function drawVertexConfiguration(
    ctx: CanvasRenderingContext2D,
    vc: VertexConfiguration,
    options: {
        size?: number;
        backgroundColor?: string;
        padding?: number;
    } = {}
): void {
    const { size = 220, backgroundColor = '#1e1e24', padding = 16 } = options;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    if (!vc?.polygons || vc.polygons.length === 0) return;

    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    for (const polygon of vc.polygons) {
        if (!polygon.vertices) continue;
        for (const v of polygon.vertices) {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
        }
    }

    if (!isFinite(minX)) return;

    const availableSize = size - 2 * padding;
    const dataWidth = maxX - minX || 1;
    const dataHeight = maxY - minY || 1;
    const scale = Math.min(availableSize / dataWidth, availableSize / dataHeight);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, -scale);
    ctx.translate(-centerX, -centerY);

    for (const polygon of vc.polygons) {
        if (!polygon.vertices || polygon.vertices.length === 0) continue;
        const hsl = hsbToHsl(polygon.hue, 40, 100);
        ctx.fillStyle = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        ctx.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
        for (let i = 1; i < polygon.vertices.length; i++) {
            ctx.lineTo(polygon.vertices[i].x, polygon.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
}
