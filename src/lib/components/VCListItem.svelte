<script lang="ts">
	import { drawVertexConfiguration } from '$utils';
	import type { VertexConfiguration } from '$classes/algorithm/VertexConfiguration.svelte';

	let {
		id,
		name,
		vc,
		vertexCount,
		showCheckbox = false,
		checked = false,
		onToggle
	}: {
		id: number;
		name: string;
		vc: VertexConfiguration | null;
		vertexCount: number;
		showCheckbox?: boolean;
		checked?: boolean;
		onToggle?: () => void;
	} = $props();

	const SIZE = 48;

	function render(node: HTMLCanvasElement, vcData: VertexConfiguration | null) {
		if (!vcData) return;
		const ctx = node.getContext('2d');
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;
		node.width = SIZE * dpr;
		node.height = SIZE * dpr;
		ctx.scale(dpr, dpr);
		drawVertexConfiguration(ctx, vcData, {
			size: SIZE,
			backgroundColor: 'rgba(39, 39, 42, 0.5)',
			padding: 6
		});
	}

	function initCanvas(node: HTMLCanvasElement, vcData: VertexConfiguration | null) {
		requestAnimationFrame(() => render(node, vcData));
		const ro = new ResizeObserver(() => requestAnimationFrame(() => render(node, vcData)));
		ro.observe(node);
		return {
			update(vcData: VertexConfiguration | null) {
				requestAnimationFrame(() => render(node, vcData));
			},
			destroy() {
				ro.disconnect();
			}
		};
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="vc-list-item flex items-center gap-3 px-3 py-2 rounded-md border border-zinc-700/30 bg-zinc-800/30 hover:border-zinc-600/40 transition-colors {showCheckbox ? 'cursor-pointer' : ''}"
	role={showCheckbox ? 'button' : undefined}
	tabindex={showCheckbox ? 0 : undefined}
	onclick={() => showCheckbox && onToggle?.()}
	onkeydown={(e) => e.key === 'Enter' && showCheckbox && onToggle?.()}
>
	{#if showCheckbox}
		<input
			type="checkbox"
			class="shrink-0 h-4 w-4 rounded border border-zinc-600/60 bg-zinc-800/50 checked:bg-green-500/90 checked:border-green-500/80 focus:ring-1 focus:ring-green-500/40"
			checked={checked}
			onclick={(e) => e.stopPropagation()}
			onchange={() => onToggle?.()}
		/>
	{/if}
	<div class="shrink-0 w-12 h-12 rounded overflow-hidden border border-zinc-700/50 bg-zinc-900">
		{#if vc}
			<canvas use:initCanvas={vc} class="block w-full h-full"></canvas>
		{:else}
			<div class="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">—</div>
		{/if}
	</div>
	<span class="vc-list-id text-xs text-zinc-500 tabular-nums shrink-0 w-6 text-right">{id}</span>
	<span class="vc-list-name truncate font-mono text-sm text-zinc-300" title={name}>{name}</span>
	<span class="vc-list-meta shrink-0 text-xs text-zinc-500">{vertexCount} tiles</span>
</div>
