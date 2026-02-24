<script>
	import Checkbox from '$components/ui/Checkbox.svelte';

	let {
		enabled = $bindable(false),
		angle = $bindable(30),
		debounceMs = 300
	} = $props();

	let inputValue = $state(angle);
	let debounceTimer = null;

	function handleInput(event) {
		inputValue = event.target.value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const n = Number(inputValue);
			if (!Number.isNaN(n)) angle = n;
		}, debounceMs);
	}

	$effect(() => {
		if (angle !== Number(inputValue)) {
			inputValue = angle;
		}
	});
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between">
		<span class="text-xs uppercase text-zinc-400 font-medium tracking-wider">Angle Modulo</span>
	</div>

	<Checkbox
		id="angleEnabled"
		label="Enable angle filter"
		bind:checked={enabled}
	/>

	<div class="relative">
		<input
			type="number"
			id="angleFilter"
			value={inputValue}
			oninput={handleInput}
			disabled={!enabled}
			min="1"
			max="180"
			class="w-full h-9 rounded-md border border-zinc-700/50 bg-zinc-800/90 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/40 focus-visible:border-green-500/70 transition-all disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
		/>
		<span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">deg</span>
	</div>
</div>
