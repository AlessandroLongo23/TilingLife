import { tolerance, debugView, offsets, debugManager, updateDebugStore } from '$stores';
import { angleBetween, isWithinTolerance, getSpatialKey } from '$utils';
import { vertexConfigurations } from '$lib/const';
import { DualPolygon, Polygon } from '../polygons';
import { Vector } from '../Vector.svelte';
import { Tiling } from '../Tiling.svelte';
import { GOLEngine } from './GOLEngine.svelte';

export class TilingGenerator {
    tiling: Tiling;
    golEngine: GOLEngine;
    // tilingChecker: TilingChecker;
    possibleVertexConfigurations: number[][];

    constructor() {
        this.tiling = new Tiling();
        this.golEngine = new GOLEngine();
        // this.tilingChecker = new TilingChecker();
        this.possibleVertexConfigurations = [...vertexConfigurations];
    }

    computeDual = () => {
        if (debugView) debugManager.startTimer("Dual");
        let originalVertices = this.tiling.nodes.map(node => node.vertices).flat();

        let uniqueOriginalVertices: Vector[] = [];
        for (let originalVertex of originalVertices)
            if (!uniqueOriginalVertices.some(v => isWithinTolerance(v, originalVertex)))
                uniqueOriginalVertices.push(originalVertex);

        let dualNodes: DualPolygon[] = [];
        for (let i = 0; i < uniqueOriginalVertices.length; i++) {
            let centroid = uniqueOriginalVertices[i];

            let neighboringPolygons: Polygon[] = [];
            for (let j = 0; j < this.tiling.nodes.length; j++) {
                let belongsToCentroid = false;
                for (let k = 0; k < this.tiling.nodes[j].vertices.length; k++) {
                    if (isWithinTolerance(this.tiling.nodes[j].vertices[k], centroid)) {
                        belongsToCentroid = true;
                        break;
                    }
                }

                if (belongsToCentroid) {
                    neighboringPolygons.push(this.tiling.nodes[j]);
                }
            }

            if (neighboringPolygons.length < 3) {
                continue;
            }

            let neighboringHalfwayPoints: Vector[] = [];
            for (let i = 0; i < neighboringPolygons.length; i++) {
                for (let k = 0; k < neighboringPolygons[i].halfways.length; k++) {
                    let angle = angleBetween(neighboringPolygons[i].centroid, neighboringPolygons[i].halfways[k], centroid);

                    if (Math.abs(angle - Math.PI / 2) < tolerance || Math.abs(angle + Math.PI / 2) < tolerance) {
                        neighboringHalfwayPoints.push(neighboringPolygons[i].halfways[k] as Vector);
                    }
                }
            }

            let uniqueNeighboringHalfwayPoints: Vector[] = [];
            for (let i = 0; i < neighboringHalfwayPoints.length; i++) {
                if (!uniqueNeighboringHalfwayPoints.some(point => isWithinTolerance(point, neighboringHalfwayPoints[i]))) {
                    uniqueNeighboringHalfwayPoints.push(neighboringHalfwayPoints[i]);
                }
            }

            if (neighboringPolygons.length < uniqueNeighboringHalfwayPoints.length) {
                continue;
            }

            let vertices: Vector[] = neighboringPolygons.map(polygon => polygon.centroid);

            vertices.sort((a, b) => {
                let angleToCentroidA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
                let angleToCentroidB = Math.atan2(b.y - centroid.y, b.x - centroid.x);

                if (angleToCentroidA < 0) angleToCentroidA += 2 * Math.PI;
                if (angleToCentroidB < 0) angleToCentroidB += 2 * Math.PI;

                return angleToCentroidA - angleToCentroidB;
            });

            let halfways: Vector[] = [];
            for (let j = 0; j < vertices.length; j++)
                halfways.push(Vector.midpoint(vertices[j], vertices[(j + 1) % vertices.length]));

            let dualNode = new DualPolygon({
                centroid: centroid.copy(),
                vertices: vertices,
                halfways: halfways
            });

            dualNodes.push(dualNode);
        }

        this.tiling.nodes = [...dualNodes];

        if (debugView) debugManager.endTimer("Dual");
    }

    calculateNeighbors = (): void => {
        if (debugView) debugManager.startTimer("Computing Neighbors");
        
        const neighborSet = new Set();
        
        if (debugView) debugManager.startTimer("Creating spatial indices");
        const halfwaysSpatialMap = new Map();
        const verticesSpatialMap = new Map();

        for (let i = 0; i < this.tiling.nodes.length; i++) {
            this.tiling.nodes[i].neighbors = [];
            
            for (let j = 0; j < this.tiling.nodes[i].halfways.length; j++) {
                const hw = this.tiling.nodes[i].halfways[j];
                const key = getSpatialKey(hw.x, hw.y);
                
                if (!halfwaysSpatialMap.has(key)) {
                    halfwaysSpatialMap.set(key, []);
                }
                halfwaysSpatialMap.get(key).push({
                    nodeIndex: i,
                    halfwayIndex: j
                });
            }
            
            for (let j = 0; j < this.tiling.nodes[i].vertices.length; j++) {
                const v = this.tiling.nodes[i].vertices[j];
                const key = getSpatialKey(v.x, v.y);
                
                if (!verticesSpatialMap.has(key)) {
                    verticesSpatialMap.set(key, []);
                }
                verticesSpatialMap.get(key).push({
                    nodeIndex: i,
                    vertexIndex: j
                });
            }
        }
        if (debugView) debugManager.endTimer("Creating spatial indices");
        
        const addNeighbor = (i: number, k: number): void => {
            const pairKey = i < k ? `${i}-${k}` : `${k}-${i}`;
            
            if (!neighborSet.has(pairKey)) {
                neighborSet.add(pairKey);
                (this.tiling.nodes[i].neighbors || []).push(this.tiling.nodes[k]);
                (this.tiling.nodes[k].neighbors || []).push(this.tiling.nodes[i]);
            }
        };

        if (debugView) debugManager.startTimer("Calculating halfways neighbors");
        const processedHalfwayCells = new Set();
        
        for (const [key, entries] of halfwaysSpatialMap.entries()) {
            if (entries.length < 2) continue;
            
            for (let i = 0; i < entries.length; i++) {
                const entry1 = entries[i];
                const node1 = this.tiling.nodes[entry1.nodeIndex];
                const hw1 = node1.halfways[entry1.halfwayIndex];
                
                for (let j = i + 1; j < entries.length; j++) {
                    const entry2 = entries[j];
                    const node2 = this.tiling.nodes[entry2.nodeIndex];
                    const hw2 = node2.halfways[entry2.halfwayIndex];
                    
                    if (isWithinTolerance(hw1, hw2)) {
                        addNeighbor(entry1.nodeIndex, entry2.nodeIndex);
                    }
                }
            }
            
            processedHalfwayCells.add(key);
        }
        
        for (const [key, entries] of halfwaysSpatialMap.entries()) {
            if (processedHalfwayCells.has(key)) continue;
            
            const [baseX, baseY] = key.split(',').map(Number);
            
            for (const entry1 of entries) {
                const node1 = this.tiling.nodes[entry1.nodeIndex];
                const hw1 = node1.halfways[entry1.halfwayIndex];
                
                for (const [dx, dy] of offsets) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const adjKey = `${baseX + dx},${baseY + dy}`;
                    const adjEntries = halfwaysSpatialMap.get(adjKey) || [];
                    
                    for (const entry2 of adjEntries) {
                        const node2 = this.tiling.nodes[entry2.nodeIndex];
                        const hw2 = node2.halfways[entry2.halfwayIndex];
                        
                        if (isWithinTolerance(hw1, hw2)) {
                            addNeighbor(entry1.nodeIndex, entry2.nodeIndex);
                        }
                    }
                }
            }
        }
        if (debugView) debugManager.endTimer("Calculating halfways neighbors");

        if (debugView) debugManager.endTimer("Computing Neighbors");
        updateDebugStore();
    }
}