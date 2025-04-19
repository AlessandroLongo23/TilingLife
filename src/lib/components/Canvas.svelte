<script>
    import { onMount } from 'svelte';
    import { ruleType, golRule, golRules } from '$lib/stores/configuration';
    
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

    let prevWidth = $state(width);   
    let prevHeight = $state(height);
    let prevTilingRule = $state(tilingRule);
    let prevTransformSteps = $state(transformSteps);
    let prevSide = $state(side);

    let prevRuleType = $state($ruleType);
    let prevGolRule = $state($golRule);
    let prevGolRules = $state($golRules);
    let rule = $state({});
    let rules = $state({});

    let tiling = $state();

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
                        x: this.shapeSeed[0][0] == 3 ? side * Math.sqrt(3) / 6 : 0,
                        y: this.shapeSeed[0][0] == 3 ? side / 2 : 0,
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

                        let apothem = side / 2 / Math.tan(Math.PI / this.shapeSeed[i][j]);
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
                                this.mirrorRelativeTo(this.transforms[i].relativeTo)
                            } else if (this.transforms[i].angle) {
                                this.mirrorByAngle(this.transforms[i].angle)
                            }
                        } else if (this.transforms[i].type === 'rotation') {
                            if (this.transforms[i].angle) {
                                this.rotateByAngle(this.transforms[i].angle)
                            } else if (this.transforms[i].relativeTo) {
                                this.rotateRelativeTo(this.transforms[i].relativeTo)
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

                console.log(this.nodes);
            }

            mirrorRelativeTo = (relativeTo) => {
                let type = relativeTo[0];
                let index = relativeTo[1];

                let origin = p5.findOrigin(this.anchorNodes, type, index);

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
                    
                    newNodes.push(newNode);
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
                        
                        newNodes.push(newNode);
                    }

                    this.nodes = this.nodes.concat(newNodes);
                    this.nodes = p5.removeDuplicates(this.nodes);
                    
                    angle *= 2;
                }
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

                        newNodes.push(newNode);
                    }

                    this.nodes = this.nodes.concat(newNodes);
                    this.nodes = p5.removeDuplicates(this.nodes);
                    
                    angle += alfa * Math.PI / 180;
                }
            }


            rotateRelativeTo = (relativeTo) => {
                let type = relativeTo[0];
                let index = relativeTo[1];

                let origin = p5.findOrigin(this.anchorNodes, type, index);

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
                    
                    newNodes.push(newNode);
                }

                this.nodes = this.nodes.concat(newNodes);
                this.nodes = p5.removeDuplicates(this.nodes);
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
                        }
                    } else {
                        if (this.nodes[i].state && !rules[this.nodes[i].n].survival.includes(aliveNeighbors)) {
                            this.nodes[i].nextState = false;
                        } else if (!this.nodes[i].state && rules[this.nodes[i].n].birth.includes(aliveNeighbors)) {
                            this.nodes[i].nextState = true;
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
                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].showGameOfLife();
                }
                p5.pop();
            }

            drawGraphTiling = () => {
                p5.push();
                p5.translate(p5.width / 2, p5.height / 2);
                p5.stroke(0);
                p5.strokeWeight(2);
                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].show();
                }

                p5.stroke(0);
                p5.strokeWeight(1);
                for (let i = 0; i < this.nodes.length; i++) {
                    if (
                        p5.dist(p5.mouseX - p5.width / 2, -p5.mouseY + p5.height / 2, this.nodes[i].pos.x, this.nodes[i].pos.y) < p5.apothem(this.nodes[i].n)
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
                                side / 5,
                                side / 5
                            );
                        }

                        p5.fill(0, 0, 0);
                        p5.ellipse(
                            this.nodes[i].pos.x,
                            this.nodes[i].pos.y,
                            side / 5,
                            side / 5
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
                p5.fill(color || p5.map(this.n, 3, 12, 0, 300), 100, 100, 0.2);
                p5.beginShape();
                for (let i = 0; i < this.vertices.length; i++) {
                    p5.vertex(this.vertices[i].x, this.vertices[i].y);
                }
                p5.endShape(p5.CLOSE);
                
                if (showConstructionPoints) {
                    p5.fill(0, 100, 100);
                    p5.ellipse(this.centroid.x, this.centroid.y, 5);
                    
                    p5.fill(120, 100, 100);
                    for (let i = 0; i < this.halfways.length; i++) {
                        p5.ellipse(this.halfways[i].x, this.halfways[i].y, 5);
                    }
                    
                    p5.fill(240, 100, 100);
                    for (let i = 0; i < this.vertices.length; i++) {
                        p5.ellipse(this.vertices[i].x, this.vertices[i].y, 5);
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
                let radius = side / 2 / Math.sin(Math.PI / this.n);
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
            prevSide = side;
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
            p5.background(255);
            try {
                if (showGameOfLife) {
                    if (
                        prevRuleType != $ruleType || 
                        ($ruleType == "Single" && !p5.isSameRule(prevGolRule, $golRule)) || 
                        ($ruleType == "By Shape" && !p5.isSameRule(prevGolRules, $golRules))
                    ) {
                        tiling.setupGameOfLife();
                    }

                    if (p5.frameCount % frameMod == 0) {
                        tiling.updateGameOfLife();
                    }
                    
                    tiling.drawGameOfLife();
                } else {
                    if (showInfo) {
                        p5.drawInfo();
                    }
                    tiling.drawGraphTiling();
                }
            } catch (e) {
                console.log(e);
            }

            p5.noStroke();
 
            try {
                if (prevTilingRule != tilingRule || prevTransformSteps != transformSteps || prevSide != side) {
                    tiling.parseRule(tilingRule);
                    tiling.createGraph();
                    tiling.setupGameOfLife();
                }
            } catch (e) {
                console.log(e);
            }

            prevWidth = width;
            prevHeight = height;
            prevTilingRule = tilingRule;
            prevTransformSteps = transformSteps;
            prevSide = side;

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
                p5.text('c' + (i + 1), centroid.x + p5.width / 2, -centroid.y + p5.height / 2);
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
                p5.text('h' + (i + 1), halfway.x + p5.width / 2, -halfway.y + p5.height / 2);
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
                p5.text('v' + (i + 1), vertex.x + p5.width / 2, -vertex.y + p5.height / 2);
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
            return side / 2 / Math.tan(Math.PI / n);
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
	};

    let canvasContainer = $state();
    let p5;
    let myp5 = $state();
    
    onMount(async () => {
        if (typeof window !== 'undefined') {
            p5 = (await import('p5')).default;
            myp5 = new p5(sketch, canvasContainer);
            
            if (width && height && myp5) {
                myp5.resizeCanvas(width, height);
                prevWidth = width;
                prevHeight = height;
            }
        }
    });

    $effect(() => {
        if (myp5 && width && height && (prevWidth !== width || prevHeight !== height)) {
            
            myp5.resizeCanvas(width, height);
            prevWidth = width;
            prevHeight = height;
        }
    });
</script>

<div bind:this={canvasContainer}></div>