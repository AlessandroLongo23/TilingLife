import { tolerance, debugView, offsets, debugManager, updateDebugStore } from '$stores';
import { isWithinTolerance, getSpatialKey } from '$utils';
import { Tiling, Parser, Polygon, GOLNeighborhood, GOLRuleType } from '$classes';

export class GOLEngine {
    tiling: Tiling;

    constructor() {}

    setupGameOfLife = (tiling: Tiling, ruleType: GOLRuleType, golRule: string, golRules: { [key: number]: string }) => {
        this.tiling = tiling;
        this.loadGameOfLifeRule(ruleType, golRule, golRules);
        this.tiling.randomizeGameOfLifeGrid();
    }

    loadGameOfLifeRule = (ruleType: GOLRuleType, golRule: string, golRules: { [key: number]: string }) => {
        const parser = new Parser();
        
        if (ruleType === GOLRuleType.SINGLE) {
            this.tiling.golRuleType = GOLRuleType.SINGLE;
            this.tiling.parsedGolRule = parser.parseGameOfLifeRule(golRule)
        } else {
            this.tiling.golRuleType = GOLRuleType.BY_SHAPE;
            this.tiling.rules = {}

            for (let i = 0; i < Object.keys(golRules).length; i++) {
                let key = Object.keys(golRules)[i];
                let value = golRules[key];
                this.tiling.rules[key] = parser.parseGameOfLifeRule(value);
            }
        }
        this.calculateGoLNeighbors(this.tiling.parsedGolRule.range || 1, this.tiling.parsedGolRule.neighborhood as GOLNeighborhood);
    }

    calculateGoLNeighbors = (depth: number = 1, neighborhoodType: GOLNeighborhood = GOLNeighborhood.MOORE): void => {
        if (debugView) debugManager.startTimer("Computing Neighbors");
        
        const neighborSet = new Set();
        
        if (debugView) debugManager.startTimer("Creating spatial indices");
        const halfwaysSpatialMap = new Map();
        const verticesSpatialMap = new Map();

        for (let i = 0; i < this.tiling.nodes.length; i++) {
            this.tiling.nodes[i].golNeighbors = [];
            
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
        
        const addGolNeighbor = (i: number, k: number): void => {
            const pairKey = i < k ? `${i}-${k}` : `${k}-${i}`;
            
            if (!neighborSet.has(pairKey)) {
                neighborSet.add(pairKey);
                (this.tiling.nodes[i].golNeighbors || []).push(this.tiling.nodes[k]);
                (this.tiling.nodes[k].golNeighbors || []).push(this.tiling.nodes[i]);
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
                        addGolNeighbor(entry1.nodeIndex, entry2.nodeIndex);
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
                            addGolNeighbor(entry1.nodeIndex, entry2.nodeIndex);
                        }
                    }
                }
            }
        }
        if (debugView) debugManager.endTimer("Calculating halfways neighbors");

        if (neighborhoodType === GOLNeighborhood.MOORE) {
            if (debugView) debugManager.startTimer("Calculating vertices neighbors");
            const vertexToNodesMap = new Map();
            
            for (let i = 0; i < this.tiling.nodes.length; i++) {
                for (let j = 0; j < this.tiling.nodes[i].vertices.length; j++) {
                    const vertex = this.tiling.nodes[i].vertices[j];
                    const key = getSpatialKey(vertex.x, vertex.y);
                    
                    const baseX = Math.floor(vertex.x / (tolerance * 2));
                    const baseY = Math.floor(vertex.y / (tolerance * 2));
                    
                    let canonicalVertex = vertex;
                    let canonicalKey: string | null = null;
                    
                    for (const [dx, dy] of offsets) {
                        const nearbyKey = `${baseX + dx},${baseY + dy}`;
                        const existingVertices = vertexToNodesMap.get(nearbyKey);
                        
                        if (!existingVertices) continue;
                        
                        for (const {v} of existingVertices) {
                            if (isWithinTolerance(vertex, v)) {
                                canonicalVertex = v;
                                canonicalKey = nearbyKey as string;
                                break;
                            }
                        }
                        
                        if (canonicalKey) break;
                    }
                    
                    if (!canonicalKey) {
                        canonicalKey = key;
                        
                        if (!vertexToNodesMap.has(canonicalKey)) {
                            vertexToNodesMap.set(canonicalKey, []);
                        }
                        
                        vertexToNodesMap.get(canonicalKey).push({
                            v: canonicalVertex,
                            nodeIndexes: new Set([i])
                        });
                    } else {
                        for (const entry of vertexToNodesMap.get(canonicalKey)) {
                            if (isWithinTolerance(entry.v, canonicalVertex)) {
                                entry.nodeIndexes.add(i);
                                break;
                            }
                        }
                    }
                }
            }
            
            for (const entries of vertexToNodesMap.values()) {
                for (const {nodeIndexes} of entries) {
                    if (nodeIndexes.size < 2) continue;
                    
                    const nodeIndexArray = Array.from(nodeIndexes);
                    
                    for (let i = 0; i < nodeIndexArray.length; i++) {
                        for (let j = i + 1; j < nodeIndexArray.length; j++) {
                            const node1Index = nodeIndexArray[i] as number;
                            const node2Index = nodeIndexArray[j] as number;
                            
                            const isSideNeighbors = (this.tiling.nodes[node1Index].golNeighbors || []).some(
                                neighbor => isWithinTolerance(neighbor.centroid, this.tiling.nodes[node2Index].centroid)
                            );
                            
                            if (!isSideNeighbors) {
                                addGolNeighbor(node1Index, node2Index);
                            }
                        }
                    }
                }
            }
            if (debugView) debugManager.endTimer("Calculating vertices neighbors");
        }

        if (debugView) debugManager.startTimer("Calculating all neighbors with DFS");
        
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            const node = this.tiling.nodes[i];
            
            node.golNeighbors = [];
            
            const visited = new Set([node]);
            const allNeighbors = new Set();
            
            const queue: { node: Polygon, depth: number }[] = [];
            
            for (const neighbor of node.golNeighbors || []) {
                queue.push({ node: neighbor, depth: 1 });
                visited.add(neighbor);
                allNeighbors.add(neighbor);
            }
            
            while (queue.length > 0) {
                const { node: currentNode, depth: currentDepth } = queue.shift() as { node: Polygon, depth: number };
                
                if (currentDepth >= depth) continue;
                
                for (const nextNode of currentNode.golNeighbors || []) {
                    if (!visited.has(nextNode)) {
                        visited.add(nextNode);
                        allNeighbors.add(nextNode);
                        
                        queue.push({
                            node: nextNode,
                            depth: currentDepth + 1
                        });
                    }
                }
            }
            
            node.golNeighbors = Array.from(allNeighbors) as Polygon[];
        }
        
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            delete this.tiling.nodes[i].golNeighbors;
        }
        
        if (debugView) debugManager.endTimer("Calculating all neighbors with DFS");
        if (debugView) debugManager.endTimer("Computing Neighbors");
        updateDebugStore();
    }

    removeDuplicates = (nodes: Polygon[]) => {
        if (debugView) debugManager.startTimer("Remove Duplicates");
        
        const spatialMap = new Map();
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const key = getSpatialKey(node.centroid.x, node.centroid.y);
            
            if (!spatialMap.has(key)) {
                spatialMap.set(key, []);
            }
            spatialMap.get(key).push(i);
        }
        
        const processed = new Set();
        let uniqueNodes: Polygon[] = [];
        
        for (let i = 0; i < nodes.length; i++) {
            if (processed.has(i)) continue;
            
            const node = nodes[i];
            uniqueNodes.push(node as Polygon);
            processed.add(i);
            
            const baseX = Math.floor(node.centroid.x / (tolerance * 2));
            const baseY = Math.floor(node.centroid.y / (tolerance * 2));
            
            for (const [dx, dy] of offsets) {
                const key = `${baseX + dx},${baseY + dy}`;
                const candidates = spatialMap.get(key) || [];
                
                for (const candidateIdx of candidates) {
                    if (candidateIdx !== i && !processed.has(candidateIdx) && 
                        isWithinTolerance(node.centroid, nodes[candidateIdx].centroid)) {
                        processed.add(candidateIdx);
                    }
                }
            }
        }

        if (debugView) debugManager.endTimer("Remove Duplicates");
        return uniqueNodes;
    }
}