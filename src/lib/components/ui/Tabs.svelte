<script>
	import { activeTab } from '$lib/stores/configuration';

	let { 
		tabs = []
	} = $props();
</script>

<div class="w-full">
	<div class="flex border-b border-zinc-600">
		{#each tabs as tab}
			<button
				onclick={() => { $activeTab = tab }}
				class="px-4 py-2 text-sm font-medium {$activeTab === tab ? 'text-white border-b-2 border-blue-500' : 'text-zinc-300 hover:text-white'}"
				aria-selected={$activeTab === tab}
				role="tab"
			>
				{tab}
			</button>
		{/each}
	</div>
	
	<div class="py-4 overflow-y-auto">
		{#if $activeTab === tabs[0]}
			<slot name='tab-0' />
		{:else if $activeTab === tabs[1]}
			<slot name='tab-1' />
		{/if}
	</div>
</div> 