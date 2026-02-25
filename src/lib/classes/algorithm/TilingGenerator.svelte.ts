import { SeedConfiguration, Vector } from "$classes";

export class TilingGenerator {
    constructor() {}

    generateTilings = (seedConfiguration: SeedConfiguration): Tiling[] => {
        const candidateVerticesSet: Vector[][] = [];
        for (const polygon of seedConfiguration.polygons) {
            for (const vertex of polygon.vertices) {
                candidateVerticesSet.push(vertex);
            }
        }


    }

    isInsideConvexHull = (vertices: Vector[], point: Vector): boolean => {
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % n];
            const crossProduct = Vector.cross(Vector.sub(v2, v1), Vector.sub(point, v1));
            if (crossProduct > 0) return false;
        }
        return true;
    }
}