<script>
	import { sounds } from '$lib/utils/sounds.js';
	
	let { name, cr, rulestring, groupId, onClick, golRules } = $props();

	let isDual = $derived(rulestring.includes('*'));

	const capitalize = (str) => {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	const formatCrNotation = (cr) => {
		if (!cr) return '';
		
		let formatted = cr.replace(/\^(\d+)/g, '<sup>$1</sup>');
		
		formatted = formatted.replace(/_(\d+)/g, '<sub>$1</sub>');
		
		return formatted;
	}
	
	function handleClick() {
		sounds.button();
		onClick({
			name,
			cr,
			rulestring,
			golRules
		});
	}
</script>

<button 
	class="w-full p-3 border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/60 transition-all rounded-lg mb-2 text-left group"
	onclick={handleClick}
>
	<div class="flex flex-col gap-2">
		<span class="text-sm font-medium mb-1 text-white/90 group-hover:text-white truncate">{capitalize(name)}</span>
		<div class="relative w-full aspect-square bg-zinc-700/30 rounded-md flex items-center justify-center overflow-hidden border border-zinc-700/40 group-hover:border-green-500/50">
			<img src={`/tilings/${groupId}/${rulestring.replaceAll('/', '_').replaceAll('*', '_')}.webp`} alt={name} class="w-full h-full object-cover rounded-md group-hover:scale-105 transition-transform duration-300">
			{#if isDual}
				<div class="absolute top-0 right-1">
					<span class="text-xs font-medium text-white/90 group-hover:text-white bg-zinc-800 rounded-full px-2 py-[2px]">Dual</span>
				</div>
			{/if}
		</div>
		{#if cr}
			<span class="text-xs text-zinc-400">C&R: {@html formatCrNotation(cr)}</span>
		{/if}
	</div>
</button> 