<script>
	let { 
		id,
		label, 
		checked = $bindable(false), 
		disabled = false 
	} = $props();
</script>

<div class="flex items-center space-x-2">
	<input
		type="checkbox"
		id={id}
		bind:checked={checked}
		onchange={(e) => (checked = e.target.checked)}
		disabled={disabled}
		class="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:ring-offset-zinc-800 dark:checked:bg-blue-500 dark:focus:ring-blue-400"
	/>
	<label
		for={id}
		class="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-50"
	>
		{label}
	</label>
</div> 