<script lang="ts">
	import type { Polygon } from '$classes';

	let {
		id,
		name,
		polygon,
		tagLabel,
		tagClass = 'regular',
		showCheckbox = false,
		checked = false,
		onToggle
	}: {
		id: number;
		name: string;
		polygon: Polygon | null;
		tagLabel: string;
		tagClass?: string;
		showCheckbox?: boolean;
		checked?: boolean;
		onToggle?: () => void;
	} = $props();

	function hsbToHsl(h: number, s: number, b: number) {
		s /= 100;
		b /= 100;
		const l = b * (1 - s / 2);
		const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
		return { h, s: sl * 100, l: l * 100 };
	}

	function drawPolygon(canvas: HTMLCanvasElement, poly: Polygon) {
		const size = 48;
		const ctx = canvas.getContext('2d');
		if (!ctx || !poly.vertices?.length) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.scale(dpr, dpr);
		ctx.fillStyle = '#1e1e24';
		ctx.fillRect(0, 0, size, size);

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const v of poly.vertices) {
			minX = Math.min(minX, v.x);
			minY = Math.min(minY, v.y);
			maxX = Math.max(maxX, v.x);
			maxY = Math.max(maxY, v.y);
		}
		if (!isFinite(minX)) return;

		const padding = 6;
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

		const hsl = hsbToHsl(poly.hue ?? 200, 40, 100);
		ctx.fillStyle = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.lineWidth = 1.5 / scale;
		ctx.beginPath();
		ctx.moveTo(poly.vertices[0].x, poly.vertices[0].y);
		for (let i = 1; i < poly.vertices.length; i++) {
			ctx.lineTo(poly.vertices[i].x, poly.vertices[i].y);
		}
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	function initCanvas(node: HTMLCanvasElement, poly: Polygon | null) {
		let ro: ResizeObserver | undefined;
		function render() {
			if (poly) drawPolygon(node, poly);
		}
		requestAnimationFrame(render);
		ro = new ResizeObserver(() => requestAnimationFrame(render));
		ro.observe(node);
		return {
			update(p: Polygon | null) {
				if (p) drawPolygon(node, p);
			},
			destroy() {
				ro?.disconnect();
			}
		};
	}
</script>

<div
	class="polygon-list-item flex items-center gap-3 px-3 py-2 rounded-md border border-zinc-700/30 bg-zinc-800/30 hover:border-zinc-600/40 transition-colors {showCheckbox ? 'selectable' : ''}"
	role={showCheckbox ? 'button' : undefined}
	tabindex={showCheckbox ? 0 : undefined}
	onclick={() => showCheckbox && onToggle?.()}
	onkeydown={(e) => e.key === 'Enter' && showCheckbox && onToggle?.()}
>
	{#if showCheckbox}
		<div class="shrink-0" onclick={(e) => e.stopPropagation()}>
			<input
				type="checkbox"
				class="h-4 w-4 rounded border border-zinc-600/60 bg-zinc-800/50 checked:bg-green-500/90 checked:border-green-500/80 focus:ring-1 focus:ring-green-500/40"
				checked={checked}
				onchange={() => onToggle?.()}
			/>
		</div>
	{/if}
	<div class="shrink-0 w-12 h-12 rounded overflow-hidden border border-zinc-700/50 bg-zinc-900">
		{#if polygon}
			<canvas use:initCanvas={polygon} class="block w-full h-full"></canvas>
		{:else}
			<div class="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">—</div>
		{/if}
	</div>
	<span class="polygon-list-id text-xs text-zinc-500 tabular-nums shrink-0 w-6 text-right">{id}</span>
	<span class="polygon-list-name truncate font-mono text-sm text-zinc-300" title={name}>{name}</span>
	<span class="polygon-list-tag shrink-0 category-tag category-{tagClass}">{tagLabel}</span>
</div>

<style>
	.polygon-list-item.selectable {
		cursor: pointer;
	}
	.category-tag {
		font-size: 0.55rem;
		padding: 0.05rem 0.4rem;
		border-radius: 0.75rem;
		font-weight: 500;
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
	.category-generic {
		color: rgba(167, 139, 250, 0.9);
		background-color: rgba(167, 139, 250, 0.1);
	}
</style>
