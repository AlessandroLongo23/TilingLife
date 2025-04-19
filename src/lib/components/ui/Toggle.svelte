<script>
	let { 
		leftValue, 
		rightValue, 
		value = $bindable(''),
		disabled = false
	} = $props();
</script>

<div class="relative inline-flex rounded-md shadow-sm">
	<button 
		type="button"
		aria-label={leftValue}
		role="radio"
		aria-checked={value === leftValue}
		disabled={disabled}
        onclick={() => value = leftValue}
		class="relative py-2 px-4 text-sm font-medium transition-all duration-200 ease-in-out
			rounded-l-md border border-r-0 border-zinc-700/50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500/40
			{value == leftValue 
				? 'bg-green-500/90 text-white hover:bg-green-600/90 border-green-500/80' 
				: 'bg-zinc-800/40 text-zinc-200 hover:bg-zinc-700/60 border-zinc-700/50'}
			{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
	>
		{leftValue}
	</button>
	<button
		type="button"
		aria-label={rightValue}
		role="radio"
		aria-checked={value === rightValue}
		disabled={disabled}
        onclick={() => value = rightValue}
		class="relative py-2 px-4 text-sm font-medium transition-all duration-200 ease-in-out
			rounded-r-md border border-zinc-700/50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500/40
			{value == rightValue 
				? 'bg-green-500/90 text-white hover:bg-green-600/90 border-green-500/80' 
				: 'bg-zinc-800/40 text-zinc-200 hover:bg-zinc-700/60 border-zinc-700/50'}
			{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
	>
		{rightValue}
	</button>
</div> 