<script>
	let { title, value, onClick } = $props();
</script>

<button 
	class="w-full p-2 border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/60 transition-all rounded-lg mb-2 text-left group"
	onclick={() => onClick(value)}
>
	<div class="flex flex-col">
		<span class="text-xs font-medium mb-1 text-white/90 group-hover:text-white">{title}</span>
		<div class="w-full aspect-square bg-zinc-700/30 rounded-md flex items-center justify-center overflow-hidden border border-zinc-700/40 group-hover:border-green-500/50">
			<img src={`/tilings/${title.replaceAll('/', '_')}.png`} alt={title} class="w-full h-full object-cover rounded-md group-hover:scale-105 transition-transform duration-300">
		</div>
	</div>
</button> 