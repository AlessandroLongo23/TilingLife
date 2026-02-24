import { type GeneratorParameters, PolygonType, StarVertexTypes, Vector, PolygonSignature } from '$classes';
import { isWithinTolerance, segmentsIntersect } from '$utils';
import { tolerance } from '$stores';

class Segment {
    s: Vector;
    e: Vector;

    constructor(s: Vector, e: Vector) {
        this.s = s;
        this.e = e;
    }
}

export class PolygonsGenerator {
    polygons: PolygonSignature[] = [];

    constructor(parameters: GeneratorParameters, additionalPolygons: PolygonSignature[] = []) {
        this.polygons = [...additionalPolygons];

        if (parameters[PolygonType.REGULAR]) {
            const n_max = parameters[PolygonType.REGULAR].n_max;
            for (let n = 3; n <= n_max; n++) {
                this.polygons.push(new PolygonSignature(PolygonType.REGULAR, n));
            }
        }

        if (parameters[PolygonType.STAR_REGULAR]) {
            const n_max = parameters[PolygonType.STAR_REGULAR].n_max;
            const angle_par = parameters[PolygonType.STAR_REGULAR].angle;

            for (let n = 3; n <= n_max; n++) {
                for (let d = 2; d < Math.floor(n / 2); d++) {
                    let a = Math.PI * (1 - 2 * d / n);
                    let b = Math.PI * (1 + 2 * (d - 1) / n);
                    if (this.isMultiple(a, angle_par) && this.isMultiple(b, angle_par)) {
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_REGULAR, n, {d: d, startsWith: StarVertexTypes.OUTER}));
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_REGULAR, n, {d: d, startsWith: StarVertexTypes.INNER}));
                    }
                }
            }
        }

        if (parameters[PolygonType.STAR_PARAMETRIC]) {
            const n_max = parameters[PolygonType.STAR_PARAMETRIC].n_max;
            const angle_par = parameters[PolygonType.STAR_PARAMETRIC].angle;

            for (let n = 3; n <= n_max; n++) {
                let alpha = angle_par;
                let max_alpha = Math.PI * (n - 2) / n;
                while (alpha < max_alpha - tolerance) {
                    let d = n / 2 * (1 - alpha / Math.PI);
                    if (this.isMultiple(d, 1)) {
                        alpha += angle_par;
                        continue;
                    }

                    let b = 2 * Math.PI * (1 - 1 / n) - alpha;
                    if (this.isMultiple(b, angle_par)) {
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_PARAMETRIC, n, {alpha: alpha, startsWith: StarVertexTypes.OUTER}));
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_PARAMETRIC, n, {alpha: alpha, startsWith: StarVertexTypes.INNER}));
                    }
                    alpha += angle_par;
                }
            }
        }

        if (parameters[PolygonType.EQUILATERAL]) {
            const n_max = parameters[PolygonType.EQUILATERAL].n_max;
            const angle_par = parameters[PolygonType.EQUILATERAL].angle;

            const numDirections = Math.round(2 * Math.PI / angle_par);
            const directions = Array.from({ length: numDirections }, (_, i) => new Vector(Math.cos(i * angle_par), Math.sin(i * angle_par)));

            const closedPaths: Vector[][] = [];
            const stack = [{ path: [directions[0].copy()], currentIndex: 0, currentSum: directions[0].copy() }];

            while (stack.length > 0) {
                const { path, currentIndex, currentSum } = stack.pop()!;

                if (path.length >= 3 && isWithinTolerance(currentSum, new Vector())) {
                    closedPaths.push(path);
                } else {
                    const oppositeIndex = (currentIndex + numDirections / 2) % numDirections;
                    for (let i = currentIndex + 1; i < directions.length; i++) {
                        if (i === oppositeIndex)
                            continue;

                        if (path.length === n_max) continue;

                        const nextPath = [...path, directions[i].copy()];
                        const nextSum = Vector.add(currentSum.copy(), directions[i].copy());

                        if (this.isSelfIntersecting(nextPath)) continue;

                        stack.unshift({ path: [...nextPath], currentIndex: i, currentSum: nextSum.copy() });
                    }
                }
            }

            for (const path of closedPaths) {
                const interior_angles: number[] = [];
                for (let i = 0; i < path.length; i++) {
                    const currentVec = path[i];
                    const prevVec = path[(i - 1 + path.length) % path.length];

                    let extAngle = currentVec.heading() - prevVec.heading();
                    while (extAngle > Math.PI) extAngle -= 2 * Math.PI;
                    while (extAngle <= -Math.PI) extAngle += 2 * Math.PI;

                    interior_angles.push(Math.PI - extAngle);
                }

                if (interior_angles.every(angle => isWithinTolerance(angle, interior_angles[0]))) continue;

                this.polygons.push(new PolygonSignature(PolygonType.EQUILATERAL, path.length, { angles: interior_angles }));
            }
        }

        // filter the polygons to remove duplicates by checking the name
        this.polygons = this.polygons.filter((polygon, index, self) =>
            index === self.findIndex((t: PolygonSignature) => t.name === polygon.name)
        );
    }

    isMultiple = (value: number, divisor: number): boolean => {
        let rem = value % divisor;
        return Math.abs(rem) < tolerance || Math.abs(rem - divisor) < tolerance;
    }

    isSelfIntersecting = (path: Vector[]): boolean => {
        const segments: Segment[] = [];
        let sum = new Vector();
        for (let i = 0; i < path.length; i++) {
            segments.push(new Segment(sum, Vector.add(sum, path[i])));
            sum = Vector.add(sum, path[i]);
        }
        for (let i = 0; i < segments.length; i++) {
            for (let j = i + 1; j < segments.length; j++) {
                if (segmentsIntersect(segments[i].s, segments[i].e, segments[j].s, segments[j].e)) {
                    return true;
                }
            }
        }

        return false;
    }
}