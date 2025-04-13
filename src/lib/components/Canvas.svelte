<script>
    import { onMount } from 'svelte';
    
    let possibleAngles = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
    let possibleSides = [0, 3, 4, 6, 8, 10, 12];
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],  [0, 0],  [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    let debug = $state(false);

    let {
        width,
        height,
        rule,
        tiling,
        transformSteps,
        side,
        showConstructionPoints,
        showGameOfLife,
        showInfo,
        speed
    } = $props();

    let birth = $state([]);
    let survival = $state([]);
    let tolerance = $state(0.01);
    let frameMod = $derived(Math.max(1, Math.floor(60 / speed)));

    let oldWidth = $state(width);   
    let oldHeight = $state(height);
    let oldRule = $state(rule);
    let oldTiling = $state(tiling);
    let oldTransformSteps = $state(transformSteps);
    let oldSide = $state(side);

    // Update frameMod when speed changes

    let graph = $state({
        nodes: [],
        edges: []
    });

	let sketch = function(p5) {
        // svelte-ignore perf_avoid_nested_class
        class Node {
            constructor(pos, n, angle) {
                this.pos = pos;
                this.n = n;
                this.angle = angle;
                this.neighbors = [];
                this.calculateCentroid();
                this.calculateVertices();
                this.calculateHalfways();
            }

            show = () => {
                p5.push();
                p5.stroke(0, 0, 0);
                p5.fill(p5.map(this.n, 3, 12, 0, 300), 100, 100, 0.2);
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
                if (this.alive) {
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

                if (Math.abs(this.centroid.x) < 0.001) {
                    this.centroid.x = 0;
                }
                if (Math.abs(this.centroid.y) < 0.001) {
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

                    if (Math.abs(this.vertices[i].x) < 0.001) {
                        this.vertices[i].x = 0;
                    }
                    if (Math.abs(this.vertices[i].y) < 0.001) {
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

                    if (Math.abs(this.halfways[i].x) < 0.001) {
                        this.halfways[i].x = 0;
                    }
                    if (Math.abs(this.halfways[i].y) < 0.001) {
                        this.halfways[i].y = 0;
                    }
                }
            }
        }

        p5.setup = () => {
            p5.createCanvas(1000, 700);
            p5.colorMode(p5.HSB, 360, 100, 100);

            try {
                [birth, survival] = rule.split('/');
                birth = birth.slice(1).split('').map(Number);
                survival = survival.slice(1).split('').map(Number);

                let [shapeSeed, groups, transforms] = p5.parseTiling(tiling);
                p5.createGraphTiling(shapeSeed, groups, transforms);
                p5.setupGameOfLife();
            } catch (e) {
                console.log(e);
            }

            oldRule = rule;
            oldTiling = tiling;
            oldTransformSteps = transformSteps;
            oldSide = side;
        }

        p5.draw = () => {
            p5.push();
            p5.translate(0, p5.height);
            p5.scale(1, -1);
            p5.background(255);
            try {
                if (showGameOfLife) {
                    if (p5.frameCount % frameMod == 0) {
                        p5.updateGameOfLife();
                    }
                    p5.drawGameOfLife();
                } else {
                    if (showInfo) {
                        p5.drawInfo();
                    }
                    p5.drawGraphTiling();
                }
            } catch (e) {
                console.log(e);
            }

            p5.noStroke();
 
            try {
                if (oldRule != rule || oldTiling != tiling || oldTransformSteps != transformSteps || oldSide != side) {
                    [birth, survival] = rule.split('/');
                    birth = birth.slice(1).split('').map(Number);
                    survival = survival.slice(1).split('').map(Number);
                    
                    let [shapeSeed, groups, transforms] = p5.parseTiling(tiling);
                    p5.createGraphTiling(shapeSeed, groups, transforms);
                    p5.setupGameOfLife();
                }
            } catch (e) {
                console.log(e);
            }

            oldWidth = width;
            oldHeight = height;
            oldRule = rule;
            oldTiling = tiling;
            oldTransformSteps = transformSteps;
            oldSide = side;
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

        p5.drawInfo = () => {
            p5.push();
            p5.translate(0, p5.height);
            p5.scale(1, -1);
            let uniqueCentroids = [];

            for (let i = 0; i < graph.nodes.length; i++) {
                let centroid = graph.nodes[i].centroid;
                if (!uniqueCentroids.some(c => Math.abs(c.x - centroid.x) < tolerance && Math.abs(c.y - centroid.y) < tolerance)) {
                    uniqueCentroids.push(centroid);
                }
            }

            let uniqueCentroidsSorted = p5.sortPointsByAngleAndDistance(uniqueCentroids);
            uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => Math.abs(centroid.x) > tolerance || Math.abs(centroid.y) > tolerance);
            
            for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
                let centroid = uniqueCentroidsSorted[i];
                p5.text('c' + (i + 1), centroid.x + 305, -centroid.y + 305);
            }

            let uniqueHalfways = [];
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].halfways.length; j++) {
                    let halfway = graph.nodes[i].halfways[j];
                    if (!uniqueHalfways.some(h => Math.abs(h.x - halfway.x) < tolerance && Math.abs(h.y - halfway.y) < tolerance)) {
                        uniqueHalfways.push(halfway);
                    }
                }
            }

            let uniqueHalfwaysSorted = p5.sortPointsByAngleAndDistance(uniqueHalfways);

            for (let i = 0; i < uniqueHalfwaysSorted.length; i++) {
                let halfway = uniqueHalfwaysSorted[i];
                p5.text('h' + (i + 1), halfway.x + 305, -halfway.y + 305);
            }

            let uniqueVertices = [];
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].vertices.length; j++) {
                    let vertex = graph.nodes[i].vertices[j];
                    if (!uniqueVertices.some(v => Math.abs(v.x - vertex.x) < tolerance && Math.abs(v.y - vertex.y) < tolerance)) {
                        uniqueVertices.push(vertex);
                    }
                }
            }

            let uniqueVerticesSorted = p5.sortPointsByAngleAndDistance(uniqueVertices); 

            for (let i = 0; i < uniqueVerticesSorted.length; i++) {
                let vertex = uniqueVerticesSorted[i];
                p5.text('v' + (i + 1), vertex.x + 305, -vertex.y + 305);
            }

            p5.pop();
        }
        
        p5.parseTiling = (tiling) => {
            let phases = tiling.split('/');
            let shapeSeed = phases[0].split('-');
            for (let i = 0; i < shapeSeed.length; i++) {
                shapeSeed[i] = shapeSeed[i].split(',').map(Number);
            }
            if (shapeSeed.flat().some(n => !possibleSides.includes(n))) {
                throw new Error('Invalid shape seed');
            }

            let transforms = [];
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
                transforms.push(transform);
            }

            return [shapeSeed, transforms];
        }

        p5.createGraphTiling = (shapeSeed, transforms) => {
            if (debug) console.time("Total tiling generation");
            const perfStart = performance.now();
            if (debug) console.log("Starting tiling generation...");
            graph.nodes = [];
            
            // shape seed
            if (debug) console.time("Creating seed shapes");
            const seedStart = performance.now();
            
            // first group
            graph.nodes.push(new Node(
                {
                    x: shapeSeed[0][0] == 3 ? side * Math.sqrt(3) / 6 : 0,
                    y: shapeSeed[0][0] == 3 ? -side / 2 : 0,
                },
                shapeSeed[0][0],
                shapeSeed[0][0] == 3 ? 0 : Math.PI / shapeSeed[0][0]
            ));

            // additional groups
            for (let i = 1; i < shapeSeed.length; i++) {
                let newNodes = [];
                let indexOff = 0;
                for (let j = 0; j < shapeSeed[i].length; j++) {
                    if (shapeSeed[i][j] == 0) {
                        indexOff += 1;
                        continue;
                    }

                    let anchor = p5.findAnchor(newNodes, indexOff);
                    let v = p5.createVector(
                        anchor.halfwayPoint.x - anchor.node.centroid.x,
                        anchor.halfwayPoint.y - anchor.node.centroid.y
                    );
                    v.normalize();

                    let apothem = side / 2 / Math.tan(Math.PI / shapeSeed[i][j]);
                    let newCentroid = {
                        x: anchor.halfwayPoint.x + v.x * apothem,
                        y: anchor.halfwayPoint.y + v.y * apothem
                    };

                    let newNode = new Node(
                        newCentroid,
                        shapeSeed[i][j],
                        shapeSeed[i][j] == 3 ? Math.atan2(v.y, v.x) : Math.atan2(v.y, v.x) + Math.PI / shapeSeed[i][j]
                    );

                    newNodes.push(newNode);
                }

                graph.nodes = graph.nodes.concat(newNodes);
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
                for (let i = 0; i < transforms.length; i++) {
                    const transformTypeStart = performance.now();
                    if (debug) console.time(`Transform ${s+1}.${i+1}`);
                    if (s == transformSteps - 1 && i == transforms.length - 1) {
                        break;
                    }

                    if (transforms[i].type === 'mirror') {
                        // mirror relative to point
                        if (transforms[i].relativeTo) {
                            let type = transforms[i].relativeTo[0];
                            let index = transforms[i].relativeTo[1];

                            let origin = p5.findOrigin(graph.nodes, type, index);

                            let newNodes = [];
                            for (let j = 0; j < graph.nodes.length; j++) {
                                let newNode = new Node(
                                    {
                                        x: graph.nodes[j].pos.x,
                                        y: graph.nodes[j].pos.y
                                    },
                                    graph.nodes[j].n,
                                    graph.nodes[j].angle
                                );

                                // Mirror position across the origin point
                                newNode.pos.x = 2 * origin.x - newNode.pos.x;
                                newNode.pos.y = 2 * origin.y - newNode.pos.y;
                                
                                // Mirror angle - flip it across the line through origin and point
                                newNode.angle = Math.PI + newNode.angle;

                                newNode.calculateCentroid();
                                newNode.calculateVertices();
                                newNode.calculateHalfways();
                                
                                newNodes.push(newNode);
                            }

                            graph.nodes = graph.nodes.concat(newNodes);
                            graph.nodes = p5.removeDuplicates(graph.nodes);
                        } 
                        
                        // mirror relative to angle
                        else if (transforms[i].angle) {
                            let angle = transforms[i].angle;
                            while (angle < 360) {
                                let newNodes = [];
                                for (let j = 0; j < graph.nodes.length; j++) {
                                    let newNode = new Node(
                                        {
                                            x: graph.nodes[j].pos.x,
                                            y: graph.nodes[j].pos.y
                                        },
                                        graph.nodes[j].n,
                                        graph.nodes[j].angle
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

                                graph.nodes = graph.nodes.concat(newNodes);
                                graph.nodes = p5.removeDuplicates(graph.nodes);
                                
                                angle *= 2;
                            }
                        }
                    } 
                    
                    // rotation
                    else if (transforms[i].type === 'rotation') {
                        
                        // rotation by angle
                        if (transforms[i].angle) {
                            let angle = transforms[i].angle * Math.PI / 180;
                            while (angle < 2 * Math.PI) {
                                let newNodes = [];
                                for (let j = 0; j < graph.nodes.length; j++) {
                                    let newNode = new Node(
                                        {
                                            x: graph.nodes[j].pos.x,
                                            y: graph.nodes[j].pos.y
                                        },
                                        graph.nodes[j].n,
                                        graph.nodes[j].angle
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

                                graph.nodes = graph.nodes.concat(newNodes);
                                graph.nodes = p5.removeDuplicates(graph.nodes);
                                
                                angle += transforms[i].angle * Math.PI / 180;
                            }
                        } 
                        
                        // rotation relative to a point
                        else if (transforms[i].relativeTo) {
                            let type = transforms[i].relativeTo[0];
                            let index = transforms[i].relativeTo[1];

                            let origin = p5.findOrigin(graph.nodes, type, index);

                            let newNodes = [];
                            for (let j = 0; j < graph.nodes.length; j++) {
                                let newNode = new Node(
                                    {
                                        x: graph.nodes[j].pos.x,
                                        y: graph.nodes[j].pos.y
                                    },
                                    graph.nodes[j].n,
                                    graph.nodes[j].angle
                                );

                                newNode.pos.x = 2 * origin.x - newNode.pos.x;
                                newNode.pos.y = 2 * origin.y - newNode.pos.y;
                                newNode.angle = Math.PI + newNode.angle;

                                newNode.calculateCentroid();
                                newNode.calculateVertices();
                                newNode.calculateHalfways();
                                
                                newNodes.push(newNode);
                            }

                            graph.nodes = graph.nodes.concat(newNodes);
                            graph.nodes = p5.removeDuplicates(graph.nodes);
                        }
                    }

                    const transformTypeEnd = performance.now();
                    if (debug) console.timeEnd(`Transform ${s+1}.${i+1}`);
                    if (debug) console.log(`Transform ${s+1}.${i+1} took ${transformTypeEnd - transformTypeStart}ms, Nodes: ${graph.nodes.length}`);
                }
                const stepEnd = performance.now();
                if (debug) console.timeEnd(`Transform step ${s+1}`);
                if (debug) console.log(`Transform step ${s+1} completed in ${stepEnd - stepStart}ms, Total nodes: ${graph.nodes.length}`);
            }
            const transformEnd = performance.now();
            if (debug) console.timeEnd("Applying transformations");
            if (debug) console.log(`All transformations applied in ${transformEnd - transformStart}ms`);

            if (debug) console.time("Calculating neighbors");
            const neighborsStart = performance.now();
            
            if (debug) console.time("Creating spatial indices");
            const spatialIndexStart = performance.now();
            
            const halfwaysSpatialMap = new Map();
            const verticesSpatialMap = new Map();
            
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].halfways.length; j++) {
                    const hw = graph.nodes[i].halfways[j];
                    const key = p5.getSpatialKey(hw.x, hw.y);
                    
                    if (!halfwaysSpatialMap.has(key)) {
                        halfwaysSpatialMap.set(key, []);
                    }

                    halfwaysSpatialMap.get(key).push({
                        nodeIndex: i,
                        halfwayIndex: j
                    });
                }
                
                for (let j = 0; j < graph.nodes[i].vertices.length; j++) {
                    const v = graph.nodes[i].vertices[j];
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
            
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].halfways.length; j++) {
                    const hw = graph.nodes[i].halfways[j];
                    const baseX = Math.floor(hw.x / (tolerance * 2));
                    const baseY = Math.floor(hw.y / (tolerance * 2));
                    
                    for (const [dx, dy] of offsets) {
                        const key = `${baseX + dx},${baseY + dy}`;
                        
                        const potentialMatches = halfwaysSpatialMap.get(key) || [];
                        
                        for (const match of potentialMatches) {
                            const k = match.nodeIndex;
                            const l = match.halfwayIndex;
                            
                            if (i >= k) continue;
                            
                            if (Math.abs(hw.x - graph.nodes[k].halfways[l].x) < tolerance && 
                                Math.abs(hw.y - graph.nodes[k].halfways[l].y) < tolerance) {
                                graph.nodes[i].neighbors.push(graph.nodes[k]);
                                graph.nodes[k].neighbors.push(graph.nodes[i]);
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
            
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].vertices.length; j++) {
                    const vertex = graph.nodes[i].vertices[j];
                    const baseX = Math.floor(vertex.x / (tolerance * 2));
                    const baseY = Math.floor(vertex.y / (tolerance * 2));
                    
                    for (const [dx, dy] of offsets) {
                        const key = `${baseX + dx},${baseY + dy}`;
                        
                        const potentialMatches = verticesSpatialMap.get(key) || [];
                        
                        for (const match of potentialMatches) {
                            const k = match.nodeIndex;
                            const l = match.vertexIndex;
                            
                            if (i >= k) continue;
                            
                            if (graph.nodes[i].neighbors.some(neighbor => 
                                Math.abs(neighbor.pos.x - graph.nodes[k].pos.x) < tolerance && 
                                Math.abs(neighbor.pos.y - graph.nodes[k].pos.y) < tolerance)) {
                                continue;
                            }
                            
                            if (Math.abs(vertex.x - graph.nodes[k].vertices[l].x) < tolerance && 
                                Math.abs(vertex.y - graph.nodes[k].vertices[l].y) < tolerance) {
                                graph.nodes[i].neighbors.push(graph.nodes[k]);
                                graph.nodes[k].neighbors.push(graph.nodes[i]);
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

            const perfEnd = performance.now();
            if (debug) console.timeEnd("Total tiling generation");
            if (debug) console.log(`Total tiling generation completed in ${perfEnd - perfStart}ms, Total nodes: ${graph.nodes.length}`);

            console.log(graph.nodes);
        }

        p5.getSpatialKey = (x, y) => {
            const gridSize = tolerance * 2;
            const hashX = Math.floor(x / gridSize);
            const hashY = Math.floor(y / gridSize);
            return `${hashX},${hashY}`;
        };

        p5.findAnchor = (newNodes, indexOff) => {
            const startTime = performance.now();
            const allNodes = graph.nodes.concat(newNodes);

            let anchors = [];
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let s = 0; s < graph.nodes[i].halfways.length; s++) {
                    let isFree = true;

                    for (let j = 0; j < allNodes.length; j++) {
                        if (p5.dist(
                            graph.nodes[i].centroid.x,
                            graph.nodes[i].centroid.y,
                            allNodes[j].centroid.x,
                            allNodes[j].centroid.y
                        ) < tolerance)
                            continue;

                        for (let k = 0; k < allNodes[j].halfways.length; k++) {
                            if (p5.dist(
                                graph.nodes[i].halfways[s].x,
                                graph.nodes[i].halfways[s].y,
                                allNodes[j].halfways[k].x,
                                allNodes[j].halfways[k].y
                            ) < tolerance) {
                                isFree = false;
                                break;
                            }
                        }
                        
                        if (!isFree) 
                            break;
                    }

                    if (isFree) {
                        anchors.push({
                            node: graph.nodes[i],
                            halfwayPoint: graph.nodes[i].halfways[s]
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
            });

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
                        if (
                            Math.abs(uniqueNodes[uniqueIndex].pos.x - node.pos.x) < tolerance && 
                            Math.abs(uniqueNodes[uniqueIndex].pos.y - node.pos.y) < tolerance
                        ) {
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
                            if (Math.abs(uniquePoints[uniqueIndex].x - point.x) < tolerance && 
                                Math.abs(uniquePoints[uniqueIndex].y - point.y) < tolerance) {
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

                // remove centroid at the origin
                sortedCentroids = sortedCentroids.filter(centroid => Math.abs(centroid.x) > tolerance || Math.abs(centroid.y) > tolerance);

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

        p5.setupGameOfLife = () => {
            for (let i = 0; i < graph.nodes.length; i++) {
                graph.nodes[i].alive = Math.random() < 0.5;
            }
        }

        p5.updateGameOfLife = () => {
            for (let i = 0; i < graph.nodes.length; i++) {
                let aliveNeighbors = graph.nodes[i].neighbors.filter(neighbor => neighbor.alive).length;
                
                if (graph.nodes[i].alive) {
                    if (!survival.includes(aliveNeighbors)) {
                        graph.nodes[i].alive = false;
                    }
                } else {
                    if (birth.includes(aliveNeighbors)) {
                        graph.nodes[i].alive = true;
                    }
                }
            }
        }

        p5.drawGameOfLife = () => {
            p5.push();
            p5.translate(p5.width / 2, p5.height / 2);
            for (let i = 0; i < graph.nodes.length; i++) {
                graph.nodes[i].showGameOfLife();
            }
            p5.pop();
        }

        p5.drawGraphTiling = () => {
            p5.push();
            p5.translate(p5.width / 2, p5.height / 2);
            p5.stroke(0);
            p5.strokeWeight(2);
            for (let i = 0; i < graph.nodes.length; i++) {
                graph.nodes[i].show();
            }

            p5.stroke(0);
            p5.strokeWeight(1);
            for (let i = 0; i < graph.nodes.length; i++) {
                if (
                    p5.dist(p5.mouseX - p5.width / 2, p5.mouseY - p5.height / 2, graph.nodes[i].pos.x, graph.nodes[i].pos.y) < p5.apothem(graph.nodes[i].n)
                ) {
                    for (let j = 0; j < graph.nodes[i].neighbors.length; j++) {
                        p5.line(
                            graph.nodes[i].pos.x, 
                            graph.nodes[i].pos.y, 
                            graph.nodes[i].neighbors[j].pos.x, 
                            graph.nodes[i].neighbors[j].pos.y
                        );
                    }
                }
            }
            p5.pop();
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
            if (oldWidth !== width || oldHeight !== height) {
                p5.resizeCanvas(width, height);
                oldWidth = width;
                oldHeight = height;
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
        }
    });
</script>

<div bind:this={canvasContainer} bind:clientWidth={width} bind:clientHeight={height}></div>