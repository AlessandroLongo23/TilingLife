<script>
	import { Search, X } from 'lucide-svelte';
	import { untrack } from 'svelte';

	let {
		activeSearch = $bindable(''),
		placeholder = 'Filter by name...',
		debounceMs = 200
	} = $props();

	let searchQuery = $state(activeSearch);
	let debounceTimer = null;

	function handleInput(event) {
		searchQuery = event.target.value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			activeSearch = searchQuery.trim().toLowerCase();
		}, debounceMs);
	}

	function clearSearch() {
		searchQuery = '';
		activeSearch = '';
	}

	$effect(() => {
		if (activeSearch === '') {
			untrack(() => { searchQuery = ''; });
		}
	});
</script>

<div class="flex flex-col gap-2">
	<span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Search</span>
	<div class="relative">
		<Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
		<input
			type="text"
			bind:value={searchQuery}
			oninput={handleInput}
			{placeholder}
			class="w-full h-9 rounded-md border border-zinc-700/50 bg-zinc-800/90 pl-9 pr-8 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/40 focus-visible:border-green-500/70 transition-all"
		/>
		{#if searchQuery}
			<button
				class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
				onclick={clearSearch}
				aria-label="Clear search"
			>
				<X size={14} />
			</button>
		{/if}
	</div>
</div>
