<script>
	import { activeTab } from '$stores';

	let { 
		tabs = [],
		tab0,
		tab1,
		tab2
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
			{@render tab0?.()}
		{:else if $activeTab === tabs[1]}
			{@render tab1?.()}
		{:else if $activeTab === tabs[2]}
			{@render tab2?.()}
		{/if}
	</div>
</div> 