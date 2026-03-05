import { isWithinTolerance } from "../utils/math.svelte";
import { compareVCNames, cycleToMinimumLexicographicalOrder, isEqualOrChiral } from "../utils/utils.svelte";
import { Vector } from "./Vector.svelte";
import { Polygon } from "./polygons/Polygon.svelte";
import { Tiling } from "./Tiling.svelte";
import { VertexConfiguration } from "./algorithm/VertexConfiguration.svelte";
import { tolerance } from "$stores";

export const gyrationOrders: number[] = [6, 4, 3, 2];

export class TilingChecker {
    constructor() {}
    
    findVertexConfigurations(tiling: Tiling) {
        // O(N) spatial hash: unique vertices + polygons touching each vertex in one pass
        const vertexMap = new Map<string, { point: Vector; polygons: Polygon[] }>();
        for (let node of tiling.nodes) {
            for (let vertex of node.vertices) {
                const key = TilingChecker.getSpatialKey(vertex);
                if (!vertexMap.has(key)) {
                    vertexMap.set(key, { point: vertex, polygons: [node] });
                } else {
                    vertexMap.get(key)!.polygons.push(node);
                }
            }
        }

        const vertexConfigurations: { vc: VertexConfiguration; occurrences: number }[] = [];
        for (const { point: uniqueVertex, polygons: shapesOnVertex } of vertexMap.values()) {
            // check the internal angle sum of the shapes around the vertex
            const internalAngleSum = shapesOnVertex.reduce((acc, polygon) => acc + polygon.getAngleAtVertex(uniqueVertex), 0);
            if (!isWithinTolerance(internalAngleSum, 2 * Math.PI)) continue;

            // sort the shapes based on the relative position of the centroid to the unique vertex
            shapesOnVertex.sort((a, b) => Vector.sub(a.centroid, uniqueVertex).heading() - Vector.sub(b.centroid, uniqueVertex).heading());
            const shapesOnVertexNumbers: number[] = shapesOnVertex.map(shape => shape.n);
            const shapesOnVertexNumbersSorted: number[] = cycleToMinimumLexicographicalOrder(shapesOnVertexNumbers);

            // if the vertex configuration is new, add it to the list
            if (!vertexConfigurations.some(group => isEqualOrChiral(group.vc.polygons.map(p => p.n), shapesOnVertexNumbersSorted))) {
                vertexConfigurations.push({
                    vc: new VertexConfiguration(shapesOnVertex.map(shape => shape.clone())),
                    occurrences: 1
                });
            } 
            
            // otherwise, increment the occurence count
            else {
                vertexConfigurations.find(group => isEqualOrChiral(group.vc.polygons.map(p => p.n), shapesOnVertexNumbersSorted)).occurrences++;
            }
        }

        vertexConfigurations.sort((a, b) => compareVCNames(a.vc.polygons.map(p => p.getName()), b.vc.polygons.map(p => p.getName())));

        tiling.vcs = vertexConfigurations;
    }

    computeWallpaperGroup(tiling: Tiling) {
        this.findTranslationalCellBasis(tiling);
        this.findGyrationCenters(tiling);
    }

    findTranslationalCellBasis(tiling: Tiling): void {
        // take the polygon closest to the origin
        tiling.originPolygon = tiling.nodes.reduce((min, node) => node.centroid.mag() < min.centroid.mag() ? node : min);

        // compute all vectors between polygons of the same type and with the same orientation  
        const samePolygonsTranslationVectors: Vector[] = tiling.nodes
            .filter(polygon => polygon.n === tiling.originPolygon.n)
            .filter(polygon => polygon.isTranslated(tiling.originPolygon))
            .map(polygon => Vector.sub(polygon.centroid, tiling.originPolygon.centroid))
            .filter(vector => vector.mag() > tolerance)
            .sort((a, b) => a.mag() - b.mag());

        // now filter them to only include valid translation vectors, i.e., translation vectors that do not change the tiling
        const translationVectors: Vector[] = [];
        for (const translationVector of samePolygonsTranslationVectors) {
            const translatedTiling: Tiling = Tiling.translate(tiling, translationVector);
            if (translatedTiling.isEquivalent(tiling)) {
                translationVectors.push(translationVector);
            }
        }

        // degenerate fallback
        if (translationVectors.length === 0) {
            tiling.translationalCellBasis = [new Vector(1, 0), new Vector(0, 1)];
            return;
        }

        // v1 = shortest valid vector
        translationVectors.sort((a, b) => a.mag() - b.mag());
        const v1: Vector = translationVectors[0];

        // v2 = first valid vector that is NOT parallel to v1 (decoupled for rectangular lattices)
        let v2: Vector | null = null;
        for (let i = 1; i < translationVectors.length; i++) {
            if (Math.abs(Vector.cross(v1, translationVectors[i])) > tolerance) {
                v2 = translationVectors[i];
                break;
            }
        }

        if (!v2) {
            // fallback: return v1 twice if no linearly independent vector found (degenerate case)
            tiling.translationalCellBasis = [v1, v1.copy()];
        }

        tiling.translationalCellBasis = [v1, v2];
    }

    findGyrationCenters(tiling: Tiling): void {
        const points: Vector[] = this.findUniquePointsInCell(
            tiling, 
            tiling.originPolygon!.centroid, 
            tiling.translationalCellBasis![0], 
            tiling.translationalCellBasis![1]
        );
            
        tiling.gyrations = [];
        for (let point of points) {
            for (let order of gyrationOrders) {
                let isEquivalent = true;
                for (let i = 1; i < order; i++) {
                    const rotatedTiling: Tiling = Tiling.rotate(tiling, point, 2 * Math.PI * i / order);
                    if (!tiling.isEquivalent(rotatedTiling)) {
                        isEquivalent = false;
                        break;
                    }
                }

                if (isEquivalent) {
                    tiling.gyrations.push({ center: point, order });
                    break;
                }
            }
        }
    }

    private static getSpatialKey(v: Vector): string {
        return `${Math.round(v.x / tolerance)},${Math.round(v.y / tolerance)}`;
    }

    findUniquePoints(tiling: Tiling): Vector[] {
        const pointMap = new Map<string, Vector>();
        for (let node of tiling.nodes) {
            for (let vertex of node.vertices) {
                const key = TilingChecker.getSpatialKey(vertex);
                if (!pointMap.has(key)) pointMap.set(key, vertex);
            }
            for (let halfway of node.halfways) {
                const key = TilingChecker.getSpatialKey(halfway);
                if (!pointMap.has(key)) pointMap.set(key, halfway);
            }
            const key = TilingChecker.getSpatialKey(node.centroid);
            if (!pointMap.has(key)) pointMap.set(key, node.centroid);
        }
        return Array.from(pointMap.values());
    }

    /**
     * Returns unique construction points that lie inside the primitive translational cell [0,1) x [0,1).
     * Uses half-open interval to capture boundaries (vertices, edge midpoints) without double-counting.
     */
    findUniquePointsInCell(tiling: Tiling, origin: Vector, v1: Vector, v2: Vector): Vector[] {
        if (!origin || !v1 || !v2) return [];
        const cross = Vector.cross(v1, v2);
        if (Math.abs(cross) < tolerance) return [];

        const pointMap = new Map<string, Vector>();
        for (let node of tiling.nodes) {
            for (const point of [...node.vertices, ...node.halfways, node.centroid]) {
                const rel = Vector.sub(point, origin);
                const a = Vector.cross(rel, v2) / cross;
                const b = Vector.cross(v1, rel) / cross;
                if (a >= -tolerance && a < 1 && b >= -tolerance && b < 1) {
                    const key = TilingChecker.getSpatialKey(point);
                    if (!pointMap.has(key)) pointMap.set(key, point);
                }
            }
        }
        return Array.from(pointMap.values());
    }
}