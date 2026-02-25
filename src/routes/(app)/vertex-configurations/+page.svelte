<script>
    import { VertexConfiguration } from '$classes/algorithm';
    import { browser } from '$app/environment';
    import { regularStarRegex, parametricStarRegex, regularPolygonRegex, equilateralPolygonRegex, PolygonType } from '$classes';
    import { Search, Minus, Plus, Hexagon, Network, GitFork } from 'lucide-svelte';
    import { isValidMultiple } from '$utils/filterHelpers';

    import MultiSelect from '$components/ui/MultiSelect.svelte';
    import SearchInput from '$components/ui/SearchInput.svelte';
    import AngleFilterBlock from '$components/ui/AngleFilterBlock.svelte';
    import Pagination from '$components/ui/Pagination.svelte';

    import allVCNames from '$lib/classes/algorithm/vcs.json';

    const COL_MIN = 3;
    const COL_MAX = 8;
    let columnsPerRow = $state(4);

    const PAGE_SIZE = 32;
    let currentPage = $state(1);

    const categoryOptions = [
        { id: PolygonType.REGULAR, label: 'Regular' },
        { id: PolygonType.STAR_REGULAR, label: 'Star Regular' },
        { id: PolygonType.STAR_PARAMETRIC, label: 'Star Parametric' },
        { id: PolygonType.EQUILATERAL, label: 'Equilateral' },
    ];

    let selectedCategories = $state([PolygonType.REGULAR, PolygonType.STAR_REGULAR, PolygonType.STAR_PARAMETRIC, PolygonType.EQUILATERAL]);

    let activeSearch = $state('');
    let filterAngleEnabled = $state(false);
    let filterAngle = $state(30);

    const vcCache = new Map();

    let filteredNames = $derived.by(() => {
        return allVCNames.filter(name => {
            if (activeSearch && !name.toLowerCase().includes(activeSearch)) return false;
            const parts = name.split(',');

            for (const p of parts) {
                if (p.match(regularPolygonRegex) && selectedCategories.includes(PolygonType.REGULAR)) {
                    return true;
                }
                
                if (p.match(regularStarRegex) && selectedCategories.includes(PolygonType.STAR_REGULAR)) {
                    const regularStarMatch = p.match(regularStarRegex);
                    const n = parseInt(regularStarMatch[1]);
                    const d = parseInt(regularStarMatch[2]);
                    const a = 180 * (1 - 2 * d / n);
                    const b = 180 * (1 + 2 * (d - 1) / n);
                    if (!filterAngleEnabled || (isValidMultiple(a, filterAngle) && isValidMultiple(b, filterAngle))) 
                        return true;
                } 
            
                if (p.match(parametricStarRegex) && selectedCategories.includes(PolygonType.STAR_PARAMETRIC)) {
                    const parametricStarMatch = p.match(parametricStarRegex);
                    const n = parseInt(parametricStarMatch[1]);
                    const alpha = parseInt(parametricStarMatch[2]);
                    const b = 360 * (1 - 1 / n) - alpha;
                    if (!filterAngleEnabled || (isValidMultiple(alpha, filterAngle) && isValidMultiple(b, filterAngle))) 
                        return true;
                } 
                
                if (p.match(equilateralPolygonRegex) && selectedCategories.includes(PolygonType.EQUILATERAL)) {
                    const equilateralPolygonMatch = p.match(equilateralPolygonRegex);
                    const angles = equilateralPolygonMatch[2].split(';').map(a => parseInt(a));
                    if (!filterAngleEnabled || angles.every(a => isValidMultiple(a, filterAngle))) 
                        return true;
                }
            }
            return false;
        });
    });

    $effect(() => {
        filteredNames;
        currentPage = 1;
    });

    let paginatedNames = $derived(filteredNames.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));

    let displayedVCs = $derived.by(() => {
        if (!browser) return [];
        return paginatedNames.map(name => {
            if (!vcCache.has(name)) {
                try {
                    vcCache.set(name, { name, vc: VertexConfiguration.fromName(name) });
                } catch {
                    vcCache.set(name, { name, vc: null });
                }
            }
            return vcCache.get(name);
        });
    });

    function hsbToHsl(h, s, b) {
        s /= 100;
        b /= 100;
        const l = b * (1 - s / 2);
        const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
        return { h, s: sl * 100, l: l * 100 };
    }

    function initCanvas(canvas, vcData) {
        let resizeObserver;

        function render() {
            if (vcData) drawVC(canvas, vcData);
        }

        requestAnimationFrame(render);

        resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(render);
        });
        resizeObserver.observe(canvas);

        return {
            update(newVcData) {
                vcData = newVcData;
                requestAnimationFrame(render);
            },
            destroy() {
                resizeObserver?.disconnect();
            }
        };
    }

    function drawVC(canvas, vc) {
        const size = canvas.clientWidth || 220;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, size, size);

        if (!vc.polygons || vc.polygons.length === 0) return;
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

        if (!isFinite(minX)) return;

        const padding = 16;
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

        for (const polygon of vc.polygons) {
            if (!polygon.vertices || polygon.vertices.length === 0) continue;
            const hsl = hsbToHsl(polygon.hue, 40, 100);
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
        }

        ctx.restore();
    }
</script>

<div class="min-h-screen bg-zinc-900 text-white flex flex-col">
    <!-- Header -->
    <div class="border-b border-zinc-800 bg-zinc-900 backdrop-blur-sm sticky top-0 z-20">
        <div class="max-w-[1600px] mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <h1 class="text-lg font-semibold text-white/90">Vertex Configurations</h1>
                    <span class="count-badge">{filteredNames.length}</span>
                </div>
                <nav class="flex items-center gap-1">
                    <a href="/polygons-collection" class="nav-link">
                        <Hexagon size={14} />
                        <span>Polygons</span>
                    </a>
                    <a href="/vertex-configurations" class="nav-link nav-link-active">
                        <Network size={14} />
                        <span>Vertex Configs</span>
                    </a>
                    <a href="/compatibility-graph" class="nav-link">
                        <GitFork size={14} />
                        <span>Compat. Graph</span>
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

                <!-- Angle filter -->
                {#if selectedCategories.includes(PolygonType.STAR_REGULAR) || selectedCategories.includes(PolygonType.STAR_PARAMETRIC) || selectedCategories.includes(PolygonType.EQUILATERAL)}
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
                            <span class="text-zinc-400">{allVCNames.length}</span>
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
                    <p class="text-sm">No vertex configurations match your filters.</p>
                    <p class="text-xs mt-1 text-zinc-700">Try adjusting your search or category selection.</p>
                </div>
            {:else}
                <div class="p-5 flex flex-col gap-4">
                    <Pagination totalItems={filteredNames.length} pageSize={PAGE_SIZE} bind:currentPage />

                    <div
                        class="grid gap-3"
                        style="grid-template-columns: repeat({columnsPerRow}, minmax(0, 1fr));"
                    >
                        {#each displayedVCs as { name, vc }, i (name + i)}
                            {@const globalIndex = (currentPage - 1) * PAGE_SIZE + i}
                            <div class="vc-card group">
                                <div class="vc-card-header">
                                    <span class="vc-index">{globalIndex + 1}</span>
                                    <span class="truncate" title={name}>{name}</span>
                                </div>
                                {#if vc}
                                    <canvas
                                        use:initCanvas={vc}
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

    .vc-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid rgba(63, 63, 70, 0.3);
        background-color: rgba(39, 39, 42, 0.3);
        transition: border-color 0.15s ease;
    }

    .vc-card:hover {
        border-color: rgba(113, 113, 122, 0.4);
    }

    .vc-card-header {
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

    .vc-card:hover .vc-card-header {
        color: rgba(228, 228, 231, 1);
    }

    .vc-index {
        font-size: 0.6rem;
        color: rgba(113, 113, 122, 0.7);
        min-width: 1.25rem;
        text-align: right;
        flex-shrink: 0;
    }
</style>
