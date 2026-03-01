import { isWithinTolerance } from "../utils/math.svelte";
import { compareArrays } from "../utils/utils.svelte";
import { Vector } from "./Vector.svelte";
import { Polygon } from "./polygons/Polygon.svelte";
import { Tiling } from "./Tiling.svelte";

export class TilingChecker {
    constructor() {}
    
    findVertexConfigurations(tiling: Tiling) {
        const uniqueVertices: Vector[] = [];
        for (let i = 0; i < tiling.nodes.length; i++) {
            for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                const vertex = tiling.nodes[i].vertices[j];
                if (!uniqueVertices.some(v => isWithinTolerance(v, vertex))) {
                    uniqueVertices.push(vertex);
                }
            }
        }

        const vertexConfigurations: { shapes: number[], occurrences: number }[] = [];
        for (let uniqueVertex of uniqueVertices) {
            const shapesOnVertex: Polygon[] = [];
            for (let node of tiling.nodes) {
                for (let vertex of node.vertices) {
                    if (isWithinTolerance(vertex, uniqueVertex)) {
                        shapesOnVertex.push(node);
                        break;
                    }
                }
            }

            const internalAngleSum = shapesOnVertex.reduce((acc, polygon) => acc + getAngleAtVertex(polygon, uniqueVertex), 0);
            if (!isWithinTolerance(internalAngleSum, 2 * Math.PI)) continue;

            shapesOnVertex.sort((a, b) => Vector.sub(a.centroid, uniqueVertex).heading() - Vector.sub(b.centroid, uniqueVertex).heading());
            const shapesOnVertexNumbers: number[] = shapesOnVertex.map(shape => shape.n);
            const shapesOnVertexNumbersSorted: number[] = shapesOnVertexNumbers.cycleToMinimumLexicographicalOrder();

            if (!vertexConfigurations.some(group => group.shapes.isEqualOrChiral(shapesOnVertexNumbersSorted))) {
                vertexConfigurations.push({
                    shapes: shapesOnVertexNumbersSorted,
                    occurrences: 1
                });
            } else {
                vertexConfigurations.find(group => group.shapes.isEqualOrChiral(shapesOnVertexNumbersSorted)).occurrences++;
            }
        }

        this.vertexConfigurations = vertexConfigurations
            .map(group => group.shapes.join('.'))
            .sort((a, b) => a.localeCompare(b));

        vertexConfigurations = this.vertexConfigurations.map(group => group.split('.').map(Number)).sort((a, b) => compareArrays(a, b));

        tiling.crNotation = "";
        let exponent = 1;
        for (let i = 0; i < vertexConfigurations.length; i++) {
            for (let j = 0; j < vertexConfigurations[i].length; j++) {
                if (j < vertexConfigurations[i].length && vertexConfigurations[i][j] === vertexConfigurations[i][j + 1]) {
                    exponent++;
                } else {
                    if (exponent > 1) {
                        tiling.crNotation += vertexConfigurations[i][j] + "^" + exponent + ".";
                    } else {
                        tiling.crNotation += vertexConfigurations[i][j] + ".";
                    }
                    exponent = 1;
                }
            }
            
            tiling.crNotation = tiling.crNotation.slice(0, -1);
            if (i < vertexConfigurations.length - 1) {
                tiling.crNotation += ";";
            }
        }
    }
}