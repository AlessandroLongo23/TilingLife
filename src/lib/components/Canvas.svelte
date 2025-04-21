<script>
    import { debugManager, debugStore, updateDebugStore } from '$lib/stores/debug';
    import { ruleType, golRule, golRules } from '$lib/stores/configuration';
    import { Check, Camera, RefreshCw } from 'lucide-svelte';
    import { onMount } from 'svelte';

    import LiveChart from '$lib/components/LiveChart.svelte';
    import PieChart from '$lib/components/PieChart.svelte';
    
    let possibleAngles = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
    let possibleSides = [0, 3, 4, 6, 8, 10, 12];
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],  [0, 0],  [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    let debug = $state(false);

    let {
        width = 600,
        height = 600,
        tilingRule,
        // isDual,
        transformSteps,
        side,
        showConstructionPoints,
        showGameOfLife,
        showInfo,
        speed,
    } = $props();


    let tolerance = $state(0.01);
    let frameMod = $derived(Math.max(1, Math.floor(60 / speed)));
    let takeScreenshot = $state(false);
    let showNotification = $state(false);
    let notificationMessage = $state('');
    let alivePercentage = $state(0);
    let iterationCount = $state(0);
    
    let canvasElement = $state(null);

    let prevWidth = $state(width);   
    let prevHeight = $state(height);
    let prevTilingRule = $state(tilingRule);
    let prevTransformSteps = $state(transformSteps);
    // let prevIsDual = $state(isDual);

    let prevRuleType = $state($ruleType);
    let prevGolRule = $state($golRule);
    let prevGolRules = $state($golRules);
    let rule = $state({});
    let rules = $state({});
    let tiling = $state();

    let resetGameOfLife = $state(false);
    
    $effect(() => {
        if (width !== prevWidth || height !== prevHeight) {
            prevWidth = width;
            prevHeight = height;
            
            if (canvasElement && canvasElement.resizeCanvas) {
                canvasElement.resizeCanvas(width, height);
            }
        }
    });

    $effect(() => {
        debugManager.isEnabled = debug;
        if (debug) {
            debugManager.reset();
        } else {
            debugManager.disable();
        }
        updateDebugStore();
    });

    $effect(() => {
        if (tilingRule !== prevTilingRule || transformSteps !== prevTransformSteps) {
            if (debug) {
                debugManager.reset();
                updateDebugStore();
            }
        }
    });

	let sketch = function(p5) {
        // svelte-ignore perf_avoid_nested_class
        class Tiling {
            constructor() {
                this.nodes = [];
                this.anchorNodes = [];
                this.dual = false;

                this.shapeSeed = [];
                this.transforms = [];

                this.angleCache = new Map();
                this.distanceCache = new Map();
                this.toleranceCache = new Map();
            }

            isWithinTolerance = (a, b) => {
                const key = `${a.x},${a.y}-${b.x},${b.y}`;
                const reverseKey = `${b.x},${b.y}-${a.x},${a.y}`;
                
                if (this.toleranceCache.has(key)) {
                    return this.toleranceCache.get(key);
                }
                
                if (this.toleranceCache.has(reverseKey)) {
                    return this.toleranceCache.get(reverseKey);
                }
                
                const result = p5.isWithinTolerance(a, b);
                this.toleranceCache.set(key, result);
                return result;
            }
            
            getClockwiseAngle = (point) => {
                const key = `${point.x},${point.y}`;
                
                if (this.angleCache.has(key)) {
                    return this.angleCache.get(key);
                }
                
                const angle = p5.getClockwiseAngle(point);
                this.angleCache.set(key, angle);
                return angle;
            }
            
            getDistance = (x1, y1, x2, y2) => {
                const key = `${x1},${y1}-${x2},${y2}`;
                const reverseKey = `${x2},${y2}-${x1},${y1}`;
                
                if (this.distanceCache.has(key)) {
                    return this.distanceCache.get(key);
                }
                
                if (this.distanceCache.has(reverseKey)) {
                    return this.distanceCache.get(reverseKey);
                }
                
                const result = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                this.distanceCache.set(key, result);
                return result;
            }
            
            clearCaches = () => {
                this.angleCache.clear();
                this.distanceCache.clear();
                this.toleranceCache.clear();
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
                                alfa: parseInt(alfa) * Math.PI / 180
                            };
                        }
                    }
                }
                // if (this.shapeSeed.flat().some(n => n && !possibleSides.includes(n))) {
                //     throw new Error('Invalid shape seed');
                // }

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

            createGraph = () => {
                if (debug) {
                    debugManager.reset();
                    debugManager.startTimer("Tiling generation");
                }
                this.nodes = [];
                
                this.clearCaches();
                
                if (debug) debugManager.startTimer("Seed");
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
                            let apothem = 0.5 / Math.tan(Math.PI / this.shapeSeed[i][j].n);
                            let newCentroid = {
                                x: halfwayPoint.x + anchor.dir.x * apothem,
                                y: halfwayPoint.y + anchor.dir.y * apothem
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
                            let sideVector = p5.createVector(
                                firstVertex.x - secondVertex.x,
                                firstVertex.y - secondVertex.y
                            );
                            sideVector.normalize();
                            let dir = sideVector.setHeading(sideVector.heading() + this.shapeSeed[i][j].alfa / 2);
                            
                            let gamma = Math.PI * (this.shapeSeed[i][j].n - 2) / (2 * this.shapeSeed[i][j].n);
                            let beta = gamma - this.shapeSeed[i][j].alfa / 2;
                            let dist = Math.cos(beta) / Math.cos(gamma);

                            let newCentroid = {
                                x: secondVertex.x + dir.x * dist,
                                y: secondVertex.y + dir.y * dist
                            }

                            newNode = new StarPolygon({
                                centroid: newCentroid,
                                n: this.shapeSeed[i][j].n,
                                angle: Math.atan2(dir.y, dir.x),
                                alfa: this.shapeSeed[i][j].alfa
                            });
                        }

                        newNodes.push(newNode);
                    }

                    this.nodes = this.nodes.concat(newNodes);
                }
                console.log(this.nodes)
                if (debug) debugManager.endTimer("Seed");

                this.newLayerNodes = [...this.nodes];

                if (debug) debugManager.startTimer("Transformations");
                for (let s = 0; s < transformSteps; s++) {
                    if (debug) debugManager.startTimer(`Transform ${s+1}`);
                    for (let i = 0; i < this.transforms.length; i++) {
                        if (debug) debugManager.startTimer(`Transform ${s+1}.${i+1}`);
                        if (s == transformSteps - 1 && i == this.transforms.length - 1)
                            break;

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
                        if (debug) debugManager.endTimer(`Transform ${s+1}.${i+1}`);
                    }
                    if (debug) debugManager.endTimer(`Transform ${s+1}`);
                }
                if (debug) debugManager.endTimer("Transformations");

                if (this.dual)
                    this.computeDual();
                
                this.calculateNeighbors();

                if (debug) debugManager.endTimer("Tiling generation");
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
                                if (p5.isWithinTolerance(this.anchorNodes[i].halfways[k], origin)) {
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
                            if (p5.isWithinTolerance(this.nodes[i].centroid, allNodes[j].centroid))
                                continue;

                            for (let k = 0; k < allNodes[j].halfways.length; k++) {
                                if (p5.isWithinTolerance(this.nodes[i].halfways[s], allNodes[j].halfways[k])) {
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
                    const angleA = p5.getClockwiseAngle(a.node.halfways[a.halfwayPointIndex]);
                    const angleB = p5.getClockwiseAngle(b.node.halfways[b.halfwayPointIndex]);
                    
                    if (Math.abs(angleA - angleB) < tolerance) {
                        const distA = Math.sqrt(a.node.halfways[a.halfwayPointIndex].x ** 2 + a.node.halfways[a.halfwayPointIndex].y ** 2);
                        const distB = Math.sqrt(b.node.halfways[b.halfwayPointIndex].x ** 2 + b.node.halfways[b.halfwayPointIndex].y ** 2);
                        return distA - distB;
                    }
                    
                    return angleA - angleB;
                });

                let anchor = anchors[indexOff];

                anchor.dir = p5.createVector(
                    anchor.node.vertices[(anchor.halfwayPointIndex + 1) % anchor.node.vertices.length].x - anchor.node.vertices[anchor.halfwayPointIndex].x,
                    anchor.node.vertices[(anchor.halfwayPointIndex + 1) % anchor.node.vertices.length].y - anchor.node.vertices[anchor.halfwayPointIndex].y
                );

                anchor.dir.normalize();
                anchor.dir.rotate(-Math.PI / 2);

                return anchor;
            }

            findOrigin = (nodes, type, index) => {
                if (debug) debugManager.startTimer(`findOrigin (${type}${index})`);
                
                const deduplicatePoints = (points) => {
                    const spatialMap = new Map();
                    let uniquePoints = [];
                    
                    for (let i = 0; i < points.length; i++) {
                        const point = points[i];
                        const baseKey = p5.getSpatialKey(point.x, point.y);
                        const baseX = Math.floor(point.x / (tolerance * 2));
                        const baseY = Math.floor(point.y / (tolerance * 2));
                        
                        let isDuplicate = false;
                        
                        for (const [dx, dy] of offsets) {
                            const key = `${baseX + dx},${baseY + dy}`;
                            
                            const potentialDuplicates = spatialMap.get(key) || [];
                            
                            for (const uniqueIndex of potentialDuplicates) {
                                if (p5.isWithinTolerance(uniquePoints[uniqueIndex], point)) {
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
                    let sortedCentroids = p5.sortPointsByAngleAndDistance(uniqueCentroids);

                    sortedCentroids = sortedCentroids.filter(centroid => !p5.isWithinTolerance(centroid, {x: 0, y: 0}));

                    result = sortedCentroids[index - 1];
                } 
                
                else if (type === 'h') {
                    let halfways = nodes.map(node => node.halfways).flat();
                    
                    let uniqueHalfways = deduplicatePoints(halfways);
                    let sortedHalfways = p5.sortPointsByAngleAndDistance(uniqueHalfways);

                    result = sortedHalfways[index - 1];
                } 
                
                else if (type === 'v') {
                    let vertices = nodes.map(node => node.vertices).flat();
                    
                    let uniqueVertices = deduplicatePoints(vertices);
                    let sortedVertices = p5.sortPointsByAngleAndDistance(uniqueVertices);

                    result = sortedVertices[index - 1];
                }
                
                if (debug) debugManager.endTimer(`findOrigin (${type}${index})`);
                
                return result;
            }

            addNewNodes = (newNodes) => {
                let newLayerNodes = [];
                
                const spatialMap = new Map();
                for (let i = 0; i < this.nodes.length; i++) {
                    const node = this.nodes[i];
                    const key = p5.getSpatialKey(node.centroid.x, node.centroid.y);
                    
                    if (!spatialMap.has(key)) {
                        spatialMap.set(key, []);
                    }
                    spatialMap.get(key).push(i);
                }
                
                for (let i = 0; i < newNodes.length; i++) {
                    const newNode = newNodes[i];
                    const key = p5.getSpatialKey(newNode.centroid.x, newNode.centroid.y);
                    
                    let isDuplicate = false;
                    
                    const baseX = Math.floor(newNode.centroid.x / (tolerance * 2));
                    const baseY = Math.floor(newNode.centroid.y / (tolerance * 2));
                    
                    for (const [dx, dy] of offsets) {
                        const adjKey = `${baseX + dx},${baseY + dy}`;
                        const existingIndices = spatialMap.get(adjKey) || [];
                        
                        for (const idx of existingIndices) {
                            if (p5.isWithinTolerance(this.nodes[idx].centroid, newNode.centroid)) {
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
                if (debug) debugManager.startTimer("Dual");
                let originalVertices = this.nodes.map(node => node.vertices).flat();

                let uniqueOriginalVertices = [];
                for (let i = 0; i < originalVertices.length; i++) {
                    let vertex = originalVertices[i];

                    if (!uniqueOriginalVertices.some(v => p5.isWithinTolerance(v, vertex))) {
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
                            if (p5.isWithinTolerance(this.nodes[j].vertices[k], centroid)) {
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
                        if (!uniqueNeighboringHalfwayPoints.some(point => p5.isWithinTolerance(point, neighboringHalfwayPoints[i]))) {
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

                if (debug) debugManager.endTimer("Dual");
            }

            calculateNeighbors = () => {
                if (debug) debugManager.startTimer("Computing Neighbors");
                
                const neighborSet = new Set();
                
                if (debug) debugManager.startTimer("Creating spatial indices");
                const halfwaysSpatialMap = new Map();
                const verticesSpatialMap = new Map();
                
                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].neighbors = {
                        side: [],
                        vertex: []
                    };
                    
                    for (let j = 0; j < this.nodes[i].halfways.length; j++) {
                        const hw = this.nodes[i].halfways[j];
                        const key = p5.getSpatialKey(hw.x, hw.y);
                        
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
                        const key = p5.getSpatialKey(v.x, v.y);
                        
                        if (!verticesSpatialMap.has(key)) {
                            verticesSpatialMap.set(key, []);
                        }
                        verticesSpatialMap.get(key).push({
                            nodeIndex: i,
                            vertexIndex: j
                        });
                    }
                }
                if (debug) debugManager.endTimer("Creating spatial indices");
                
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

                if (debug) debugManager.startTimer("Calculating halfways neighbors");
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
                            
                            if (p5.isWithinTolerance(hw1, hw2)) {
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
                                
                                if (p5.isWithinTolerance(hw1, hw2)) {
                                    addNeighbor('halfways', entry1.nodeIndex, entry2.nodeIndex);
                                }
                            }
                        }
                    }
                }
                if (debug) debugManager.endTimer("Calculating halfways neighbors");


                if (debug) debugManager.startTimer("Calculating vertices neighbors");
                const processedVertexCells = new Set();
                
                // Create a map to track which nodes share each vertex
                const vertexToNodesMap = new Map();
                
                // First, collect all vertices and which nodes they belong to
                for (let i = 0; i < this.nodes.length; i++) {
                    for (let j = 0; j < this.nodes[i].vertices.length; j++) {
                        const vertex = this.nodes[i].vertices[j];
                        const key = p5.getSpatialKey(vertex.x, vertex.y);
                        
                        // Check all neighboring spatial cells
                        const baseX = Math.floor(vertex.x / (tolerance * 2));
                        const baseY = Math.floor(vertex.y / (tolerance * 2));
                        
                        // Find the "canonical" vertex for this spatial region
                        let canonicalVertex = vertex;
                        let canonicalKey = null;
                        
                        // Search for an existing vertex in nearby cells that matches this one
                        for (const [dx, dy] of offsets) {
                            const nearbyKey = `${baseX + dx},${baseY + dy}`;
                            const existingVertices = vertexToNodesMap.get(nearbyKey);
                            
                            if (!existingVertices) continue;
                            
                            for (const {v, nodeIndexes} of existingVertices) {
                                if (p5.isWithinTolerance(vertex, v)) {
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
                                if (p5.isWithinTolerance(entry.v, canonicalVertex)) {
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
                                    neighbor => p5.isWithinTolerance(neighbor.centroid, this.nodes[node2Index].centroid)
                                );
                                
                                if (!isSideNeighbors) {
                                    addNeighbor('vertices', node1Index, node2Index);
                                }
                            }
                        }
                    }
                }
                if (debug) debugManager.endTimer("Calculating vertices neighbors");

                if (debug) debugManager.endTimer("Computing Neighbors");
                updateDebugStore();
            }

            removeDuplicates = (nodes) => {
                if (debug) debugManager.startTimer("Remove Duplicates");
                
                const spatialMap = new Map();
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    const key = p5.getSpatialKey(node.centroid.x, node.centroid.y);
                    
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
                                p5.isWithinTolerance(node.centroid, nodes[candidateIdx].centroid)) {
                                processed.add(candidateIdx);
                            }
                        }
                    }
                }

                if (debug) debugManager.endTimer("Remove Duplicates");
                return uniqueNodes;
            }

            parseGameOfLifeRule = (rule) => {
                let pieces = rule.split('/');
                let birth = pieces[0].slice(1).split('').map(Number);
                let survival = pieces[1].slice(1).split('').map(Number);
                let generations = pieces[2] ? parseInt(pieces[2]) : 1;

                return {
                    birth: birth,
                    survival: survival,
                    generations: generations
                }
            }

            setupGameOfLife = () => {
                if ($ruleType === 'Single') {
                    rule = this.parseGameOfLifeRule($golRule)
                    
                } else {
                    rules = {}

                    for (let i = 0; i < Object.keys($golRules).length; i++) {
                        let key = Object.keys($golRules)[i];
                        let value = $golRules[key];
                        rules[key] = this.parseGameOfLifeRule(value);
                    }
                }

                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].state = Math.random() < 0.5 ? 1 : 0;
                }
            }

            updateGameOfLife = () => {
                for (let i = 0; i < this.nodes.length; i++) {
                    let aliveNeighbors = [...this.nodes[i].neighbors.side, ...this.nodes[i].neighbors.vertex].filter(neighbor => neighbor.state === 1).length;

                    if ($ruleType === 'Single') {
                        if (this.nodes[i].state === 1) {
                            // Cell is alive (state = 1)
                            if (rule.survival.includes(aliveNeighbors)) {
                                // Cell survives
                                this.nodes[i].nextState = 1;
                            } else {
                                // Cell dies - transition to next generation
                                this.nodes[i].nextState = 2;
                            }
                        } else if (this.nodes[i].state === 0) {
                            // Cell is dead
                            if (rule.birth.includes(aliveNeighbors)) {
                                // Cell becomes alive
                                this.nodes[i].nextState = 1;
                            } else {
                                // Cell stays dead
                                this.nodes[i].nextState = 0;
                            }
                        } else {
                            // Cell is in aging state
                            const nextGeneration = this.nodes[i].state + 1;
                            // If nextGeneration exceeds the total number of states, cell dies
                            this.nodes[i].nextState = nextGeneration > rule.generations ? 0 : nextGeneration;
                        }
                    } else {
                        const nodeRule = rules[this.nodes[i].n];
                        if (this.nodes[i].state === 1) {
                            // Cell is alive (state = 1)
                            if (nodeRule.survival.includes(aliveNeighbors)) {
                                // Cell survives
                                this.nodes[i].nextState = 1;
                            } else {
                                // Cell dies - transition to next generation
                                this.nodes[i].nextState = 2;
                            }
                        } else if (this.nodes[i].state === 0) {
                            // Cell is dead
                            if (nodeRule.birth.includes(aliveNeighbors)) {
                                // Cell becomes alive
                                this.nodes[i].nextState = 1;
                            } else {
                                // Cell stays dead
                                this.nodes[i].nextState = 0;
                            }
                        } else {
                            // Cell is in aging state
                            const nextGeneration = this.nodes[i].state + 1;
                            // If nextGeneration exceeds the total number of states, cell dies
                            this.nodes[i].nextState = nextGeneration > nodeRule.generations ? 0 : nextGeneration;
                        }
                    }
                }

                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].state = this.nodes[i].nextState;
                }
            }

            drawGameOfLife = () => {
                p5.push();
                p5.translate(p5.width / 2, p5.height / 2);
                p5.scale(side);
                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].showGameOfLife();
                }
                p5.pop();
            }

            showNeighbors = () => {
                p5.push();
                p5.translate(p5.width / 2, p5.height / 2);
                p5.scale(side);
                p5.stroke(0);
                p5.strokeWeight(2 / side);
                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].show();
                }

                p5.stroke(0);
                p5.strokeWeight(1 / side);
                
                // Get mouse position in world coordinates
                const mouseWorldX = (p5.mouseX - p5.width / 2) / side;
                const mouseWorldY = (-p5.mouseY + p5.height / 2) / side;
                const mousePoint = { x: mouseWorldX, y: mouseWorldY };
                
                for (let node of this.nodes) {
                    // Use polygon hit test instead of center distance
                    if (node.containsPoint(mousePoint)) {
                        node.show(p5.color(0, 0, 100));

                        for (let neighbor of node.neighbors.side) {
                            neighbor.show(p5.color(240, 100, 100, 0.5));
                            p5.line(
                                node.centroid.x,
                                node.centroid.y,
                                neighbor.centroid.x,
                                neighbor.centroid.y
                            );
                            p5.ellipse(
                                neighbor.centroid.x,
                                neighbor.centroid.y,
                                1/5,
                                1/5
                            );
                        }

                        for (let neighbor of node.neighbors.vertex) {
                            neighbor.show(p5.color(120, 100, 100, 0.5));
                            p5.line(
                                node.centroid.x,
                                node.centroid.y,
                                neighbor.centroid.x,
                                neighbor.centroid.y
                            );
                            p5.ellipse(
                                neighbor.centroid.x,
                                neighbor.centroid.y,
                                1/5,
                                1/5
                            );
                        }

                        p5.fill(0, 0, 0);
                        p5.ellipse(
                            node.centroid.x,
                            node.centroid.y,
                            1/5,
                            1/5
                        );
                    }
                }
                p5.pop();
            }
        }

        // svelte-ignore perf_avoid_nested_class
        class Polygon {
            constructor(data) {
                this.centroid = data.centroid;
                this.n = data.n;
                this.angle = data.angle;
                
                this.neighbors = {
                    side: [],
                    vertex: []
                };
                this.state = 0;
                this.nextState = 0;

                this.calculateCentroid();
                this.calculateVertices();
                this.calculateHalfways();
            }

            containsPoint = (point) => {
                return p5.isPointInPolygon(point, this.vertices);
            }

            show = (customColor = null) => {
                if (this.centroid.x < -p5.width / 2 - 10 || this.centroid.y < -p5.height / 2 - 10 || this.centroid.x > p5.width / 2 + 10 || this.centroid.y > p5.height / 2 + 10)
                    return;

                p5.push();
                p5.stroke(0, 0, 0);
                p5.fill(customColor || this.hue, 40, 100, 0.80);
                p5.beginShape();
                for (let i = 0; i < this.vertices.length; i++) {
                    p5.vertex(this.vertices[i].x, this.vertices[i].y);
                }
                p5.endShape(p5.CLOSE);
                
                if (showConstructionPoints) {
                    p5.fill(0, 100, 100);
                    p5.ellipse(this.centroid.x, this.centroid.y, 5 / side);
                    
                    p5.fill(120, 100, 100);
                    for (let i = 0; i < this.halfways.length; i++) {
                        p5.ellipse(this.halfways[i].x, this.halfways[i].y, 5 / side);
                    }
                    
                    p5.fill(240, 100, 100);
                    for (let i = 0; i < this.vertices.length; i++) {
                        p5.ellipse(this.vertices[i].x, this.vertices[i].y, 5 / side);
                    }
                }
                p5.pop();
            }

            showGameOfLife = () => {
                p5.push();
                p5.strokeWeight(1 / side);
                p5.stroke(0, 0, 0);
                
                // If state is 0, cell is dead (black)
                // If state is 1, cell is alive (white)
                // If state is > 1, cell is aging (use a color gradient)
                if (this.state === 0) {
                    // Dead cell - white
                    p5.fill(0, 0, 100);
                } else if (this.state === 1) {
                    // Alive cell - black
                    p5.fill(0, 0, 0);
                } else {
                    // Aging cell - use color based on generation
                    const maxGenerations = $ruleType === 'Single' ? rule.generations : rules[this.n].generations;
                    const progress = (this.state - 1) / (maxGenerations - 1); // normalized between 0 and 1
                    // Use a hue-based color gradient for aging cells (blue → purple → red)
                    const brightness = progress * 100; // 240 (blue) to 0 (red)
                    p5.fill(0, 0, brightness);
                }

                p5.beginShape();
                for (let i = 0; i < this.vertices.length; i++) {
                    p5.vertex(this.vertices[i].x, this.vertices[i].y);
                }
                p5.endShape(p5.CLOSE);
                p5.pop();
            }

            calculateCentroid = () => {
                if (Math.abs(this.centroid.x) < tolerance) {
                    this.centroid.x = 0;
                }
                if (Math.abs(this.centroid.y) < tolerance) {
                    this.centroid.y = 0;
                }
            }

            calculateVertices = () => {
                this.vertices = [];
                let radius = 0.5 / Math.sin(Math.PI / this.n);
                for (let i = 0; i < this.n; i++) {
                    this.vertices.push({
                        x: this.centroid.x + radius * Math.cos(i * 2 * Math.PI / this.n + this.angle),
                        y: this.centroid.y + radius * Math.sin(i * 2 * Math.PI / this.n + this.angle)
                    });

                    if (Math.abs(this.vertices[i].x) < tolerance) {
                        this.vertices[i].x = 0;
                    }

                    if (Math.abs(this.vertices[i].y) < tolerance) {
                        this.vertices[i].y = 0;
                    }
                }
            }

            calculateHalfways = () => {
                this.halfways = [];
                for (let i = 0; i < this.n; i++) {
                    this.halfways.push({
                        x: (this.vertices[i].x + this.vertices[(i + 1) % this.n].x) / 2,
                        y: (this.vertices[i].y + this.vertices[(i + 1) % this.n].y) / 2
                    });

                    if (Math.abs(this.halfways[i].x) < tolerance) {
                        this.halfways[i].x = 0;
                    }

                    if (Math.abs(this.halfways[i].y) < tolerance) {
                        this.halfways[i].y = 0;
                    }
                }
            }
        }

        // svelte-ignore perf_avoid_nested_class
        class RegularPolygon extends Polygon {
            constructor(data) {
                super(data);

                this.calculateHue();
            }

            calculateHue = () => {
                this.hue = p5.map(this.vertices.length, 3, 12, 0, 300);
            }

            clone = () => {
                return new RegularPolygon({
                    centroid: {
                        x: this.centroid.x,
                        y: this.centroid.y
                    },
                    n: this.n,
                    angle: this.angle
                });
            }
        }

        // svelte-ignore perf_avoid_nested_class
        class DualPolygon extends Polygon {
            constructor(data) {
                super({
                    centroid: data.centroid,
                    n: 3,
                    angle: 0
                });
                this.vertices = data.vertices;
                this.halfways = data.halfways;

                this.calculateHue();
            }

            calculateHue = () => {
                this.hue = this.calculateAnglesHash();
            }

            calculateAnglesHash() {
                let angles = [];
                for (let i = 0; i < this.vertices.length; i++) {
                    const prev = (i === 0) ? this.vertices.length - 1 : i - 1;
                    const curr = i;
                    const next = (i === this.vertices.length - 1) ? 0 : i + 1;
                    
                    const v1 = {
                        x: this.vertices[prev].x - this.vertices[curr].x,
                        y: this.vertices[prev].y - this.vertices[curr].y
                    };
                    const v2 = {
                        x: this.vertices[next].x - this.vertices[curr].x,
                        y: this.vertices[next].y - this.vertices[curr].y
                    };
                    
                    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                    
                    const dot = v1.x * v2.x + v1.y * v2.y;
                    
                    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
                    angles.push(Math.round(angle)); 
                }

                let minRotation = [...angles]; 
                let canonicalAngles = [...angles];
                
                for (let i = 1; i < angles.length; i++) {
                    const rotation = [...angles.slice(i), ...angles.slice(0, i)];
                    
                    let isSmaller = false;
                    for (let j = 0; j < angles.length; j++) {
                        if (rotation[j] < minRotation[j]) {
                            isSmaller = true;
                            break;
                        } else if (rotation[j] > minRotation[j]) {
                            break;
                        }
                    }
                    
                    if (isSmaller) {
                        minRotation = rotation;
                        canonicalAngles = rotation;
                    }
                }
                
                let hash = 0;
                for (let i = 0; i < canonicalAngles.length; i++) {
                    hash = (hash * 31 + canonicalAngles[i]) % (300 * Math.sqrt(2));
                }
                
                return hash % 300;
            }

            clone = () => {
                return new DualPolygon({
                    centroid: {
                        x: this.centroid.x,
                        y: this.centroid.y
                    },
                    vertices: [...this.vertices],
                    halfways: [...this.halfways]
                });
            }
        }

        // svelte-ignore perf_avoid_nested_class
        class StarPolygon extends Polygon {
            constructor(data) {
                super({
                    centroid: data.centroid,
                    n: data.n,
                    angle: data.angle
                });

                this.alfa = data.alfa;
                this.calculateVertices();
                this.calculateHalfways();
                this.calculateHue();
            }

            calculateVertices = () => {
                this.vertices = [];
                let gamma = Math.PI * (this.n - 2) / (2 * this.n);
                let alfa = this.alfa / 2;
                let beta = gamma - alfa;

                let radius = Math.cos(beta) / Math.cos(gamma);
                let intRadius = Math.tan(gamma) * Math.cos(beta) - Math.sin(beta);
                for (let i = 0; i < this.n; i++) {
                    this.vertices.push({
                        x: this.centroid.x + radius * Math.cos(i * 2 * Math.PI / this.n + this.angle + Math.PI),
                        y: this.centroid.y + radius * Math.sin(i * 2 * Math.PI / this.n + this.angle + Math.PI)
                    });

                    this.vertices.push({
                        x: this.centroid.x + intRadius * Math.cos((i + .5) * 2 * Math.PI / this.n + this.angle + Math.PI),
                        y: this.centroid.y + intRadius * Math.sin((i + .5) * 2 * Math.PI / this.n + this.angle + Math.PI)
                    });

                    if (Math.abs(this.vertices[i].x) < tolerance) {
                        this.vertices[i].x = 0;
                    }

                    if (Math.abs(this.vertices[i].y) < tolerance) {
                        this.vertices[i].y = 0;
                    }
                }
            }

            calculateHalfways = () => {
                this.halfways = [];
                for (let i = 0; i < this.vertices.length; i++) {
                    this.halfways.push({
                        x: (this.vertices[i].x + this.vertices[(i + 1) % this.vertices.length].x) / 2,
                        y: (this.vertices[i].y + this.vertices[(i + 1) % this.vertices.length].y) / 2
                    });
                }
            }

            calculateHue = () => {
                this.hue = p5.map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
            }

            clone = () => {
                return new StarPolygon({
                    centroid: {
                        x: this.centroid.x,
                        y: this.centroid.y
                    },
                    n: this.n,
                    angle: this.angle,
                    alfa: this.alfa
                });
            }
        }

        p5.setup = () => {
            p5.createCanvas(width, height);
            canvasElement = p5;
            p5.colorMode(p5.HSB, 360, 100, 100);

            tiling = new Tiling();

            try {
                tiling.parseRule(tilingRule);
                if (debug) {
                    debugManager.reset();
                }
                tiling.createGraph();
                tiling.setupGameOfLife();
                if (debug) {
                    updateDebugStore();
                }
            } catch (e) {
                console.log(e);
            }

            prevTilingRule = tilingRule;
            // prevIsDual = isDual;
            prevTransformSteps = transformSteps;
        }

        p5.isSameRule = (prev, current) => {
            if ($ruleType === 'Single') {
                return prev === current;
            } else {
                let isSame = true;
                for (let i = 0; i < Object.keys(prev).length; i++) {
                    let key = Object.keys(prev)[i];

                    if (prev[key] !== current[key]) {
                        isSame = false;
                        break;
                    }
                }
                
                return isSame;
            }
        }

        p5.draw = () => {
            p5.push();
            p5.translate(0, p5.height);
            p5.scale(1, -1);
            p5.background(240, 7, 16);
            try {
                if (showGameOfLife) {
                    if (
                        prevRuleType != $ruleType || 
                        ($ruleType == "Single" && !p5.isSameRule(prevGolRule, $golRule)) || 
                        ($ruleType == "By Shape" && !p5.isSameRule(prevGolRules, $golRules)) ||
                        resetGameOfLife
                    ) {
                        tiling.setupGameOfLife();
                        resetGameOfLife = false;
                    }

                    if (p5.frameCount % frameMod == 0) {
                        tiling.updateGameOfLife();
                        alivePercentage = tiling.nodes.filter(node => node.state === 1).length / tiling.nodes.length * 100;
                        iterationCount++;
                    }
                    
                    tiling.drawGameOfLife();
                } else {
                    if (showInfo) {
                        p5.showConstructionPoints();
                    }
                    tiling.showNeighbors();
                    
                    if (takeScreenshot) {
                        p5.takeScreenshot();
                        takeScreenshot = false;
                    }
                }
            } catch (e) {
                console.log(e);
            }

            p5.noStroke();
 
            try {
                if (
                    prevTilingRule != tilingRule || 
                    // prevIsDual != isDual || 
                    prevTransformSteps != transformSteps
                ) {
                    tiling.parseRule(tilingRule);
                    tiling.createGraph();
                    tiling.setupGameOfLife();
                    
                    prevTilingRule = tilingRule;
                    // prevIsDual = isDual;
                    prevTransformSteps = transformSteps;
                }
            } catch (e) {
                console.log(e);
            }

            prevWidth = width;
            prevHeight = height;
            prevRuleType = $ruleType;
            prevGolRule = $golRule;
            prevGolRules = $golRules;
        }

        p5.sortPointsByAngleAndDistance = (points) => {
            return points.sort((a, b) => {
                const angleA = p5.getClockwiseAngle(a);
                const angleB = p5.getClockwiseAngle(b);
                
                if (Math.abs(angleA - angleB) < tolerance) {
                    const distA = Math.sqrt(a.x ** 2 + a.y ** 2);
                    const distB = Math.sqrt(b.x ** 2 + b.y ** 2);
                    return distA - distB;
                }
                
                return angleA - angleB;
            });
        };

        p5.isWithinTolerance = (a, b) => {
            return p5.dist(a.x, a.y, b.x, b.y) < tolerance;
        }

        p5.isTriangleOverlappingHexagon = (triangle, existingNodes) => {
            if (triangle.n !== 3) return false;
            
            const hexagons = existingNodes.filter(node => node.n === 6);
            if (hexagons.length === 0) return false;
            
            for (let i = 0; i < hexagons.length; i++) {
                const hexagon = hexagons[i];
                
                if (p5.dist(triangle.centroid.x, triangle.centroid.y, hexagon.centroid.x, hexagon.centroid.y) > 2) {
                    continue;
                }
                
                let centroidMatchFound = false;
                let centroidMatchVertex = -1;
                
                for (let j = 0; j < triangle.vertices.length; j++) {
                    if (p5.isWithinTolerance(triangle.vertices[j], hexagon.centroid)) {
                        centroidMatchFound = true;
                        centroidMatchVertex = j;
                        break;
                    }
                }
                
                if (!centroidMatchFound) continue;
                
                let vertexMatches = 0;
                
                for (let j = 0; j < triangle.vertices.length; j++) {
                    if (j === centroidMatchVertex) continue;
                    
                    for (let k = 0; k < hexagon.vertices.length; k++) {
                        if (p5.isWithinTolerance(triangle.vertices[j], hexagon.vertices[k])) {
                            vertexMatches++;
                            break;
                        }
                    }
                }
                
                if (vertexMatches >= 2) {
                    return true;
                }
            }
            
            return false;
        }

        p5.isHexagonCoveredByTriangles = (hexagon, existingNodes) => {
            if (hexagon.n !== 6) return false;
            
            const triangles = existingNodes.filter(node => node.n === 3);
            const coveredVertices = new Set();
            
            for (let i = 0; i < hexagon.vertices.length; i++) {
                const hexVertex = hexagon.vertices[i];
                
                for (let j = 0; j < triangles.length; j++) {
                    const triangle = triangles[j];
                    
                    if (p5.dist(hexagon.centroid.x, hexagon.centroid.y, triangle.centroid.x, triangle.centroid.y) > 2) {
                        continue;
                    }
                    
                    for (let k = 0; k < triangle.vertices.length; k++) {
                        if (p5.isWithinTolerance(hexVertex, triangle.vertices[k])) {
                            coveredVertices.add(i);
                            break;
                        }
                    }
                }
            }
            
            if (coveredVertices.size >= 2) {
                const trianglesPointingInward = triangles.filter(triangle => {
                    if (p5.dist(hexagon.centroid.x, hexagon.centroid.y, triangle.centroid.x, triangle.centroid.y) > 2) {
                        return false;
                    }
                    
                    for (let i = 0; i < triangle.vertices.length; i++) {
                        if (p5.isWithinTolerance(triangle.vertices[i], hexagon.centroid)) {
                            return true;
                        }
                    }
                    return false;
                });
                
                return trianglesPointingInward.length >= 2;
            }
            
            return false;
        }

        p5.getClockwiseAngle = (point) => {
            if (Math.abs(point.x) < tolerance)
                return point.y > 0 ? 0 : Math.PI;

            let angle = Math.PI / 2 - Math.atan2(point.y, point.x);
            
            if (angle < 0) {
                angle += 2 * Math.PI;
            }

            return angle;
        }

        p5.apothem = (n) => {
            return 0.5 / Math.tan(Math.PI / n);
        }

        p5.showConstructionPoints = () => {
            p5.push();
            p5.translate(0, p5.height);
            p5.scale(1, -1);
            p5.translate(p5.width / 2, p5.height / 2);
            p5.scale(side);
            
            let uniqueCentroids = [];

            for (let i = 0; i < tiling.anchorNodes.length; i++) {
                let centroid = tiling.anchorNodes[i].centroid;
                if (!uniqueCentroids.some(c => p5.isWithinTolerance(c, centroid))) {
                    uniqueCentroids.push(centroid);
                }
            }

            let uniqueCentroidsSorted = p5.sortPointsByAngleAndDistance(uniqueCentroids);
            uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => !p5.isWithinTolerance(centroid, {x: 0, y: 0}));
            
            p5.textSize(12 / side);
            p5.fill(0, 0, 100);
            
            for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
                let centroid = uniqueCentroidsSorted[i];
                p5.text('c' + (i + 1), centroid.x, -centroid.y);
            }

            let uniqueHalfways = [];
            for (let i = 0; i < tiling.anchorNodes.length; i++) {
                for (let j = 0; j < tiling.anchorNodes[i].halfways.length; j++) {
                    let halfway = tiling.anchorNodes[i].halfways[j];
                    if (!uniqueHalfways.some(h => p5.isWithinTolerance(h, halfway))) {
                        uniqueHalfways.push(halfway);
                    }
                }
            }

            let uniqueHalfwaysSorted = p5.sortPointsByAngleAndDistance(uniqueHalfways);

            for (let i = 0; i < uniqueHalfwaysSorted.length; i++) {
                let halfway = uniqueHalfwaysSorted[i];
                p5.text('h' + (i + 1), halfway.x, -halfway.y);
            }

            let uniqueVertices = [];
            for (let i = 0; i < tiling.anchorNodes.length; i++) {
                for (let j = 0; j < tiling.anchorNodes[i].vertices.length; j++) {
                    let vertex = tiling.anchorNodes[i].vertices[j];
                    if (!uniqueVertices.some(v => p5.isWithinTolerance(v, vertex))) {
                        uniqueVertices.push(vertex);
                    }
                }
            }

            let uniqueVerticesSorted = p5.sortPointsByAngleAndDistance(uniqueVertices); 

            for (let i = 0; i < uniqueVerticesSorted.length; i++) {
                let vertex = uniqueVerticesSorted[i];
                p5.text('v' + (i + 1), vertex.x, -vertex.y);
            }

            p5.pop();
        }

        p5.getSpatialKey = (x, y) => {
            const gridSize = tolerance * 2;
            const hashX = Math.floor(x / gridSize);
            const hashY = Math.floor(y / gridSize);
            return `${hashX},${hashY}`;
        };

        p5.windowResized = () => {
            if (prevWidth !== width || prevHeight !== height) {
                p5.resizeCanvas(width, height);
                prevWidth = width;
                prevHeight = height;
            }
        }
        
        p5.takeScreenshot = () => {
            const filename = `${tilingRule}.png`;
            
            const screenshotCanvas = p5.createGraphics(600, 600);
            
            screenshotCanvas.colorMode(p5.HSB, 360, 100, 100);
            
            screenshotCanvas.push();
            screenshotCanvas.translate(0, 600);
            screenshotCanvas.scale(1, -1);
            
            screenshotCanvas.background(240, 7, 16);
            
            screenshotCanvas.translate(300, 300);
            
            screenshotCanvas.stroke(0);
            screenshotCanvas.strokeWeight(2 / side);
            
            screenshotCanvas.scale(side);
            
            for (let i = 0; i < tiling.nodes.length; i++) {
                screenshotCanvas.push();
                const hue = tiling.nodes[i].hue;
                screenshotCanvas.fill(hue, 40, 100, 0.80);
                screenshotCanvas.beginShape();
                for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                    screenshotCanvas.vertex(tiling.nodes[i].vertices[j].x, tiling.nodes[i].vertices[j].y);
                }
                screenshotCanvas.endShape(screenshotCanvas.CLOSE);
                screenshotCanvas.pop();
            }
            
            if (showInfo) {
                const drawInfoOnScreenshot = () => {
                    let uniqueCentroids = [];
                    for (let i = 0; i < tiling.anchorNodes.length; i++) {
                        let centroid = tiling.anchorNodes[i].centroid;
                        if (!uniqueCentroids.some(c => p5.isWithinTolerance(c, centroid))) {
                            uniqueCentroids.push(centroid);
                        }
                    }
                    
                    let uniqueCentroidsSorted = p5.sortPointsByAngleAndDistance(uniqueCentroids);
                    uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => !p5.isWithinTolerance(centroid, {x: 0, y: 0}));
                    
                    for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
                        let centroid = uniqueCentroidsSorted[i];
                        screenshotCanvas.text('c' + (i + 1), centroid.x, centroid.y);
                    }
                    
                    let uniqueHalfways = [];
                    for (let i = 0; i < tiling.anchorNodes.length; i++) {
                        for (let j = 0; j < tiling.anchorNodes[i].halfways.length; j++) {
                            let halfway = tiling.anchorNodes[i].halfways[j];
                            if (!uniqueHalfways.some(h => p5.isWithinTolerance(h, halfway))) {
                                uniqueHalfways.push(halfway);
                            }
                        }
                    }
                    
                    let uniqueHalfwaysSorted = p5.sortPointsByAngleAndDistance(uniqueHalfways);
                    for (let i = 0; i < uniqueHalfwaysSorted.length; i++) {
                        let halfway = uniqueHalfwaysSorted[i];
                        screenshotCanvas.text('h' + (i + 1), halfway.x, halfway.y);
                    }
                    
                    let uniqueVertices = [];
                    for (let i = 0; i < tiling.anchorNodes.length; i++) {
                        for (let j = 0; j < tiling.anchorNodes[i].vertices.length; j++) {
                            let vertex = tiling.anchorNodes[i].vertices[j];
                            if (!uniqueVertices.some(v => p5.isWithinTolerance(v, vertex))) {
                                uniqueVertices.push(vertex);
                            }
                        }
                    }
                    
                    let uniqueVerticesSorted = p5.sortPointsByAngleAndDistance(uniqueVertices);
                    for (let i = 0; i < uniqueVerticesSorted.length; i++) {
                        let vertex = uniqueVerticesSorted[i];
                        screenshotCanvas.text('v' + (i + 1), vertex.x, vertex.y);
                    }
                };
                
                drawInfoOnScreenshot();
            }
            
            if (showConstructionPoints) {
                for (let i = 0; i < tiling.nodes.length; i++) {
                    screenshotCanvas.fill(0, 40, 100);
                    screenshotCanvas.ellipse(tiling.nodes[i].centroid.x, tiling.nodes[i].centroid.y, 5 / side);
                    
                    screenshotCanvas.fill(120, 40, 100);
                    for (let j = 0; j < tiling.nodes[i].halfways.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].halfways[j].x, tiling.nodes[i].halfways[j].y, 5 / side);
                    }
                    
                    screenshotCanvas.fill(240, 40, 100);
                    for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].vertices[j].x, tiling.nodes[i].vertices[j].y, 5 / side);
                    }
                }
            }
            
            screenshotCanvas.pop();
            
            p5.saveCanvas(screenshotCanvas, filename, 'png');
            
            screenshotCanvas.remove();
            
            notificationMessage = `Screenshot saved as ${filename}`;
            showNotification = true;
            setTimeout(() => {
                showNotification = false;
            }, 3000);
        }

        p5.isPointInPolygon = (point, vertices) => {
            let inside = false;
            
            for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
                const xi = vertices[i].x;
                const yi = vertices[i].y;
                const xj = vertices[j].x;
                const yj = vertices[j].y;
                
                const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
                
                if (intersect) 
                    inside = !inside;
            }
            
            return inside;
        };
	};

    let canvasContainer = $state();
    let p5;
    let myp5 = $state();
    
    const captureScreenshot = () => {
        takeScreenshot = true;
    }
    
    onMount(async () => {
        if (typeof window !== 'undefined') {
            p5 = (await import('p5')).default;
            myp5 = new p5(sketch, canvasContainer);
            
            canvasElement = myp5;
            
            if (width && height && myp5) {
                myp5.resizeCanvas(width, height);
                prevWidth = width;
                prevHeight = height;
            }
        }
    });

    $effect(() => {
        if (myp5 && (width !== prevWidth || height !== prevHeight)) {
            myp5.resizeCanvas(width, height);
            prevWidth = width;
            prevHeight = height;
        }
    });
</script>

<div class="relative h-full w-full">
    <div bind:this={canvasContainer}></div>
    
    {#if !showGameOfLife}
        <div class="absolute top-4 right-4 flex flex-col gap-2 z-10">
            <button 
                class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors duration-200 flex items-center gap-2"
                onclick={captureScreenshot}
            >
                <Camera />
                Screenshot
            </button>
            
            <button 
                class="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors duration-200 flex items-center gap-2"
                onclick={() => {
                    debug = !debug;
                    if (debug) {
                        debugManager.reset();
                        setTimeout(() => {
                            tiling.createGraph();
                            updateDebugStore();
                        }, 0);
                    }
                }}
            >
                {debug ? 'Disable Debug' : 'Enable Debug'}
            </button>
        </div>
    {:else}
        <div class="absolute top-4 right-4 flex flex-col gap-4 z-10">
            <button 
                class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                onclick={() => resetGameOfLife = true}
            >
                <RefreshCw size={18} />
                Randomize
            </button>
            
            <div class="w-72">
                <LiveChart bind:alivePercentage={alivePercentage} bind:iterationCount={iterationCount}/>
            </div>
        </div>
    {/if}
    
    {#if debug}
        <div class="absolute bottom-4 right-4 w-96 z-20">
            <PieChart />
            {#if $debugStore.timingData.phases.length === 0}
                <div class="mt-2 p-3 bg-amber-500/80 text-white text-sm rounded-lg">
                    No timing data available. Try changing the tilingRule or transformSteps to generate data.
                </div>
            {/if}
        </div>
    {/if}
</div>

{#if showNotification}
    <div class="fixed bottom-4 right-4 bg-green-500 text-white py-2 px-4 rounded-md shadow-md animate-fade-in-out flex items-center gap-2 z-20">
        <Check />
        {notificationMessage}
    </div>
{/if}

<div class="flex flex-col gap-3">
    {#if showInfo && !debug}
        <LiveChart 
            bind:alivePercentage={alivePercentage}
            bind:iterationCount={iterationCount}
        />
    {/if}
</div>