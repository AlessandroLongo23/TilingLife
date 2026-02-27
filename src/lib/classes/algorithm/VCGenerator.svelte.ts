import { PolygonSignature, PolygonType, VertexConfiguration } from '$classes';
import { comparePolygonNames, isWithinAngularTolerance } from '$utils';
import { tolerance } from '$stores';

export class VCGenerator {
    vertexConfigurations: VertexConfiguration[] = [];
    polygons: PolygonSignature[] = [];

    constructor(polygons: PolygonSignature[] = []) {
        this.polygons = polygons;
    }

    generateVertexConfigurations = (): VertexConfiguration[] => {
        this.vertexConfigurations = [];
        const n = this.polygons.length;
        if (n === 0) return [];

        const seen = new Set<string>();
        const TWO_PI = 2 * Math.PI;

        const interiorAngles = new Float64Array(n);
        const sharedAngleRight = new Float64Array(n);
        const sharedAngleLeft = new Float64Array(n);
        const polyNames: string[] = new Array(n);

        let minAngle = Infinity;
        for (let i = 0; i < n; i++) {
            const p = this.polygons[i];
            interiorAngles[i] = p.interior_angle;
            sharedAngleRight[i] = p.angles[1];
            sharedAngleLeft[i] = p.angles[p.angles.length - 1];
            polyNames[i] = p.name;
            if (interiorAngles[i] < minAngle) minAngle = interiorAngles[i];
        }

        const canFollow: Int32Array[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const followers: number[] = [];
            for (let j = 0; j < n; j++) {
                if (!canBeAdjacentSig(this.polygons[i], this.polygons[j])) continue;
                if (sharedAngleLeft[i] + sharedAngleRight[j] > TWO_PI + tolerance) continue;
                followers.push(j);
            }
            followers.sort((a, b) => interiorAngles[a] - interiorAngles[b]);
            canFollow[i] = new Int32Array(followers);
        }

        const allByAngle = Int32Array.from(
            Array.from({ length: n }, (_, i) => i)
                .sort((a, b) => interiorAngles[a] - interiorAngles[b])
        );

        const stack = new Int32Array(32);
        const stackNames: string[] = [];
        let depth = 0;
        let angleSum = 0;

        const dfs = () => {
            if (depth > 0 && isWithinAngularTolerance(angleSum, TWO_PI)) {
                const lastIdx = stack[depth - 1];
                const firstIdx = stack[0];
                if (sharedAngleLeft[lastIdx] + sharedAngleRight[firstIdx] > TWO_PI + tolerance) return;

                const canonical = canonicalCyclicForm(stackNames);
                if (!seen.has(canonical)) {
                    seen.add(canonical);
                    const vc = this.buildAndValidate(stack, depth);
                    if (vc) this.vertexConfigurations.push(vc);
                }
                return;
            }

            const remaining = TWO_PI - angleSum;
            if (remaining < minAngle - tolerance) return;

            const isFirst = depth === 0;
            const candidates = isFirst ? allByAngle : canFollow[stack[depth - 1]];
            const len = candidates.length;
            const firstName = isFirst ? null : polyNames[stack[0]];

            for (let ci = 0; ci < len; ci++) {
                const j = candidates[ci];
                const angle = interiorAngles[j];

                if (angle > remaining + tolerance) break;

                if (!isFirst && comparePolygonNames(polyNames[j], firstName!) < 0) continue;

                stack[depth] = j;
                stackNames.push(polyNames[j]);
                angleSum += angle;
                depth++;

                dfs();

                depth--;
                stackNames.pop();
                angleSum -= angle;
            }
        };

        dfs();
        return this.vertexConfigurations;
    }

    private buildAndValidate = (indices: Int32Array, len: number): VertexConfiguration | null => {
        const vc = new VertexConfiguration([]);
        for (let i = 0; i < len; i++) {
            vc.addPolygon(this.polygons[indices[i]]);
            if (!vc.valid) return null;
        }
        return vc;
    }
}

const canBeAdjacentSig = (a: PolygonSignature, b: PolygonSignature): boolean => {
    const isStarA = a.type === PolygonType.STAR_REGULAR || a.type === PolygonType.STAR_PARAMETRIC;
    const isStarB = b.type === PolygonType.STAR_REGULAR || b.type === PolygonType.STAR_PARAMETRIC;
    if (isStarA && isStarB && a.startsWith === b.startsWith) return false;
    return true;
}

const canonicalCyclicForm = (names: string[]): string => {
    let minStart = 0;
    const n = names.length;
    for (let i = 1; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const cmp = names[(i + j) % n].localeCompare(names[(minStart + j) % n]);
            if (cmp < 0) { minStart = i; break; }
            if (cmp > 0) break;
        }
    }
    const result: string[] = new Array(n);
    for (let j = 0; j < n; j++) result[j] = names[(minStart + j) % n];
    return result.join(',');
}