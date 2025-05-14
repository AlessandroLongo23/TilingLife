<script>
	import { sounds } from '$lib/utils/sounds.js';
	import { 
		Activity, // For Generations
		Grid, // For Totalistic 
		Pilcrow, // For Non-totalistic
		Maximize, // For Larger than Life
		Compass, // For Isotropic
		Workflow, // For Anisotropic  
		Heart, // For Stable
		Bomb, // For Explosive
		Sparkles // For Chaotic
	} from 'lucide-svelte';
	
	let { name, rule, description, onClick } = $props();
	
	function handleClick() {
		sounds.button();
		onClick(rule);
	}
	
	function parseRuleString(ruleString) {
		const characteristics = {
			isGenerations: false,
			isLargerThanLife: false,
			isTotalistic: true, // Default
			isNonTotalistic: false,
			isIsotropic: true, // Default
			isAnisotropic: false,
			stability: 'chaotic' // Default: chaotic, stable, or explosive
		};
		
		// Check if it's a Generations rule (has a third parameter)
		if (ruleString.split('/').length > 2) {
			const thirdPart = ruleString.split('/')[2];
			if (thirdPart && !isNaN(parseInt(thirdPart))) {
				characteristics.isGenerations = true;
			}
		}
		
		// Check for Larger Than Life format (starts with R)
		if (ruleString.startsWith('R')) {
			characteristics.isLargerThanLife = true;
		}
		
		// Check for non-totalistic rules (contain letters after numbers)
		if (/[0-9][a-z]/i.test(ruleString)) {
			characteristics.isTotalistic = false;
			characteristics.isNonTotalistic = true;
		}
		
		// Check for anisotropic rules (MAP strings or special notation)
		if (ruleString.includes('MAP') || /[a-z]{5,}/i.test(ruleString)) {
			characteristics.isIsotropic = false;
			characteristics.isAnisotropic = true;
		}
		
		// Determine stability based on birth conditions
		// Extract birth conditions
		let birthConditions = [];
		
		if (ruleString.startsWith('B')) {
			// B/S format
			const birthPart = ruleString.split('/')[0].substring(1);
			birthConditions = birthPart.split('').filter(c => /[0-9]/.test(c)).map(Number);
		} else if (ruleString.includes('/')) {
			// S/B format
			const birthPart = ruleString.split('/')[1];
			birthConditions = birthPart.split('').filter(c => /[0-9]/.test(c)).map(Number);
		}
		
		// Determine stability based on birth conditions
		if (birthConditions.includes(1)) {
			characteristics.stability = 'explosive';
		} else if (birthConditions.includes(2)) {
			characteristics.stability = 'explosive';
		} else if (birthConditions.some(n => n >= 4)) {
			characteristics.stability = 'stable';
		}
		
		return characteristics;
	}
	
	const characteristics = parseRuleString(rule);
</script>

<button 
	class="w-full p-4 border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/60 transition-all rounded-lg mb-2 text-left group"
	onclick={handleClick}
>
	<div class="flex flex-col">
		<span class="text-base font-medium mb-1 text-white/90 group-hover:text-white">{name}</span>
		<span class="text-xs font-mono text-green-300/80 mb-2">{rule}</span>
		<p class="text-xs text-white/70 mb-3 line-clamp-2">{description}</p>
		
		<div class="flex space-x-2 mt-auto">
			<!-- Stability indicator -->
			{#if characteristics.stability === 'stable'}
				<Heart class="w-4 h-4 text-blue-400" />
			{:else if characteristics.stability === 'explosive'}
				<Bomb class="w-4 h-4 text-red-400" />
			{:else}
				<Sparkles class="w-4 h-4 text-yellow-400" />
			{/if}
			
			<!-- Rule type indicators -->
			{#if characteristics.isGenerations}
				<Activity class="w-4 h-4 text-purple-400" title="Generations rule" />
			{/if}
			
			{#if characteristics.isLargerThanLife}
				<Maximize class="w-4 h-4 text-green-400" title="Larger Than Life rule" />
			{/if}
			
			{#if characteristics.isTotalistic}
				<Grid class="w-4 h-4 text-blue-400" title="Totalistic rule" />
			{:else if characteristics.isNonTotalistic}
				<Pilcrow class="w-4 h-4 text-orange-400" title="Non-totalistic rule" />
			{/if}
			
			{#if characteristics.isIsotropic}
				<Compass class="w-4 h-4 text-teal-400" title="Isotropic rule" />
			{:else if characteristics.isAnisotropic}
				<Workflow class="w-4 h-4 text-pink-400" title="Anisotropic rule" />
			{/if}
		</div>
	</div>
</button> 