<script>
    import { onMount } from 'svelte';
    
    let possible_angles = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

    let {
        width,
        height,
        rule,
        tiling,
        transform_steps,
        side,
        show_construction_points,
        show_game_of_life,
        show_info
    } = $props();

    let birth = $state([]);
    let survival = $state([]);
    let tolerance = $state(0.01);

    let old_rule = $state(rule);
    let old_tiling = $state(tiling);
    let old_transform_steps = $state(transform_steps);
    let old_side = $state(side);

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
                this.calculate_centroid();
                this.calculate_vertices();
                this.calculate_halfways();
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
                
                if (show_construction_points) {
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
                if (this.alive) {
                    p5.fill(0, 0, 0);
                } else {
                    p5.fill(255, 255, 255);
                }

                p5.beginShape();
                for (let i = 0; i < this.vertices.length; i++) {
                    p5.vertex(this.vertices[i].x, this.vertices[i].y);
                }
                p5.endShape(p5.CLOSE);
                p5.pop();
            }

            calculate_centroid = () => {
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

            calculate_vertices = () => {
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

            calculate_halfways = () => {
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
            p5.createCanvas(600, 600);
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

            old_rule = rule;
            old_tiling = tiling;
            old_transform_steps = transform_steps;
            old_side = side;
        }

        p5.draw = () => {
            p5.background(255);
            // p5.translate(0, p5.height);
            // p5.scale(1, -1);
            try {
                if (show_game_of_life) {
                    if (p5.frameCount % 15 == 0) {
                        p5.updateGameOfLife();
                    }
                    p5.drawGameOfLife();
                } else {
                    if (show_info) {
                        p5.drawInfo();
                    }
                    p5.drawGraphTiling();
                }
            } catch (e) {
                console.log(e);
            }

            p5.noStroke();
 
            try {
                if (old_rule != rule || old_tiling != tiling || old_transform_steps != transform_steps || old_side != side) {
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

            old_rule = rule;
            old_tiling = tiling;
            old_transform_steps = transform_steps;
            old_side = side;
        }

        p5.drawInfo = () => {
            let unique_centroids = [];

            for (let i = 0; i < graph.nodes.length; i++) {
                let centroid = graph.nodes[i].centroid;
                if (!unique_centroids.some(c => c.x === centroid.x && c.y === centroid.y)) {
                    unique_centroids.push(centroid);
                }
            }

            // Sort by angle, then by distance if angles are similar
            const sortPointsByAngleAndDistance = (points) => {
                return points.sort((a, b) => {
                    const angleA = p5.getClockwiseAngle(a);
                    const angleB = p5.getClockwiseAngle(b);
                    
                    // If angles are approximately the same (within tolerance)
                    if (Math.abs(angleA - angleB) < tolerance) {
                        // Sort by distance from center
                        const distA = Math.sqrt(a.x ** 2 + a.y ** 2);
                        const distB = Math.sqrt(b.x ** 2 + b.y ** 2);
                        return distA - distB;
                    }
                    
                    // Otherwise sort by angle
                    return angleA - angleB;
                });
            };

            let unique_centroids_sorted = sortPointsByAngleAndDistance(unique_centroids);
            
            for (let i = 0; i < unique_centroids_sorted.length; i++) {
                let centroid = unique_centroids_sorted[i];
                p5.text('c' + (i + 1), centroid.x + 300, centroid.y + 300);
            }
        }

        p5.parseTiling = (tiling) => {
            let phases = tiling.split('/');
            let shapeSeed = phases[0].split('-').map(Number);

            let transforms = [];
            for (let i = 1; i < phases.length; i++) {
                let transform = {};
                if (phases[i].includes('(')) {
                    transform = {
                        type: phases[i][0] === 'r' ? 'rotation' : 'mirror',
                        relative_to: phases[i].split('(')[1].split(')')[0],
                    }
                } else {
                    let type = phases[i][0] === 'r' ? 'rotation' : 'mirror';
                    let angle = type === 'rotation' ? parseInt(phases[i].split('r')[1]) : parseInt(phases[i].split('m')[1]);
                    transform = {
                        type: type,
                        angle: angle
                    }
                    if (!possible_angles.includes(parseInt(transform.angle))) {
                        throw new Error('Invalid angle');
                    }
                }
                transforms.push(transform);
            }

            return [shapeSeed, transforms];
        }

        p5.createGraphTiling = (shapeSeed, transforms) => {
            console.time("Total tiling generation");
            const perfStart = performance.now();
            console.log("Starting tiling generation...");
            graph.nodes = [];
            
            // shape seed
            console.time("Creating seed shapes");
            const seedStart = performance.now();
            // origin shape
            graph.nodes.push(new Node(
                {
                    x: shapeSeed[0] == 3 ? side * Math.sqrt(3) / 6 : 0,
                    y: shapeSeed[0] == 3 ? -side / 2 : 0,
                },
                shapeSeed[0],
                shapeSeed[0] == 3 ? 0 : Math.PI / shapeSeed[0]
            ));

            // additional seed shapes
            for (let i = 1; i < shapeSeed.length; i++) {
                let free_side = p5.find_free_side(i, graph.nodes[graph.nodes.length - 1]);
                let centroid = graph.nodes[graph.nodes.length - 1].centroid;
                let dir = {
                    x: free_side.x - centroid.x,
                    y: free_side.y - centroid.y
                };
                let length = Math.sqrt(dir.x ** 2 + dir.y ** 2);
                dir.x /= length;
                dir.y /= length;

                let apothem = side / 2 / Math.tan(Math.PI / shapeSeed[i]);
                let new_centroid = {
                    x: free_side.x + dir.x * apothem,
                    y: free_side.y + dir.y * apothem
                };

                graph.nodes.push(new Node(
                    new_centroid,
                    shapeSeed[i],
                    shapeSeed[i] == 3 ? Math.atan2(dir.y, dir.x) : Math.atan2(dir.y, dir.x) + Math.PI / shapeSeed[i]
                ));
            }
            const seedEnd = performance.now();
            console.timeEnd("Creating seed shapes");
            console.log(`Seed shapes created in ${seedEnd - seedStart}ms`);

            // transformations
            console.time("Applying transformations");
            const transformStart = performance.now();
            for (let s = 0; s < transform_steps; s++) {
                const stepStart = performance.now();
                console.time(`Transform step ${s+1}`);
                for (let i = 0; i < transforms.length; i++) {
                    const transformTypeStart = performance.now();
                    console.time(`Transform ${s+1}.${i+1}`);
                    if (s == transform_steps - 1 && i == transforms.length - 1) {
                        break;
                    }

                    if (transforms[i].type === 'mirror') {
                        if (transforms[i].angle) {
                            let angle = transforms[i].angle;
                            while (angle < 360) {
                                let new_nodes = [];
                                for (let j = 0; j < graph.nodes.length; j++) {
                                    let new_node = new Node(
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
                                    
                                    let dotProduct = new_node.pos.x * vx + new_node.pos.y * vy;
                                    let projX = dotProduct * vx;
                                    let projY = dotProduct * vy;
                                    
                                    new_node.pos.x = 2 * projX - new_node.pos.x;
                                    new_node.pos.y = 2 * projY - new_node.pos.y;
                                    new_node.angle = 2 * angleRad - new_node.angle;

                                    new_node.calculate_centroid();
                                    new_node.calculate_vertices();
                                    new_node.calculate_halfways();
                                    
                                    new_nodes.push(new_node);
                                }

                                graph.nodes = graph.nodes.concat(new_nodes);
                                graph.nodes = p5.remove_duplicates(graph.nodes);
                                
                                angle *= 2;
                            }
                        }
                    } else if (transforms[i].type === 'rotation') {
                        if (transforms[i].angle) {
                            let angle = transforms[i].angle * Math.PI / 180;
                            while (angle < 2 * Math.PI) {
                                let new_nodes = [];
                                for (let j = 0; j < graph.nodes.length; j++) {
                                    let new_node = new Node(
                                        {
                                            x: graph.nodes[j].pos.x,
                                            y: graph.nodes[j].pos.y
                                        },
                                        graph.nodes[j].n,
                                        graph.nodes[j].angle
                                    );

                                    let d = Math.sqrt(new_node.pos.x ** 2 + new_node.pos.y ** 2);
                                    let a = Math.atan2(new_node.pos.y, new_node.pos.x);
                                    new_node.pos.x = d * Math.cos(a + angle);
                                    new_node.pos.y = d * Math.sin(a + angle);
                                    new_node.angle = new_node.angle + angle;

                                    new_node.calculate_centroid();
                                    new_node.calculate_vertices();
                                    new_node.calculate_halfways();

                                    new_nodes.push(new_node);
                                }

                                graph.nodes = graph.nodes.concat(new_nodes);
                                graph.nodes = p5.remove_duplicates(graph.nodes);
                                
                                angle += transforms[i].angle * Math.PI / 180;
                            }
                        } else if (transforms[i].relative_to) {
                            let type = transforms[i].relative_to[0];
                            let index = transforms[i].relative_to[1];

                            let origin = p5.find_origin(graph.nodes, type, index);

                            let new_nodes = [];
                            for (let j = 0; j < graph.nodes.length; j++) {
                                let new_node = new Node(
                                    {
                                        x: graph.nodes[j].pos.x,
                                        y: graph.nodes[j].pos.y
                                    },
                                    graph.nodes[j].n,
                                    graph.nodes[j].angle
                                );

                                new_node.pos.x = 2 * origin.x - new_node.pos.x;
                                new_node.pos.y = 2 * origin.y - new_node.pos.y;
                                new_node.angle = Math.PI + new_node.angle;

                                new_node.calculate_centroid();
                                new_node.calculate_vertices();
                                new_node.calculate_halfways();
                                
                                new_nodes.push(new_node);
                            }

                            graph.nodes = graph.nodes.concat(new_nodes);
                            graph.nodes = p5.remove_duplicates(graph.nodes);
                        }
                    }

                    const transformTypeEnd = performance.now();
                    console.timeEnd(`Transform ${s+1}.${i+1}`);
                    console.log(`Transform ${s+1}.${i+1} took ${transformTypeEnd - transformTypeStart}ms, Nodes: ${graph.nodes.length}`);
                }
                const stepEnd = performance.now();
                console.timeEnd(`Transform step ${s+1}`);
                console.log(`Transform step ${s+1} completed in ${stepEnd - stepStart}ms, Total nodes: ${graph.nodes.length}`);
            }
            const transformEnd = performance.now();
            console.timeEnd("Applying transformations");
            console.log(`All transformations applied in ${transformEnd - transformStart}ms`);

            // calculate neighbors
            console.time("Calculating neighbors");
            const neighborsStart = performance.now();
            
            // Create spatial indices for faster neighbor lookup
            console.time("Creating spatial indices");
            const spatialIndexStart = performance.now();
            
            // Create hash maps for faster lookups
            const halfwaysSpatialMap = new Map();
            const verticesSpatialMap = new Map();
            
            // Helper function to get a spatial hash key
            const getSpatialKey = (x, y) => {
                // Round to fixed precision based on tolerance
                const gridSize = tolerance * 2; // Increased grid size for better coverage
                const hashX = Math.floor(x / gridSize);
                const hashY = Math.floor(y / gridSize);
                return `${hashX},${hashY}`;
            };
            
            // Generate adjacent cell offsets for checking neighboring cells
            const offsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],  [0, 0],  [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            
            // Populate spatial maps
            for (let i = 0; i < graph.nodes.length; i++) {
                // Index halfways
                for (let j = 0; j < graph.nodes[i].halfways.length; j++) {
                    const hw = graph.nodes[i].halfways[j];
                    const key = getSpatialKey(hw.x, hw.y);
                    
                    if (!halfwaysSpatialMap.has(key)) {
                        halfwaysSpatialMap.set(key, []);
                    }
                    halfwaysSpatialMap.get(key).push({
                        nodeIndex: i,
                        halfwayIndex: j
                    });
                }
                
                // Index vertices
                for (let j = 0; j < graph.nodes[i].vertices.length; j++) {
                    const v = graph.nodes[i].vertices[j];
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
            
            const spatialIndexEnd = performance.now();
            console.timeEnd("Creating spatial indices");
            console.log(`Created spatial indices in ${spatialIndexEnd - spatialIndexStart}ms`);
            
            console.time("Calculating halfways neighbors");
            const halfwaysStart = performance.now();
            
            // Using spatial indexing for halfways matching
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].halfways.length; j++) {
                    const hw = graph.nodes[i].halfways[j];
                    const baseX = Math.floor(hw.x / (tolerance * 2));
                    const baseY = Math.floor(hw.y / (tolerance * 2));
                    
                    // Check in current and neighboring cells
                    for (const [dx, dy] of offsets) {
                        const key = `${baseX + dx},${baseY + dy}`;
                        
                        // Get potential matches from spatial map
                        const potentialMatches = halfwaysSpatialMap.get(key) || [];
                        
                        // Check each potential match
                        for (const match of potentialMatches) {
                            const k = match.nodeIndex;
                            const l = match.halfwayIndex;
                            
                            // Skip self-comparisons
                            if (i >= k) continue;
                            
                            // Exact comparison with tolerance
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
            console.timeEnd("Calculating halfways neighbors");
            console.log(`Halfways neighbors calculated in ${halfwaysEnd - halfwaysStart}ms`);

            console.time("Calculating vertices neighbors");
            const verticesStart = performance.now();
            
            // Using spatial indexing for vertices matching
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = 0; j < graph.nodes[i].vertices.length; j++) {
                    const vertex = graph.nodes[i].vertices[j];
                    const baseX = Math.floor(vertex.x / (tolerance * 2));
                    const baseY = Math.floor(vertex.y / (tolerance * 2));
                    
                    // Check in current and neighboring cells
                    for (const [dx, dy] of offsets) {
                        const key = `${baseX + dx},${baseY + dy}`;
                        
                        // Get potential matches from spatial map
                        const potentialMatches = verticesSpatialMap.get(key) || [];
                        
                        // Check each potential match
                        for (const match of potentialMatches) {
                            const k = match.nodeIndex;
                            const l = match.vertexIndex;
                            
                            // Skip self-comparisons
                            if (i >= k) continue;
                            
                            // Skip if already neighbors
                            if (graph.nodes[i].neighbors.some(neighbor => 
                                Math.abs(neighbor.pos.x - graph.nodes[k].pos.x) < tolerance && 
                                Math.abs(neighbor.pos.y - graph.nodes[k].pos.y) < tolerance)) {
                                continue;
                            }
                            
                            // Exact comparison with tolerance
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
            console.timeEnd("Calculating vertices neighbors");
            console.log(`Vertices neighbors calculated in ${verticesEnd - verticesStart}ms`);
            
            const neighborsEnd = performance.now();
            console.timeEnd("Calculating neighbors");
            console.log(`All neighbors calculated in ${neighborsEnd - neighborsStart}ms`);

            const perfEnd = performance.now();
            console.timeEnd("Total tiling generation");
            console.log(`Total tiling generation completed in ${perfEnd - perfStart}ms, Total nodes: ${graph.nodes.length}`);
            console.log(graph.nodes);
        }

        p5.find_free_side = (i, node) => {
            const startTime = performance.now();
            
            // Helper function for spatial hashing
            const getSpatialKey = (x, y) => {
                const gridSize = tolerance * 2; // Increased grid size for better coverage
                const hashX = Math.floor(x / gridSize);
                const hashY = Math.floor(y / gridSize);
                return `${hashX},${hashY}`;
            };
            
            // Generate adjacent cell offsets for checking neighboring cells
            const offsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],  [0, 0],  [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            
            // First, index all existing halfways for quick lookup
            const halfwayMap = new Map();
            for (let i = 0; i < graph.nodes.length - 1; i++) {
                for (let j = 0; j < graph.nodes[i].halfways.length; j++) {
                    const hw = graph.nodes[i].halfways[j];
                    const key = getSpatialKey(hw.x, hw.y);
                    
                    if (!halfwayMap.has(key)) {
                        halfwayMap.set(key, []);
                    }
                    
                    halfwayMap.get(key).push(hw);
                }
            }
            
            let free_sides = [];

            // Check each halfway of the current node
            for (let s = 0; s < node.halfways.length; s++) {
                const hw = node.halfways[s];
                const baseX = Math.floor(hw.x / (tolerance * 2));
                const baseY = Math.floor(hw.y / (tolerance * 2));
                let is_free = true;
                
                // Check in current and neighboring cells
                for (const [dx, dy] of offsets) {
                    const key = `${baseX + dx},${baseY + dy}`;
                    
                    // Check if the halfway is close to any existing halfways
                    const nearbyHalfways = halfwayMap.get(key) || [];
                    for (const existingHw of nearbyHalfways) {
                        if (Math.abs(node.pos.x - existingHw.x) < tolerance && 
                            Math.abs(node.pos.y - existingHw.y) < tolerance) {
                            is_free = false;
                            break;
                        }
                    }
                    
                    if (!is_free) break;
                }
                
                if (is_free) {
                    free_sides.push(hw);
                }
            }

            free_sides.sort((a, b) => p5.getClockwiseAngle(b) - p5.getClockwiseAngle(a));

            const endTime = performance.now();
            console.log(`find_free_side: ${(endTime - startTime).toFixed(2)}ms - Found ${free_sides.length} free sides`);
            
            if (i === 1 && node.n === 3)
                return free_sides[1];

            return free_sides[0];
        }

        p5.remove_duplicates = (nodes) => {
            const startTime = performance.now();
            let nodeCount = nodes.length;
            
            // Use spatial hashing for faster duplicate detection
            const spatialMap = new Map();
            let unique_nodes = [];
            
            // Helper function to get a spatial hash key
            const getSpatialKey = (x, y) => {
                const gridSize = tolerance * 2; // Increase grid size for better coverage
                const hashX = Math.floor(x / gridSize);
                const hashY = Math.floor(y / gridSize);
                return `${hashX},${hashY}`;
            };
            
            // Generate adjacent cell offsets for checking neighboring cells
            const offsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],  [0, 0],  [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            
            // Process all nodes
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const baseKey = getSpatialKey(node.pos.x, node.pos.y);
                const baseX = Math.floor(node.pos.x / (tolerance * 2));
                const baseY = Math.floor(node.pos.y / (tolerance * 2));
                
                // Check if we need to examine this position
                let isDuplicate = false;
                
                // Check in current and neighboring cells
                for (const [dx, dy] of offsets) {
                    const key = `${baseX + dx},${baseY + dy}`;
                    
                    // Get potential duplicates in this hash bucket
                    const potentialDuplicates = spatialMap.get(key) || [];
                    
                    // Check against previously stored unique nodes in this bucket
                    for (const uniqueIndex of potentialDuplicates) {
                        if (Math.abs(unique_nodes[uniqueIndex].pos.x - node.pos.x) < tolerance && 
                            Math.abs(unique_nodes[uniqueIndex].pos.y - node.pos.y) < tolerance) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (isDuplicate) break;
                }
                
                if (!isDuplicate) {
                    // Add to unique nodes
                    const newIndex = unique_nodes.length;
                    unique_nodes.push(node);
                    
                    // Register in spatial map
                    if (!spatialMap.has(baseKey)) {
                        spatialMap.set(baseKey, []);
                    }
                    spatialMap.get(baseKey).push(newIndex);
                }
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`remove_duplicates: ${duration.toFixed(2)}ms - Reduced ${nodeCount} nodes to ${unique_nodes.length} nodes (${(nodeCount - unique_nodes.length)} duplicates removed)`);
            
            return unique_nodes;
        }

        p5.find_origin = (nodes, type, index) => {
            const startTime = performance.now();
            console.time(`find_origin (${type}${index})`);
            
            // Helper function for spatial hashing
            const getSpatialKey = (x, y) => {
                const gridSize = tolerance * 2; // Increased grid size for better coverage
                const hashX = Math.floor(x / gridSize);
                const hashY = Math.floor(y / gridSize);
                return `${hashX},${hashY}`;
            };
            
            // Generate adjacent cell offsets for checking neighboring cells
            const offsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],  [0, 0],  [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            
            const deduplicatePoints = (points) => {
                const spatialMap = new Map();
                let uniquePoints = [];
                
                for (let i = 0; i < points.length; i++) {
                    const point = points[i];
                    const baseKey = getSpatialKey(point.x, point.y);
                    const baseX = Math.floor(point.x / (tolerance * 2));
                    const baseY = Math.floor(point.y / (tolerance * 2));
                    
                    let isDuplicate = false;
                    
                    // Check in current and neighboring cells
                    for (const [dx, dy] of offsets) {
                        const key = `${baseX + dx},${baseY + dy}`;
                        
                        // Get potential duplicates in this hash bucket
                        const potentialDuplicates = spatialMap.get(key) || [];
                        
                        // Check against previously stored unique points in this bucket
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
                        // Add to unique points
                        const newIndex = uniquePoints.length;
                        uniquePoints.push(point);
                        
                        // Register in spatial map
                        if (!spatialMap.has(baseKey)) {
                            spatialMap.set(baseKey, []);
                        }
                        spatialMap.get(baseKey).push(newIndex);
                    }
                }
                
                return uniquePoints;
            };
            
            // Improved sort function that sorts by angle first, then by distance if angles are similar
            const sortPointsByAngleAndDistance = (points) => {
                return points.sort((a, b) => {
                    const angleA = p5.getClockwiseAngle(a);
                    const angleB = p5.getClockwiseAngle(b);
                    
                    // If angles are approximately the same (within tolerance)
                    if (Math.abs(angleA - angleB) < tolerance) {
                        // Sort by distance from center
                        const distA = Math.sqrt(a.x ** 2 + a.y ** 2);
                        const distB = Math.sqrt(b.x ** 2 + b.y ** 2);
                        return distA - distB;
                    }
                    
                    // Otherwise sort by angle
                    return angleA - angleB;
                });
            };
            
            let result;
            
            // cetroid
            if (type === 'c') {
                // Map centroids, already sorted by default
                let centroids = nodes.map(node => node.centroid);
                
                // Deduplicate
                let unique_centroids = deduplicatePoints(centroids);

                // Sort by angle, then by distance if angles are similar
                let sorted_centroids = sortPointsByAngleAndDistance(unique_centroids);

                result = sorted_centroids[index - 1];
                console.log(`find_origin (${type}${index}): Found ${unique_centroids.length} unique centroids`);
            } 
            
            // halfway
            else if (type === 'h') {
                let halfways = nodes.map(node => node.halfways).flat();
                
                // Deduplicate
                let unique_halfways = deduplicatePoints(halfways);

                // Sort by angle, then by distance if angles are similar
                let sorted_halfways = sortPointsByAngleAndDistance(unique_halfways);

                result = sorted_halfways[index - 1];
                console.log(`find_origin (${type}${index}): Found ${unique_halfways.length} unique halfways`);
            } 
            
            // vertex
            else if (type === 'v') {
                let vertices = nodes.map(node => node.vertices).flat();
                
                // Deduplicate
                let unique_vertices = deduplicatePoints(vertices);

                // Sort by angle, then by distance if angles are similar
                let sorted_vertices = sortPointsByAngleAndDistance(unique_vertices);

                result = sorted_vertices[index - 1];
                console.log(`find_origin (${type}${index}): Found ${unique_vertices.length} unique vertices`);
            }
            
            const endTime = performance.now();
            console.timeEnd(`find_origin (${type}${index})`);
            console.log(`find_origin (${type}${index}): ${(endTime - startTime).toFixed(2)}ms`);
            
            return result;
        }

        p5.setupGameOfLife = () => {
            for (let i = 0; i < graph.nodes.length; i++) {
                graph.nodes[i].alive = Math.random() < 0.5;
            }
        }

        p5.updateGameOfLife = () => {
            for (let i = 0; i < graph.nodes.length; i++) {
                let alive_neighbors = graph.nodes[i].neighbors.filter(neighbor => neighbor.alive).length;
                
                if (graph.nodes[i].alive) {
                    if (!survival.includes(alive_neighbors)) {
                        graph.nodes[i].alive = false;
                    }
                } else {
                    if (birth.includes(alive_neighbors)) {
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
            p5.colorMode(p5.HSB, 360, 100, 100);
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

            p5.fill(0);
            for (let i = 0; i < graph.nodes.length; i++) {
                p5.ellipse(graph.nodes[i].pos.x, graph.nodes[i].pos.y, 4);
            }
            p5.pop();
        }

        p5.apothem = (n) => {
            return side / 2 / Math.tan(Math.PI / n);
        }

        p5.getClockwiseAngle = (point) => {
            if (Math.abs(point.x) < tolerance)
                return point.y > 0 ? Math.PI / 2 : 3 * Math.PI / 2;

            let angle = Math.PI / 2 - Math.atan2(point.y, point.x);
            
            if (angle < 0) {
                angle += 2 * Math.PI;
            }
            
            return angle;
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