<script>
    import {
        RegularPolygon, StarRegularPolygon, StarParametricPolygon,
        EquilateralPolygon, StarVertexTypes, PolygonType
    } from '$classes';
    import { regularStarRegex, parametricStarRegex, regularPolygonRegex, equilateralPolygonRegex } from '$classes';
    import { Vector } from '$classes';
    import { toRadians, comparePolygonNames } from '$utils';
    import { isValidMultiple } from '$utils/filterHelpers';
    import { browser } from '$app/environment';
    import { Search, Minus, Plus, Hexagon, Network, GitFork, Puzzle } from 'lucide-svelte';

    import MultiSelect from '$components/ui/MultiSelect.svelte';
    import Checkbox from '$components/ui/Checkbox.svelte';
    import SearchInput from '$components/ui/SearchInput.svelte';
    import AngleFilterBlock from '$components/ui/AngleFilterBlock.svelte';
    import Pagination from '$components/ui/Pagination.svelte';

    const { data } = $props();

    const allPolygonNames = data.allPolygonNames ?? [];

    const COL_MIN = 3;
    const COL_MAX = 8;
    let columnsPerRow = $state(5);

    const PAGE_SIZE = 32;
    let currentPage = $state(1);

    const categoryOptions = [
        { id: PolygonType.REGULAR, label: 'Regular' },
        { id: PolygonType.STAR_REGULAR, label: 'Star Regular' },
        { id: PolygonType.STAR_PARAMETRIC, label: 'Star Parametric' },
        { id: PolygonType.EQUILATERAL, label: 'Equilateral' },
    ];

    const tagMap = {
        [PolygonType.REGULAR]: 'Reg',
        [PolygonType.STAR_REGULAR]: 'Star',
        [PolygonType.STAR_PARAMETRIC]: 'Param',
        [PolygonType.EQUILATERAL]: 'Equil',
    }

    const vertexOptions = [
        { id: StarVertexTypes.OUTER, label: 'Outer (o)' },
        { id: StarVertexTypes.INNER, label: 'Inner (i)' },
    ];

    let selectedCategories = $state([PolygonType.REGULAR, PolygonType.STAR_REGULAR, PolygonType.STAR_PARAMETRIC, PolygonType.EQUILATERAL]);
    let selectedVertexTypes = $state([StarVertexTypes.OUTER, StarVertexTypes.INNER]);
    let uniqueOnly = $state(true);

    let activeSearch = $state('');
    let filterAngleEnabled = $state(false);
    let filterAngle = $state(30);

    function isCyclicMinimum(name) {
        const eqMatch = name.match(equilateralPolygonRegex);
        if (!eqMatch) return true;
        const angles = eqMatch[2].split(';').map(Number);
        const n = angles.length;
        for (let r = 1; r < n; r++) {
            for (let j = 0; j < n; j++) {
                const a = angles[j];
                const b = angles[(j + r) % n];
                if (b < a) break;
                if (b > a) return false;
            }
        }
        return true;
    }

    const canonicalEquilateralNames = new Set(
        allPolygonNames.filter(n => n.match(equilateralPolygonRegex) && isCyclicMinimum(n))
    );

    function getCategory(name) {
        if (name.match(regularPolygonRegex)) return PolygonType.REGULAR;
        if (name.match(regularStarRegex)) return PolygonType.STAR_REGULAR;
        if (name.match(parametricStarRegex)) return PolygonType.STAR_PARAMETRIC;
        if (name.match(equilateralPolygonRegex)) return PolygonType.EQUILATERAL;
        return null;
    }

    function getVertexType(name) {
        if (name.endsWith('o}')) return StarVertexTypes.OUTER;
        if (name.endsWith('i}')) return StarVertexTypes.INNER;
        return null;
    }

    let filteredNames = $derived.by(() => {
        return allPolygonNames.filter(name => {
            if (activeSearch && !name.toLowerCase().includes(activeSearch)) return false;

            const category = getCategory(name);
            if (!category || !selectedCategories.includes(category)) return false;

            const vertexType = getVertexType(name);
            if (vertexType && !selectedVertexTypes.includes(vertexType)) return false;

            if (uniqueOnly) {
                if (vertexType === StarVertexTypes.INNER) return false;
                if (category === PolygonType.EQUILATERAL && !canonicalEquilateralNames.has(name)) return false;
            }

            if (filterAngleEnabled) {
                if (category === PolygonType.STAR_REGULAR) {
                    const m = name.match(regularStarRegex);
                    const n = parseInt(m[1]), d = parseInt(m[2]);
                    const a = 180 * (1 - 2 * d / n);
                    const b = 180 * (1 + 2 * (d - 1) / n);
                    if (!isValidMultiple(a, filterAngle) || !isValidMultiple(b, filterAngle)) return false;
                } else if (category === PolygonType.STAR_PARAMETRIC) {
                    const m = name.match(parametricStarRegex);
                    const n = parseInt(m[1]), alpha = parseInt(m[2]);
                    const b = 360 * (1 - 1 / n) - alpha;
                    if (!isValidMultiple(alpha, filterAngle) || !isValidMultiple(b, filterAngle)) return false;
                } else if (category === PolygonType.EQUILATERAL) {
                    const m = name.match(equilateralPolygonRegex);
                    const angles = m[2].split(';').map(a => parseInt(a));
                    if (angles.some(a => !isValidMultiple(a, filterAngle))) return false;
                }
            }

            return true;
        });
    });

    $effect(() => {
        filteredNames;
        currentPage = 1;
    });

    let paginatedNames = $derived(filteredNames.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));

    const polygonCache = new Map();

    function parsePolygon(name) {
        const dir = new Vector(1, 0);
        const anchor = new Vector(0, 0);

        if (name.match(regularPolygonRegex)) {
            return RegularPolygon.fromAnchorAndDir(parseInt(name), anchor, dir);
        }

        const starMatch = name.match(regularStarRegex);
        if (starMatch) {
            const [, n, d, suffix] = starMatch;
            const startsWith = suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER;
            return StarRegularPolygon.fromAnchorAndDir(parseInt(n), anchor, dir, parseInt(d), startsWith);
        }

        const paramMatch = name.match(parametricStarRegex);
        if (paramMatch) {
            const [, n, value, suffix] = paramMatch;
            const startsWith = suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER;
            return StarParametricPolygon.fromAnchorAndDir(parseInt(n), anchor, dir, toRadians(parseInt(value)), startsWith);
        }

        const eqMatch = name.match(equilateralPolygonRegex);
        if (eqMatch) {
            const [, n, angles] = eqMatch;
            return EquilateralPolygon.fromAnchorAndDir(parseInt(n), anchor, dir, angles.split(';').map(a => toRadians(parseInt(a))));
        }

        return null;
    }

    let displayedPolygons = $derived.by(() => {
        if (!browser) return [];
        let names = paginatedNames.map(name => {
            if (!polygonCache.has(name)) {
                try {
                    polygonCache.set(name, { name, polygon: parsePolygon(name) });
                } catch {
                    polygonCache.set(name, { name, polygon: null });
                }
            }
            return polygonCache.get(name);
        });

        names.sort((a, b) => comparePolygonNames(a.name, b.name));
        return names;
    });

    function hsbToHsl(h, s, b) {
        s /= 100;
        b /= 100;
        const l = b * (1 - s / 2);
        const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
        return { h, s: sl * 100, l: l * 100 };
    }

    function initCanvas(canvas, polygonData) {
        let resizeObserver;

        function render() {
            if (polygonData) drawPolygon(canvas, polygonData);
        }

        requestAnimationFrame(render);

        resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(render);
        });
        resizeObserver.observe(canvas);

        return {
            update(newData) {
                polygonData = newData;
                requestAnimationFrame(render);
            },
            destroy() {
                resizeObserver?.disconnect();
            }
        };
    }

    function drawPolygon(canvas, polygon) {
        const size = canvas.clientWidth || 220;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, size, size);

        if (!polygon.vertices || polygon.vertices.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const v of polygon.vertices) {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
        }
        if (!isFinite(minX)) return;

        const padding = 20;
        const availableSize = size - 2 * padding;
        const dataWidth = maxX - minX || 1;
        const dataHeight = maxY - minY || 1;
        const scale = Math.min(availableSize / dataWidth, availableSize / dataHeight);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.scale(scale, -scale);
        ctx.translate(-centerX, -centerY);

        const hsl = hsbToHsl(polygon.hue ?? 200, 40, 100);
        ctx.fillStyle = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        ctx.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
        for (let i = 1; i < polygon.vertices.length; i++) {
            ctx.lineTo(polygon.vertices[i].x, polygon.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw vertex at anchor point (first vertex)
        ctx.fillStyle = 'rgba(74, 222, 128, 0.9)';
        ctx.beginPath();
        ctx.arc(polygon.vertices[0].x, polygon.vertices[0].y, 3 / scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
</script>

<div class="min-h-screen bg-zinc-900 text-white flex flex-col">
    <!-- Header -->
    <div class="border-b border-zinc-800 bg-zinc-900 backdrop-blur-sm sticky top-0 z-20">
        <div class="max-w-[1600px] mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <Hexagon size={20} />
                    <h1 class="text-lg font-semibold text-white/90">Polygon Collection</h1>
                    <span class="count-badge">{filteredNames.length}</span>
                </div>
                <nav class="flex items-center gap-1">
                    <a href="/polygons-collection" class="nav-link nav-link-active">
                        <Hexagon size={14} />
                        <span>Polygons</span>
                    </a>
                    <a href="/vertex-configurations" class="nav-link">
                        <Network size={14} />
                        <span>Vertex Configs</span>
                    </a>
                    <a href="/compatibility-graph" class="nav-link">
                        <GitFork size={14} />
                        <span>Compat. Graph</span>
                    </a>
                    <a href="/seed-configurations" class="nav-link">
                        <Puzzle size={14} />
                        <span>Seed Configs</span>
                    </a>
                </nav>
            </div>
        </div>
    </div>

    <div class="flex-1 max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row">
        <!-- Sidebar filters -->
        <aside class="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/50">
            <div class="p-5 flex flex-col gap-6 lg:sticky lg:top-[65px] lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto">
                <SearchInput bind:activeSearch />

                <!-- Category filter -->
                <div class="border-t border-zinc-800 pt-5">
                    <MultiSelect
                        label="Category"
                        options={categoryOptions}
                        bind:selected={selectedCategories}
                    />
                </div>

                <!-- Vertex type filter (outer/inner) -->
                {#if selectedCategories.includes(PolygonType.STAR_REGULAR) || selectedCategories.includes(PolygonType.STAR_PARAMETRIC)}
                    <div class="border-t border-zinc-800 pt-5">
                        <MultiSelect
                            label="Vertex Type"
                            options={vertexOptions}
                            bind:selected={selectedVertexTypes}
                        />
                    </div>
                {/if}

                <!-- Unique filter -->
                {#if selectedCategories.includes(PolygonType.STAR_REGULAR) || selectedCategories.includes(PolygonType.STAR_PARAMETRIC) || selectedCategories.includes(PolygonType.EQUILATERAL)}
                    <div class="border-t border-zinc-800 pt-5">
                        <Checkbox
                            id="uniqueOnly"
                            label="Unique only"
                            bind:checked={uniqueOnly}
                        />
                        <p class="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                            Keep only outer star variants and cyclic-minimum equilateral polygons.
                        </p>
                    </div>

                    <!-- Angle filter -->
                    <div class="border-t border-zinc-800 pt-5">
                        <AngleFilterBlock bind:enabled={filterAngleEnabled} bind:angle={filterAngle} />
                    </div>
                {/if}

                <!-- Per Row -->
                <div class="border-t border-zinc-800 pt-5">
                    <div class="flex flex-col gap-2">
                        <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Per Row</span>
                        <div class="flex items-center gap-2 justify-center">
                            <button
                                class="p-1 rounded-md border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                onclick={() => columnsPerRow = Math.max(COL_MIN, columnsPerRow - 1)}
                                disabled={columnsPerRow <= COL_MIN}
                                aria-label="Fewer columns"
                            >
                                <Minus size={14} />
                            </button>
                            <div class="flex gap-1 flex-1 justify-center">
                                {#each Array.from({ length: COL_MAX - COL_MIN + 1 }, (_, i) => i + COL_MIN) as n}
                                    <button
                                        class="w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-all border
                                            {columnsPerRow === n
                                                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                                : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 hover:bg-zinc-700/50 hover:text-zinc-300'}"
                                        onclick={() => columnsPerRow = n}
                                    >
                                        {n}
                                    </button>
                                {/each}
                            </div>
                            <button
                                class="p-1 rounded-md border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                onclick={() => columnsPerRow = Math.min(COL_MAX, columnsPerRow + 1)}
                                disabled={columnsPerRow >= COL_MAX}
                                aria-label="More columns"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Stats -->
                <div class="border-t border-zinc-800 pt-5">
                    <div class="flex flex-col gap-1.5 text-xs text-zinc-500">
                        <div class="flex justify-between">
                            <span>Total in dataset</span>
                            <span class="text-zinc-400">{allPolygonNames.length}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Matching filters</span>
                            <span class="text-green-400 font-medium">{filteredNames.length}</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Grid -->
        <main class="flex-1 min-w-0">
            {#if filteredNames.length === 0}
                <div class="flex flex-col items-center justify-center h-64 text-zinc-600">
                    <Search size={32} class="mb-3 opacity-50" />
                    <p class="text-sm">No polygons match your filters.</p>
                    <p class="text-xs mt-1 text-zinc-700">Try adjusting your search or category selection.</p>
                </div>
            {:else}
                <div class="p-5 flex flex-col gap-4">
                    <Pagination totalItems={filteredNames.length} pageSize={PAGE_SIZE} bind:currentPage />

                    <div
                        class="grid gap-3"
                        style="grid-template-columns: repeat({columnsPerRow}, minmax(0, 1fr));"
                    >
                        {#each displayedPolygons as { name, polygon }, i (name + i)}
                            {@const globalIndex = (currentPage - 1) * PAGE_SIZE + i}
                            {@const category = getCategory(name)}
                            <div class="polygon-card group">
                                <div class="polygon-card-header">
                                    <span class="polygon-index">{globalIndex + 1}</span>
                                    <span class="truncate" title={name}>{name}</span>
                                    <span class="category-tag category-{category}">{tagMap[category]}</span>
                                </div>
                                {#if polygon}
                                    <canvas
                                        use:initCanvas={polygon}
                                        class="block w-full aspect-square"
                                    ></canvas>
                                {:else}
                                    <div
                                        class="flex items-center justify-center text-zinc-600 text-xs w-full aspect-square"
                                    >
                                        Could not parse
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>

                    <Pagination totalItems={filteredNames.length} pageSize={PAGE_SIZE} bind:currentPage />
                </div>
            {/if}
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

    .polygon-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid rgba(63, 63, 70, 0.3);
        background-color: rgba(39, 39, 42, 0.3);
        transition: border-color 0.15s ease;
    }

    .polygon-card:hover {
        border-color: rgba(113, 113, 122, 0.4);
    }

    .polygon-card-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.7rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(161, 161, 170, 1);
        background-color: rgba(39, 39, 42, 0.5);
        border-bottom: 1px solid rgba(63, 63, 70, 0.25);
        transition: color 0.15s ease;
    }

    .polygon-card:hover .polygon-card-header {
        color: rgba(228, 228, 231, 1);
    }

    .polygon-index {
        font-size: 0.6rem;
        color: rgba(113, 113, 122, 0.7);
        min-width: 1.25rem;
        text-align: right;
        flex-shrink: 0;
    }

    .category-tag {
        margin-left: auto;
        font-size: 0.55rem;
        padding: 0.05rem 0.4rem;
        border-radius: 0.75rem;
        font-family: system-ui, sans-serif;
        font-weight: 500;
        letter-spacing: 0.02em;
        flex-shrink: 0;
    }

    .category-regular {
        color: rgba(96, 165, 250, 0.9);
        background-color: rgba(96, 165, 250, 0.1);
    }

    .category-star_regular {
        color: rgba(251, 191, 36, 0.9);
        background-color: rgba(251, 191, 36, 0.1);
    }

    .category-star_parametric {
        color: rgba(244, 114, 182, 0.9);
        background-color: rgba(244, 114, 182, 0.1);
    }

    .category-equilateral {
        color: rgba(52, 211, 153, 0.9);
        background-color: rgba(52, 211, 153, 0.1);
    }
</style>
