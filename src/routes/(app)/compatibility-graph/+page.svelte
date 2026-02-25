<script lang="ts">
    import { VertexConfiguration, CompatibilityGraph, VCNode, regularPolygonRegex, regularStarRegex, parametricStarRegex, equilateralPolygonRegex, PolygonType } from '$classes';
    import { browser } from '$app/environment';
    import { Vector } from '$classes/Vector.svelte';
    import { onMount } from 'svelte';
    import { Hexagon, Network, GitFork, Puzzle, ChevronRight, SlidersHorizontal } from 'lucide-svelte';
    import { isValidMultiple } from '$utils/filterHelpers';

    import MultiSelect from '$components/ui/MultiSelect.svelte';
    import SearchInput from '$components/ui/SearchInput.svelte';
    import AngleFilterBlock from '$components/ui/AngleFilterBlock.svelte';
	import Checkbox from '$components/ui/Checkbox.svelte';

    import allVCNames from '$lib/classes/algorithm/vcs.json';
    import adjacencyListData from '$lib/classes/algorithm/compatibilityGraph.json';

    const adjacencyList: Record<string, string[]> = adjacencyListData as any;

    const categoryOptions = [
        { id: PolygonType.REGULAR, label: 'Regular' },
        { id: PolygonType.STAR_REGULAR, label: 'Star Regular' },
        { id: PolygonType.STAR_PARAMETRIC, label: 'Star Parametric' },
        { id: PolygonType.EQUILATERAL, label: 'Equilateral' },
    ];

    let selectedCategories = $state([PolygonType.REGULAR]);
    let activeSearch = $state('');
    let filterAngleEnabled = $state(false);
    let filterAngle = $state(30);
    let showNames = $state(false);

    let filteredNames = $derived.by(() => {
        return allVCNames.filter(name => {
            if (activeSearch && !name.toLowerCase().includes(activeSearch)) return false;
            const parts = name.split(',');
            for (const p of parts) {
                if (p.match(regularPolygonRegex)) {
                    if (!selectedCategories.includes(PolygonType.REGULAR)) return false;
                } else {
                    const regularStarMatch = p.match(regularStarRegex);
                    if (regularStarMatch) {
                        if (!selectedCategories.includes(PolygonType.STAR_REGULAR)) return false;
                        const n = parseInt(regularStarMatch[1]);
                        const d = parseInt(regularStarMatch[2]);
                        const a = 180 * (1 - 2 * d / n);
                        const b = 180 * (1 + 2 * (d - 1) / n);
                        if (filterAngleEnabled && (!isValidMultiple(a, filterAngle) || !isValidMultiple(b, filterAngle))) return false;
                    } else {
                        const parametricStarMatch = p.match(parametricStarRegex);
                        if (parametricStarMatch) {
                            if (!selectedCategories.includes(PolygonType.STAR_PARAMETRIC)) return false;
                            const n = parseInt(parametricStarMatch[1]);
                            const alpha = parseInt(parametricStarMatch[2]);
                            const bb = 360 * (1 - 1 / n) - alpha;
                            if (filterAngleEnabled && (!isValidMultiple(alpha, filterAngle) || !isValidMultiple(bb, filterAngle))) return false;
                        } else {
                            const equilateralMatch = p.match(equilateralPolygonRegex);
                            if (equilateralMatch) {
                                if (!selectedCategories.includes(PolygonType.EQUILATERAL)) return false;
                                const angles = equilateralMatch[2].split(';').map(a => parseInt(a));
                                if (filterAngleEnabled && angles.some(a => !isValidMultiple(a, filterAngle))) return false;
                            } else {
                                return false;
                            }
                        }
                    }
                }
            }
            return true;
        });
    });

    // --- Physics parameters (tunable) ---
    let nodeRadius = $state(100);
    let repulsionExp = $state(0);
    let attractionExp = $state(-6);
    let gravityExp = $state(-7);
    let dampingVal = $state(0.90);
    let bhTheta = $state(1.0);
    let physicsOpen = $state(false);

    const REST_LENGTH = 50;
    const MIN_DISTANCE = 50;
    const DEFAULT_ZOOM = 0.3;

    let REPULSION = $derived(Math.pow(10, repulsionExp));
    let ATTRACTION = $derived(Math.pow(10, attractionExp));
    let CENTER_GRAVITY = $derived(Math.pow(10, gravityExp));

    const getAttractionFactor = (dist: number, numNodes: number): number => {
        return ATTRACTION * dist;
    }

    const getRepulsionFactor = (dist: number, degA: number, degB: number, numNodes: number): number => {
        return -REPULSION * (degA + 1) * (degB + 1) / dist;
    }

    const getGravityFactor = (dist: number, degree: number): number => {
        return CENTER_GRAVITY * (degree + 1) * dist;
    }

    const getRadius = (numNeighbors: number): number => {
        return nodeRadius * Math.log10(numNeighbors + 2);
    }

    const getCenterOfMass = (nodes: VCNode[]): Vector => {
        let center = new Vector(0, 0);
        for (const node of nodes) {
            center.add(node.pos);
        }
        center.scale(1 / nodes.length);
        return center;
    }

    // --- Canvas & camera ---
    let canvasEl;
    let containerEl;
    let animationId;

    let zoom = DEFAULT_ZOOM;
    let targetZoom = DEFAULT_ZOOM;
    let offset = new Vector(0, 0);
    let targetOffset = new Vector(0, 0);
    const CAM_DAMP = 0.15;

    // --- Interaction ---
    let isDragging = false;
    let draggedNode = null;
    let isPanning = false;
    let lastMouse = new Vector(0, 0);
    let hoveredNode = null;

    // --- Graph data ---
    let graph: CompatibilityGraph | null = null;
    let edgeCount = $state(0);
    let nodeCount = $state(0);
    let thumbnailCache = new Map();
    const vcCache = new Map();

    // Filter the pre-computed graph whenever filters change (no recomputation)
    $effect(() => {
        if (!browser) return;

        const vcs: VertexConfiguration[] = [];
        for (const name of filteredNames) {
            if (!vcCache.has(name)) {
                try { vcCache.set(name, VertexConfiguration.fromName(name)); }
                catch { vcCache.set(name, null); }
            }
            const vc = vcCache.get(name);
            if (vc) vcs.push(vc);
        }

        graph = CompatibilityGraph.fromAdjacencyList(adjacencyList, vcs);

        let edges = 0;
        for (const node of graph.nodes) edges += node.neighbors.length;
        edgeCount = edges / 2;
        nodeCount = graph.nodes.length;

        const layoutRadius = Math.max(300, graph.nodes.length * 50);
        const angles = Array.from({ length: graph.nodes.length }, (_, i) => i).sort((a, b) => Math.random() - 0.5)
        for (let i = 0; i < graph.nodes.length; i++) {
            graph.nodes[i].pos = Vector.fromPolar(layoutRadius, angles[i]);
            graph.nodes[i].radius = getRadius(graph.nodes[i].neighbors.length);

            const vcName = graph.nodes[i].vertexConfiguration.name;
            if (!thumbnailCache.has(vcName)) {
                thumbnailCache.set(vcName, renderThumbnail(graph.nodes[i].vertexConfiguration));
            }
            graph.nodes[i].thumbnail = thumbnailCache.get(vcName);
        }

        targetOffset.set(0, 0);
        targetZoom = DEFAULT_ZOOM;
    });

    // --- Thumbnail rendering ---
    function hsbToHsl(h, s, b) {
        s /= 100;
        b /= 100;
        const l = b * (1 - s / 2);
        const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
        return { h, s: sl * 100, l: l * 100 };
    }

    function renderThumbnail(vc) {
        const size = nodeRadius * 2;
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();

        if (!vc.polygons || vc.polygons.length === 0) return canvas;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const polygon of vc.polygons) {
            if (!polygon.vertices) continue;
            for (const v of polygon.vertices) {
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            }
        }
        if (!isFinite(minX)) return canvas;

        const padding = nodeRadius / 2.5;
        const avail = size - 2 * padding;
        const dw = maxX - minX || 1;
        const dh = maxY - minY || 1;
        const sc = Math.min(avail / dw, avail / dh);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.clip();

        ctx.translate(size / 2, size / 2);
        ctx.scale(sc, -sc);
        ctx.translate(-cx, -cy);

        for (const polygon of vc.polygons) {
            if (!polygon.vertices || polygon.vertices.length === 0) continue;
            const hsl = hsbToHsl(polygon.hue, 40, 100);
            ctx.fillStyle = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1.5 / sc;
            ctx.beginPath();
            ctx.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
            for (let k = 1; k < polygon.vertices.length; k++)
                ctx.lineTo(polygon.vertices[k].x, polygon.vertices[k].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
        return canvas;
    }

    // --- Barnes-Hut quadtree ---
    class BHCell {
        x: number; y: number; size: number;
        cx = 0; cy = 0;
        mass = 0;
        count = 0;
        body: VCNode | null = null;
        children: BHCell[] | null = null;

        constructor(x: number, y: number, size: number) {
            this.x = x; this.y = y; this.size = size;
        }

        insert(node: VCNode, depth = 0): void {
            const m = node.neighbors.length + 1;

            if (this.count === 0) {
                this.body = node;
                this.cx = node.pos.x;
                this.cy = node.pos.y;
                this.mass = m;
                this.count = 1;
                return;
            }

            const newMass = this.mass + m;
            this.cx = (this.cx * this.mass + node.pos.x * m) / newMass;
            this.cy = (this.cy * this.mass + node.pos.y * m) / newMass;
            this.mass = newMass;
            this.count++;

            if (depth > 40) return;

            if (this.children === null) {
                this.children = this._subdivide();
                this._insertChild(this.body!, depth);
                this.body = null;
            }

            this._insertChild(node, depth);
        }

        _subdivide(): BHCell[] {
            const hs = this.size / 2;
            return [
                new BHCell(this.x,      this.y,      hs),
                new BHCell(this.x + hs, this.y,      hs),
                new BHCell(this.x,      this.y + hs, hs),
                new BHCell(this.x + hs, this.y + hs, hs),
            ];
        }

        _insertChild(node: VCNode, depth: number): void {
            const midX = this.x + this.size / 2;
            const midY = this.y + this.size / 2;
            const idx = (node.pos.x >= midX ? 1 : 0) + (node.pos.y >= midY ? 2 : 0);
            this.children![idx].insert(node, depth + 1);
        }

        computeForce(node: VCNode, thetaSq: number, repulsion: number): void {
            if (this.count === 0) return;
            if (this.count === 1 && this.body === node) return;

            const dx = this.cx - node.pos.x;
            const dy = this.cy - node.pos.y;
            const distSq = dx * dx + dy * dy;

            if (this.children === null || this.size * this.size < thetaSq * distSq) {
                const dist = Math.sqrt(distSq) || 1e-6;
                const f = -repulsion * (node.neighbors.length + 1) * this.mass / dist;
                node.force.x += (dx / dist) * f;
                node.force.y += (dy / dist) * f;
                return;
            }

            for (const child of this.children) {
                child.computeForce(node, thetaSq, repulsion);
            }
        }
    }

    function buildBHTree(nodes: VCNode[]): BHCell {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
            if (n.pos.x < minX) minX = n.pos.x;
            if (n.pos.y < minY) minY = n.pos.y;
            if (n.pos.x > maxX) maxX = n.pos.x;
            if (n.pos.y > maxY) maxY = n.pos.y;
        }
        const size = Math.max(maxX - minX, maxY - minY, 1) + 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const root = new BHCell(cx - size / 2, cy - size / 2, size);
        for (const n of nodes) root.insert(n);
        return root;
    }

    // --- Physics simulation ---
    function simulate() {
        if (!graph || graph.nodes.length === 0) return;
        const nodes = graph.nodes;

        for (const n of nodes) {
            n.radius = getRadius(n.neighbors.length);
            n.resetForce();
        }

        // FORCE ATLAS 2
        for (let i = 0; i < nodes.length; i++) {
            for (const nb of nodes[i].neighbors) {
                if (nb.index <= i) continue;
                const delta = Vector.sub(nb.pos, nodes[i].pos);
                const dist = Math.max(delta.mag() - nodes[i].radius - nb.radius, delta.mag());
                const force = Vector.scale(delta, getAttractionFactor(dist, nodes.length));
                nodes[i].force.add(force);
                nb.force.sub(force);
            }
        }

        const tree = buildBHTree(nodes);
        const thetaSq = bhTheta * bhTheta;
        for (const n of nodes) {
            tree.computeForce(n, thetaSq, REPULSION);
        }

        // Gentle pull toward center
        for (const n of nodes) {
            n.force.sub(Vector.scale(n.pos, getGravityFactor(n.pos.mag(), n.neighbors.length)));
        }

        // Euler integration with damping
        for (const n of nodes) {
            if (n.pinned) continue;
            n.vel.add(n.force);
            n.vel.scale(dampingVal);
            n.pos.add(n.vel);

            n.pos.sub(getCenterOfMass(nodes));
        }
    }

    // --- Canvas rendering ---
    function render() {
        if (!canvasEl || canvasEl.width === 0) return;
        const ctx = canvasEl.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = new Vector(canvasEl.width / dpr, canvasEl.height / dpr);

        zoom += (targetZoom - zoom) * CAM_DAMP;
        offset.add(Vector.sub(targetOffset, offset).scale(CAM_DAMP));

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, size.x, size.y);

        if (!graph || graph.nodes.length === 0) {
            ctx.fillStyle = '#71717a';
            ctx.font = '14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No nodes to display', size.x / 2, size.y / 2);
            return;
        }

        ctx.save();
        ctx.translate(size.x / 2 + offset.x, size.y / 2 + offset.y);
        ctx.scale(zoom, zoom);

        const nodes = graph.nodes;

        // Draw edges
        for (let i = 0; i < nodes.length; i++) {
            for (const nb of nodes[i].neighbors) {
                if (nb.index <= i) continue;
                const hl = hoveredNode && (hoveredNode === nodes[i] || hoveredNode === nb);
                ctx.strokeStyle = hl ? '#4ade80' : 'rgba(128, 128, 128, 0.15)';
                ctx.lineWidth = (hl ? 2.5 : 1) / zoom;
                ctx.beginPath();
                ctx.moveTo(nodes[i].pos.x, nodes[i].pos.y);
                ctx.lineTo(nb.pos.x, nb.pos.y);
                ctx.stroke();
            }
        }

        // Draw nodes
        for (const node of nodes) {
            const isHov = hoveredNode === node;
            const isNb = hoveredNode !== null && hoveredNode.neighbors.includes(node);
            const dim = hoveredNode !== null && !isHov && !isNb;

            ctx.save();
            if (dim) ctx.globalAlpha = 0.25;

            if (node.thumbnail) {
                const sz = node.radius * 2;
                ctx.drawImage(node.thumbnail, node.pos.x - node.radius, node.pos.y - node.radius, sz, sz);
            }

            ctx.strokeStyle = isHov ? '#4ade80' : isNb ? '#86efac' : 'rgba(161,161,170,0.4)';
            ctx.lineWidth = (isHov ? 3 : isNb ? 2 : 1.5) / zoom;
            ctx.beginPath();
            ctx.arc(node.pos.x, node.pos.y, node.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();

            // Label with clamped screen-size
            if (!dim && showNames) {
                const minScreenPx = 8;
                const worldSize = 10;
                const fs = Math.max(worldSize, minScreenPx / zoom);
                ctx.font = `${fs}px ui-monospace, monospace`;
                ctx.fillStyle = isHov ? '#ffffff' : '#a1a1aa';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(node.vertexConfiguration.name, node.pos.x, node.pos.y + node.radius + 4 / zoom);
            }
        }

        ctx.restore();
    }

    function loop() {
        simulate();
        render();
        animationId = requestAnimationFrame(loop);
    }

    // --- Canvas sizing ---
    function resizeCanvas() {
        if (!canvasEl || !containerEl) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = containerEl.getBoundingClientRect();
        canvasEl.width = rect.width * dpr;
        canvasEl.height = rect.height * dpr;
        canvasEl.style.width = `${rect.width}px`;
        canvasEl.style.height = `${rect.height}px`;
    }

    // --- Coordinate helpers ---
    function screenToWorld(screen: Vector) {
        const dpr = window.devicePixelRatio || 1;
        const size = new Vector(canvasEl.width / dpr, canvasEl.height / dpr);
        return new Vector(
            (screen.x - size.x / 2 - offset.x) / zoom,
            (screen.y - size.y / 2 - offset.y) / zoom
        );
    }

    function findNodeAt(world: Vector) {
        if (!graph) return null;
        for (let i = graph.nodes.length - 1; i >= 0; i--) {
            const n = graph.nodes[i];
            const dx = n.pos.x - world.x, dy = n.pos.y - world.y;
            if (dx * dx + dy * dy <= n.radius * n.radius) return n;
        }
        return null;
    }

    // --- Event handlers ---
    function handleMouseDown(e) {
        if (e.target !== canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        const screen = new Vector(e.clientX - rect.left, e.clientY - rect.top);

        if (e.button === 2) {
            e.preventDefault();
            targetOffset.set(0, 0);
            targetZoom = DEFAULT_ZOOM;
            return;
        }

        if (e.button === 0) {
            const world = screenToWorld(screen);
            const node = findNodeAt(world);
            if (node) {
                draggedNode = node;
                node.pinned = true;
                isDragging = true;
            } else {
                isPanning = true;
            }
            lastMouse.set(screen);
        }
    }

    function handleMouseMove(e) {
        if (!canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        const screen = new Vector(e.clientX - rect.left, e.clientY - rect.top);

        if (isDragging && draggedNode) {
            const world = screenToWorld(screen);
            draggedNode.pos.set(world);
            draggedNode.vel.set(0, 0);
        } else if (isPanning) {
            const delta = Vector.sub(screen, lastMouse);
            targetOffset.add(delta);
            offset.add(delta);
            lastMouse.set(screen);
        } else {
            const world = screenToWorld(screen);
            hoveredNode = findNodeAt(world);
            canvasEl.style.cursor = hoveredNode ? 'grab' : 'default';
        }
    }

    function handleMouseUp() {
        if (draggedNode) { draggedNode.pinned = false; draggedNode = null; }
        isDragging = false;
        isPanning = false;
    }

    function handleWheel(e) {
        e.preventDefault();
        const rect = canvasEl.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const halfSize = new Vector(canvasEl.width / dpr / 2, canvasEl.height / dpr / 2);

        // Mouse position relative to canvas center (matches the ctx.translate in render)
        const mouse = new Vector(e.clientX - rect.left - halfSize.x, e.clientY - rect.top - halfSize.y);

        // World coordinate under mouse, using target values (not animated)
        const world = Vector.scale(Vector.sub(mouse, targetOffset), 1 / targetZoom);

        if (e.deltaY > 0) targetZoom = Math.max(targetZoom / 1.1, 0.05);
        else targetZoom = Math.min(targetZoom * 1.1, 10);

        // Where the same world point would now appear (center-relative)
        const newMouse = Vector.add(Vector.scale(world, targetZoom), targetOffset);

        // Adjust offset so the world point stays under the cursor
        targetOffset.add(Vector.sub(mouse, newMouse));
    }

    onMount(() => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        canvasEl.addEventListener('wheel', handleWheel, { passive: false });
        loop();
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            canvasEl.removeEventListener('wheel', handleWheel);
            if (animationId) cancelAnimationFrame(animationId);
        };
    });
</script>

<div class="h-screen flex flex-col bg-zinc-900 text-white overflow-hidden">
    <!-- Header -->
    <div class="border-b border-zinc-800 bg-zinc-900 backdrop-blur-sm sticky top-0 z-20 shrink-0">
        <div class="max-w-[1600px] mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <GitFork size={20} />
                    <h1 class="text-lg font-semibold text-white/90">Compatibility Graph</h1>
                    <span class="count-badge">{nodeCount} nodes · {edgeCount} edges</span>
                </div>
                <nav class="flex items-center gap-1">
                    <a href="/polygons-collection" class="nav-link">
                        <Hexagon size={14} />
                        <span>Polygons</span>
                    </a>
                    <a href="/vertex-configurations" class="nav-link">
                        <Network size={14} />
                        <span>Vertex Configs</span>
                    </a>
                    <a href="/compatibility-graph" class="nav-link nav-link-active">
                        <GitFork size={14} />
                        <span>Compat. Graph</span>
                    </a>
                    <a href="/seed-configurations" class="nav-link">
                        <Puzzle size={14} />
                        <span>Seed Configs</span>
                    </a>
                </nav>
            </div>
            <p class="mt-1.5 text-xs text-zinc-600">
                Scroll to zoom · Drag to pan · Right-click to reset · Drag nodes to reposition
            </p>
        </div>
    </div>

    <div class="flex-1 flex min-h-0 max-w-[1600px] w-full mx-auto">
        <!-- Sidebar -->
        <aside class="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
            <div class="p-5 flex flex-col gap-6 lg:overflow-y-auto">
                <SearchInput bind:activeSearch placeholder="Filter by name..." />

                <div class="border-t border-zinc-800 pt-5">
                    <MultiSelect
                        label="Category"
                        options={categoryOptions}
                        bind:selected={selectedCategories}
                    />
                </div>

                {#if selectedCategories.includes(PolygonType.STAR_REGULAR) || selectedCategories.includes(PolygonType.STAR_PARAMETRIC) || selectedCategories.includes(PolygonType.EQUILATERAL)}
                    <div class="border-t border-zinc-800 pt-5">
                        <AngleFilterBlock bind:enabled={filterAngleEnabled} bind:angle={filterAngle} />
                    </div>
                {/if}

                <div class="border-t border-zinc-800 pt-5">
                    <div class="flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Show Names</span>
                        </div>
                    
                        <Checkbox
                            id="showNames"
                            label="Show names"
                            bind:checked={showNames}
                        />
                    </div>
                </div>

                <div class="border-t border-zinc-800 pt-5">
                    <button
                        class="flex items-center gap-2 w-full text-left text-xs uppercase text-zinc-400 font-medium tracking-wider hover:text-zinc-300 transition-colors"
                        onclick={() => physicsOpen = !physicsOpen}
                    >
                        <ChevronRight size={12} class="transition-transform duration-200 {physicsOpen ? 'rotate-90' : ''}" />
                        <SlidersHorizontal size={12} />
                        Simulation
                    </button>

                    {#if physicsOpen}
                        <div class="mt-4 flex flex-col gap-4">
                            <div class="sim-param">
                                <div class="sim-param-header">
                                    <span>Node Radius</span>
                                    <span class="sim-param-value">{nodeRadius}</span>
                                </div>
                                <input type="range" bind:value={nodeRadius} min={10} max={300} step={5} class="sim-slider" />
                            </div>

                            <div class="sim-param">
                                <div class="sim-param-header">
                                    <span>Repulsion</span>
                                    <span class="sim-param-value">{REPULSION.toExponential(1)}</span>
                                </div>
                                <input type="range" bind:value={repulsionExp} min={-5} max={1} step={0.1} class="sim-slider" />
                            </div>

                            <div class="sim-param">
                                <div class="sim-param-header">
                                    <span>Attraction</span>
                                    <span class="sim-param-value">{ATTRACTION.toExponential(1)}</span>
                                </div>
                                <input type="range" bind:value={attractionExp} min={-9} max={-3} step={0.1} class="sim-slider" />
                            </div>

                            <div class="sim-param">
                                <div class="sim-param-header">
                                    <span>Gravity</span>
                                    <span class="sim-param-value">{CENTER_GRAVITY.toExponential(1)}</span>
                                </div>
                                <input type="range" bind:value={gravityExp} min={-10} max={-3} step={0.1} class="sim-slider" />
                            </div>

                            <div class="sim-param">
                                <div class="sim-param-header">
                                    <span>Damping</span>
                                    <span class="sim-param-value">{dampingVal.toFixed(2)}</span>
                                </div>
                                <input type="range" bind:value={dampingVal} min={0.1} max={0.99} step={0.01} class="sim-slider" />
                            </div>

                            <div class="sim-param">
                                <div class="sim-param-header">
                                    <span>BH Theta</span>
                                    <span class="sim-param-value">{bhTheta.toFixed(1)}</span>
                                </div>
                                <input type="range" bind:value={bhTheta} min={0.3} max={3.0} step={0.1} class="sim-slider" />
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="border-t border-zinc-800 pt-5">
                    <div class="flex flex-col gap-1.5 text-xs text-zinc-500">
                        <div class="flex justify-between">
                            <span>Total in dataset</span>
                            <span class="text-zinc-400">{allVCNames.length}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Matching filters</span>
                            <span class="text-green-400 font-medium">{filteredNames.length}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Nodes</span>
                            <span class="text-green-400 font-medium">{nodeCount}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Edges</span>
                            <span class="text-green-400 font-medium">{edgeCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Graph canvas -->
        <main class="flex-1 min-w-0 relative" bind:this={containerEl}>
            <canvas
                bind:this={canvasEl}
                onmousedown={handleMouseDown}
                onmousemove={handleMouseMove}
                onmouseup={handleMouseUp}
                onmouseleave={handleMouseUp}
                oncontextmenu={(e) => e.preventDefault()}
            ></canvas>
        </main>
    </div>
</div>

<style>
    .count-badge {
        font-size: 0.7rem;
        color: rgba(74, 222, 128, 0.9);
        padding: 0.1rem 0.5rem;
        border-radius: 1rem;
        background-color: rgba(74, 222, 128, 0.1);
        font-weight: 500;
    }

    .nav-link {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: rgba(161, 161, 170, 1);
        transition: all 0.15s ease;
        border: 1px solid transparent;
    }

    .nav-link:hover {
        color: rgba(228, 228, 231, 1);
        background-color: rgba(63, 63, 70, 0.3);
    }

    .nav-link-active {
        color: rgba(74, 222, 128, 0.9);
        background-color: rgba(74, 222, 128, 0.08);
        border-color: rgba(74, 222, 128, 0.15);
    }

    .nav-link-active:hover {
        color: rgba(74, 222, 128, 1);
        background-color: rgba(74, 222, 128, 0.12);
    }

    .sim-param {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .sim-param-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
        color: rgba(161, 161, 170, 0.8);
    }

    .sim-param-value {
        font-family: ui-monospace, monospace;
        font-size: 0.7rem;
        color: rgba(74, 222, 128, 0.9);
    }

    .sim-slider {
        width: 100%;
        height: 0.5rem;
        border-radius: 9999px;
        appearance: none;
        cursor: pointer;
        background-color: rgba(63, 63, 70, 0.7);
        accent-color: #22c55e;
    }

    .sim-slider:focus {
        outline: none;
    }
</style>
