import { tolerance, parameter, debugView, transformSteps, offsets, possibleSides, possibleAngles } from '$lib/stores/configuration.js';
import { sortPointsByAngleAndDistance, getClockwiseAngle } from '$lib/utils/geometry.svelte';
import { RegularPolygon, StarPolygon, DualPolygon} from '$lib/classes/Polygon.svelte';
import { debugManager, updateDebugStore } from '$lib/stores/debug.js';
import { apothem, angleBetween } from '$lib/utils/geometry.svelte';
import { getSpatialKey } from '$lib/utils/optimizing.svelte';
import { isWithinTolerance } from '$lib/utils/math.svelte';
import { Vector } from '$lib/classes/Vector.svelte.js';
import { Tiling } from '$lib/classes/Tiling.svelte';

const vertexConfigurations = [
    [3, 12, 12],
    [4, 6, 12], [4, 12, 6],
    // [4, 8, 8],
    [6, 6, 6],

    [3, 3, 4, 12], [3, 3, 12, 4],
    [3, 3, 6, 6],
    [3, 4, 3, 12],
    [3, 4, 4, 6], [3, 6, 4, 4],
    [3, 4, 6, 4],
    [3, 6, 3, 6],
    [4, 4, 4, 4],
    
    [3, 3, 3, 3, 6],
    [3, 3, 3, 4, 4],
    [3, 3, 4, 3, 4],
    
    [3, 3, 3, 3, 3, 3],
]

const availablePolygons = [3, 4, 6, /*8,*/ 12];

Array.prototype.cyclicallyInclude = function(array) {
    if (array.length > this.length) return false;
    if (array.some(a => !this.includes(a))) return false;
    
    for (let i = 0; i < this.length; i++) {
        let match = true;
        for (let j = 0; j < array.length; j++) {
            if (this[(i + j) % this.length] != array[j]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }

    return false;
}

export class TilingGenerator {
    constructor() {
        this.tiling = new Tiling();
        this.possibleVertexConfigurations = [...vertexConfigurations];
    }

    generateWithWFC() {
        this.tiling.nodes = [];

        this.addFirstNode();

        while (true) {
            let lowestEntropyVertex = this.getLowestEntropyVertex();
            if (!lowestEntropyVertex) break;

            this.collapseVertex(lowestEntropyVertex);
            this.propagateConstraints();

            if (this.tiling.nodes.length > 100) break;

            break;
        }
        
        return this.tiling;
    }

    addFirstNode = () => {
        const randomFromList = (l) => {
            return l[Math.floor(Math.random() * l.length)];
        }
    
        let sides = randomFromList(availablePolygons);

        this.tiling.nodes.push(new RegularPolygon({
            centroid: new Vector(),
            n: sides,
            angle: sides == 3 ? 0 : Math.PI / sides
        }));

        this.freeVertices = this.tiling.nodes[0].vertices.map(v => {
            return {
                vertex: v,
                radialDistance: 0,
                neighbors: this.tiling.nodes[0].vertices.filter(other => isWithinTolerance(v.distance(other),  1)),
                coveredAngle: Math.PI * (sides - 2) / sides,
                possibleConfigurations: this.computePossibleConfigurations(v)
            }
        });
    }

    computePossibleConfigurations = (v) => {
        let shapesOnVertex = [];
        for (let node of this.tiling.nodes) {
            for (let vertex of node.vertices) {
                if (isWithinTolerance(v, vertex)) {
                    shapesOnVertex.push(node);
                    break;
                }
            }
        }

        shapesOnVertex.sort((a, b) => Vector.sub(a.centroid, v).heading() - Vector.sub(b.centroid, v).heading());
        shapesOnVertex = shapesOnVertex.map(shape => shape.n);

        return this.possibleVertexConfigurations.filter(c => c.cyclicallyInclude(shapesOnVertex));
    }

    getLowestEntropyVertex = () => {
        let lowestEntropy = Infinity;
        let minRadialDistance = Infinity;
        let lowestEntropyVertex = null;

        for (let freeVertex of this.freeVertices) {
            if (freeVertex.possibleConfigurations.length < lowestEntropy) {
                lowestEntropy = freeVertex.possibleConfigurations.length;
                minRadialDistance = freeVertex.vertex.distance(new Vector());
                lowestEntropyVertex = freeVertex;
            } else if (freeVertex.possibleConfigurations.length == lowestEntropy && freeVertex.vertex.distance(new Vector()) < minRadialDistance) {
                minRadialDistance = freeVertex.vertex.distance(new Vector());
                lowestEntropyVertex = freeVertex;
            }
        }

        return lowestEntropyVertex;
    }

    collapseVertex = (vertex) => {
        let randomConfiguration = vertex.possibleConfigurations[Math.floor(Math.random() * vertex.possibleConfigurations.length)];
    }

    propagateConstraints = () => {

    }

    generateFromRule(rule) {
        this.parseRule(rule);

        if (debugView) {
            debugManager.reset();
            debugManager.startTimer("Tiling generation");
        }
        this.tiling.nodes = [];
        
        this.generateSeed();
        this.generateTransformations();

        if (this.tiling.dual) this.computeDual();
        
        if (debugView) debugManager.endTimer("Tiling generation");
        updateDebugStore();

        this.extractCundyRollettNotation();

        return this.tiling;
    }

    parseRule = (tilingRule) => {
        this.tiling.dual = false;
        if (tilingRule[tilingRule.length - 1] === '*') {
            this.tiling.dual = true;
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
                    parameter.subscribe((v) => {
                        this.shapeSeed[i][j] = {
                            type: 'star',
                            n: parseInt(n),
                            alfa: alfa == 'a' ? v * Math.PI / 180 : parseInt(alfa) * Math.PI / 180
                        };
                    });
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

    addCoreNode = () => {
        if (this.shapeSeed[0][0].type === 'star') {
            this.coreNode = new StarPolygon({
                centroid: new Vector(),
                n: this.shapeSeed[0][0].n,
                angle: Math.PI / this.shapeSeed[0][0].n,
                alfa: this.shapeSeed[0][0].alfa
            });
        } else {
            this.coreNode = new RegularPolygon({
                centroid: new Vector(
                    this.shapeSeed[0][0].n == 3 ? Math.sqrt(3) / 6 : 0,
                    this.shapeSeed[0][0].n == 3 ? 0.5 : 0
                ),
                n: this.shapeSeed[0][0].n,
                angle: this.shapeSeed[0][0].n == 3 ? 0 : Math.PI / this.shapeSeed[0][0].n
            });
        }

        this.tiling.nodes.push(this.coreNode);
    }

    generateSeed = () => {
        if (debugView) debugManager.startTimer("Seed");
        this.addCoreNode();

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
                    let newCentroid = new Vector(
                        halfwayPoint.x + anchor.dir.x * a,
                        halfwayPoint.y + anchor.dir.y * a
                    );

                    let angle = anchor.dir.heading();
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

                    let newCentroid = new Vector(
                        secondVertex.x + sideVector.x * dist,
                        secondVertex.y + sideVector.y * dist
                    )

                    newNode = new StarPolygon({
                        centroid: newCentroid,
                        n: this.shapeSeed[i][j].n,
                        angle: Math.atan2(sideVector.y, sideVector.x),
                        alfa: this.shapeSeed[i][j].alfa
                    });
                }

                newNodes.push(newNode);
            }

            this.tiling.nodes = this.tiling.nodes.concat(newNodes);
        }

        this.newLayerNodes = [...this.tiling.nodes];
        this.seedNodes = [...this.tiling.nodes];
        if (debugView) debugManager.endTimer("Seed");
    }

    generateTransformations = () => {
        if (debugView) debugManager.startTimer("Transformations");
        let layers;
        transformSteps.subscribe((v) => {
            layers = v;
        });

        let start = performance.now();
        let end;
        
        for (let s = 0; s < layers; s++) {
            if (debugView) debugManager.startTimer(`Transform ${s+1}`);

            let newNodes = [];
            for (let i = 0; i < this.transforms.length; i++) {
                if (s == layers - 1 && i == this.transforms.length - 1) break;

                if (debugView) debugManager.startTimer(`Transform ${s+1}.${i+1}`);

                if (s == 0) this.tiling.anchorNodes = [...this.tiling.nodes, ...newNodes];

                if (this.transforms[i].type === 'm') {
                    if (this.transforms[i].relativeTo)
                        newNodes = newNodes.concat(this.mirrorRelativeTo(i, newNodes))
                    else if (this.transforms[i].angle)
                        newNodes = newNodes.concat(this.mirrorByAngle(this.transforms[i].angle, newNodes))
                } else if (this.transforms[i].type === 'r') {
                    if (this.transforms[i].relativeTo)
                        newNodes = newNodes.concat(this.rotateRelativeTo(i, newNodes))
                    else if (this.transforms[i].angle)
                        newNodes = newNodes.concat(this.rotateByAngle(this.transforms[i].angle, newNodes))
                } else if (this.transforms[i].type === 't') {
                    newNodes = newNodes.concat(this.translateRelativeTo(i, newNodes))
                }
                
                if (debugView) debugManager.endTimer(`Transform ${s+1}.${i+1}`);
            }

            this.newLayerNodes = this.addNewNodes(newNodes);
            end = performance.now();
            if (end - start > 5000) {
                break;
            }
            if (debugView) debugManager.endTimer(`Transform ${s+1}`);
        }
        if (debugView) debugManager.endTimer("Transformations");
    }

    mirrorRelativeTo = (transformationIndex, additionalNodes) => {
        let origin = this.transforms[transformationIndex].anchor; 
        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo[0];
            let index = this.transforms[transformationIndex].relativeTo.slice(1);

            origin = this.findOrigin(this.tiling.anchorNodes, type, index);
            this.transforms[transformationIndex].anchor = origin;
        }
        
        let newNodes = [];
        for (let newLayerNode of  [...this.newLayerNodes, ...this.seedNodes, ...additionalNodes]) {
            let newNode = newLayerNode.clone();

            if (this.transforms[transformationIndex].relativeTo[0] === 'h') {
                let lineVector = null;
                
                for (let i = 0; i < this.tiling.anchorNodes.length; i++) {
                    for (let k = 0; k < this.tiling.anchorNodes[i].halfways.length; k++) {
                        if (isWithinTolerance(this.tiling.anchorNodes[i].halfways[k], origin)) {
                            const v1 = this.tiling.anchorNodes[i].vertices[k];
                            const v2 = this.tiling.anchorNodes[i].vertices[(k + 1) % this.tiling.anchorNodes[i].n];
                            
                            lineVector = Vector.sub(v2, v1).normalize();
                            break;
                        }
                    }

                    if (lineVector) 
                        break;
                }

                const pointVector = Vector.sub(newNode.centroid, origin);
                const dot = pointVector.dot(lineVector);
                const projection = lineVector.scale(dot);
                const perpendicular = Vector.sub(pointVector, projection);
                
                newNode.centroid.x = origin.x + projection.x - perpendicular.x;
                newNode.centroid.y = origin.y + projection.y - perpendicular.y;
                
                const lineAngle = lineVector.heading();
                newNode.angle = (2 * lineAngle - newNode.angle + 2 * Math.PI) % (2 * Math.PI);
            } else {
                newNode.centroid.x = origin.x - (newNode.centroid.x - origin.x);
                newNode.centroid.y = origin.y - (newNode.centroid.y - origin.y);
                newNode.angle = (Math.PI + newNode.angle) % (Math.PI * 2);
            }

            newNode.calculateCentroid();
            newNode.calculateVertices();
            newNode.calculateHalfways();
            
            newNodes.push(newNode);
        }

        return newNodes;
    }

    mirrorByAngle = (angle, additionalNodes) => {
        const anglesToProcess = [];
        let angleRad = angle * Math.PI / 180;
        while (angleRad < 2 * Math.PI) {
            anglesToProcess.push(angleRad + Math.PI / 2);
            angleRad *= 2;
        }
        
        let newNodes = [];
        for (const angleRad of anglesToProcess) {
            for (let newLayerNode of [...this.newLayerNodes, ...this.seedNodes, ...additionalNodes, ...newNodes]) {
                let newNode = newLayerNode.clone();

                newNode.centroid.mirror(angleRad);
                newNode.angle = (2 * angleRad - newNode.angle + Math.PI * 2) % (Math.PI * 2);

                newNode.calculateCentroid();
                newNode.calculateVertices();
                newNode.calculateHalfways();
                
                newNodes.push(newNode);
            }
        }
        return newNodes;
    }

    rotateRelativeTo = (transformationIndex, additionalNodes) => {
        let origin = this.transforms[transformationIndex].anchor;

        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo[0];
            let index = this.transforms[transformationIndex].relativeTo.slice(1);

            origin = this.findOrigin(this.tiling.anchorNodes, type, index);
            this.transforms[transformationIndex].anchor = origin;
        }

        let newNodes = [];
        for (let newLayerNode of [...this.newLayerNodes, ...this.seedNodes, ...additionalNodes]) {
            let newNode = newLayerNode.clone();

            newNode.centroid.x = origin.x - (newNode.centroid.x - origin.x);
            newNode.centroid.y = origin.y - (newNode.centroid.y - origin.y);
            newNode.angle = (Math.PI + newNode.angle) % (Math.PI * 2);

            newNode.calculateCentroid();
            newNode.calculateVertices();
            newNode.calculateHalfways();
            
            newNodes.push(newNode);
        }

        return newNodes;
    }
    
    rotateByAngle = (alfa, additionalNodes) => {
        const angleRad = alfa * Math.PI / 180;
        
        const anglesToProcess = [];
        let currentAngle = angleRad;
        while (currentAngle < 2 * Math.PI) {
            anglesToProcess.push(currentAngle);
            currentAngle += angleRad;
        }
        
        const rotationCache = new Map();
        
        let newNodes = [];
        for (const angle of anglesToProcess) {
            for (let newLayerNode of [...this.newLayerNodes, ...this.seedNodes, ...additionalNodes]) {
                const cacheKey = `${newLayerNode.centroid.x},${newLayerNode.centroid.y}-${angle}`;
                let newPos;
                
                if (rotationCache.has(cacheKey)) {
                    newPos = rotationCache.get(cacheKey);
                } else {
                    const d = newLayerNode.centroid.mag();
                    if (d < tolerance) {
                        newPos = new Vector();
                    } else {
                        const a = newLayerNode.centroid.heading();
                        newPos = Vector.fromAngle(a + angle).scale(d);
                    }
                    rotationCache.set(cacheKey, newPos);
                }
                
                let newNode = newLayerNode.clone();
                newNode.centroid.set(newPos);
                newNode.angle = (newLayerNode.angle + angle) % (Math.PI * 2);

                newNode.calculateCentroid();
                newNode.calculateVertices();
                newNode.calculateHalfways();
                
                newNodes.push(newNode);
            }
        }

        rotationCache.clear();
        return newNodes;
    }

    translateRelativeTo = (transformationIndex, additionalNodes) => {
        let origin = this.transforms[transformationIndex].anchor;

        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo[0];
            let index = this.transforms[transformationIndex].relativeTo.slice(1);

            origin = this.findOrigin(this.tiling.anchorNodes, type, index);
            this.transforms[transformationIndex].anchor = origin;
        }
        
        let newNodes = [];
        for (let newLayerNode of [...this.newLayerNodes, ...this.seedNodes, ...additionalNodes]) {
            let newNode = newLayerNode.clone();

            newNode.centroid.add(origin);

            newNode.calculateCentroid();
            newNode.calculateVertices();
            newNode.calculateHalfways();
            
            newNodes.push(newNode);
        }

        return newNodes;
    }

    findAnchor = (newNodes, indexOff) => {
        const allNodes = this.tiling.nodes.concat(newNodes);

        let anchors = [];
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            for (let s = 0; s < this.tiling.nodes[i].halfways.length; s++) {
                let isFree = true;

                for (let j = 0; j < allNodes.length; j++) {
                    if (isWithinTolerance(this.tiling.nodes[i].centroid, allNodes[j].centroid))
                        continue;

                    for (let k = 0; k < allNodes[j].halfways.length; k++) {
                        if (isWithinTolerance(this.tiling.nodes[i].halfways[s], allNodes[j].halfways[k])) {
                            isFree = false;
                            break;
                        }
                    }
                    
                    if (!isFree) 
                        break;
                }

                if (isFree) {
                    anchors.push({
                        node: this.tiling.nodes[i],
                        halfwayPointIndex: s
                    });
                }
            }
        }

        anchors = anchors.sort((a, b) => {
            const angleA = getClockwiseAngle(a.node.halfways[a.halfwayPointIndex]);
            const angleB = getClockwiseAngle(b.node.halfways[b.halfwayPointIndex]);
            
            if (Math.abs(angleA - angleB) < tolerance) {
                const distA = a.node.halfways[a.halfwayPointIndex].mag();
                const distB = b.node.halfways[b.halfwayPointIndex].mag();
                return distA - distB;
            }
            
            return angleA - angleB;
        });

        let anchor = anchors[indexOff];

        anchor.dir = Vector.sub(
            anchor.node.vertices[(anchor.halfwayPointIndex + 1) % anchor.node.vertices.length],
            anchor.node.vertices[anchor.halfwayPointIndex]
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

            sortedCentroids = sortedCentroids.filter(centroid => !isWithinTolerance(centroid, new Vector()));

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
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            const node = this.tiling.nodes[i];
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
                    if (isWithinTolerance(this.tiling.nodes[idx].centroid, newNode.centroid)) {
                        isDuplicate = true;
                        break;
                    }
                }
                
                if (isDuplicate) break;
            }
            
            if (!isDuplicate) {
                this.tiling.nodes.push(newNode);
                newLayerNodes.push(newNode);
                
                if (!spatialMap.has(key)) {
                    spatialMap.set(key, []);
                }
                spatialMap.get(key).push(this.tiling.nodes.length - 1);
            }
        }

        return newLayerNodes;
    }

    computeDual = () => {
        if (debugView) debugManager.startTimer("Dual");
        let originalVertices = this.tiling.nodes.map(node => node.vertices).flat();

        let uniqueOriginalVertices = [];
        for (let originalVertex of originalVertices)
            if (!uniqueOriginalVertices.some(v => isWithinTolerance(v, originalVertex)))
                uniqueOriginalVertices.push(originalVertex);

        let dualNodes = [];
        for (let i = 0; i < uniqueOriginalVertices.length; i++) {
            let centroid = uniqueOriginalVertices[i];

            let neighboringPolygons = [];
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

    calculateNeighbors = (depth, neighborhoodType) => {
        if (debugView) debugManager.startTimer("Computing Neighbors");
        
        const neighborSet = new Set();
        
        if (debugView) debugManager.startTimer("Creating spatial indices");
        const halfwaysSpatialMap = new Map();
        const verticesSpatialMap = new Map();

        for (let i = 0; i < this.tiling.nodes.length; i++) {
            this.tiling.nodes[i].directNeighbors = [];
            
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
        
        const addDirectNeighbor = (i, k) => {
            const pairKey = i < k ? `${i}-${k}` : `${k}-${i}`;
            
            if (!neighborSet.has(pairKey)) {
                neighborSet.add(pairKey);
                this.tiling.nodes[i].directNeighbors.push(this.tiling.nodes[k]);
                this.tiling.nodes[k].directNeighbors.push(this.tiling.nodes[i]);
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
                        addDirectNeighbor(entry1.nodeIndex, entry2.nodeIndex);
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
                            addDirectNeighbor(entry1.nodeIndex, entry2.nodeIndex);
                        }
                    }
                }
            }
        }
        if (debugView) debugManager.endTimer("Calculating halfways neighbors");

        for (let node of this.tiling.nodes)
            node.dualNeighbors = [...node.directNeighbors];

        if (neighborhoodType === 'moore') {
            if (debugView) debugManager.startTimer("Calculating vertices neighbors");
            const vertexToNodesMap = new Map();
            
            for (let i = 0; i < this.tiling.nodes.length; i++) {
                for (let j = 0; j < this.tiling.nodes[i].vertices.length; j++) {
                    const vertex = this.tiling.nodes[i].vertices[j];
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
                            
                            const isSideNeighbors = this.tiling.nodes[node1Index].directNeighbors.some(
                                neighbor => isWithinTolerance(neighbor.centroid, this.tiling.nodes[node2Index].centroid)
                            );
                            
                            if (!isSideNeighbors) {
                                addDirectNeighbor(node1Index, node2Index);
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
            
            node.neighbors = [];
            
            if (depth === 1) {
                node.neighbors = [...node.directNeighbors];
                continue;
            }
            
            const visited = new Set([node]);
            const allNeighbors = new Set();
            
            const queue = [];
            
            for (const neighbor of node.directNeighbors) {
                queue.push({ node: neighbor, depth: 1 });
                visited.add(neighbor);
                allNeighbors.add(neighbor);
            }
            
            while (queue.length > 0) {
                const { node: currentNode, depth: currentDepth } = queue.shift();
                
                if (currentDepth >= depth) continue;
                
                for (const nextNode of currentNode.directNeighbors) {
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
            
            node.neighbors = Array.from(allNeighbors);
        }
        
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            delete this.tiling.nodes[i].directNeighbors;
        }
        
        if (debugView) debugManager.endTimer("Calculating all neighbors with DFS");
        if (debugView) debugManager.endTimer("Computing Neighbors");
        updateDebugStore();
    }

    // removeDuplicates = (nodes) => {
    //     if (debugView) debugManager.startTimer("Remove Duplicates");
        
    //     const spatialMap = new Map();
    //     for (let i = 0; i < nodes.length; i++) {
    //         const node = nodes[i];
    //         const key = getSpatialKey(node.centroid.x, node.centroid.y);
            
    //         if (!spatialMap.has(key)) {
    //             spatialMap.set(key, []);
    //         }
    //         spatialMap.get(key).push(i);
    //     }
        
    //     const processed = new Set();
    //     let uniqueNodes = [];
        
    //     for (let i = 0; i < nodes.length; i++) {
    //         if (processed.has(i)) continue;
            
    //         const node = nodes[i];
    //         uniqueNodes.push(node);
    //         processed.add(i);
            
    //         const baseX = Math.floor(node.centroid.x / (tolerance * 2));
    //         const baseY = Math.floor(node.centroid.y / (tolerance * 2));
            
    //         for (const [dx, dy] of offsets) {
    //             const key = `${baseX + dx},${baseY + dy}`;
    //             const candidates = spatialMap.get(key) || [];
                
    //             for (const candidateIdx of candidates) {
    //                 if (candidateIdx !== i && !processed.has(candidateIdx) && 
    //                     isWithinTolerance(node.centroid, nodes[candidateIdx].centroid)) {
    //                     processed.add(candidateIdx);
    //                 }
    //             }
    //         }
    //     }

    //     if (debugView) debugManager.endTimer("Remove Duplicates");
    //     return uniqueNodes;
    // }

    extractCundyRollettNotation = () => {
        let uniqueVertices = [];
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            for (let j = 0; j < this.tiling.nodes[i].vertices.length; j++) {
                let vertex = this.tiling.nodes[i].vertices[j];
                if (!uniqueVertices.some(v => isWithinTolerance(v, vertex))) {
                    uniqueVertices.push(vertex);
                }
            }
        }

        let vertexGroups = [];
        for (let uniqueVertex of uniqueVertices) {
            let shapesOnVertex = [];
            for (let node of this.tiling.nodes) {
                for (let vertex of node.vertices) {
                    if (isWithinTolerance(vertex, uniqueVertex)) {
                        shapesOnVertex.push(node);
                        break;
                    }
                }
            }

            let sum = shapesOnVertex.reduce((acc, shape) => acc + Math.PI * (shape.n - 2) / shape.n, 0);
            if (Math.abs(sum - 2 * Math.PI) > 0.01) continue;

            shapesOnVertex.sort((a, b) => Vector.sub(a.centroid, uniqueVertex).heading() - Vector.sub(b.centroid, uniqueVertex).heading());
            shapesOnVertex = shapesOnVertex.map(shape => shape.n);
            shapesOnVertex = shapesOnVertex.cycleToMinimumLexicographicalOrder();

            if (!vertexGroups.some(group => group.shapes.isEqualOrChiral(shapesOnVertex))) {
                vertexGroups.push({
                    shapes: shapesOnVertex,
                    occurrences: 1
                });
            } else {
                vertexGroups.find(group => group.shapes.isEqualOrChiral(shapesOnVertex)).occurrences++;
            }
        }

        this.vertexGroups = vertexGroups
            .map(group => group.shapes.join('.'))
            .sort((a, b) => a.localeCompare(b));

        vertexGroups = this.vertexGroups.map(group => group.split('.').map(Number)).sort((a, b) => compareArrays(a, b));

        this.crNotation = "";
        let exponent = 1;
        for (let i = 0; i < vertexGroups.length; i++) {
            for (let j = 0; j < vertexGroups[i].length; j++) {
                if (j < vertexGroups[i].length && vertexGroups[i][j] === vertexGroups[i][j + 1]) {
                    exponent++;
                } else {
                    if (exponent > 1) {
                        this.crNotation += vertexGroups[i][j] + "^" + exponent + ".";
                    } else {
                        this.crNotation += vertexGroups[i][j] + ".";
                    }
                    exponent = 1;
                }
            }
            
            this.crNotation = this.crNotation.slice(0, -1);
            if (i < vertexGroups.length - 1) {
                this.crNotation += ";";
            }
        }
    }




    setupGameOfLife = (ruleType, golRule, golRules) => {
        this.loadGameOfLifeRule(ruleType, golRule, golRules);
        this.tiling.randomizeGameOfLifeGrid();
    }

    loadGameOfLifeRule = (ruleType, golRule, golRules) => {
        if (ruleType === 'Single') {
            this.tiling.golRuleType = 'Single';
            this.tiling.parsedGolRule = this.parseGameOfLifeRule(golRule)
        } else {
            this.tiling.golRuleType = 'By Shape';
            this.tiling.rules = {}

            for (let i = 0; i < Object.keys(golRules).length; i++) {
                let key = Object.keys(golRules)[i];
                let value = golRules[key];
                this.tiling.rules[key] = this.parseGameOfLifeRule(value);
            }
        }
    }

    parseGameOfLifeRule = (golRule) => {
        let rule = {
            birth: [],
            survival: [],
            generations: 1,
            neighborhood: 'moore',
            range: 1,
        };

        let pieces = golRule.split('/');
        if (pieces.length == 1) {
            pieces = golRule.split(',');
        }

        let calculatedNeighbors = false;

        for (let i = 0; i < pieces.length; i++) {
            if (pieces[i].startsWith('B')) {
                if (pieces[i].slice(1).includes('-')) {
                    let [min, max] = pieces[i].slice(1).split('-').map(Number);
                    rule.birth.min = min;
                    rule.birth.max = max;
                } else {
                    rule.birth = pieces[i].slice(1).split('').map(Number);
                }
            } else if (pieces[i].startsWith('S')) {
                if (pieces[i].slice(1).includes('-')) {
                    let [min, max] = pieces[i].slice(1).split('-').map(Number);
                    rule.survival.min = min;
                    rule.survival.max = max;
                } else {
                    rule.survival = pieces[i].slice(1).split('').map(Number);
                }
            } else if (pieces[i].startsWith('G') || pieces[i].startsWith('C')) {
                rule.generations = parseInt(pieces[i].slice(1));
            } else if (pieces[i].startsWith('N')) {
                rule.neighborhood = pieces[i].slice(1) == 'n' ? 'vonNeumann' : 'moore';
            } else if (pieces[i].startsWith('R')) {
                rule.range = parseInt(pieces[i].slice(1)) || 1;
                this.calculateNeighbors(rule.range, rule.neighborhood);
                calculatedNeighbors = true;
            }
        }

        if (!calculatedNeighbors) {
            this.calculateNeighbors(rule.range, rule.neighborhood);
        }

        return rule;
    }
}


Array.prototype.cycleToMinimumLexicographicalOrder = function() {
    let min = this.slice(0);
    for (let i = 0; i < this.length; i++) {
        let rotated = this.slice(i).concat(this.slice(0, i));
        if (compareArrays(rotated, min) < 0) {
            min = rotated;
        }
    }
    return min;
}

function compareArrays(a, b) {
    if (a.length !== b.length) return a.length - b.length;

    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i]) return a[i] - b[i];

    return 0;
}

Array.prototype.isEqual = function(array) {
    if (this.length !== array.length) return false;
    for (let i = 0; i < this.length; i++)
        if (this[i] !== array[i]) return false;
    return true;
}

Array.prototype.isEqualOrChiral = function(array) {
    if (this.length !== array.length) return false;
    
    for (let i = 0; i < this.length; i++) {
        let rotated = this.slice(i).concat(this.slice(0, i));
        if (rotated.isEqual(array)) return true;
    }

    let reversed = this.slice().reverse();
    for (let i = 0; i < this.length; i++) {
        let rotated = reversed.slice(i).concat(reversed.slice(0, i));
        if (rotated.isEqual(array)) return true;
    }

    return false;
}