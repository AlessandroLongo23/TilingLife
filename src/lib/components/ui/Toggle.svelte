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
			rounded-l-md border border-r-0 border-zinc-300 dark:border-zinc-600 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500
			{value == leftValue 
				? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500 dark:border-blue-500' 
				: 'bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'}
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
			rounded-r-md border border-zinc-300 dark:border-zinc-600 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500
			{value == rightValue 
				? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500 dark:border-blue-500' 
				: 'bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'}
			{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
	>
		{rightValue}
	</button>
</div> 