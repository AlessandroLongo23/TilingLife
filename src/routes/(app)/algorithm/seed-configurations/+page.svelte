<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { Search, Minus, Plus, Puzzle, Camera } from 'lucide-svelte';
    import { headerStore, openScreenshotPreview } from '$stores';
    import { map, sounds } from '$utils';
    import { drawTransformations } from '$lib/algorithm/drawTransformations';
    import { compactSeedName, compactToHtml } from '$lib/utils/compactSeedName';

    import Checkbox from '$components/ui/Checkbox.svelte';
    import Pagination from '$components/ui/Pagination.svelte';
    import ReloadButton from '$components/ui/ReloadButton.svelte';

    let { data } = $props();

    $effect(() => {
        headerStore.set({ title: 'Seed Configurations', badge: String(data.totalItems), subtitle: null });
    });

    let columnsPerRow = $state(4);
    const COL_MIN = 2;
    const COL_MAX = 6;

    let showVcsCenters = $state(false);
    let showTransformations = $state(false);

    let currentPage = $state(data.page);

    $effect(() => {
        currentPage = data.page;
    });

    const navigateTo = (k: number | null, m: number | null, pg: number = 1, grouping: string | null = null, search: string | null = null): void => {
        const params = new URLSearchParams();
        if (k !== null) params.set('k', String(k));
        if (m !== null) params.set('m', String(m));
        if (pg > 1) params.set('page', String(pg));
        if (grouping) params.set('grouping', grouping);
        if (search) params.set('search', search);
        goto(`/algorithm/seed-configurations?${params.toString()}`);
    }

    function handlePageChange() {
        navigateTo(data.selectedK, data.selectedM, currentPage, data.selectedGrouping, data.selectedSearch);
    }

    let searchInput = $state(data.selectedSearch ?? '');

    $effect(() => {
        searchInput = data.selectedSearch ?? '';
    });

    function handleSearchSubmit() {
        const q = searchInput.trim();
        navigateTo(data.selectedK, data.selectedM, 1, data.selectedGrouping, q || null);
    }

    $effect(() => {
        if (browser && currentPage !== data.page) {
            handlePageChange();
        }
    });

    let mValuesForSelectedK = $derived(
        data.available.filter((a: any) => a.k === data.selectedK)
    );

    function handleCardScreenshot(e: MouseEvent, filename: string) {
        const card = (e.currentTarget as HTMLElement).closest('.sc-card');
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

    function initCanvas(canvas: HTMLCanvasElement, params: { seedConfiguration: any; showVcsCenters: boolean; showTransformations: boolean }) {
        let seedConfiguration = params.seedConfiguration;
        let showVcsCenters = params.showVcsCenters;
        let showTransformations = params.showTransformations;
        let resizeObserver: ResizeObserver;

        function render() {
            if (seedConfiguration) drawSeedConfig(canvas, seedConfiguration, showVcsCenters, showTransformations);
        }

        requestAnimationFrame(render);

        resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(render);
        });
        resizeObserver.observe(canvas);

        return {
            update(newParams: { seedConfiguration: any; showVcsCenters: boolean; showTransformations: boolean }) {
                seedConfiguration = newParams.seedConfiguration;
                showVcsCenters = newParams.showVcsCenters;
                showTransformations = newParams.showTransformations;
                requestAnimationFrame(render);
            },
            destroy() {
                resizeObserver?.disconnect();
            }
        };
    }

    function drawSeedConfig(canvas: HTMLCanvasElement, seedConfiguration: any, showVcsCenters: boolean, showTransformations: boolean) {
        const size = canvas.clientWidth || 220;
        const ctx = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, size, size);

        if (!seedConfiguration.polygons || seedConfiguration.polygons.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const polygon of seedConfiguration.polygons) {
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

        for (const polygon of seedConfiguration.polygons) {
            if (!polygon.vertices || polygon.vertices.length === 0) continue;
            const hue = getPolygonHue(polygon.type, polygon.vertices.length);
            const hsl = hsbToHsl(hue, 40, 100);
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

        if (showVcsCenters && seedConfiguration.vcsCenters && seedConfiguration.vcsCenters.length > 0) {
            ctx.save();
            ctx.translate(size / 2, size / 2);
            ctx.scale(scale, -scale);
            ctx.translate(-centerX, -centerY);

            const dotRadius = 3 / scale;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 1.2 / scale;

            for (const center of seedConfiguration.vcsCenters) {
                const x = (center as { x?: number; y?: number }).x;
                const y = (center as { x?: number; y?: number }).y;
                if (typeof x !== 'number' || typeof y !== 'number') continue;
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            ctx.restore();
        }

        if (showTransformations && (seedConfiguration.gyrations?.length || seedConfiguration.reflections?.length)) {
            ctx.save();
            ctx.translate(size / 2, size / 2);
            ctx.scale(scale, -scale);
            ctx.translate(-centerX, -centerY);
            drawTransformations(ctx, seedConfiguration.gyrations, seedConfiguration.reflections, scale);
            ctx.restore();
        }
    }
</script>

<div class="flex-1 max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row">
    <!-- Sidebar filters -->
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
                        <p class="text-xs text-zinc-600">No data generated yet.</p>
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
                                onclick={() => navigateTo(data.selectedK, m, 1, null)}
                            >
                                <span>m={m}</span>
                                <span class="km-count">{count.toLocaleString()}</span>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Search -->
            {#if data.selectedK !== null && data.selectedM !== null}
                <div class="border-t border-zinc-800 pt-5">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider block mb-2.5">Search</span>
                    <form onsubmit={(e) => { e.preventDefault(); handleSearchSubmit(); }} class="flex gap-1.5">
                        <input
                            type="text"
                            bind:value={searchInput}
                            placeholder="e.g. 3 3 3 4 4 or (3^3.4^2)^2"
                            class="search-input flex-1 min-w-0"
                            aria-label="Search seed by name"
                        />
                        <button type="submit" class="km-btn km-btn-active shrink-0" title="Search">
                            <Search size={14} />
                        </button>
                    </form>
                    <p class="text-[0.65rem] text-zinc-500 mt-1.5">Extended or compact notation; spaces ignored</p>
                </div>
            {/if}

            <!-- Grouping selector -->
            {#if data.selectedK !== null && data.selectedM !== null && data.groupings?.length}
                <div class="border-t border-zinc-800 pt-5">
                    <span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Grouping</span>
                    <div class="flex flex-wrap gap-1.5 mt-2.5">
                        <button
                            class="km-btn {!data.selectedGrouping ? 'km-btn-active' : ''}"
                            onclick={() => navigateTo(data.selectedK, data.selectedM, 1, null)}
                        >
                            All
                        </button>
                        {#each data.groupings as { label, count }}
                            {@const isActive = data.selectedGrouping === label}
                            <button
                                class="km-btn {isActive ? 'km-btn-active' : ''}"
                                onclick={() => navigateTo(data.selectedK, data.selectedM, 1, label)}
                            >
                                <span>{label}</span>
                                <span class="km-count">{count.toLocaleString()}</span>
                            </button>
                        {/each}
                    </div>
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

            <!-- VC centers toggle -->
            {#if data.selectedK !== null && data.selectedM !== null}
                <div class="border-t border-zinc-800 pt-5 space-y-3">
                    <Checkbox
                        id="showVcsCenters"
                        label="Show VC centers"
                        bind:checked={showVcsCenters}
                    />
                    <Checkbox
                        id="showTransformations"
                        label="Show gyrations & reflections"
                        bind:checked={showTransformations}
                    />
                </div>
            {/if}

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
                        <span>Seed configurations</span>
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
                <Puzzle size={32} class="mb-3 opacity-50" />
                <p class="text-sm">Select k and m values to view seed configurations.</p>
            </div>
        {:else if data.totalItems === 0}
            <div class="flex flex-col items-center justify-center h-64 text-zinc-600">
                <Search size={32} class="mb-3 opacity-50" />
                <p class="text-sm">No seed configurations found for k={data.selectedK}, m={data.selectedM}.</p>
            </div>
        {:else}
            <div class="p-5 flex flex-col gap-4">
                <Pagination totalItems={data.totalItems} pageSize={data.pageSize} bind:currentPage />

                <div
                    class="grid gap-3"
                    style="grid-template-columns: repeat({columnsPerRow}, minmax(0, 1fr));"
                >
                    {#each data.seedConfigurations as seedConfiguration, i}
                        {@const globalIndex = (data.page - 1) * data.pageSize + i}
                        <div class="sc-card group relative">
                            <div class="sc-card-header" title={seedConfiguration.name}>
                                <span class="sc-index">{globalIndex + 1}</span>
                                <span class="text-zinc-500 sc-name">{@html compactToHtml(compactSeedName(seedConfiguration.name))}</span>
                            </div>
                            {#if browser}
                                <canvas
                                    use:initCanvas={{ seedConfiguration, showVcsCenters, showTransformations }}
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
                                    onclick={(e) => handleCardScreenshot(e, `seed-k${data.selectedK}-m${data.selectedM}-${globalIndex + 1}.png`)}
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

    .search-input {
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background-color: rgba(39, 39, 42, 0.5);
        border: 1px solid rgba(63, 63, 70, 0.4);
        color: rgba(228, 228, 231, 1);
        transition: border-color 0.15s ease;
    }

    .search-input::placeholder {
        color: rgba(113, 113, 122, 0.7);
    }

    .search-input:focus {
        outline: none;
        border-color: rgba(74, 222, 128, 0.4);
    }

    .sc-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid rgba(63, 63, 70, 0.3);
        background-color: rgba(39, 39, 42, 0.3);
        transition: border-color 0.15s ease;
    }

    .sc-card:hover {
        border-color: rgba(113, 113, 122, 0.4);
    }

    .sc-card-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.8rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(161, 161, 170, 1);
        background-color: rgba(39, 39, 42, 0.5);
        border-bottom: 1px solid rgba(63, 63, 70, 0.25);
        transition: color 0.15s ease;
    }

    .sc-card:hover .sc-card-header {
        color: rgba(228, 228, 231, 1);
    }

    .sc-index {
        font-size: 0.7rem;
        color: rgba(113, 113, 122, 0.7);
        min-width: 1.25rem;
        text-align: right;
        flex-shrink: 0;
    }

    .sc-name :global(sup) {
        font-size: 0.8em;
        line-height: 0;
    }
</style>
