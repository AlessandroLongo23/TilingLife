<script>
	import { sounds } from '$lib/utils/sounds.js';
	
	let { 
		id = null,
		leftValue, 
		rightValue, 
		value = $bindable(''),
		disabled = false,
		label = null,
		align = 'left',
		padding = 'py-2 px-4'
	} = $props();
	
	function handleLeftClick() {
		if (value !== leftValue && !disabled) {
			value = leftValue;
			sounds.toggleOn();
		}
	}
	
	function handleRightClick() {
		if (value !== rightValue && !disabled) {
			value = rightValue;
			sounds.toggleOff();
		}
	}
</script>

<div class="w-full {align === 'center' ? 'flex flex-col items-center' : 'grid'} gap-1.5">
	{#if label}
		<label for={id} class="{align === 'center' ? 'text-lg font-bold' : 'text-sm font-medium'}  leading-none text-white/80">
			{label}
		</label>
	{/if}

	<div class="relative inline-flex rounded-md shadow-sm">
		<button 
			type="button"
			aria-label={leftValue}
			role="radio"
			aria-checked={value === leftValue}
			disabled={disabled}
			onclick={handleLeftClick}
			class="relative {padding} text-sm font-medium transition-all duration-200 ease-in-out
				rounded-l-md border border-r-0 border-zinc-700/50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500/40
				{value == leftValue 
					? 'bg-green-500/50 text-white hover:bg-green-600/50 border-green-500/80' 
					: 'bg-zinc-800/40 text-zinc-200 hover:bg-zinc-700/60 border-zinc-700/50'}
				{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
		>
			{leftValue.charAt(0).toUpperCase() + leftValue.slice(1)}
		</button>
		<button
			type="button"
			aria-label={rightValue}
			role="radio"
			aria-checked={value === rightValue}
			disabled={disabled}
			onclick={handleRightClick}
			class="relative {padding} text-sm font-medium transition-all duration-200 ease-in-out
				rounded-r-md border border-zinc-700/50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500/40
				{value == rightValue 
					? 'bg-green-500/50 text-white hover:bg-green-600/50 border-green-500/80' 
					: 'bg-zinc-800/40 text-zinc-200 hover:bg-zinc-700/60 border-zinc-700/50'}
				{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
		>
			{rightValue.charAt(0).toUpperCase() + rightValue.slice(1)}
		</button>
	</div> 
</div> 