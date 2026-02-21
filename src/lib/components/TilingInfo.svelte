<script>
	import * as ls from 'lucide-svelte';
	
	let { 
		tileCount = 0
	} = $props();
	
	let isHovered = $state(false);
</script>

<div 
	class="relative"
	onmouseenter={() => isHovered = true}
	onmouseleave={() => isHovered = false}
>
	<button
		class="info-button flex items-center justify-center w-8 h-8 rounded-md bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-white/70 hover:text-white hover:bg-zinc-700/80 hover:border-zinc-600/60 transition-all duration-200"
		aria-label="Tiling information"
	>
		<ls.Info size={16} />
	</button>
	
	{#if isHovered}
		<div 
			class="info-tooltip absolute left-0 top-10 min-w-44 bg-zinc-800/95 backdrop-blur-sm rounded-lg border border-zinc-700/50 shadow-xl p-3 z-50"
		>
			<div class="flex flex-col gap-2">
				<h4 class="text-xs font-medium text-white/60 uppercase tracking-wider">Tiling Info</h4>
				
				<div class="flex items-center justify-between gap-4">
					<span class="text-sm text-white/80">Tiles</span>
					<span class="text-sm font-medium text-green-400/90 bg-green-400/10 px-2 py-0.5 rounded">
						{tileCount.toLocaleString()}
					</span>
				</div>
			</div>
			
			<div class="tooltip-arrow"></div>
		</div>
	{/if}
</div>

<style>
	.info-button:focus {
		outline: none;
		ring: 1px;
		ring-color: rgba(34, 197, 94, 0.4);
	}
	
	.info-tooltip {
		animation: fadeIn 0.15s ease-out;
	}
	
	.tooltip-arrow {
		position: absolute;
		top: -6px;
		left: 12px;
		width: 12px;
		height: 12px;
		background: inherit;
		border-top: 1px solid rgba(63, 63, 70, 0.5);
		border-left: 1px solid rgba(63, 63, 70, 0.5);
		transform: rotate(45deg);
		border-radius: 2px 0 0 0;
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
