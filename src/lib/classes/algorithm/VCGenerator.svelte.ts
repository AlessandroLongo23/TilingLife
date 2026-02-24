import { Polygon, PolygonSignature, StarParametricPolygon, StarRegularPolygon, VertexConfiguration } from '$classes';
import { compareArrays, isWithinAngularTolerance } from '$utils';
import { tolerance } from '$stores';

export class VCGenerator {
    vertexConfigurations: VertexConfiguration[] = [];
    polygons: PolygonSignature[] = [];

    constructor(polygons: PolygonSignature[] = []) {
        this.polygons = polygons;
    }

    generateVertexConfigurations = (): VertexConfiguration[] => {
        this.vertexConfigurations = [];
        const seen = new Set<string>();
        const minAngle = this.polygons.length > 0
            ? Math.min(...this.polygons.map(p => p.interior_angle))
            : Infinity;

        const vc = new VertexConfiguration([]);

        const dfs = () => {
            if (vc.polygons.length > 0 && isWithinAngularTolerance(vc.angle, 2 * Math.PI)) {
                const names = vc.polygons.map(p => p.name);
                const canonical = canonicalCyclicForm(names);
                if (!seen.has(canonical)) {
                    seen.add(canonical);
                    this.vertexConfigurations.push(vc.clone());
                }
                return;
            }

            if (2 * Math.PI - vc.angle < minAngle - tolerance) return;

            for (const polygonData of this.polygons) {
                if (vc.polygons.length > 0 &&
                    polygonData.name.localeCompare(vc.polygons[0].name) < 0) {
                    continue;
                }

                if (vc.polygons.length > 0 &&
                    !canBeAdjacent(vc.polygons[vc.polygons.length - 1], polygonData)) {
                    continue;
                }

                const prevAngle = vc.angle;
                const prevDir = vc.current_dir.copy();
                const prevName = vc.name;
                const prevValid = vc.valid;
                const prevLen = vc.polygons.length;

                vc.addPolygon(polygonData);

                if (vc.valid) {
                    dfs();
                }

                vc.polygons.length = prevLen;
                vc.angle = prevAngle;
                vc.current_dir = prevDir;
                vc.name = prevName;
                vc.valid = prevValid;
            }
        };

        dfs();
        return this.vertexConfigurations;
    }
}

const canBeAdjacent = (polygon1: Polygon, polygon2: PolygonSignature): boolean => {
    if (
        (polygon1 instanceof StarRegularPolygon || polygon1 instanceof StarParametricPolygon) && 
        (polygon2 instanceof StarRegularPolygon || polygon2 instanceof StarParametricPolygon) &&
        polygon1.startsWith === polygon2.startsWith
    ) {
        return false;
    }
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