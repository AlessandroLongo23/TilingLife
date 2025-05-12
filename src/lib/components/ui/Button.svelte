<script>
	let {
		id,
		label,
		icon,
		classes,
		onclick = () => {}
	} = $props();
</script>

<button 
	id={id} 
	onclick={onclick} 
	class="{classes} bg-zinc-800/40 hover:bg-zinc-700/60 text-white/90 hover:text-white px-4 py-2 rounded-md transition-all duration-200 border border-zinc-700/50 hover:border-zinc-600/80 font-medium text-sm flex items-center justify-center gap-2"
>
	{#if icon}
		<svelte:component this={icon} class="w-4 h-4" />
	{/if}
	{label}
</button>