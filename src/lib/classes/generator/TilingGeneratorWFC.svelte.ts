// import { tolerance, debugView, transformSteps, offsets } from '$stores';

// import { RegularPolygon } from '../polygons/RegularPolygon.svelte.ts';
// // import { IsotoxalPolygon } from './polygons/IsotoxalPolygon.svelte.ts';
// // import { StarPolygon } from './polygons/StarPolygon.svelte.ts';
// // import { DualPolygon } from './polygons/DualPolygon.svelte.ts';
// // import { GeneralPolygon } from './polygons/GeneralPolygon.svelte.ts';

// import { Parser } from './Parser.svelte.ts';
// import { Transformer } from './Transformer.svelte.ts';

// import { TilingChecker } from '../../classes/TilingChecker.svelte';
// import { isWithinTolerance } from '../../utils/math.svelte.ts';
// import { Vector } from '../../classes/Vector.svelte';
// import { Tiling } from '../../classes/Tiling.svelte';
// import { TilingGenerator } from './TilingGenerator.svelte.ts';

// // const availablePolygons = [3, 4, 6, /*8,*/ 12];

// export class TilingGeneratorWFC extends TilingGenerator {
//     tiling: Tiling;
//     tilingChecker: TilingChecker;
//     possibleVertexConfigurations: number[][];
//     parser: Parser;
//     transformer: Transformer;

//     constructor(tiling: Tiling) {
//         super();
//     }

//     generateWithWFC() {
//         this.tiling.nodes = [];

//         this.addFirstNode();

//         let iterations = 0;
//         while (true) {
//             this.prune();
//             this.evaluateVertices();

//             let lowestEntropyVertex = this.getLowestEntropyVertex();
//             if (lowestEntropyVertex == Infinity) break;

//             this.collapseVertex(lowestEntropyVertex);
//             this.propagateConstraints(lowestEntropyVertex);

//             console.log(this.tiling.nodes)

//             console.log('--------------------------------')

//             if (this.tiling.nodes.length > 250 || iterations > 100) break;
//             iterations++;
//         }

//         return this.tiling;
//     }

//     addFirstNode = () => {
//         let sides = availablePolygons.pickRandom();

//         this.tiling.nodes.push(new RegularPolygon({
//             centroid: new Vector(),
//             n: sides,
//             angle: sides == 3 ? 0 : Math.PI / sides
//         }));
//     }

//     prune = () => {
//         let newNodes = [];
//         for (let node of this.tiling.nodes) {
//             if (isNaN(node.centroid.x)) continue;
//             if (newNodes.some(n => isWithinTolerance(n.centroid, node.centroid))) continue;

//             newNodes.push(node);
//         }

//         this.tiling.nodes = [...newNodes];
//     }

//     computePossibleConfigurations = (v, shapesAround) => {
//         shapesAround.sort((a, b) => Vector.sub(a.centroid, v).heading() - Vector.sub(b.centroid, v).heading());
//         shapesAround = shapesAround.map(shape => shape.n);

//         return this.possibleVertexConfigurations.filter(c => c.cyclicallyInclude(shapesAround));
//     }

//     evaluateVertices = () => {
//         this.uniqueUncollapsedVertices = []
        
//         for (let node of this.tiling.nodes) {
//             for (let vertex of node.vertices) {
//                 // if the vertex is already in the list, skip
//                 if (this.uniqueUncollapsedVertices.some(v => isWithinTolerance(v.coord, vertex)))
//                     continue;

//                 // get the shapes around the vertex
//                 let shapesAround = [];
//                 for (let otherNode of this.tiling.nodes) {
//                     for (let otherVertex of otherNode.vertices) {
//                         if (isWithinTolerance(vertex, otherVertex)) {
//                             shapesAround.push(otherNode);
//                             break;
//                         }
//                     }
//                 }
                
//                 // get the covered angle
//                 let coveredAngle = shapesAround.reduce((acc, shape) => acc + Math.PI * (shape.n - 2) / shape.n, 0);

//                 // get the possible configurations, and skip if there are none (impossible vertex)
//                 let possibleConfigurations = this.computePossibleConfigurations(vertex, shapesAround);
//                 if (possibleConfigurations.length == 0) continue;

//                 // if the vertex is fully covered, skip
//                 if (isWithinTolerance(coveredAngle, 2 * Math.PI) || coveredAngle > 2 * Math.PI) 
//                     continue;

//                 let neighbors = this.tiling.nodes.flatMap(n => n.vertices).filter(other => isWithinTolerance(vertex.distance(other),  1));

//                 // add the vertex to the list of unique uncollapsed vertices
//                 this.uniqueUncollapsedVertices.push({
//                     coord: vertex,
//                     radialDistance: vertex.mag(),
//                     neighbors: neighbors,
//                     shapesAround: shapesAround,
//                     coveredAngle: coveredAngle,
//                     possibleConfigurations: possibleConfigurations
//                 });
//             }
//         }
//     }

//     getLowestEntropyVertex = () => {
//         let lowestEntropy = Infinity;
//         let minRadialDistance = Infinity;
//         let lowestEntropyVertex = null;

//         for (let freeVertex of this.uniqueUncollapsedVertices) {
//             if (freeVertex.possibleConfigurations.length < lowestEntropy) {
//                 lowestEntropy = freeVertex.possibleConfigurations.length;
//                 minRadialDistance = freeVertex.radialDistance;
//                 lowestEntropyVertex = freeVertex;
//             } else if (freeVertex.possibleConfigurations.length == lowestEntropy && freeVertex.radialDistance < minRadialDistance) {
//                 minRadialDistance = freeVertex.radialDistance;
//                 lowestEntropyVertex = freeVertex;
//             }
//         }

//         console.log('lowest entropy vertex: ', lowestEntropyVertex)
//         console.log('lowest entropy: ', lowestEntropy)

//         return lowestEntropyVertex;
//     }

//     collapseVertex = (vertex) => {
//         let randomConfiguration = vertex.possibleConfigurations.pickRandom();
        
//         console.log("chosen configuration: ", randomConfiguration)

//         console.log("already placed nodes around vertex: ", vertex.shapesAround)

//         // sort the by the angle from the centroid to the vertex
//         vertex.shapesAround.sort((a, b) => {
//             let angleA = Vector.sub(a.centroid, vertex.coord).heading();
//             let angleB = Vector.sub(b.centroid, vertex.coord).heading();
//             return angleA - angleB;
//         });

//         console.log("already placed nodes around vertex (sorted): ", vertex.shapesAround)

//         if (vertex.shapesAround.length > 1) {
//             for (let i = 0; i < vertex.shapesAround.length; i++) {
//                 let curr = vertex.shapesAround[i];
//                 let next = vertex.shapesAround[(i + 1) % vertex.shapesAround.length];

//                 let vecA = Vector.sub(curr.centroid, vertex.coord).normalize();
//                 let vecB = Vector.sub(next.centroid, vertex.coord).normalize();
//                 let intAngleA = Math.PI * (curr.n - 2) / (2 * curr.n);
//                 let intAngleB = Math.PI * (next.n - 2) / (2 * next.n);
//                 if (!isWithinTolerance(Vector.rotate(vecA, intAngleA + intAngleB), vecB)) {
//                     let temp = []
//                     for (let j = 0; j < vertex.shapesAround.length; j++) {
//                         temp.push(vertex.shapesAround[(i + 1 + j) % vertex.shapesAround.length]);
//                     }
//                     vertex.shapesAround = [...temp];
//                     break;
//                 }
//             }
//         }

//         console.log("already placed nodes around vertex (sorted after gap check): ", vertex.shapesAround)

//         // find the starting index in the configuration
//         // if more than one, select it at random
//         let startingIndexes = randomConfiguration.findSubsequenceStartingIndex(vertex.shapesAround.map(n => n.n));
//         let startingIndex;
//         if (startingIndexes.length > 1) {
//             startingIndex = startingIndexes.pickRandom();
//         } else {
//             startingIndex = startingIndexes[0];
//         }
//         let endIndex = (startingIndex + vertex.shapesAround.length) % randomConfiguration.length;

//         // going in circle, add the nodes around the vertex, adding their vertices to the free vertices list
//         let lastNode = vertex.shapesAround[vertex.shapesAround.length - 1];
//         let lastNodeDir = Vector.sub(lastNode.centroid, vertex.coord);

//         for (let i = 0; i < randomConfiguration.length - vertex.shapesAround.length; i++) {
//             let n = randomConfiguration[(endIndex + i) % randomConfiguration.length];

//             let lastNodeIntAngle = Math.PI * (lastNode.n - 2) / (2 * lastNode.n);
//             let currNodeIntAngle = Math.PI * (n - 2) / (2 * n);
//             lastNodeDir = lastNodeDir.rotate(lastNodeIntAngle + currNodeIntAngle);

            
//             let radius = 0.5 / Math.sin(Math.PI / n);
//             let newNode = new RegularPolygon({
//                 centroid: Vector.add(vertex.coord, Vector.fromAngle(lastNodeDir.heading()).scale(radius)),
//                 n: n,
//                 angle: Vector.rotate(lastNodeDir, Math.PI).heading()
//             });
//             lastNode = newNode;

//             this.tiling.nodes.push(newNode);
//         }
//     }

//     showWFCInfo = (ctx) => {
//         let focusedVertex = null;
//         let minDist = Infinity;
//         let mousePos = new Vector(
//             (ctx.mouseX - ctx.width / 2 - get(controls).offset.x) / get(controls).zoom, 
//             -(ctx.mouseY - ctx.height / 2 - get(controls).offset.y) / get(controls).zoom
//         );
//         for (let vertex of this.uniqueUncollapsedVertices) {
//             let d = mousePos.distance(vertex.coord);
//             if (d < minDist && d < 0.5) {
//                 minDist = d;
//                 focusedVertex = vertex;
//             }
//         }

//         if (!focusedVertex) return;

//         ctx.push();
//         ctx.scale(1, -1);
//         ctx.stroke(0, 0, 0);
//         ctx.fill(0, 0, 255);
//         ctx.ellipse(focusedVertex.coord.x, -focusedVertex.coord.y, 0.2);

//         ctx.fill(0, 0, 0);
//         ctx.noStroke();
//         ctx.textSize(0.4);
//         for (let i = 0; i < focusedVertex.shapesAround.length; i++) {
//             let vec = Vector.sub(focusedVertex.shapesAround[i].centroid, focusedVertex.coord).setMag(0.5);
//             ctx.text(i, focusedVertex.shapesAround[i].centroid.x - 0.1, -focusedVertex.shapesAround[i].centroid.y + 0.1);
//             ctx.text(vec.heading(), focusedVertex.coord.x + vec.x, -focusedVertex.coord.y - vec.y);
                
//             ctx.stroke(0, 0, 0);
//             ctx.line(focusedVertex.coord.x, -focusedVertex.coord.y, focusedVertex.coord.x + vec.x, -focusedVertex.coord.y - vec.y);
//         }
//         ctx.pop();
//     }
// }