<script lang="ts">
	import { Camera } from 'lucide-svelte';
	import { compactSeedName, compactToHtml } from '$lib/utils/compactSeedName';

	let {
		id,
		name,
		polygonCount,
		thumbnail,
		onScreenshot
	}: {
		id: number;
		name: string;
		polygonCount: number;
		thumbnail?: import('svelte').Snippet;
		onScreenshot?: (e: MouseEvent) => void;
	} = $props();
</script>

<div
	class="tiling-list-item flex items-center gap-3 px-3 py-2 rounded-md border border-zinc-700/30 bg-zinc-800/30 hover:border-zinc-600/40 transition-colors"
>
	<div class="shrink-0 w-16 h-16 rounded overflow-hidden border border-zinc-700/50 bg-zinc-900">
		{#if thumbnail}
			{@render thumbnail()}
		{:else}
			<div class="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">—</div>
		{/if}
	</div>
	<span class="tiling-list-id text-xs text-zinc-500 tabular-nums shrink-0 w-6 text-right">{id}</span>
	<span class="tiling-list-name truncate font-mono text-sm text-zinc-300 flex-1 min-w-0" title={name}>
		{@html compactToHtml(compactSeedName(name || ''))}
	</span>
	<span class="shrink-0 text-xs text-zinc-500">{polygonCount} polys</span>
	{#if onScreenshot}
		<button
			type="button"
			class="p-1.5 rounded-md bg-zinc-800/90 border border-zinc-600/60 text-zinc-400 hover:text-white hover:bg-zinc-700/90 shrink-0"
			onclick={onScreenshot}
			title="Screenshot"
			aria-label="Take screenshot"
		>
			<Camera size={14} />
		</button>
	{/if}
</div>
