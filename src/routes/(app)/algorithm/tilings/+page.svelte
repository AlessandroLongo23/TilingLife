<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { Search, Minus, Plus, Grid3x3, Layers, Camera } from 'lucide-svelte';
    import { headerStore, openScreenshotPreview } from '$stores';
    import { map, sounds } from '$utils';
    import { Tiling, type EncodedTiling } from '$classes/algorithm/Tiling.svelte';
    
    import Pagination from '$components/ui/Pagination.svelte';
    import ReloadButton from '$components/ui/ReloadButton.svelte';

    let { data } = $props();

    $effect(() => {
        headerStore.set({ title: 'Tilings', badge: String(data.totalItems), subtitle: null });
    });

    let columnsPerRow = $state(3);
    const COL_MIN = 1;
    const COL_MAX = 5;

    let currentPage = $state(data.page);
    let layers = $state(data.layers);

    $effect(() => { currentPage = data.page; });
    $effect(() => { layers = data.layers; });

    function navigateTo(k: number | null, m: number | null, pg: number = 1, ly: number = layers) {
        const params = new URLSearchParams();
        if (k !== null) params.set('k', String(k));
        if (m !== null) params.set('m', String(m));
        if (pg > 1) params.set('page', String(pg));
        if (ly !== 2) params.set('layers', String(ly));
        goto(`/algorithm/tilings?${params.toString()}`);
    }

    function handlePageChange() {
        navigateTo(data.selectedK, data.selectedM, currentPage, layers);
    }

    $effect(() => {
        if (browser && currentPage !== data.page) {
            handlePageChange();
        }
    });

    let mValuesForSelectedK = $derived(
        data.available.filter((a: any) => a.k === data.selectedK)
    );

    // ─── Color helpers ───

    function handleCardScreenshot(e: MouseEvent, filename: string) {
        const card = (e.currentTarget as HTMLElement).closest('.tiling-card');
        const canvas = card?.querySelector('canvas');
        if (!canvas) return;
        const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
        openScreenshotPreview({ imageDataUrl: dataUrl, filename, rulestring: '', groupId: null });
        sounds.screenshot();
    }

    function hsbToHsl(h: number, s: number, b: number) {
        s /= 100;
        b /= 100;
        const l = b * (1 - s / 2);
        const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
        return { h, s: sl * 100, l: l * 100 };
    }

    function getPolygonHue(type: string, vertexCount: number): number {
        if (type === 'regular') {
            return map(Math.log(vertexCount), Math.log(3), Math.log(40), 0, 300);
        }
        return map(vertexCount / 2, 3, 12, 300, 0) + 300 / 12;
    }

    // ─── Polygon expansion (seed + generators format) ───

    interface Vertex { x: number; y: number }
    interface EncodedPolygon { type: string; n: number; vertices: Vertex[] }

    function getPolygonsForDrawing(tiling: EncodedTiling): EncodedPolygon[] {
        if (tiling.seed && tiling.generators) {
            const polygons = Tiling.expandToPolygons(tiling);
            return polygons as EncodedPolygon[];
        }
        return [];
    }

    // ─── Canvas ───

    function initCanvas(canvas: HTMLCanvasElement, tilingData: EncodedTiling) {
        let resizeObserver: ResizeObserver;

        function render() {
            if (tilingData) drawTiling(canvas, tilingData);
        }

        requestAnimationFrame(render);
        resizeObserver = new ResizeObserver(() => requestAnimationFrame(render));
        resizeObserver.observe(canvas);

        return {
            update(newData: EncodedTiling) {
                tilingData = newData;
                requestAnimationFrame(render);
            },
            destroy() {
                resizeObserver?.disconnect();
            }
        };
    }

    function drawTiling(canvas: HTMLCanvasElement, tiling: EncodedTiling) {
        const size = canvas.clientWidth || 300;
        const ctx = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, size, size);

        const polygons = getPolygonsForDrawing(tiling);
        if (!polygons.length) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const poly of polygons) {
            for (const v of poly.vertices) {
                if (v.x == null || v.y == null) continue;
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            }
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
            if (!poly.vertices?.length) continue;
            const hasNull = poly.vertices.some(v => v.x == null || v.y == null);
            if (hasNull) continue;

            const hue = getPolygonHue(poly.type, poly.vertices.length);
            const hsl = hsbToHsl(hue, 40, 100);
            ctx.fillStyle = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 1 / scale;

            ctx.beginPath();
            ctx.moveTo(poly.vertices[0].x, poly.vertices[0].y);
            for (let i = 1; i < poly.vertices.length; i++) {
                ctx.lineTo(poly.vertices[i].x, poly.vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
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
                            onclick={() => navigateTo(k, null)}
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
                                onclick={() => navigateTo(data.selectedK, m)}
                            >
                                <span>m={m}</span>
                                <span class="km-count">{count.toLocaleString()}</span>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Layers control -->
            <div class="border-t border-zinc-800 pt-5">
                <div class="flex flex-col gap-2">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider flex items-center gap-1.5">
                        <Layers size={12} />
                        Layers
                    </span>
                    <div class="flex items-center gap-2 justify-center">
                        <button
                            class="ctrl-btn"
                            onclick={() => { layers = Math.max(1, layers - 1); navigateTo(data.selectedK, data.selectedM, currentPage, layers); }}
                            disabled={layers <= 1}
                            aria-label="Fewer layers"
                        >
                            <Minus size={14} />
                        </button>
                        <div class="flex gap-1 flex-1 justify-center">
                            {#each [1, 2, 3, 4, 5] as n}
                                <button
                                    class="w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-all border
                                        {layers === n
                                            ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                            : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 hover:bg-zinc-700/50 hover:text-zinc-300'}"
                                    onclick={() => { layers = n; navigateTo(data.selectedK, data.selectedM, currentPage, n); }}
                                >
                                    {n}
                                </button>
                            {/each}
                        </div>
                        <button
                            class="ctrl-btn"
                            onclick={() => { layers = Math.min(5, layers + 1); navigateTo(data.selectedK, data.selectedM, currentPage, layers); }}
                            disabled={layers >= 5}
                            aria-label="More layers"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
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
                <p class="text-sm">No tilings found for k={data.selectedK}, m={data.selectedM}.</p>
            </div>
        {:else}
            <div class="p-5 flex flex-col gap-4">
                <Pagination totalItems={data.totalItems} pageSize={data.pageSize} bind:currentPage />

                <div
                    class="grid gap-3"
                    style="grid-template-columns: repeat({columnsPerRow}, minmax(0, 1fr));"
                >
                    {#each data.tilings as tiling, i}
                        {@const globalIndex = (data.page - 1) * data.pageSize + i}
                        <div class="tiling-card group relative">
                            <div class="tiling-card-header">
                                <span class="tiling-index">{globalIndex + 1}</span>
                                <span class="text-zinc-500 truncate" title={tiling.seed?.name ?? ''}>{tiling.seed?.name ?? '?'}</span>
                                <span class="text-zinc-600">{tiling.generators?.length ?? 0} gens</span>
                            </div>
                            {#if browser}
                                <canvas
                                    use:initCanvas={tiling}
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
                                    onclick={(e) => handleCardScreenshot(e, `tiling-${(tiling.seed?.name ?? 'unknown').replace(/[/\\?%*:|"<>]/g, '-')}-${globalIndex + 1}.png`)}
                                    title="Screenshot"
                                    aria-label="Take screenshot"
                                >
                                    <Camera size={14} />
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>

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
