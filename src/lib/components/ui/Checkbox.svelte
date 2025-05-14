<script>
	import { Check } from 'lucide-svelte';
	import { sounds } from '$lib/utils/sounds.js';

	let { 
		id,
		label, 
		checked = $bindable(false), 
		disabled = false,
		// position = 'right'
	} = $props();
	
	function handleToggle() {
		if (!disabled) {
			const newValue = !checked;
			checked = newValue;
			
			if (newValue) {
				sounds.toggleOn();
			} else {
				sounds.toggleOff();
			}
		}
	}
</script>

<div 
	tabindex="0"
	role="checkbox"
	aria-checked={checked}
	class="flex items-center space-x-3 cursor-pointer" 
	onclick={handleToggle}
	onkeypress={(e) => {}}
>
	<div class="relative flex items-center">
		<input
			type="checkbox"
			id={id}
			bind:checked={checked}
			onchange={(e) => {
				checked = e.target.checked;
				if (checked) sounds.toggleOn();
				else sounds.toggleOff();
			}}
			disabled={disabled}
			class="peer h-4 w-4 appearance-none rounded border border-zinc-600/60 bg-zinc-800/50 checked:bg-green-500/90 checked:border-green-500/80 focus:outline-none focus:ring-1 focus:ring-green-500/40 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
		/>
		<Check class="absolute top-0 left-0 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
	</div>
	<label
		for={null}
		class="text-sm font-medium text-white/80 cursor-pointer"
	>
		{label}
	</label>
</div> 