<script>
	import { activeTab } from '$lib/stores/configuration.js';

	let { 
		tabs = []
	} = $props();
</script>

<div class="w-full h-full flex flex-col">
	<div class="flex border-b border-zinc-700/50 flex-shrink-0 bg-zinc-800/60">
		{#each tabs as tab}
			<button
				onclick={() => { $activeTab = tab }}
				class="px-4 py-3 text-sm font-medium transition-all {$activeTab === tab ? 'text-white border-b-2 border-green-500 bg-zinc-800/40' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/20'}"
				aria-selected={$activeTab === tab}
				role="tab"
			>
				{tab}
			</button>
		{/each}
	</div>
	
	<div class="flex-1 overflow-hidden">
		{#if $activeTab === tabs[0]}
			<slot name='tab-0' />
		{:else if $activeTab === tabs[1]}
			<slot name='tab-1' />
		{:else if $activeTab === tabs[2]}
			<slot name='tab-2' />
		{/if}
	</div>
</div> 