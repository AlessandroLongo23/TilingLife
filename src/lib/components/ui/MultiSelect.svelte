<script>
	import { sounds } from '$utils';

	let {
		label = null,
		options = [],
		selected = $bindable([]),
	} = $props();

	function toggle(id) {
		if (selected.includes(id)) {
			selected = selected.filter(s => s !== id);
			sounds.toggleOff();
		} else {
			selected = [...selected, id];
			sounds.toggleOn();
		}
	}

	function selectAll() {
		selected = options.map(o => o.id);
		sounds.toggleOn();
	}

	function deselectAll() {
		selected = [];
		sounds.toggleOff();
	}

	let allSelected = $derived(selected.length === options.length);
</script>

<div class="flex flex-col gap-2">
	{#if label}
		<div class="flex items-center justify-between">
			<span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">{label}</span>
			<button
				class="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-700/40"
				onclick={() => allSelected ? deselectAll() : selectAll()}
			>
				{allSelected ? 'Clear' : 'All'}
			</button>
		</div>
	{/if}

	<div class="flex flex-wrap gap-1.5">
		{#each options as option}
			<button
				class="px-3 py-1 text-xs rounded-full transition-all border select-none
					{selected.includes(option.id)
						? 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25'
						: 'bg-zinc-800/80 text-zinc-500 border-zinc-700/40 hover:bg-zinc-700/50 hover:text-zinc-300'}"
				onclick={() => toggle(option.id)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</div>
