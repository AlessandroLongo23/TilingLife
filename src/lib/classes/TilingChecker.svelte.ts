// import { isWithinTolerance } from "../utils/math.svelte";
// import { compareArrays } from "../utils/utils.svelte";
// import { Vector } from "./Vector.svelte";
// import { Polygon } from "./polygons/Polygon.svelte";
// import { Tiling } from "./Tiling.svelte";

// export class TilingChecker {
//     constructor() {}
    
//     findVertexConfigurations(tiling: Tiling) {
//         const uniqueVertices: Vector[] = [];
//         for (let i = 0; i < tiling.nodes.length; i++) {
//             for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
//                 const vertex = tiling.nodes[i].vertices[j];
//                 if (!uniqueVertices.some(v => isWithinTolerance(v, vertex))) {
//                     uniqueVertices.push(vertex);
//                 }
//             }
//         }

//         const vertexGroups: { shapes: number[], occurrences: number }[] = [];
//         for (let uniqueVertex of uniqueVertices) {
//             const shapesOnVertex: Polygon[] = [];
//             for (let node of tiling.nodes) {
//                 for (let vertex of node.vertices) {
//                     if (isWithinTolerance(vertex, uniqueVertex)) {
//                         shapesOnVertex.push(node);
//                         break;
//                     }
//                 }
//             }

//             const sum = shapesOnVertex.reduce((acc, shape) => acc + Math.PI * (shape.n - 2) / shape.n, 0);
//             if (!isWithinTolerance(sum, 2 * Math.PI)) continue;

//             shapesOnVertex.sort((a, b) => Vector.sub(a.centroid, uniqueVertex).heading() - Vector.sub(b.centroid, uniqueVertex).heading());
//             const shapesOnVertexNumbers: number[] = shapesOnVertex.map(shape => shape.n);
//             const shapesOnVertexNumbersSorted: number[] = shapesOnVertexNumbers.cycleToMinimumLexicographicalOrder();

//             if (!vertexGroups.some(group => group.shapes.isEqualOrChiral(shapesOnVertexNumbersSorted))) {
//                 vertexGroups.push({
//                     shapes: shapesOnVertexNumbersSorted,
//                     occurrences: 1
//                 });
//             } else {
//                 vertexGroups.find(group => group.shapes.isEqualOrChiral(shapesOnVertexNumbersSorted)).occurrences++;
//             }
//         }

//         this.vertexGroups = vertexGroups
//             .map(group => group.shapes.join('.'))
//             .sort((a, b) => a.localeCompare(b));

//         vertexGroups = this.vertexGroups.map(group => group.split('.').map(Number)).sort((a, b) => compareArrays(a, b));

//         tiling.crNotation = "";
//         let exponent = 1;
//         for (let i = 0; i < vertexGroups.length; i++) {
//             for (let j = 0; j < vertexGroups[i].length; j++) {
//                 if (j < vertexGroups[i].length && vertexGroups[i][j] === vertexGroups[i][j + 1]) {
//                     exponent++;
//                 } else {
//                     if (exponent > 1) {
//                         tiling.crNotation += vertexGroups[i][j] + "^" + exponent + ".";
//                     } else {
//                         tiling.crNotation += vertexGroups[i][j] + ".";
//                     }
//                     exponent = 1;
//                 }
//             }
            
//             tiling.crNotation = tiling.crNotation.slice(0, -1);
//             if (i < vertexGroups.length - 1) {
//                 tiling.crNotation += ";";
//             }
//         }
//     }
// }