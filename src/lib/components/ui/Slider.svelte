<script>
	let { 
		id, 
		label,
		value = $bindable(1),
		min = 1,
		max = 60,
		step = 1,
		disabled = false
	} = $props();
</script>

<div class="grid w-full gap-1.5">
	{#if label}
		<div class="flex justify-between items-center">
			<label for={id} class="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-50">
				{label}
			</label>
			<span class="text-xs text-zinc-500 dark:text-zinc-400">{value}</span>
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
		class="w-full h-2 rounded-md appearance-none cursor-pointer bg-zinc-200 dark:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
	/>
</div> 