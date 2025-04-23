<script>
	let { 
		id, 
		label,
		value = $bindable(1),
		min = 1,
		max = 60,
		step = 1,
		disabled = false,
		unit = ''
	} = $props();
</script>

<div class="grid w-full gap-2">
	{#if label}
		<div class="flex flex-row justify-between items-center">
			<label for={id} class="text-sm font-medium text-white/80">
				{label}
			</label>
			<span class="text-xs text-green-400/90 font-medium">{value} {unit}</span>
		</div>
	{/if}

	<input 
		id={id}
		type="range"
		bind:value={value}
		oninput={(e) => (value = Number(e.target.value))}
		min={min}
		max={max}
		step={step}
		disabled={disabled}
		class="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-700/70 accent-green-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-green-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
	/>
</div> 