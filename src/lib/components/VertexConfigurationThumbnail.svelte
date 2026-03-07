<script lang="ts">
    import { drawVertexConfiguration } from '$utils';
    import type { VertexConfiguration } from '$classes/algorithm/VertexConfiguration.svelte';

    let { vc, size = 200, showName = false, showOccurrences = false, occurrences }: {
        vc: VertexConfiguration | null;
        size?: number;
        showName?: boolean;
        showOccurrences?: boolean;
        occurrences?: number;
    } = $props();

    let canvasEl = $state<HTMLCanvasElement | null>(null);

    function render() {
        if (!canvasEl || !vc) return;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const displaySize = canvasEl.clientWidth || size;

        canvasEl.width = displaySize * dpr;
        canvasEl.height = displaySize * dpr;
        ctx.scale(dpr, dpr);

        drawVertexConfiguration(ctx, vc, {
            size: displaySize,
            backgroundColor: 'rgba(39, 39, 42, 0.5)',
            padding: 12
        });
    }

    const initCanvas = (node: HTMLCanvasElement) => {
        canvasEl = node;
        let resizeObserver: ResizeObserver | undefined;

        function scheduleRender() {
            requestAnimationFrame(render);
        }

        scheduleRender();
        resizeObserver = new ResizeObserver(scheduleRender);
        resizeObserver.observe(node);

        return {
            destroy() {
                resizeObserver?.disconnect();
            }
        };
    };

    $effect(() => {
        vc;
        if (canvasEl) requestAnimationFrame(render);
    });
</script>

<div class="vc-thumbnail flex flex-col rounded-lg overflow-hidden border border-zinc-700/40 bg-zinc-800/40">
    <canvas
        use:initCanvas
        class="block w-full aspect-square"
        style="min-width: {size}px; min-height: {size}px;"
    ></canvas>
    {#if (showName || showOccurrences) && vc}
        <div class="vc-thumbnail-header px-2 py-1.5 text-sm font-mono text-zinc-300 bg-zinc-800/60 border-t border-zinc-700/30 flex items-center justify-between gap-2 min-w-0">
            {#if showName}
                <span class="truncate" title={vc.name}>{vc.name}</span>
            {/if}
            {#if showOccurrences && occurrences !== undefined && occurrences > 1}
                <span class="shrink-0 text-zinc-500">×{occurrences}</span>
            {/if}
        </div>
    {/if}
</div>
