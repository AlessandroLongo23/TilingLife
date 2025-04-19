<script>
	let { 
		id,
		label, 
		checked = $bindable(false), 
		disabled = false 
	} = $props();
</script>

<div class="flex items-center space-x-3">
	<div class="relative flex items-center">
		<input
			type="checkbox"
			id={id}
			bind:checked={checked}
			onchange={(e) => (checked = e.target.checked)}
			disabled={disabled}
			class="peer h-4 w-4 appearance-none rounded border border-zinc-600/60 bg-zinc-800/50 checked:bg-green-500/90 checked:border-green-500/80 focus:outline-none focus:ring-1 focus:ring-green-500/40 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
		/>
		<svg 
			class="pointer-events-none absolute h-4 w-4 stroke-white opacity-0 peer-checked:opacity-100 transition-opacity" 
			viewBox="0 0 16 16" 
			fill="none" 
			stroke="currentColor" 
			stroke-width="2" 
			stroke-linecap="round" 
			stroke-linejoin="round"
		>
			<polyline points="3,8 7,12 13,4"></polyline>
		</svg>
	</div>
	<label
		for={id}
		class="text-sm font-medium text-white/80 select-none"
	>
		{label}
	</label>
</div> 