import type { EncodedGyration, EncodedReflection } from "./generatorEncoding";

const GYRATION_MARKER_RADIUS_PX = 6;
const ORDER_TO_SIDES: Record<number, number> = { 2: 4, 3: 3, 4: 4, 6: 6 };

/** Rhombus diagonal ratio: vertical / horizontal (≠1 so it's not a square). */
const RHOMBUS_RATIO = 1.4;

function drawGyrationMarker(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    order: number,
    radius: number
): void {
    let vertices: { x: number; y: number }[] = [];

    if (order === 2) {
        // Rhombus with distinct diagonals: vertical = radius*ratio, horizontal = radius
        const ry = radius;
        const rx = radius / RHOMBUS_RATIO;
        vertices = [
            { x: cx, y: cy + ry },
            { x: cx + rx, y: cy },
            { x: cx, y: cy - ry },
            { x: cx - rx, y: cy },
        ];
    } else {
        const n = ORDER_TO_SIDES[order] ?? order;
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * (i + 0.5)) / n - Math.PI / 2;
            vertices.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
        }
    }
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/**
 * Draws gyrations and reflections on a Canvas 2D context.
 * - Reflections: lines along the axis
 * - Gyrations: shape markers (diamond=2, triangle=3, square=4, hexagon=6)
 *
 * @param ctx - Canvas 2D rendering context (already transformed to data coordinates)
 * @param gyrations - Encoded gyration centers
 * @param reflections - Encoded reflection axes
 * @param scale - Current scale factor (for line weight / point size)
 */
export function drawTransformations(
    ctx: CanvasRenderingContext2D,
    gyrations: EncodedGyration[] | undefined,
    reflections: EncodedReflection[] | undefined,
    scale: number
): void {
    if (!gyrations?.length && !reflections?.length) return;

    const lineLength = 1.5;

    // Draw reflection axes (cyan lines, matching play page style)
    if (reflections?.length) {
        ctx.strokeStyle = "hsl(0, 70%, 50%)";
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([]);
        for (const r of reflections) {
            const ax = r.axis.x;
            const ay = r.axis.y;
            const len = Math.sqrt(ax * ax + ay * ay) || 1;
            const nx = ax / len;
            const ny = ay / len;
            const startX = r.point.x - nx * lineLength;
            const startY = r.point.y - ny * lineLength;
            const endX = r.point.x + nx * lineLength;
            const endY = r.point.y + ny * lineLength;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    // Draw gyration centers as shape markers: diamond(2), triangle(3), square(4), hexagon(6)
    if (gyrations?.length) {
        const radius = GYRATION_MARKER_RADIUS_PX / scale;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.lineWidth = 1 / scale;
        ctx.fillStyle = "hsl(200, 90%, 85%)";

        for (const g of gyrations) {
            drawGyrationMarker(ctx, g.center.x, g.center.y, g.order, radius);
        }
    }
}
