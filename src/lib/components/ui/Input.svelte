<script>
	import { sounds } from '$lib/utils/sounds.js';
	
	let { 
		id, 
		type = "text", 
		label = null, 
		value = $bindable(''), 
		placeholder = "", 
		min, 
		max, 
		step = 1, 
		disabled = false,
		align,
		onChangeFunction = () => {}
	} = $props();

	let incrementTimer;
	let decrementTimer; 
	let initialDelay = 300; // ms before starting continuous increments (reduced)
	let repeatInterval = 80; // ms between increments once started (reduced)
	let prevValue = value;
	
	// Track value changes and play sound
	$effect(() => {
		if (type === "number" && value !== prevValue) {
			sounds.slider();
			prevValue = value;
		}
	});

	function increment() {
		if (disabled || type !== 'number') return;
		
		const newValue = Number(value) + (step || 1);
		if (max !== undefined && newValue > max) return;
		
		value = newValue;
		onChangeFunction({ target: { value: newValue } });
		
		// Sound is played by the effect
	}

	function decrement() {
		if (disabled || type !== 'number') return;
		
		const newValue = Number(value) - (step || 1);
		if (min !== undefined && newValue < min) return;
		
		value = newValue;
		onChangeFunction({ target: { value: newValue } });
		
		// Sound is played by the effect
	}

	function startIncrementing() {
		if (disabled || type !== 'number') return;
		
		// Clear any existing timer
		clearInterval(incrementTimer);
		
		// Do one increment immediately
		increment();
		
		// Start continuous increments after a delay
		incrementTimer = setTimeout(() => {
			incrementTimer = setInterval(() => {
				increment();
			}, repeatInterval);
		}, initialDelay);
	}
	
	function startDecrementing() {
		if (disabled || type !== 'number') return;
		
		// Clear any existing timer
		clearInterval(decrementTimer);
		
		// Do one decrement immediately
		decrement();
		
		// Start continuous decrements after a delay
		decrementTimer = setTimeout(() => {
			decrementTimer = setInterval(() => {
				decrement();
			}, repeatInterval);
		}, initialDelay);
	}
	
	function stopContinuousChange() {
		clearTimeout(incrementTimer);
		clearTimeout(decrementTimer);
		clearInterval(incrementTimer);
		clearInterval(decrementTimer);
	}
	
	function handleInput(e) {
		const oldValue = value;
		
		if (type === "number") {
			value = Number(e.target.value);
			
			// Explicitly play sound on manual input
			if (oldValue !== value) {
				sounds.slider();
			}
		}
		
		onChangeFunction(e);
	}
</script>

<div class="w-full {align === 'center' ? 'flex flex-col items-center' : 'grid'} gap-1.5">
	{#if label}
		<label for={id} class="{align === 'center' ? 'text-lg font-bold' : 'text-sm font-medium'}  leading-none text-white/80">
			{label}
		</label>
	{/if}
	
	<div class="relative w-full">
		<input 
			id={id}
			type={type}
			bind:value={value}
			oninput={handleInput}
			placeholder={placeholder}
			min={min}
			max={max}
			step={step}
			disabled={disabled}
			class="flex {align === 'center' ? 'text-center' : ''} h-9 w-full rounded-md border border-zinc-700/50 bg-zinc-800/90 px-3 py-2 text-sm text-zinc-100 ring-offset-zinc-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/40 focus-visible:border-green-500/70 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
		/>

		{#if type === 'number'}
			<div class="absolute inset-y-0 right-0 flex flex-col border-l border-zinc-700/50 text-white/70">
				<button 
					type="button"
					onmousedown={startIncrementing}
					onmouseup={stopContinuousChange}
					onmouseleave={stopContinuousChange}
					class="flex items-center justify-center h-[18px] w-8 hover:bg-zinc-700/40 hover:text-white border-b border-zinc-700/50 rounded-tr-md transition-colors"
					disabled={disabled || (max !== undefined && Number(value) >= max)}
					aria-label="Increment"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
				</button>
				<button 
					type="button"
					onmousedown={startDecrementing}
					onmouseup={stopContinuousChange}
					onmouseleave={stopContinuousChange}
					class="flex items-center justify-center h-[18px] w-8 hover:bg-zinc-700/40 hover:text-white rounded-br-md transition-colors"
					disabled={disabled || (min !== undefined && Number(value) <= min)}
					aria-label="Decrement"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
				</button>
			</div>
		{/if}
	</div>
</div> 