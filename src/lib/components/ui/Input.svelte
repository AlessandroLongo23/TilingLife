<script>
	let { 
		id, 
		type = "text", 
		label, 
		value = $bindable(''), 
		placeholder = "", 
		min, 
		max, 
		step, 
		disabled = false 
	} = $props();
</script>

<div class="grid w-full gap-1.5">
	{#if label}
		<label for={id} class="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-50">
			{label}
		</label>
	{/if}
	<input 
		id={id}
		type={type}
		bind:value={value}
		oninput={(e) => (value = type === "number" ? Number(e.target.value) : e.target.value)}
		placeholder={placeholder}
		min={min}
		max={max}
		step={step}
		disabled={disabled}
		class="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-offset-zinc-800 dark:placeholder:text-zinc-400 dark:focus-visible:ring-blue-400"
	/>
</div> 