<script>
    import { ruleType, golRule, golRules } from '$lib/stores/configuration';
    import { Check, Camera, RefreshCw } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import LiveChart from '$lib/components/LiveChart.svelte';
    
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
        transformSteps,
        side,
        showConstructionPoints,
        showGameOfLife,
        showInfo,
        speed
    } = $props();


    let tolerance = $state(0.01);
    let frameMod = $derived(Math.max(1, Math.floor(60 / speed)));
    let takeScreenshot = $state(false);
    let showNotification = $state(false);
    let notificationMessage = $state('');
    let alivePercentage = $state(0);
    let iterationCount = $state(0);
    
    // Track canvas element to update dimensions
    let canvasElement = $state(null);

    let prevWidth = $state(width);   
    let prevHeight = $state(height);
    let prevTilingRule = $state(tilingRule);
    let prevTransformSteps = $state(transformSteps);

    let prevRuleType = $state($ruleType);
    let prevGolRule = $state($golRule);
    let prevGolRules = $state($golRules);
    let rule = $state({});
    let rules = $state({});
    let tiling = $state();

    let resetGameOfLife = $state(false);
    
    // Handle dimension changes
    $effect(() => {
        if (width !== prevWidth || height !== prevHeight) {
            prevWidth = width;
            prevHeight = height;
            
            if (canvasElement && canvasElement.resizeCanvas) {
                // Force canvas resize
                canvasElement.resizeCanvas(width, height);
            }
        }
    });

	let sketch = function(p5) {
        // svelte-ignore perf_avoid_nested_class
        class Tiling {
            constructor() {
                this.nodes = [];
                this.anchorNodes = [];

                this.shapeSeed = [];
                this.transforms = [];
            }

            parseRule = (tilingRule) => {
                let phases = tilingRule.split('/');
                this.shapeSeed = phases[0].split('-');
                for (let i = 0; i < this.shapeSeed.length; i++) {
                    this.shapeSeed[i] = this.shapeSeed[i].split(',').map(Number);
                }
                if (this.shapeSeed.flat().some(n => !possibleSides.includes(n))) {
                    throw new Error('Invalid shape seed');
                }

                this.transforms = [];
                for (let i = 1; i < phases.length; i++) {
                    let transform = {};
                    if (phases[i].includes('(')) {
                        transform = {
                            type: phases[i][0] === 'r' ? 'rotation' : 'mirror',
                            relativeTo: phases[i].split('(')[1].split(')')[0],
                            anchor: null
                        }
                    } else {
                        let type = phases[i][0] === 'r' ? 'rotation' : 'mirror';
                        let angle = type === 'rotation' ? parseInt(phases[i].split('r')[1]) : parseInt(phases[i].split('m')[1]);
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
                if (debug) console.time("Total tilingRule generation");
                const perfStart = performance.now();
                if (debug) console.log("Starting tilingRule generation...");
                this.nodes = [];
                
                // shape seed
                if (debug) console.time("Creating seed shapes");
                const seedStart = performance.now();
                
                // first group
                this.nodes.push(new Node(
                    {
                        x: this.shapeSeed[0][0] == 3 ? Math.sqrt(3) / 6 : 0,
                        y: this.shapeSeed[0][0] == 3 ? 0.5 : 0,
                    },
                    this.shapeSeed[0][0],
                    this.shapeSeed[0][0] == 3 ? 0 : Math.PI / this.shapeSeed[0][0]
                ));

                // additional groups
                for (let i = 1; i < this.shapeSeed.length; i++) {
                    let newNodes = [];
                    let indexOff = 0;
                    for (let j = 0; j < this.shapeSeed[i].length; j++) {
                        if (this.shapeSeed[i][j] == 0) {
                            indexOff += 1;
                            continue;
                        }

                        let anchor = p5.findAnchor(newNodes, indexOff);
                        let v = p5.createVector(
                            anchor.halfwayPoint.x - anchor.node.centroid.x,
                            anchor.halfwayPoint.y - anchor.node.centroid.y
                        );
                        v.normalize();

                        let apothem = 0.5 / Math.tan(Math.PI / this.shapeSeed[i][j]);
                        let newCentroid = {
                            x: anchor.halfwayPoint.x + v.x * apothem,
                            y: anchor.halfwayPoint.y + v.y * apothem
                        };

                        let newNode = new Node(
                            newCentroid,
                            this.shapeSeed[i][j],
                            this.shapeSeed[i][j] == 3 ? Math.atan2(v.y, v.x) : Math.atan2(v.y, v.x) + Math.PI / this.shapeSeed[i][j]
                        );

                        newNodes.push(newNode);
                    }

                    this.nodes = this.nodes.concat(newNodes);
                }
                const seedEnd = performance.now();
                if (debug) console.timeEnd("Creating seed shapes");
                if (debug) console.log(`Seed shapes created in ${seedEnd - seedStart}ms`);

                // transformations
                if (debug) console.time("Applying transformations");
                const transformStart = performance.now();
                for (let s = 0; s < transformSteps; s++) {
                    const stepStart = performance.now();
                    if (debug) console.time(`Transform step ${s+1}`);
                    for (let i = 0; i < this.transforms.length; i++) {
                        const transformTypeStart = performance.now();
                        if (debug) console.time(`Transform ${s+1}.${i+1}`);
                        if (s == transformSteps - 1 && i == this.transforms.length - 1) {
                            break;
                        }

                        if (s == 0) {
                            this.anchorNodes = [...this.nodes];
                        }

                        if (this.transforms[i].type === 'mirror') {
                            if (this.transforms[i].relativeTo) {
                                this.mirrorRelativeTo(i)
                            } else if (this.transforms[i].angle) {
                                this.mirrorByAngle(this.transforms[i].angle)
                            }
                        } else if (this.transforms[i].type === 'rotation') {
                            if (this.transforms[i].relativeTo) {
                                this.rotateRelativeTo(i)
                            } else if (this.transforms[i].angle) {
                                this.rotateByAngle(this.transforms[i].angle)
                            }
                        }

                        const transformTypeEnd = performance.now();
                        if (debug) console.timeEnd(`Transform ${s+1}.${i+1}`);
                        if (debug) console.log(`Transform ${s+1}.${i+1} took ${transformTypeEnd - transformTypeStart}ms, Nodes: ${this.nodes.length}`);
                    }
                    
                    const stepEnd = performance.now();
                    if (debug) console.timeEnd(`Transform step ${s+1}`);
                    if (debug) console.log(`Transform step ${s+1} completed in ${stepEnd - stepStart}ms, Total nodes: ${this.nodes.length}`);
                }

                const transformEnd = performance.now();
                if (debug) console.timeEnd("Applying transformations");
                if (debug) console.log(`All transformations applied in ${transformEnd - transformStart}ms`);

                this.calculateNeighbors();

                const perfEnd = performance.now();
                if (debug) console.timeEnd("Total tiling generation");
                if (debug) console.log(`Total tiling generation completed in ${perfEnd - perfStart}ms, Total nodes: ${this.nodes.length}`);
            }

            mirrorRelativeTo = (transformationIndex) => {
                let origin = this.transforms[transformationIndex].anchor; 
                if (!origin) {
                    let type = this.transforms[transformationIndex].relativeTo[0];
                    let index = this.transforms[transformationIndex].relativeTo.slice(1);

                    origin = p5.findOrigin(this.anchorNodes, type, index);
                    this.transforms[transformationIndex].anchor = origin;
                }
                
                let newNodes = [];
                for (let j = 0; j < this.nodes.length; j++) {
                    let newNode = new Node(
                        {
                            x: this.nodes[j].pos.x,
                            y: this.nodes[j].pos.y
                        },
                        this.nodes[j].n,
                        this.nodes[j].angle
                    );

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
                            x: newNode.pos.x - origin.x,
                            y: newNode.pos.y - origin.y
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
                        
                        newNode.pos.x = origin.x + projection.x - perpendicular.x;
                        newNode.pos.y = origin.y + projection.y - perpendicular.y;
                        
                        const lineAngle = Math.atan2(lineVector.y, lineVector.x);
                        newNode.angle = 2 * lineAngle - newNode.angle;
                    } else {
                        newNode.pos.x = 2 * origin.x - newNode.pos.x;
                        newNode.pos.y = 2 * origin.y - newNode.pos.y;
                        newNode.angle = Math.PI + newNode.angle;
                    }

                    newNode.calculateCentroid();
                    newNode.calculateVertices();
                    newNode.calculateHalfways();
                    
                    // Check for special overlap cases before adding to newNodes
                    let shouldSkip = false;
                    
                    // Skip triangles overlapping hexagons
                    // if (newNode.n === 3 && p5.isTriangleOverlappingHexagon(newNode, this.nodes)) {
                    //     shouldSkip = true;
                    // }
                    
                    // // Skip hexagons covered by triangles
                    // if (newNode.n === 6 && p5.isHexagonCoveredByTriangles(newNode, this.nodes)) {
                    //     shouldSkip = true;
                    // }
                    
                    if (!shouldSkip) {
                        newNodes.push(newNode);
                    }
                }

                this.nodes = this.nodes.concat(newNodes);
                this.nodes = p5.removeDuplicates(this.nodes);
            }

            mirrorByAngle = (angle) => {
                while (angle < 360) {
                    let newNodes = [];
                    for (let j = 0; j < this.nodes.length; j++) {
                        let newNode = new Node(
                            {
                                x: this.nodes[j].pos.x,
                                y: this.nodes[j].pos.y
                            },
                            this.nodes[j].n,
                            this.nodes[j].angle
                        );

                        let angleRad = angle * Math.PI / 180 - Math.PI / 2;
                        
                        let vx = Math.cos(angleRad);
                        let vy = Math.sin(angleRad);
                        
                        let dotProduct = newNode.pos.x * vx + newNode.pos.y * vy;
                        let projX = dotProduct * vx;
                        let projY = dotProduct * vy;
                        
                        newNode.pos.x = 2 * projX - newNode.pos.x;
                        newNode.pos.y = 2 * projY - newNode.pos.y;
                        newNode.angle = 2 * angleRad - newNode.angle;

                        newNode.calculateCentroid();
                        newNode.calculateVertices();
                        newNode.calculateHalfways();
                        
                        // Check for special overlap cases before adding to newNodes
                        let shouldSkip = false;
                        
                        // Skip triangles overlapping hexagons
                        // if (newNode.n === 3 && p5.isTriangleOverlappingHexagon(newNode, this.nodes)) {
                        //     shouldSkip = true;
                        // }
                        
                        // // Skip hexagons covered by triangles
                        // if (newNode.n === 6 && p5.isHexagonCoveredByTriangles(newNode, this.nodes)) {
                        //     shouldSkip = true;
                        // }
                        
                        if (!shouldSkip) {
                            newNodes.push(newNode);
                        }
                    }

                    this.nodes = this.nodes.concat(newNodes);
                    this.nodes = p5.removeDuplicates(this.nodes);
                    
                    angle *= 2;
                }
            }

            rotateRelativeTo = (transformationIndex) => {
                let origin = this.transforms[transformationIndex].anchor;

                if (!origin) {
                    let type = this.transforms[transformationIndex].relativeTo[0];
                    let index = this.transforms[transformationIndex].relativeTo.slice(1);

                    origin = p5.findOrigin(this.anchorNodes, type, index);
                    this.transforms[transformationIndex].anchor = origin;
                }

                let newNodes = [];
                for (let j = 0; j < this.nodes.length; j++) {
                    let newNode = new Node(
                        {
                            x: this.nodes[j].pos.x,
                            y: this.nodes[j].pos.y
                        },
                        this.nodes[j].n,
                        this.nodes[j].angle
                    );

                    newNode.pos.x = 2 * origin.x - newNode.pos.x;
                    newNode.pos.y = 2 * origin.y - newNode.pos.y;
                    newNode.angle = Math.PI + newNode.angle;

                    newNode.calculateCentroid();
                    newNode.calculateVertices();
                    newNode.calculateHalfways();
                    
                    // Check for special overlap cases before adding to newNodes
                    let shouldSkip = false;
                    
                    // // Skip triangles overlapping hexagons
                    // if (newNode.n === 3 && p5.isTriangleOverlappingHexagon(newNode, this.nodes)) {
                    //     shouldSkip = true;
                    // }
                    
                    // // Skip hexagons covered by triangles
                    // if (newNode.n === 6 && p5.isHexagonCoveredByTriangles(newNode, this.nodes)) {
                    //     shouldSkip = true;
                    // }
                    
                    if (!shouldSkip) {
                        newNodes.push(newNode);
                    }
                }

                this.nodes = this.nodes.concat(newNodes);
                this.nodes = p5.removeDuplicates(this.nodes);
            }
            
            rotateByAngle = (alfa) => {
                let angle = alfa * Math.PI / 180;
                while (angle < 2 * Math.PI) {
                    let newNodes = [];
                    for (let j = 0; j < this.nodes.length; j++) {
                        let newNode = new Node(
                            {
                                x: this.nodes[j].pos.x,
                                y: this.nodes[j].pos.y
                            },
                            this.nodes[j].n,
                            this.nodes[j].angle
                        );

                        let d = Math.sqrt(newNode.pos.x ** 2 + newNode.pos.y ** 2);
                        let a = Math.atan2(newNode.pos.y, newNode.pos.x);
                        newNode.pos.x = d * Math.cos(a + angle);
                        newNode.pos.y = d * Math.sin(a + angle);
                        newNode.angle = newNode.angle + angle;

                        newNode.calculateCentroid();
                        newNode.calculateVertices();
                        newNode.calculateHalfways();
                        
                        // Check for special overlap cases before adding to newNodes
                        let shouldSkip = false;
                        
                        // // Skip triangles overlapping hexagons
                        // if (newNode.n === 3 && p5.isTriangleOverlappingHexagon(newNode, this.nodes)) {
                        //     shouldSkip = true;
                        // }
                        
                        // // // Skip hexagons covered by triangles
                        // if (newNode.n === 6 && p5.isHexagonCoveredByTriangles(newNode, this.nodes)) {
                        //     shouldSkip = true;
                        // }
                        
                        if (!shouldSkip) {
                            newNodes.push(newNode);
                        }
                    }

                    this.nodes = this.nodes.concat(newNodes);
                    this.nodes = p5.removeDuplicates(this.nodes);
                    
                    angle += alfa * Math.PI / 180;
                }
            }

            calculateNeighbors = () => {
                if (debug) console.time("Calculating neighbors");
                const neighborsStart = performance.now();
                
                if (debug) console.time("Creating spatial indices");
                const spatialIndexStart = performance.now();
                
                const halfwaysSpatialMap = new Map();
                const verticesSpatialMap = new Map();
                
                for (let i = 0; i < this.nodes.length; i++) {
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
                
                const spatialIndexEnd = performance.now();
                if (debug) console.timeEnd("Creating spatial indices");
                if (debug) console.log(`Created spatial indices in ${spatialIndexEnd - spatialIndexStart}ms`);
                
                if (debug) console.time("Calculating halfways neighbors");
                const halfwaysStart = performance.now();
                
                for (let i = 0; i < this.nodes.length; i++) {
                    for (let j = 0; j < this.nodes[i].halfways.length; j++) {
                        const hw = this.nodes[i].halfways[j];
                        const baseX = Math.floor(hw.x / (tolerance * 2));
                        const baseY = Math.floor(hw.y / (tolerance * 2));
                        
                        for (const [dx, dy] of offsets) {
                            const key = `${baseX + dx},${baseY + dy}`;
                            
                            const potentialMatches = halfwaysSpatialMap.get(key) || [];
                            
                            for (const match of potentialMatches) {
                                const k = match.nodeIndex;
                                const l = match.halfwayIndex;
                                
                                if (i >= k) 
                                    continue;
                                
                                if (p5.isWithinTolerance(hw, this.nodes[k].halfways[l])) {
                                    this.nodes[i].neighbors.push(this.nodes[k]);
                                    this.nodes[k].neighbors.push(this.nodes[i]);
                                }
                            }
                        }
                    }
                }
                
                const halfwaysEnd = performance.now();
                if (debug) console.timeEnd("Calculating halfways neighbors");
                if (debug) console.log(`Halfways neighbors calculated in ${halfwaysEnd - halfwaysStart}ms`);

                if (debug) console.time("Calculating vertices neighbors");
                const verticesStart = performance.now();
                
                for (let i = 0; i < this.nodes.length; i++) {
                    for (let j = 0; j < this.nodes[i].vertices.length; j++) {
                        const vertex = this.nodes[i].vertices[j];
                        const baseX = Math.floor(vertex.x / (tolerance * 2));
                        const baseY = Math.floor(vertex.y / (tolerance * 2));
                        
                        for (const [dx, dy] of offsets) {
                            const key = `${baseX + dx},${baseY + dy}`;
                            
                            const potentialMatches = verticesSpatialMap.get(key) || [];
                            
                            for (const match of potentialMatches) {
                                const k = match.nodeIndex;
                                const l = match.vertexIndex;
                                
                                if (i >= k) 
                                    continue;
                                
                                if (this.nodes[i].neighbors.some(neighbor => p5.isWithinTolerance(neighbor.pos, this.nodes[k].pos))) {
                                    continue;
                                }
                                
                                if (p5.isWithinTolerance(vertex, this.nodes[k].vertices[l])) {
                                    this.nodes[i].neighbors.push(this.nodes[k]);
                                    this.nodes[k].neighbors.push(this.nodes[i]);
                                }
                            }
                        }
                    }
                }
                
                const verticesEnd = performance.now();
                if (debug) console.timeEnd("Calculating vertices neighbors");
                if (debug) console.log(`Vertices neighbors calculated in ${verticesEnd - verticesStart}ms`);
                
                const neighborsEnd = performance.now();
                if (debug) console.timeEnd("Calculating neighbors");
                if (debug) console.log(`All neighbors calculated in ${neighborsEnd - neighborsStart}ms`);
            }

            setupGameOfLife = () => {
                if ($ruleType === 'Single') {
                    rule = {
                        birth: $golRule.split('/')[0].slice(1).split('').map(Number),
                        survival: $golRule.split('/')[1].slice(1).split('').map(Number)
                    }
                } else {
                    rules = {}

                    for (let i = 0; i < Object.keys($golRules).length; i++) {
                        let key = Object.keys($golRules)[i];
                        let value = $golRules[key];

                        rules[key] = {
                            birth: value.split('/')[0].slice(1).split('').map(Number),
                            survival: value.split('/')[1].slice(1).split('').map(Number)
                        }
                    }
                }

                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].state = Math.random() < 0.5;
                }
            }

            updateGameOfLife = () => {
                for (let i = 0; i < this.nodes.length; i++) {
                    let aliveNeighbors = this.nodes[i].neighbors.filter(neighbor => neighbor.state).length;

                    if ($ruleType === 'Single') {
                        if (this.nodes[i].state && !rule.survival.includes(aliveNeighbors)) {
                            this.nodes[i].nextState = false;
                        } else if (!this.nodes[i].state && rule.birth.includes(aliveNeighbors)) {
                            this.nodes[i].nextState = true;
                        } else {
                            this.nodes[i].nextState = this.nodes[i].state;
                        }
                    } else {
                        if (this.nodes[i].state && !rules[this.nodes[i].n].survival.includes(aliveNeighbors)) {
                            this.nodes[i].nextState = false;
                        } else if (!this.nodes[i].state && rules[this.nodes[i].n].birth.includes(aliveNeighbors)) {
                            this.nodes[i].nextState = true;
                        } else {
                            this.nodes[i].nextState = this.nodes[i].state;
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

            drawGraphTiling = () => {
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
                for (let i = 0; i < this.nodes.length; i++) {
                    if (
                        p5.dist((p5.mouseX - p5.width / 2) / side, (-p5.mouseY + p5.height / 2) / side, this.nodes[i].pos.x, this.nodes[i].pos.y) < p5.apothem(this.nodes[i].n)
                    ) {
                        this.nodes[i].show(p5.color(0, 0, 100));

                        for (let j = 0; j < this.nodes[i].neighbors.length; j++) {
                            this.nodes[i].neighbors[j].show(p5.color(240, 100, 100, 0.5));
                            p5.line(
                                this.nodes[i].pos.x,
                                this.nodes[i].pos.y,
                                this.nodes[i].neighbors[j].pos.x,
                                this.nodes[i].neighbors[j].pos.y
                            );
                            p5.ellipse(
                                this.nodes[i].neighbors[j].pos.x,
                                this.nodes[i].neighbors[j].pos.y,
                                1/5,
                                1/5
                            );
                        }

                        p5.fill(0, 0, 0);
                        p5.ellipse(
                            this.nodes[i].pos.x,
                            this.nodes[i].pos.y,
                            1/5,
                            1/5
                        );
                    }
                }
                p5.pop();
            }
        }

        // svelte-ignore perf_avoid_nested_class
        class Node {
            constructor(pos, n, angle) {
                this.pos = pos;
                this.n = n;
                this.angle = angle;
                this.neighbors = [];
                this.state = false;
                this.nextState = false;

                this.calculateCentroid();
                this.calculateVertices();
                this.calculateHalfways();
            }

            show = (color = null) => {
                p5.push();
                p5.stroke(0, 0, 0);
                p5.fill(color || p5.map(this.n, 3, 12, 0, 300), 40, 100, 0.80);
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
                p5.stroke(0, 0, 0);
                if (this.state) {
                    p5.fill(0, 0, 0);
                } else {
                    p5.fill(0, 0, 100);
                }

                p5.beginShape();
                for (let i = 0; i < this.vertices.length; i++) {
                    p5.vertex(this.vertices[i].x, this.vertices[i].y);
                }
                p5.endShape(p5.CLOSE);
                p5.pop();
            }

            calculateCentroid = () => {
                this.centroid = {
                    x: this.pos.x,
                    y: this.pos.y
                };

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

        p5.setup = () => {
            p5.createCanvas(width, height);
            canvasElement = p5;
            p5.colorMode(p5.HSB, 360, 100, 100);

            tiling = new Tiling();

            try {
                tiling.parseRule(tilingRule);
                tiling.createGraph();
                tiling.setupGameOfLife();
            } catch (e) {
                console.log(e);
            }

            prevTilingRule = tilingRule;
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
                        alivePercentage = tiling.nodes.filter(node => node.state).length / tiling.nodes.length * 100;
                        iterationCount++;
                    }
                    
                    tiling.drawGameOfLife();
                } else {
                    if (showInfo) {
                        p5.drawInfo();
                    }
                    tiling.drawGraphTiling();
                    
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
                if (prevTilingRule != tilingRule || prevTransformSteps != transformSteps) {
                    tiling.parseRule(tilingRule);
                    tiling.createGraph();
                    tiling.setupGameOfLife();
                    
                    prevTilingRule = tilingRule;
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

        p5.drawInfo = () => {
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
            
            for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
                let centroid = uniqueCentroidsSorted[i];
                p5.text('c' + (i + 1), centroid.x, centroid.y);
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
                p5.text('h' + (i + 1), halfway.x, halfway.y);
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
                p5.text('v' + (i + 1), vertex.x, vertex.y);
            }

            p5.pop();
        }

        p5.getSpatialKey = (x, y) => {
            const gridSize = tolerance * 2;
            const hashX = Math.floor(x / gridSize);
            const hashY = Math.floor(y / gridSize);
            return `${hashX},${hashY}`;
        };

        p5.findAnchor = (newNodes, indexOff) => {
            const startTime = performance.now();
            const allNodes = tiling.nodes.concat(newNodes);

            let anchors = [];
            for (let i = 0; i < tiling.nodes.length; i++) {
                for (let s = 0; s < tiling.nodes[i].halfways.length; s++) {
                    let isFree = true;

                    for (let j = 0; j < allNodes.length; j++) {
                        if (p5.isWithinTolerance(tiling.nodes[i].centroid, allNodes[j].centroid))
                            continue;

                        for (let k = 0; k < allNodes[j].halfways.length; k++) {
                            if (p5.isWithinTolerance(tiling.nodes[i].halfways[s], allNodes[j].halfways[k])) {
                                isFree = false;
                                break;
                            }
                        }
                        
                        if (!isFree) 
                            break;
                    }

                    if (isFree) {
                        anchors.push({
                            node: tiling.nodes[i],
                            halfwayPoint: tiling.nodes[i].halfways[s]
                        });
                    }
                }
            }

            anchors = anchors.sort((a, b) => {
                const angleA = p5.getClockwiseAngle(a.halfwayPoint);
                const angleB = p5.getClockwiseAngle(b.halfwayPoint);
                
                if (Math.abs(angleA - angleB) < tolerance) {
                    const distA = Math.sqrt(a.halfwayPoint.x ** 2 + a.halfwayPoint.y ** 2);
                    const distB = Math.sqrt(b.halfwayPoint.x ** 2 + b.halfwayPoint.y ** 2);
                    return distA - distB;
                }
                
                return angleA - angleB;
            }).filter(anchor => !(anchor.node.n == 3 && anchor.node.angle == 0) || Math.abs(anchor.halfwayPoint.x) > tolerance);

            const endTime = performance.now();
            if (debug) console.log(`findAnchor: ${(endTime - startTime).toFixed(2)}ms - Found ${anchors.length} free sides`);
            
            return anchors[indexOff];
        }

        p5.removeDuplicates = (nodes) => {
            const startTime = performance.now();
            let nodeCount = nodes.length;
            
            const spatialMap = new Map();
            let uniqueNodes = [];
            
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const baseKey = p5.getSpatialKey(node.pos.x, node.pos.y);
                const baseX = Math.floor(node.pos.x / (tolerance * 2));
                const baseY = Math.floor(node.pos.y / (tolerance * 2));
                
                let isDuplicate = false;
                
                for (const [dx, dy] of offsets) {
                    const key = `${baseX + dx},${baseY + dy}`;
                    
                    const potentialDuplicates = spatialMap.get(key) || [];
                    
                    for (const uniqueIndex of potentialDuplicates) {
                        if (p5.isWithinTolerance(uniqueNodes[uniqueIndex].pos, node.pos)) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (isDuplicate) break;
                }
                
                if (!isDuplicate) {
                    const newIndex = uniqueNodes.length;
                    uniqueNodes.push(node);
                    
                    if (!spatialMap.has(baseKey)) {
                        spatialMap.set(baseKey, []);
                    }
                    spatialMap.get(baseKey).push(newIndex);
                }
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            if (debug) console.log(`removeDuplicates: ${duration.toFixed(2)}ms - Reduced ${nodeCount} nodes to ${uniqueNodes.length} nodes (${(nodeCount - uniqueNodes.length)} duplicates removed)`);
            
            return uniqueNodes;
        }

        // Check if a triangle would overlap with an existing hexagon
        p5.isTriangleOverlappingHexagon = (triangle, existingNodes) => {
            if (triangle.n !== 3) return false;
            
            // Find hexagons that could potentially be overlapped by this triangle
            const hexagons = existingNodes.filter(node => node.n === 6);
            if (hexagons.length === 0) return false;
            
            for (let i = 0; i < hexagons.length; i++) {
                const hexagon = hexagons[i];
                
                // Only consider hexagons close to the triangle
                if (p5.dist(triangle.pos.x, triangle.pos.y, hexagon.pos.x, hexagon.pos.y) > 2) {
                    continue;
                }
                
                // Check if one vertex of the triangle matches the centroid of the hexagon
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
                
                // Check if at least two other vertices of the triangle match vertices of the hexagon
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
                
                // If we found one vertex matching the centroid and at least two other vertices matching hexagon vertices
                if (vertexMatches >= 2) {
                    return true;
                }
            }
            
            return false;
        }

        // Add new helper function to check if a hexagon is covered by triangles
        p5.isHexagonCoveredByTriangles = (hexagon, existingNodes) => {
            if (hexagon.n !== 6) return false;
            
            const triangles = existingNodes.filter(node => node.n === 3);
            const coveredVertices = new Set();
            
            for (let i = 0; i < hexagon.vertices.length; i++) {
                const hexVertex = hexagon.vertices[i];
                
                for (let j = 0; j < triangles.length; j++) {
                    const triangle = triangles[j];
                    
                    if (p5.dist(hexagon.pos.x, hexagon.pos.y, triangle.pos.x, triangle.pos.y) > 2) {
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
                    if (p5.dist(hexagon.pos.x, hexagon.pos.y, triangle.pos.x, triangle.pos.y) > 2) {
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

        p5.findOrigin = (nodes, type, index) => {
            const startTime = performance.now();
            if (debug) console.time(`findOrigin (${type}${index})`);
            
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
                if (debug) console.log(`findOrigin (${type}${index}): Found ${uniqueCentroids.length} unique centroids`);
            } 
            
            else if (type === 'h') {
                let halfways = nodes.map(node => node.halfways).flat();
                
                let uniqueHalfways = deduplicatePoints(halfways);
                let sortedHalfways = p5.sortPointsByAngleAndDistance(uniqueHalfways);

                result = sortedHalfways[index - 1];
                if (debug) console.log(`findOrigin (${type}${index}): Found ${uniqueHalfways.length} unique halfways`);
            } 
            
            else if (type === 'v') {
                let vertices = nodes.map(node => node.vertices).flat();
                
                let uniqueVertices = deduplicatePoints(vertices);
                let sortedVertices = p5.sortPointsByAngleAndDistance(uniqueVertices);

                result = sortedVertices[index - 1];
                if (debug) console.log(`findOrigin (${type}${index}): Found ${uniqueVertices.length} unique vertices`);
            }
            
            const endTime = performance.now();
            if (debug) console.timeEnd(`findOrigin (${type}${index})`);
            if (debug) console.log(`findOrigin (${type}${index}): ${(endTime - startTime).toFixed(2)}ms`);
            
            return result;
        }

        p5.apothem = (n) => {
            return 0.5 / Math.tan(Math.PI / n);
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

        p5.windowResized = () => {
            if (prevWidth !== width || prevHeight !== height) {
                p5.resizeCanvas(width, height);
                prevWidth = width;
                prevHeight = height;
            }
        }
        
        p5.takeScreenshot = () => {
            const filename = `${tilingRule}.png`;
            
            screenshotCanvas.colorMode(p5.HSB, 360, 100, 100);
            
            screenshotCanvas.push();
            screenshotCanvas.translate(0, 600);
            screenshotCanvas.scale(1, -1);
            
            screenshotCanvas.background(255);
            
            screenshotCanvas.translate(300, 300);
            
            screenshotCanvas.stroke(0);
            screenshotCanvas.strokeWeight(2);
            
            screenshotCanvas.scale(side);
            
            for (let i = 0; i < tiling.nodes.length; i++) {
                screenshotCanvas.push();
                screenshotCanvas.fill(p5.map(tiling.nodes[i].n, 3, 12, 0, 300), 100, 100, 0.2);
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
                    screenshotCanvas.fill(0, 100, 100);
                    screenshotCanvas.ellipse(tiling.nodes[i].centroid.x, tiling.nodes[i].centroid.y, 5 / side);
                    
                    screenshotCanvas.fill(120, 100, 100);
                    for (let j = 0; j < tiling.nodes[i].halfways.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].halfways[j].x, tiling.nodes[i].halfways[j].y, 5 / side);
                    }
                    
                    screenshotCanvas.fill(240, 100, 100);
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
            // Force immediate canvas resize when width or height changes
            myp5.resizeCanvas(width, height);
            prevWidth = width;
            prevHeight = height;
        }
    });
</script>

<!-- Pass in specific dimensions using inline style to ensure immediate update -->
<div class="relative h-full w-full">
    <div bind:this={canvasContainer}></div>
    
    {#if !showGameOfLife}
        <button 
            class="absolute top-4 right-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors duration-200 flex items-center gap-2 z-10"
            onclick={captureScreenshot}
        >
            <Camera />
            Screenshot
        </button>
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
</div>

{#if showNotification}
    <div class="fixed bottom-4 right-4 bg-green-500 text-white py-2 px-4 rounded-md shadow-md animate-fade-in-out flex items-center gap-2 z-20">
        <Check />
        {notificationMessage}
    </div>
{/if}