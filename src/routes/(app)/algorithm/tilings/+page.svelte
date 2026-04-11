<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { Search, Minus, Plus, Grid3x3, Grid2X2, List, Layers, Camera, Move } from 'lucide-svelte';
    import { headerStore, openScreenshotPreview } from '$stores';
    import { map, sounds } from '$utils';

    import Pagination from '$components/ui/Pagination.svelte';
    import ReloadButton from '$components/ui/ReloadButton.svelte';
    import RangeSlider from '$components/ui/RangeSlider.svelte';
    import Checkbox from '$components/ui/Checkbox.svelte';
    import TilingListItem from '$components/TilingListItem.svelte';

    let { data } = $props();
    let viewMode = $state<'grid' | 'list'>('grid');

    $effect(() => {
        headerStore.set({ title: 'Tilings', badge: String(data.totalItems), subtitle: null });
    });

    let columnsPerRow = $state(3);
    const COL_MIN = 1;
    const COL_MAX = 5;

    let currentPage = $state(data.page);
    let layers = $state(data.layers);
    let showBasisVectors = $state(data.showBasisVectors ?? false);
    let layersRange = $state<[number, number]>([data.layers, data.layers]);

    $effect(() => { currentPage = data.page; });
    $effect(() => { layers = data.layers; });
    $effect(() => { showBasisVectors = data.showBasisVectors ?? false; });
    $effect(() => { layersRange = [data.layers, data.layers]; });

    function handleLayersChange() {
        layers = layersRange[0];
        navigateTo(data.selectedK, data.selectedM, currentPage, layers, undefined, showBasisVectors);
    }

    $effect(() => {
        if (browser && layersRange[0] !== layers && layersRange[0] >= 1 && layersRange[0] <= 8) {
            handleLayersChange();
        }
    });

    function navigateTo(
        k,
        m,
        pg = 1,
        ly = layers,
        polygons = data.selectedParamsFolder ?? null,
        basis = showBasisVectors
    ) {
        const params = new URLSearchParams();
        if (k !== null) params.set('k', String(k));
        if (m !== null) params.set('m', String(m));
        if (pg > 1) params.set('page', String(pg));
        if (ly !== 2) params.set('layers', String(ly));
        if (basis) params.set('basis', '1');
        if (polygons && polygons !== 'default') params.set('polygons', polygons);
        goto(`/algorithm/tilings?${params.toString()}`);
    }

    function handlePageChange() {
        navigateTo(data.selectedK, data.selectedM, currentPage, layers, undefined, showBasisVectors);
    }

    $effect(() => {
        if (browser && currentPage !== data.page) {
            handlePageChange();
        }
    });

    $effect(() => {
        if (browser && showBasisVectors !== (data.showBasisVectors ?? false)) {
            navigateTo(data.selectedK, data.selectedM, currentPage, layers, undefined, showBasisVectors);
        }
    });

    let mValuesForSelectedK = $derived(
        data.available.filter((a) => a.k === data.selectedK)
    );

    // ─── Color helpers ───

    function handleCardScreenshot(e, filename) {
        const target = e?.currentTarget;
        const card = target?.closest?.('.tiling-card') ?? target?.closest?.('.tiling-list-item');
        const canvas = card?.querySelector?.('canvas');
        if (!canvas?.toDataURL) return;
        const dataUrl = canvas.toDataURL('image/png');
        openScreenshotPreview({ imageDataUrl: dataUrl, filename, rulestring: '', groupId: null });
        sounds.screenshot();
    }

    function hsbToHsl(h, s, b) {
        s /= 100;
        b /= 100;
        const l = b * (1 - s / 2);
        const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
        return { h, s: sl * 100, l: l * 100 };
    }

    function getPolygonHue(type, vertexCount) {
        if (type === 'regular') {
            return map(Math.log(vertexCount), Math.log(3), Math.log(40), 0, 300);
        }
        return map(vertexCount / 2, 3, 12, 300, 0) + 300 / 12;
    }

    // ─── Translational cell: expand by layers ───
    // Polygons come from page.server in display format: { type, n, vertices: [{x,y}, ...] }

    function getPolygonsForDrawing(cell, layersCount) {
        const polys = cell.polygons ?? cell.p ?? [];
        const basis = cell.b ?? [
            [1, 0],
            [0, 1],
        ];
        const [v1, v2] = basis;
        const v1x = Number(v1[0]) || 0,
            v1y = Number(v1[1]) || 0;
        const v2x = Number(v2[0]) || 0,
            v2y = Number(v2[1]) || 0;

        const result = [];
        const half = Math.floor(layersCount / 2);
        for (let i = -half; i <= half; i++) {
            for (let j = -half; j <= half; j++) {
                const dx = i * v1x + j * v2x;
                const dy = i * v1y + j * v2y;
                for (const poly of polys) {
                    const verts = poly.vertices ?? [];
                    if (verts.length < 3) continue;
                    const translated = verts.map((v) => ({
                        x: Number(v.x) + dx,
                        y: Number(v.y) + dy,
                    }));
                    if (translated.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y))) continue;
                    result.push({ type: poly.type ?? 'regular', n: poly.n ?? 0, vertices: translated });
                }
            }
        }
        return result;
    }

    // ─── Canvas ───

    function initCanvas(canvas, binding) {
        let [cellData, layersCount, drawBasis] = binding;
        let resizeObserver;

        function render() {
            if (cellData) drawTranslationalCell(canvas, cellData, layersCount, drawBasis);
        }

        requestAnimationFrame(render);
        resizeObserver = new ResizeObserver(() => requestAnimationFrame(render));
        resizeObserver.observe(canvas);

        return {
            update(newBinding) {
                [cellData, layersCount, drawBasis] = newBinding;
                requestAnimationFrame(render);
            },
            destroy() {
                resizeObserver?.disconnect();
            }
        };
    }

    function drawTranslationalCell(canvas, cell, layersCount, drawBasis) {
        const size = canvas.clientWidth || 300;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, size, size);

        const polygons = getPolygonsForDrawing(cell, layersCount);
        if (!polygons.length) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const origin = cell.o ?? [0, 0];
        const basis = cell.b ?? [[1, 0], [0, 1]];
        const [v1, v2] = basis;

        for (const poly of polygons) {
            for (const v of poly.vertices ?? []) {
                if (v.x == null || v.y == null) continue;
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            }
        }
        if (drawBasis) {
            const ox = origin[0], oy = origin[1];
            const scale = 1.2;
            minX = Math.min(minX, ox, ox + v1[0] * scale, ox + v2[0] * scale);
            maxX = Math.max(maxX, ox, ox + v1[0] * scale, ox + v2[0] * scale);
            minY = Math.min(minY, oy, oy + v1[1] * scale, oy + v2[1] * scale);
            maxY = Math.max(maxY, oy, oy + v1[1] * scale, oy + v2[1] * scale);
        }
        if (!isFinite(minX)) return;

        const padding = 8;
        const available = size - 2 * padding;
        const dataW = maxX - minX || 1;
        const dataH = maxY - minY || 1;
        const scale = Math.min(available / dataW, available / dataH);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.scale(scale, -scale);
        ctx.translate(-cx, -cy);

        for (const poly of polygons) {
            const verts = poly.vertices ?? [];
            if (!verts.length) continue;
            const hasNull = verts.some((v) => v.x == null || v.y == null);
            if (hasNull) continue;

            const hue = getPolygonHue(poly.type ?? 'regular', poly.n ?? verts.length);
            const hsl = hsbToHsl(hue, 40, 100);
            ctx.fillStyle = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 1 / scale;

            ctx.beginPath();
            ctx.moveTo(verts[0].x, verts[0].y);
            for (let i = 1; i < verts.length; i++) {
                ctx.lineTo(verts[i].x, verts[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        if (drawBasis) {
            const ox = origin[0], oy = origin[1];
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.lineWidth = 2 / scale;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + v1[0], oy + v1[1]);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + v2[0], oy + v2[1]);
            ctx.stroke();
            ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.beginPath();
            ctx.arc(ox, oy, 3 / scale, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.restore();
    }
</script>

<div class="flex-1 max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row">
    <!-- Sidebar -->
    <aside class="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/50">
        <div class="p-5 flex flex-col gap-6 lg:sticky lg:top-[65px] lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto scrollbar-hide">
            <!-- k selector -->
            <div>
                <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Set size (k)</span>
                <div class="flex flex-wrap gap-1.5 mt-2.5">
                        {#each data.kValues as k}
                        {@const isActive = data.selectedK === k}
                        <button
                                class="km-btn {isActive ? 'km-btn-active' : ''}"
                                onclick={() => navigateTo(k, null, 1, layers, undefined, showBasisVectors)}
                            >
                            k={k}
                        </button>
                    {/each}
                    {#if data.kValues.length === 0}
                        <p class="text-xs text-zinc-600">No tilings generated yet.</p>
                    {/if}
                </div>
            </div>

            <!-- m selector -->
            {#if data.selectedK !== null}
                <div class="border-t border-zinc-800 pt-5">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Unique VCs (m)</span>
                    <div class="flex flex-wrap gap-1.5 mt-2.5">
                        {#each mValuesForSelectedK as { m, count }}
                            {@const isActive = data.selectedM === m}
                            <button
                                class="km-btn {isActive ? 'km-btn-active' : ''}"
                                onclick={() => navigateTo(data.selectedK, m, 1, layers, undefined, showBasisVectors)}
                            >
                                <span>m={m}</span>
                                <span class="km-count">{count.toLocaleString()}</span>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Layers slider -->
            <div class="border-t border-zinc-800 pt-5">
                <div class="flex flex-col gap-2">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider flex items-center gap-1.5">
                        <Layers size={12} />
                        Layers
                    </span>
                    <RangeSlider
                        bind:value={layersRange}
                        min={1}
                        max={8}
                        step={1}
                        label=""
                    />
                    <div class="flex gap-1 justify-center mt-1">
                        <button
                            class="ctrl-btn"
                            onclick={() => { layersRange = [Math.max(1, layersRange[0] - 1), Math.max(1, layersRange[0] - 1)]; handleLayersChange(); }}
                            disabled={layersRange[0] <= 1}
                            aria-label="Fewer layers"
                        >
                            <Minus size={14} />
                        </button>
                        <button
                            class="ctrl-btn"
                            onclick={() => { layersRange = [Math.min(8, layersRange[0] + 1), Math.min(8, layersRange[0] + 1)]; handleLayersChange(); }}
                            disabled={layersRange[0] >= 8}
                            aria-label="More layers"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Basis vectors toggle -->
            <div class="border-t border-zinc-800 pt-5">
                <div class="flex flex-col gap-2">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider flex items-center gap-1.5">
                        <Move size={12} />
                        Display
                    </span>
                    <Checkbox
                        id="basis-vectors"
                        bind:checked={showBasisVectors}
                        label="Show basis vectors"
                    />
                </div>
            </div>

            <!-- Per Row -->
            <div class="border-t border-zinc-800 pt-5">
                <div class="flex flex-col gap-2">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Per Row</span>
                    <div class="flex items-center gap-2 justify-center">
                        <button
                            class="ctrl-btn"
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
                            class="ctrl-btn"
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
                    {#if data.selectedK !== null && data.selectedM !== null}
                        <div class="flex justify-between">
                            <span>Current selection</span>
                            <span class="text-zinc-400">k={data.selectedK}, m={data.selectedM}</span>
                        </div>
                    {/if}
                    <div class="flex justify-between">
                        <span>Tilings</span>
                        <span class="text-green-400 font-medium">{data.totalItems.toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Total across all k/m</span>
                        <span class="text-zinc-400">{data.available.reduce((s: number, a: any) => s + a.count, 0).toLocaleString()}</span>
                    </div>
                    <div class="pt-2">
                        <ReloadButton />
                    </div>
                </div>
            </div>
        </div>
    </aside>

    <!-- Grid -->
    <main class="flex-1 min-w-0">
        {#if data.selectedK === null || data.selectedM === null}
            <div class="flex flex-col items-center justify-center h-64 text-zinc-600">
                <Grid3x3 size={32} class="mb-3 opacity-50" />
                <p class="text-sm">Select k and m values to view tilings.</p>
            </div>
        {:else if data.totalItems === 0}
            <div class="flex flex-col items-center justify-center h-64 text-zinc-600">
                <Search size={32} class="mb-3 opacity-50" />
                <p class="text-sm">No translational cells found for k={data.selectedK}, m={data.selectedM}.</p>
            </div>
        {:else}
            <div class="p-5 flex flex-col gap-4">
                <div class="flex flex-wrap items-center gap-3">
                    <Pagination totalItems={data.totalItems} pageSize={data.pageSize} bind:currentPage />
                    <div class="flex gap-1 border-l border-zinc-700 pl-3">
                        <button
                            class="p-2 rounded-md border transition-all {viewMode === 'grid' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 hover:bg-zinc-700/50 hover:text-zinc-300'}"
                            onclick={() => viewMode = 'grid'}
                            title="Grid view"
                        >
                            <Grid2X2 size={16} />
                        </button>
                        <button
                            class="p-2 rounded-md border transition-all {viewMode === 'list' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 hover:bg-zinc-700/50 hover:text-zinc-300'}"
                            onclick={() => viewMode = 'list'}
                            title="List view"
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>

                {#if viewMode === 'list'}
                    <div class="flex flex-col gap-1.5">
                        {#each data.tilings as cell, i}
                            {@const globalIndex = (data.page - 1) * data.pageSize + i}
                            {#snippet thumbnail()}
                                <canvas
                                    use:initCanvas={[cell, layers, showBasisVectors]}
                                    class="block w-full h-full"
                                ></canvas>
                            {/snippet}
                            <TilingListItem
                                id={globalIndex + 1}
                                name={cell.n ?? ''}
                                polygonCount={(cell.polygons ?? cell.p ?? []).length}
                                thumbnail={thumbnail}
                                onScreenshot={(e) => handleCardScreenshot(e, `tiling-k${data.selectedK}-m${data.selectedM}-${globalIndex + 1}.png`)}
                            />
                        {/each}
                    </div>
                {:else}
                <div
                    class="grid gap-3"
                    style="grid-template-columns: repeat({columnsPerRow}, minmax(0, 1fr));"
                >
                    {#each data.tilings as cell, i}
                        {@const globalIndex = (data.page - 1) * data.pageSize + i}
                        <div class="tiling-card group relative">
                            <div class="tiling-card-header">
                                <span class="tiling-index">{globalIndex + 1}</span>
                                <span class="text-zinc-500 truncate" title={cell.n ?? ''}>{cell.n ?? '?'}</span>
                                <span class="text-zinc-600">{(cell.polygons ?? cell.p ?? []).length} polys</span>
                            </div>
                            {#if browser}
                                <canvas
                                    use:initCanvas={[cell, layers, showBasisVectors]}
                                    class="block w-full aspect-square"
                                ></canvas>
                            {:else}
                                <div class="flex items-center justify-center text-zinc-600 text-xs w-full aspect-square">
                                    Loading...
                                </div>
                            {/if}
                            {#if browser}
                                <button
                                    type="button"
                                    class="absolute bottom-2 right-2 p-1.5 rounded-md bg-zinc-800/90 border border-zinc-600/60 text-zinc-400 hover:text-white hover:bg-zinc-700/90 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onclick={(e) => handleCardScreenshot(e, `cell-${(cell.n ?? 'unknown').replace(/[/\\?%*:|"<>]/g, '-')}-${globalIndex + 1}.png`)}
                                    title="Screenshot"
                                    aria-label="Take screenshot"
                                >
                                    <Camera size={14} />
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>
                {/if}

                <Pagination totalItems={data.totalItems} pageSize={data.pageSize} bind:currentPage />
            </div>
        {/if}
    </main>
</div>

<style>
    .km-btn {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid rgba(63, 63, 70, 0.4);
        background-color: rgba(39, 39, 42, 0.5);
        color: rgba(161, 161, 170, 1);
        transition: all 0.15s ease;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .km-btn:hover {
        background-color: rgba(63, 63, 70, 0.5);
        color: rgba(228, 228, 231, 1);
    }

    .km-btn-active {
        background-color: rgba(74, 222, 128, 0.12);
        color: rgba(74, 222, 128, 0.9);
        border-color: rgba(74, 222, 128, 0.25);
    }

    .km-btn-active:hover {
        background-color: rgba(74, 222, 128, 0.2);
        color: rgba(74, 222, 128, 1);
    }

    .km-count {
        font-size: 0.6rem;
        color: rgba(113, 113, 122, 0.7);
        font-family: ui-monospace, monospace;
    }

    .km-btn-active .km-count {
        color: rgba(74, 222, 128, 0.6);
    }

    .ctrl-btn {
        padding: 0.25rem;
        border-radius: 0.375rem;
        border: 1px solid rgba(63, 63, 70, 0.5);
        color: rgba(161, 161, 170, 1);
        transition: all 0.15s ease;
    }

    .ctrl-btn:hover:not(:disabled) {
        color: rgba(228, 228, 231, 1);
        background-color: rgba(63, 63, 70, 0.5);
    }

    .ctrl-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .tiling-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid rgba(63, 63, 70, 0.3);
        background-color: rgba(39, 39, 42, 0.3);
        transition: border-color 0.15s ease;
    }

    .tiling-card:hover {
        border-color: rgba(113, 113, 122, 0.4);
    }

    .tiling-card-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.7rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(161, 161, 170, 1);
        background-color: rgba(39, 39, 42, 0.5);
        border-bottom: 1px solid rgba(63, 63, 70, 0.25);
        transition: color 0.15s ease;
    }

    .tiling-card:hover .tiling-card-header {
        color: rgba(228, 228, 231, 1);
    }

    .tiling-index {
        font-size: 0.6rem;
        color: rgba(113, 113, 122, 0.7);
        min-width: 1.25rem;
        text-align: right;
        flex-shrink: 0;
    }
</style>
