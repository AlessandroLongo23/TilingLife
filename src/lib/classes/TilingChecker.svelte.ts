import { isWithinTolerance } from "../utils/math.svelte";
import { compareVCNames, cycleToMinimumLexicographicalOrder, isEqualOrChiral } from "../utils/utils.svelte";
import { Vector } from "./Vector.svelte";
import { Polygon } from "./polygons/Polygon.svelte";
import { Tiling } from "./Tiling.svelte";
import { VertexConfiguration } from "./algorithm/VertexConfiguration.svelte";

export class TilingChecker {
    constructor() {}
    
    findVertexConfigurations(tiling: Tiling) {
        // find all unique vertices in the tiling
        const uniqueVertices: Vector[] = [];
        for (let i = 0; i < tiling.nodes.length; i++) {
            for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                const vertex = tiling.nodes[i].vertices[j];
                if (!uniqueVertices.some(v => isWithinTolerance(v, vertex))) {
                    uniqueVertices.push(vertex);
                }
            }
        }

        // for each unique vertex
        const vertexConfigurations: { vc: VertexConfiguration, occurrences: number }[] = [];
        for (let uniqueVertex of uniqueVertices) {
            // find all shapes around it
            const shapesOnVertex: Polygon[] = [];
            for (let node of tiling.nodes) {
                for (let vertex of node.vertices) {
                    if (isWithinTolerance(vertex, uniqueVertex)) {
                        shapesOnVertex.push(node);
                        break;
                    }
                }
            }

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
}