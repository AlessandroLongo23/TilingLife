import { possibleSides, possibleAngles, tolerance, parameter, debugView, transformSteps, offsets } from '$lib/stores/configuration.js';
import { sortPointsByAngleAndDistance, getClockwiseAngle } from '$lib/utils/geometry.svelte';
import { RegularPolygon, StarPolygon, DualPolygon} from '$lib/classes/Polygon.svelte';
import { debugManager, updateDebugStore } from '$lib/stores/debug.js';
import { getSpatialKey } from '$lib/utils/optimizing.svelte';
import { isWithinTolerance } from '$lib/utils/math.svelte';
import { Vector } from '$lib/classes/Vector.svelte.js';
import { apothem } from '$lib/utils/geometry.svelte';

export class Tiling {
    constructor() {
        this.nodes = [];
        this.anchorNodes = [];
        this.dual = false;

        this.shapeSeed = [];
        this.transforms = [];

        this.parsedGolRule = {};
        this.golRuleType = 'Single';
        this.rules = {};
        this.rule = {};
    }

    parseRule = (tilingRule) => {
        this.dual = false;
        if (tilingRule[tilingRule.length - 1] === '*') {
            this.dual = true;
            tilingRule = tilingRule.slice(0, -1);
        }

        let phases = tilingRule.split('/');
        this.shapeSeed = phases[0].split('-');
        for (let i = 0; i < this.shapeSeed.length; i++) {
            this.shapeSeed[i] = this.shapeSeed[i].split(',');
            for (let j = 0; j < this.shapeSeed[i].length; j++) {
                if (!this.shapeSeed[i][j].includes('(')) {
                    this.shapeSeed[i][j] = {
                        type: 'regular',
                        n: parseInt(this.shapeSeed[i][j])
                    }
                } else {
                    let n = this.shapeSeed[i][j].split('(')[0];
                    let alfa = this.shapeSeed[i][j].split('(')[1].split(')')[0];
                    this.shapeSeed[i][j] = {
                        type: 'star',
                        n: parseInt(n),
                        alfa: alfa == 'a' ? parameter * Math.PI / 180 : parseInt(alfa) * Math.PI / 180
                    };
                }
            }
        }
        if (this.shapeSeed.flat().some(n => !possibleSides.includes(n.n))) {
            throw new Error('Invalid shape seed');
        }

        this.transforms = [];
        for (let i = 1; i < phases.length; i++) {
            let transform = {};
            if (phases[i].includes('(')) {
                transform = {
                    type: phases[i][0],
                    relativeTo: phases[i].split('(')[1].split(')')[0],
                    anchor: null
                }
            } else {
                let type = phases[i][0];
                let angle = parseInt(phases[i].slice(1));
                transform = {
                    type: type,
                    angle: angle
                }

                if (!possibleAngles.includes(parseInt(transform.angle))) {
                    throw new Error('Invalid angle');
                }
            }
            this.transforms.push(transform);
        }
    }

    generateTiling = () => {
        if (debugView) {
            debugManager.reset();
            debugManager.startTimer("Tiling generation");
        }
        this.nodes = [];
        
        if (debugView) debugManager.startTimer("Seed");
        if (this.shapeSeed[0][0].type === 'star') {
            this.coreNode = new StarPolygon({
                centroid: {
                    x: 0,
                    y: 0,
                },
                n: this.shapeSeed[0][0].n,
                angle: Math.PI / this.shapeSeed[0][0].n,
                alfa: this.shapeSeed[0][0].alfa
            });
        } else {
            this.coreNode = new RegularPolygon({
                centroid: {
                    x: this.shapeSeed[0][0].n == 3 ? Math.sqrt(3) / 6 : 0,
                    y: this.shapeSeed[0][0].n == 3 ? 0.5 : 0,
                },
                n: this.shapeSeed[0][0].n,
                angle: this.shapeSeed[0][0].n == 3 ? 0 : Math.PI / this.shapeSeed[0][0].n
            });
        }
        this.nodes.push(this.coreNode);

        for (let i = 1; i < this.shapeSeed.length; i++) {
            let newNodes = [];
            let indexOff = 0;
            for (let j = 0; j < this.shapeSeed[i].length; j++) {
                if (this.shapeSeed[i][j].n == 0) {
                    indexOff += 1;
                    continue;
                }

                let anchor = this.findAnchor(newNodes, indexOff);
                let halfwayPoint = anchor.node.halfways[anchor.halfwayPointIndex];
                
                let newNode;
                if (this.shapeSeed[i][j].type === 'regular') {
                    let a = apothem(this.shapeSeed[i][j].n);
                    let newCentroid = {
                        x: halfwayPoint.x + anchor.dir.x * a,
                        y: halfwayPoint.y + anchor.dir.y * a
                    };

                    let angle = Math.atan2(anchor.dir.y, anchor.dir.x);
                    if (this.shapeSeed[i][j].n % 2 == 0) {
                        angle += Math.PI / this.shapeSeed[i][j].n;
                    }

                    newNode = new RegularPolygon({
                        centroid: newCentroid,
                        n: this.shapeSeed[i][j].n,
                        angle: angle
                    });
                } else {
                    let firstVertex = anchor.node.vertices[anchor.halfwayPointIndex];
                    let secondVertex = anchor.node.vertices[(anchor.halfwayPointIndex + 1) % anchor.node.n];
                    let sideVector = new Vector(
                        firstVertex.x - secondVertex.x,
                        firstVertex.y - secondVertex.y
                    );
                    sideVector.normalize();
                    sideVector.rotate(this.shapeSeed[i][j].alfa / 2);
                    
                    let gamma = Math.PI * (this.shapeSeed[i][j].n - 2) / (2 * this.shapeSeed[i][j].n);
                    let beta = gamma - this.shapeSeed[i][j].alfa / 2;
                    let dist = Math.cos(beta) / Math.cos(gamma);

                    let newCentroid = {
                        x: secondVertex.x + sideVector.x * dist,
                        y: secondVertex.y + sideVector.y * dist
                    }

                    newNode = new StarPolygon({
                        centroid: newCentroid,
                        n: this.shapeSeed[i][j].n,
                        angle: Math.atan2(sideVector.y, sideVector.x),
                        alfa: this.shapeSeed[i][j].alfa
                    });
                }

                newNodes.push(newNode);
            }

            this.nodes = this.nodes.concat(newNodes);
        }

        if (debugView) debugManager.endTimer("Seed");

        this.newLayerNodes = [...this.nodes];

        if (debugView) debugManager.startTimer("Transformations");
        let layers;
        transformSteps.subscribe((v) => {
            layers = v;
        });

        let start = performance.now();
        let end;
        
        for (let s = 0; s < layers; s++) {
            if (debugView) debugManager.startTimer(`Transform ${s+1}`);
            for (let i = 0; i < this.transforms.length; i++) {
                if (s == layers - 1 && i == this.transforms.length - 1) {
                    break;
                }

                if (debugView) debugManager.startTimer(`Transform ${s+1}.${i+1}`);

                if (s == 0)
                    this.anchorNodes = [...this.nodes];

                if (this.transforms[i].type === 'm') {
                    if (this.transforms[i].relativeTo)
                        this.mirrorRelativeTo(i)
                    else if (this.transforms[i].angle)
                        this.mirrorByAngle(this.transforms[i].angle)
                } else if (this.transforms[i].type === 'r') {
                    if (this.transforms[i].relativeTo)
                        this.rotateRelativeTo(i)
                    else if (this.transforms[i].angle)
                        this.rotateByAngle(this.transforms[i].angle)
                } else if (this.transforms[i].type === 't') {
                    this.translateRelativeTo(i)
                }
                if (debugView) debugManager.endTimer(`Transform ${s+1}.${i+1}`);

            }
            end = performance.now();
            if (end - start > 1000) {
                break;
            }
            if (debugView) debugManager.endTimer(`Transform ${s+1}`);
        }
        if (debugView) debugManager.endTimer("Transformations");

        if (this.dual)
            this.computeDual();
        
        this.calculateNeighbors();

        if (debugView) debugManager.endTimer("Tiling generation");
        updateDebugStore();
    }

    mirrorRelativeTo = (transformationIndex) => {
        let origin = this.transforms[transformationIndex].anchor; 
        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo[0];
            let index = this.transforms[transformationIndex].relativeTo.slice(1);

            origin = this.findOrigin(this.anchorNodes, type, index);
            this.transforms[transformationIndex].anchor = origin;
        }
        
        // let newNodes = [this.coreNode];
        let newNodes = [];
        for (let newLayerNode of this.nodes) {
        // for (let newLayerNode of this.newLayerNodes) {
            let newNode = newLayerNode.clone();

            if (this.transforms[transformationIndex].relativeTo[0] === 'h') {
                let lineVector = null;
                
                for (let i = 0; i < this.anchorNodes.length; i++) {
                    for (let k = 0; k < this.anchorNodes[i].halfways.length; k++) {
                        if (isWithinTolerance(this.anchorNodes[i].halfways[k], origin)) {
                            const v1 = this.anchorNodes[i].vertices[k];
                            const v2 = this.anchorNodes[i].vertices[(k + 1) % this.anchorNodes[i].n];
                            
                            lineVector = {
                                x: v2.x - v1.x,
                                y: v2.y - v1.y
                            };
                            
                            const length = Math.sqrt(lineVector.x * lineVector.x + lineVector.y * lineVector.y);
                            lineVector.x /= length;
                            lineVector.y /= length;
                            
                            break;
                        }
                    }

                    if (lineVector) 
                        break;
                }
                
                const pointVector = {
                    x: newNode.centroid.x - origin.x,
                    y: newNode.centroid.y - origin.y
                };
                
                const dot = pointVector.x * lineVector.x + pointVector.y * lineVector.y;
                const projection = {
                    x: dot * lineVector.x,
                    y: dot * lineVector.y
                };
                
                const perpendicular = {
                    x: pointVector.x - projection.x,
                    y: pointVector.y - projection.y
                };
                
                newNode.centroid.x = origin.x + projection.x - perpendicular.x;
                newNode.centroid.y = origin.y + projection.y - perpendicular.y;
                
                const lineAngle = Math.atan2(lineVector.y, lineVector.x);
                newNode.angle = 2 * lineAngle - newNode.angle;
            } else {
                newNode.centroid.x = 2 * origin.x - newNode.centroid.x;
                newNode.centroid.y = 2 * origin.y - newNode.centroid.y;
                newNode.angle = Math.PI + newNode.angle;
            }

            newNode.calculateCentroid();
            newNode.calculateVertices();
            newNode.calculateHalfways();
            
            newNodes.push(newNode);
        }

        this.nodes = this.nodes.concat(newNodes);
        this.nodes = this.removeDuplicates(this.nodes);
        // this.newLayerNodes = this.addNewNodes(newNodes.concat(this.coreNode));
    }

    mirrorByAngle = (angle) => {
        const anglesToProcess = [];
        let currentAngle = angle;
        while (currentAngle < 360) {
            anglesToProcess.push(currentAngle);
            currentAngle *= 2;
        }
        
        // let newNodes = [this.coreNode];
        for (const processAngle of anglesToProcess) {
            const angleRad = processAngle * Math.PI / 180 - Math.PI / 2;
            const vx = Math.cos(angleRad);
            const vy = Math.sin(angleRad);
            
            // for (let newLayerNode of this.newLayerNodes.concat(newNodes)) {
            let newNodes = [];
            for (let newLayerNode of this.nodes) {
                let newNode = newLayerNode.clone();
                // let newNode = new RegularPolygon({
                //     centroid: {
                //         x: newLayerNode.centroid.x,
                //         y: newLayerNode.centroid.y
                //     },
                //     n: newLayerNode.n,
                //     angle: newLayerNode.angle
                // });

                const dotProduct = newNode.centroid.x * vx + newNode.centroid.y * vy;
                newNode.centroid.x = 2 * dotProduct * vx - newNode.centroid.x;
                newNode.centroid.y = 2 * dotProduct * vy - newNode.centroid.y;
                newNode.angle = 2 * angleRad - newNode.angle;

                newNode.calculateCentroid();
                newNode.calculateVertices();
                newNode.calculateHalfways();
                
                newNodes.push(newNode);
            }

            this.nodes = this.nodes.concat(newNodes);
            this.nodes = this.removeDuplicates(this.nodes);
        }
        // this.newLayerNodes = this.addNewNodes(newNodes.concat(this.coreNode));
    }

    rotateRelativeTo = (transformationIndex) => {
        let origin = this.transforms[transformationIndex].anchor;

        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo[0];
            let index = this.transforms[transformationIndex].relativeTo.slice(1);

            origin = this.findOrigin(this.anchorNodes, type, index);
            this.transforms[transformationIndex].anchor = origin;
        }

        // let newNodes = [this.coreNode];
        let newNodes = [];
        for (let newLayerNode of this.nodes) {
        // for (let newLayerNode of this.newLayerNodes.concat(newNodes)) {
            let newNode = newLayerNode.clone();

            newNode.centroid.x = 2 * origin.x - newNode.centroid.x;
            newNode.centroid.y = 2 * origin.y - newNode.centroid.y;
            newNode.angle = Math.PI + newNode.angle;

            newNode.calculateCentroid();
            newNode.calculateVertices();
            newNode.calculateHalfways();
            
            newNodes.push(newNode);
        }

        this.nodes = this.nodes.concat(newNodes);
        this.nodes = this.removeDuplicates(this.nodes);
        // this.newLayerNodes = this.addNewNodes(newNodes.concat(this.coreNode));
    }
    
    rotateByAngle = (alfa) => {
        const angleRad = alfa * Math.PI / 180;
        
        const anglesToProcess = [];
        let currentAngle = angleRad;
        while (currentAngle < 2 * Math.PI) {
            anglesToProcess.push(currentAngle);
            currentAngle += angleRad;
        }
        
        const rotationCache = new Map();
        
        for (const angle of anglesToProcess) {
            let newNodes = [];
            // let newNodes = [this.coreNode];
            for (let newLayerNode of this.nodes) {
            // for (let newLayerNode of this.newLayerNodes) {
                const cacheKey = `${newLayerNode.centroid.x},${newLayerNode.centroid.y}-${angle}`;
                let newPos;
                
                if (rotationCache.has(cacheKey)) {
                    newPos = rotationCache.get(cacheKey);
                } else {
                    const d = Math.sqrt(newLayerNode.centroid.x ** 2 + newLayerNode.centroid.y ** 2);
                    if (d < tolerance) {
                        newPos = { x: 0, y: 0 };
                    } else {
                        const a = Math.atan2(newLayerNode.centroid.y, newLayerNode.centroid.x);
                        newPos = {
                            x: d * Math.cos(a + angle),
                            y: d * Math.sin(a + angle)
                        };
                    }
                    rotationCache.set(cacheKey, newPos);
                }
                
                let newNode = newLayerNode.clone();
                newNode.centroid.x = newPos.x;
                newNode.centroid.y = newPos.y;
                newNode.angle = newLayerNode.angle + angle;

                newNode.calculateCentroid();
                newNode.calculateVertices();
                newNode.calculateHalfways();
                
                newNodes.push(newNode);
            }

            this.nodes = this.nodes.concat(newNodes);
            this.nodes = this.removeDuplicates(this.nodes);
            // this.newLayerNodes = this.addNewNodes(newNodes.concat(this.coreNode));
        }
        
        rotationCache.clear();
    }

    translateRelativeTo = (transformationIndex) => {
        let origin = this.transforms[transformationIndex].anchor;

        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo[0];
            let index = this.transforms[transformationIndex].relativeTo.slice(1);

            origin = this.findOrigin(this.anchorNodes, type, index);
            this.transforms[transformationIndex].anchor = origin;
        }
        
        let newNodes = [];
        for (let newLayerNode of this.nodes) {
        // for (let newLayerNode of this.newLayerNodes.concat(newNodes)) {
            let newNode = newLayerNode.clone();

            newNode.centroid.x += origin.x;
            newNode.centroid.y += origin.y;

            newNode.calculateCentroid();
            newNode.calculateVertices();
            newNode.calculateHalfways();
            
            newNodes.push(newNode);
        }

        this.nodes = this.nodes.concat(newNodes);
        this.nodes = this.removeDuplicates(this.nodes);
    }

    findAnchor = (newNodes, indexOff) => {
        const allNodes = this.nodes.concat(newNodes);

        let anchors = [];
        for (let i = 0; i < this.nodes.length; i++) {
            for (let s = 0; s < this.nodes[i].halfways.length; s++) {
                let isFree = true;

                for (let j = 0; j < allNodes.length; j++) {
                    if (isWithinTolerance(this.nodes[i].centroid, allNodes[j].centroid))
                        continue;

                    for (let k = 0; k < allNodes[j].halfways.length; k++) {
                        if (isWithinTolerance(this.nodes[i].halfways[s], allNodes[j].halfways[k])) {
                            isFree = false;
                            break;
                        }
                    }
                    
                    if (!isFree) 
                        break;
                }

                if (isFree) {
                    anchors.push({
                        node: this.nodes[i],
                        halfwayPointIndex: s
                    });
                }
            }
        }

        anchors = anchors.sort((a, b) => {
            const angleA = getClockwiseAngle(a.node.halfways[a.halfwayPointIndex]);
            const angleB = getClockwiseAngle(b.node.halfways[b.halfwayPointIndex]);
            
            if (Math.abs(angleA - angleB) < tolerance) {
                const distA = Math.sqrt(a.node.halfways[a.halfwayPointIndex].x ** 2 + a.node.halfways[a.halfwayPointIndex].y ** 2);
                const distB = Math.sqrt(b.node.halfways[b.halfwayPointIndex].x ** 2 + b.node.halfways[b.halfwayPointIndex].y ** 2);
                return distA - distB;
            }
            
            return angleA - angleB;
        });

        let anchor = anchors[indexOff];

        anchor.dir = new Vector(
            anchor.node.vertices[(anchor.halfwayPointIndex + 1) % anchor.node.vertices.length].x - anchor.node.vertices[anchor.halfwayPointIndex].x,
            anchor.node.vertices[(anchor.halfwayPointIndex + 1) % anchor.node.vertices.length].y - anchor.node.vertices[anchor.halfwayPointIndex].y
        );
        anchor.dir.normalize();
        anchor.dir.rotate(-Math.PI / 2);

        return anchor;
    }

    findOrigin = (nodes, type, index) => {
        if (debugView) debugManager.startTimer(`findOrigin (${type}${index})`);
        
        const deduplicatePoints = (points) => {
            const spatialMap = new Map();
            let uniquePoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const baseKey = getSpatialKey(point.x, point.y);
                const baseX = Math.floor(point.x / (tolerance * 2));
                const baseY = Math.floor(point.y / (tolerance * 2));
                
                let isDuplicate = false;
                
                for (const [dx, dy] of offsets) {
                    const key = `${baseX + dx},${baseY + dy}`;
                    
                    const potentialDuplicates = spatialMap.get(key) || [];
                    
                    for (const uniqueIndex of potentialDuplicates) {
                        if (isWithinTolerance(uniquePoints[uniqueIndex], point)) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (isDuplicate) break;
                }
                
                if (!isDuplicate) {
                    const newIndex = uniquePoints.length;
                    uniquePoints.push(point);
                    
                    if (!spatialMap.has(baseKey)) {
                        spatialMap.set(baseKey, []);
                    }
                    spatialMap.get(baseKey).push(newIndex);
                }
            }
            
            return uniquePoints;
        };
        
        let result;
        
        if (type === 'c') {
            let centroids = nodes.map(node => node.centroid);
            
            let uniqueCentroids = deduplicatePoints(centroids);
            let sortedCentroids = sortPointsByAngleAndDistance(uniqueCentroids);

            sortedCentroids = sortedCentroids.filter(centroid => !isWithinTolerance(centroid, {x: 0, y: 0}));

            result = sortedCentroids[index - 1];
        } 
        
        else if (type === 'h') {
            let halfways = nodes.map(node => node.halfways).flat();
            
            let uniqueHalfways = deduplicatePoints(halfways);
            let sortedHalfways = sortPointsByAngleAndDistance(uniqueHalfways);

            result = sortedHalfways[index - 1];
        } 
        
        else if (type === 'v') {
            let vertices = nodes.map(node => node.vertices).flat();
            
            let uniqueVertices = deduplicatePoints(vertices);
            let sortedVertices = sortPointsByAngleAndDistance(uniqueVertices);

            result = sortedVertices[index - 1];
        }
        
        if (debugView) debugManager.endTimer(`findOrigin (${type}${index})`);
        
        return result;
    }

    addNewNodes = (newNodes) => {
        let newLayerNodes = [];
        
        const spatialMap = new Map();
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const key = getSpatialKey(node.centroid.x, node.centroid.y);
            
            if (!spatialMap.has(key)) {
                spatialMap.set(key, []);
            }
            spatialMap.get(key).push(i);
        }
        
        for (let i = 0; i < newNodes.length; i++) {
            const newNode = newNodes[i];
            const key = getSpatialKey(newNode.centroid.x, newNode.centroid.y);
            
            let isDuplicate = false;
            
            const baseX = Math.floor(newNode.centroid.x / (tolerance * 2));
            const baseY = Math.floor(newNode.centroid.y / (tolerance * 2));
            
            for (const [dx, dy] of offsets) {
                const adjKey = `${baseX + dx},${baseY + dy}`;
                const existingIndices = spatialMap.get(adjKey) || [];
                
                for (const idx of existingIndices) {
                    if (isWithinTolerance(this.nodes[idx].centroid, newNode.centroid)) {
                        isDuplicate = true;
                        break;
                    }
                }
                
                if (isDuplicate) break;
            }
            
            if (!isDuplicate) {
                this.nodes.push(newNode);
                newLayerNodes.push(newNode);
                
                if (!spatialMap.has(key)) {
                    spatialMap.set(key, []);
                }
                spatialMap.get(key).push(this.nodes.length - 1);
            }
        }

        return newLayerNodes;
    }

    computeDual = () => {
        if (debugView) debugManager.startTimer("Dual");
        let originalVertices = this.nodes.map(node => node.vertices).flat();

        let uniqueOriginalVertices = [];
        for (let i = 0; i < originalVertices.length; i++) {
            let vertex = originalVertices[i];

            if (!uniqueOriginalVertices.some(v => isWithinTolerance(v, vertex))) {
                uniqueOriginalVertices.push(vertex);
            }
        }

        let dualNodes = [];
        for (let i = 0; i < uniqueOriginalVertices.length; i++) {
            let centroid = uniqueOriginalVertices[i];

            let neighboringPolygons = [];
            for (let j = 0; j < this.nodes.length; j++) {
                let belongsToCentroid = false;
                for (let k = 0; k < this.nodes[j].vertices.length; k++) {
                    if (isWithinTolerance(this.nodes[j].vertices[k], centroid)) {
                        belongsToCentroid = true;
                        break;
                    }
                }

                if (belongsToCentroid) {
                    neighboringPolygons.push(this.nodes[j]);
                }
            }

            if (neighboringPolygons.length < 3) {
                continue;
            }

            const angleBetween = (a, b, c) => {
                let v1 = {
                    x: a.x - b.x,
                    y: a.y - b.y
                };

                let v2 = {
                    x: c.x - b.x,
                    y: c.y - b.y
                };

                return (Math.atan2(v1.y, v1.x) - Math.atan2(v2.y, v2.x) + Math.PI) % Math.PI;
            }

            let neighboringHalfwayPoints = [];
            for (let i = 0; i < neighboringPolygons.length; i++) {
                for (let k = 0; k < neighboringPolygons[i].halfways.length; k++) {
                    let angle = angleBetween(neighboringPolygons[i].centroid, neighboringPolygons[i].halfways[k], centroid);

                    if (Math.abs(angle - Math.PI / 2) < tolerance || Math.abs(angle + Math.PI / 2) < tolerance) {
                        neighboringHalfwayPoints.push(neighboringPolygons[i].halfways[k]);
                    }
                }
            }

            let uniqueNeighboringHalfwayPoints = [];
            for (let i = 0; i < neighboringHalfwayPoints.length; i++) {
                if (!uniqueNeighboringHalfwayPoints.some(point => isWithinTolerance(point, neighboringHalfwayPoints[i]))) {
                    uniqueNeighboringHalfwayPoints.push(neighboringHalfwayPoints[i]);
                }
            }

            if (neighboringPolygons.length < uniqueNeighboringHalfwayPoints.length) {
                continue;
            }

            let vertices = neighboringPolygons.map(polygon => polygon.centroid);

            vertices.sort((a, b) => {
                let angleToCentroidA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
                let angleToCentroidB = Math.atan2(b.y - centroid.y, b.x - centroid.x);

                if (angleToCentroidA < 0) angleToCentroidA += 2 * Math.PI;
                if (angleToCentroidB < 0) angleToCentroidB += 2 * Math.PI;

                return angleToCentroidA - angleToCentroidB;
            });

            let halfways = [];
            for (let j = 0; j < vertices.length; j++) {
                halfways.push({
                    x: (vertices[j].x + vertices[(j + 1) % vertices.length].x) / 2,
                    y: (vertices[j].y + vertices[(j + 1) % vertices.length].y) / 2
                });
            }

            let dualNode = new DualPolygon({
                centroid: {
                    x: centroid.x,
                    y: centroid.y
                },
                vertices: vertices,
                halfways: halfways
            });

            dualNodes.push(dualNode);
        }

        this.nodes = [...dualNodes];

        if (debugView) debugManager.endTimer("Dual");
    }

    calculateNeighbors = () => {
        if (debugView) debugManager.startTimer("Computing Neighbors");
        
        const neighborSet = new Set();
        
        if (debugView) debugManager.startTimer("Creating spatial indices");
        const halfwaysSpatialMap = new Map();
        const verticesSpatialMap = new Map();
        
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].neighbors = {
                side: [],
                vertex: []
            };
            
            for (let j = 0; j < this.nodes[i].halfways.length; j++) {
                const hw = this.nodes[i].halfways[j];
                const key = getSpatialKey(hw.x, hw.y);
                
                if (!halfwaysSpatialMap.has(key)) {
                    halfwaysSpatialMap.set(key, []);
                }
                halfwaysSpatialMap.get(key).push({
                    nodeIndex: i,
                    halfwayIndex: j
                });
            }
            
            for (let j = 0; j < this.nodes[i].vertices.length; j++) {
                const v = this.nodes[i].vertices[j];
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
        
        const addNeighbor = (type, i, k) => {
            const pairKey = i < k ? `${i}-${k}` : `${k}-${i}`;
            
            if (!neighborSet.has(pairKey)) {
                neighborSet.add(pairKey);
                if (type === 'halfways') {
                    this.nodes[i].neighbors.side.push(this.nodes[k]);
                    this.nodes[k].neighbors.side.push(this.nodes[i]);
                } else if (type === 'vertices') {
                    this.nodes[i].neighbors.vertex.push(this.nodes[k]);
                    this.nodes[k].neighbors.vertex.push(this.nodes[i]);
                }
            }
        };

        if (debugView) debugManager.startTimer("Calculating halfways neighbors");
        const processedHalfwayCells = new Set();
        
        for (const [key, entries] of halfwaysSpatialMap.entries()) {
            if (entries.length < 2) continue;
            
            for (let i = 0; i < entries.length; i++) {
                const entry1 = entries[i];
                const node1 = this.nodes[entry1.nodeIndex];
                const hw1 = node1.halfways[entry1.halfwayIndex];
                
                for (let j = i + 1; j < entries.length; j++) {
                    const entry2 = entries[j];
                    const node2 = this.nodes[entry2.nodeIndex];
                    const hw2 = node2.halfways[entry2.halfwayIndex];
                    
                    if (isWithinTolerance(hw1, hw2)) {
                        addNeighbor('halfways', entry1.nodeIndex, entry2.nodeIndex);
                    }
                }
            }
            
            processedHalfwayCells.add(key);
        }
        
        for (const [key, entries] of halfwaysSpatialMap.entries()) {
            if (processedHalfwayCells.has(key)) continue;
            
            const [baseX, baseY] = key.split(',').map(Number);
            
            for (const entry1 of entries) {
                const node1 = this.nodes[entry1.nodeIndex];
                const hw1 = node1.halfways[entry1.halfwayIndex];
                
                for (const [dx, dy] of offsets) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const adjKey = `${baseX + dx},${baseY + dy}`;
                    const adjEntries = halfwaysSpatialMap.get(adjKey) || [];
                    
                    for (const entry2 of adjEntries) {
                        const node2 = this.nodes[entry2.nodeIndex];
                        const hw2 = node2.halfways[entry2.halfwayIndex];
                        
                        if (isWithinTolerance(hw1, hw2)) {
                            addNeighbor('halfways', entry1.nodeIndex, entry2.nodeIndex);
                        }
                    }
                }
            }
        }
        if (debugView) debugManager.endTimer("Calculating halfways neighbors");


        if (debugView) debugManager.startTimer("Calculating vertices neighbors");
        const vertexToNodesMap = new Map();
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = 0; j < this.nodes[i].vertices.length; j++) {
                const vertex = this.nodes[i].vertices[j];
                const key = getSpatialKey(vertex.x, vertex.y);
                
                const baseX = Math.floor(vertex.x / (tolerance * 2));
                const baseY = Math.floor(vertex.y / (tolerance * 2));
                
                let canonicalVertex = vertex;
                let canonicalKey = null;
                
                for (const [dx, dy] of offsets) {
                    const nearbyKey = `${baseX + dx},${baseY + dy}`;
                    const existingVertices = vertexToNodesMap.get(nearbyKey);
                    
                    if (!existingVertices) continue;
                    
                    for (const {v} of existingVertices) {
                        if (isWithinTolerance(vertex, v)) {
                            canonicalVertex = v;
                            canonicalKey = nearbyKey;
                            break;
                        }
                    }
                    
                    if (canonicalKey) break;
                }
                
                // If no existing vertex was found, use this one as canonical
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
                        const node1Index = nodeIndexArray[i];
                        const node2Index = nodeIndexArray[j];
                        
                        const isSideNeighbors = this.nodes[node1Index].neighbors.side.some(
                            neighbor => isWithinTolerance(neighbor.centroid, this.nodes[node2Index].centroid)
                        );
                        
                        if (!isSideNeighbors) {
                            addNeighbor('vertices', node1Index, node2Index);
                        }
                    }
                }
            }
        }
        if (debugView) debugManager.endTimer("Calculating vertices neighbors");

        if (debugView) debugManager.endTimer("Computing Neighbors");
        updateDebugStore();
    }

    removeDuplicates = (nodes) => {
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
        let uniqueNodes = [];
        
        for (let i = 0; i < nodes.length; i++) {
            if (processed.has(i)) continue;
            
            const node = nodes[i];
            uniqueNodes.push(node);
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

    drawConstructionPoints = (ctx, side) => {
        ctx.push();
        ctx.translate(0, ctx.height);
        ctx.scale(1, -1);
        ctx.translate(ctx.width / 2, ctx.height / 2);
        ctx.scale(side);
        
        let uniqueCentroids = [];

        for (let i = 0; i < this.anchorNodes.length; i++) {
            let centroid = this.anchorNodes[i].centroid;
            if (!uniqueCentroids.some(c => isWithinTolerance(c, centroid))) {
                uniqueCentroids.push(centroid);
            }
        }

        let uniqueCentroidsSorted = sortPointsByAngleAndDistance(uniqueCentroids);
        uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => !isWithinTolerance(centroid, {x: 0, y: 0}));
        
        ctx.textSize(12 / side);
        ctx.fill(0, 0, 100);
        
        for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
            let centroid = uniqueCentroidsSorted[i];
            ctx.text('c' + (i + 1), centroid.x, -centroid.y);
        }

        let uniqueHalfways = [];
        for (let i = 0; i < this.anchorNodes.length; i++) {
            for (let j = 0; j < this.anchorNodes[i].halfways.length; j++) {
                let halfway = this.anchorNodes[i].halfways[j];
                if (!uniqueHalfways.some(h => isWithinTolerance(h, halfway))) {
                    uniqueHalfways.push(halfway);
                }
            }
        }

        let uniqueHalfwaysSorted = sortPointsByAngleAndDistance(uniqueHalfways);

        for (let i = 0; i < uniqueHalfwaysSorted.length; i++) {
            let halfway = uniqueHalfwaysSorted[i];
            ctx.text('h' + (i + 1), halfway.x, -halfway.y);
        }

        let uniqueVertices = [];
        for (let i = 0; i < this.anchorNodes.length; i++) {
            for (let j = 0; j < this.anchorNodes[i].vertices.length; j++) {
                let vertex = this.anchorNodes[i].vertices[j];
                if (!uniqueVertices.some(v => isWithinTolerance(v, vertex))) {
                    uniqueVertices.push(vertex);
                }
            }
        }

        let uniqueVerticesSorted = sortPointsByAngleAndDistance(uniqueVertices); 

        for (let i = 0; i < uniqueVerticesSorted.length; i++) {
            let vertex = uniqueVerticesSorted[i];
            ctx.text('v' + (i + 1), vertex.x, -vertex.y);
        }

        ctx.pop();
    }

    show = (ctx, side, showConstructionPoints) => {
        ctx.push();
        ctx.translate(ctx.width / 2, ctx.height / 2);
        ctx.scale(side);
        ctx.strokeWeight(2 / side);
        ctx.stroke(0);
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].show(ctx, side, showConstructionPoints);
        }
        ctx.pop();
    }

    showNeighbors = (ctx, side, showConstructionPoints) => {
        ctx.push();
        ctx.translate(ctx.width / 2, ctx.height / 2);
        ctx.scale(side);
        ctx.stroke(0);
        ctx.strokeWeight(1 / side);
        
        const mouseWorldX = (ctx.mouseX - ctx.width / 2) / side;
        const mouseWorldY = (-ctx.mouseY + ctx.height / 2) / side;
        const mousePoint = { x: mouseWorldX, y: mouseWorldY };
        
        for (let node of this.nodes) {
            if (node.containsPoint(mousePoint)) {
                node.show(ctx, side, showConstructionPoints, ctx.color(0, 0, 100));

                for (let neighbor of node.neighbors.side) {
                    neighbor.show(ctx, side, showConstructionPoints, ctx.color(240, 100, 100, 0.5));
                    ctx.line(
                        node.centroid.x,
                        node.centroid.y,
                        neighbor.centroid.x,
                        neighbor.centroid.y
                    );
                    ctx.ellipse(
                        neighbor.centroid.x,
                        neighbor.centroid.y,
                        1/5,
                        1/5
                    );
                }

                for (let neighbor of node.neighbors.vertex) {
                    neighbor.show(ctx, side, showConstructionPoints, ctx.color(120, 100, 100, 0.5));
                    ctx.line(
                        node.centroid.x,
                        node.centroid.y,
                        neighbor.centroid.x,
                        neighbor.centroid.y
                    );
                    ctx.ellipse(
                        neighbor.centroid.x,
                        neighbor.centroid.y,
                        1/5,
                        1/5
                    );
                }

                ctx.fill(0, 0, 0);
                ctx.ellipse(
                    node.centroid.x,
                    node.centroid.y,
                    1/5,
                    1/5
                );
            }
        }
        ctx.pop();
    }

    setupGameOfLife = (ruleType, golRule, golRules) => {
        this.loadGameOfLifeRule(ruleType, golRule, golRules);
        this.randomizeGameOfLifeGrid();
    }

    loadGameOfLifeRule = (ruleType, golRule, golRules) => {
        if (ruleType === 'Single') {
            this.golRuleType = 'Single';
            this.parsedGolRule = this.parseGameOfLifeRule(golRule)
        } else {
            this.golRuleType = 'By Shape';
            this.rules = {}

            for (let i = 0; i < Object.keys(golRules).length; i++) {
                let key = Object.keys(golRules)[i];
                let value = golRules[key];
                this.rules[key] = this.parseGameOfLifeRule(value);
            }
        }
    }

    randomizeGameOfLifeGrid = () => {
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].state = Math.random() < 0.5 ? 1 : 0;
        }
    }

    parseGameOfLifeRule = (golRule) => {
        let pieces = golRule.split('/');
        let birth = pieces[0].slice(1).split('').map(Number);
        let survival = pieces[1].slice(1).split('').map(Number);
        let generations = pieces[2] ? parseInt(pieces[2]) : 1;

        return {
            birth: birth,
            survival: survival,
            generations: generations
        }
    }

    updateGameOfLife = () => {
        // Helper to convert boolean test to 0/1 without conditionals
        const toBinary = (test) => +(!!test);
        
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const state = node.state;
            
            let nodeRule = this.golRuleType === 'Single' ? this.parsedGolRule : this.rules[node.n];
            if (state <= 1) {
                let aliveNeighbors = [...node.neighbors.side, ...node.neighbors.vertex].filter(neighbor => neighbor.state === 1).length;
                
                const alive = state & 1;
                
                const hasBirthNeighbors = toBinary(nodeRule.birth.includes(aliveNeighbors));
                const hasSurvivalNeighbors = toBinary(nodeRule.survival.includes(aliveNeighbors));
                
                const keep = (hasBirthNeighbors & (alive ^ 1)) | (hasSurvivalNeighbors & alive);

                node.nextState = (keep * 1) | ((keep ^ 1) & alive) * 2;
            } else {
                node.nextState = state + 1;
                
                if (node.nextState > nodeRule.generations)
                    node.nextState = 0;
            }
        }

        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].state = this.nodes[i].nextState;
        }
    }

    drawGameOfLife = (ctx, side) => {
        ctx.push();
        ctx.translate(ctx.width / 2, ctx.height / 2);
        ctx.scale(side);
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].showGameOfLife(ctx, side, this.golRuleType, this.parsedGolRule, this.rules);
        }
        ctx.pop();
    }

    exportGraph = () => {
        let graph = {
            n: this.nodes.length,
            edges: []
        };
        
        const nodeMap = new Map();
        this.nodes.forEach((node, index) => {
            nodeMap.set(node, index);
        });
        
        this.nodes.forEach((node, nodeIndex) => {
            if (node.neighbors && node.neighbors.side) {
                node.neighbors.side.forEach(neighbor => {
                    const neighborIndex = nodeMap.get(neighbor);
                    if (neighborIndex !== undefined) {
                        const edgeExists = graph.edges.some(e => 
                            (e.source === nodeIndex && e.target === neighborIndex) || 
                            (e.source === neighborIndex && e.target === nodeIndex)
                        );
                        
                        if (!edgeExists) {
                            graph.edges.push({
                                source: nodeIndex,
                                target: neighborIndex,
                                type: 'side'
                            });
                        }
                    }
                });
            }
            
            if (node.neighbors && node.neighbors.vertex) {
                node.neighbors.vertex.forEach(neighbor => {
                    const neighborIndex = nodeMap.get(neighbor);
                    if (neighborIndex !== undefined) {
                        const edgeExists = graph.edges.some(e => 
                            (e.source === nodeIndex && e.target === neighborIndex) || 
                            (e.source === neighborIndex && e.target === nodeIndex)
                        );
                        
                        if (!edgeExists) {
                            graph.edges.push({
                                source: nodeIndex,
                                target: neighborIndex,
                                type: 'vertex'
                            });
                        }
                    }
                });
            }
        });
        
        const jsonData = JSON.stringify(graph, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tiling-graph.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return graph;
    }
}