<script>
    import { VertexConfiguration } from '$classes/algorithm';
    import { browser } from '$app/environment';
    import allVCNames from '$lib/classes/algorithm/vcs.json';

    const CANVAS_SIZE = 220;
    const dotStarRegex = /\{(\d+)\.(\d+)(o|i)?\}/;
    const pipeStarRegex = /\{(\d+)\|(\d+)(o|i)?\}/;
    
    let selectedTypes = $state({
        Regular: true,
        StarRegular: true,
        StarParametric: true
    });
    
    let filterAngleEnabled = $state(true);
    let filterAngle = $state(30);
    let inputValue = $state(30);
    let debounceTimer = null;
    
    const vcCache = new Map();
    
    function handleInput(event) {
        inputValue = event.target.value;

        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
            filterAngle = Number(inputValue);
        }, 300);
    }
    
    function isValidMultiple(val, divisor) {
        if (!divisor || divisor <= 0) return true;
        let rem = val % divisor;
        return Math.abs(rem) < 1e-4 || Math.abs(rem - divisor) < 1e-4;
    }

    let filteredNames = $derived.by(() => {
        return allVCNames.filter(name => {
            const parts = name.split(',');
            for (const p of parts) {
                if (/^\d+$/.test(p)) {
                    if (!selectedTypes.Regular) return false;
                } else {
                    const dotMatch = p.match(dotStarRegex);
                    if (dotMatch) {
                        if (!selectedTypes.StarRegular) return false;
                        const n = parseInt(dotMatch[1]);
                        const d = parseInt(dotMatch[2]);
                        const a = 180 * (1 - 2 * d / n);
                        const b = 180 * (1 + 2 * (d - 1) / n);
                        if (filterAngleEnabled && (!isValidMultiple(a, filterAngle) || !isValidMultiple(b, filterAngle))) return false;
                    } else {
                        const pipeMatch = p.match(pipeStarRegex);
                        if (pipeMatch) {
                            if (!selectedTypes.StarParametric) return false;
                            const n = parseInt(pipeMatch[1]);
                            const alpha = parseInt(pipeMatch[2]);
                            const b = 360 * (1 - 1 / n) - alpha;
                            if (filterAngleEnabled && (!isValidMultiple(alpha, filterAngle) || !isValidMultiple(b, filterAngle))) return false;
                        } else {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    });

    let displayedVCs = $derived.by(() => {
        if (!browser) return [];

        return filteredNames.map(name => {
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
        if (vcData) drawVC(canvas, vcData);
        return {
            update(vcData) {
                if (vcData) drawVC(canvas, vcData);
            }
        };
    }

    function drawVC(canvas, vc) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = CANVAS_SIZE;

        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        
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

<div class="min-h-screen bg-zinc-900 text-white">
    <div class="max-w-[1600px] mx-auto p-6 md:p-8">
        <div class="flex flex-col xl:flex-row xl:items-end gap-6 mb-8">
            <div class="shrink-0">
                <a href="/play" class="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">&larr; Back to Play</a>
                <h1 class="text-2xl md:text-3xl font-bold text-white mt-1">Vertex Configurations</h1>
            </div>
            
            <div class="flex flex-wrap items-center gap-4 xl:ml-auto bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                <div class="flex items-center gap-4 border-r border-zinc-700 pr-4">
                    <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" bind:checked={selectedTypes.Regular} class="rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500 focus:ring-offset-zinc-800">
                        Regular
                    </label>
                    <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" bind:checked={selectedTypes.StarRegular} class="rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500 focus:ring-offset-zinc-800">
                        Star Regular
                    </label>
                    <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" bind:checked={selectedTypes.StarParametric} class="rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500 focus:ring-offset-zinc-800">
                        Star Parametric
                    </label>
                </div>

                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" bind:checked={filterAngleEnabled} class="rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500 focus:ring-offset-zinc-800">
                        Angle Modulo (°):
                    </label>
                    <input
                        type="number"
                        id="angleFilter"
                        value={inputValue}
                        oninput={handleInput}
                        disabled={!filterAngleEnabled}
                        min="1"
                        max="180"
                        class="w-20 bg-zinc-900 text-zinc-200 border border-zinc-600 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                </div>

                <div class="ml-auto pl-4 border-l border-zinc-700">
                    <span class="text-sm font-medium text-green-400">{displayedVCs.length} <span class="text-zinc-500 font-normal">configurations</span></span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {#each displayedVCs as { name, vc }, i (name + i)}
                <div class="flex flex-col items-center bg-zinc-800/40 rounded-lg overflow-hidden border border-zinc-700/30 hover:border-zinc-500/50 transition-colors group">
                    <p class="w-full text-zinc-300 group-hover:text-white text-xs font-mono px-3 py-2 text-center truncate bg-zinc-800/50 border-b border-zinc-700/30 transition-colors" title={name}>
                        {name}
                    </p>
                    {#if vc}
                        <canvas
                            use:initCanvas={vc}
                            class="block"
                        ></canvas>
                    {:else}
                        <div
                            class="flex items-center justify-center text-zinc-600 text-xs"
                            style="width: {CANVAS_SIZE}px; height: {CANVAS_SIZE}px;"
                        >
                            Could not parse
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
</div>