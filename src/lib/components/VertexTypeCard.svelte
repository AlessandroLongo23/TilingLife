<script>
    let { 
        id = $bindable(''),
        name = $bindable(''),
        isSelected = $bindable(false),
        onToggle = $bindable(() => {})
    } = $props();
    
    const handleClick = () => {
        onToggle(id);
    };
</script>

<button 
    class="w-full h-full group flex flex-col items-center justify-between border rounded-lg overflow-hidden transition-all {
        isSelected 
            ? 'border-green-500/50 bg-green-500/10' 
            : 'border-zinc-700/50 bg-zinc-800/50 hover:border-zinc-600/80 hover:bg-zinc-800/80 '
    }"
    onclick={handleClick}
    aria-pressed={isSelected}
>
    <div class="w-full aspect-square relative">
        <div class="absolute top-1 left-1 z-10 px-2 py-1 rounded-md font-medium text-sm backdrop-blur-sm {
            isSelected 
                ? 'bg-black/60 text-green-400 ' 
                : 'bg-black/50 text-white/90 '
        }">
            {name}
        </div>

        <img 
            src="theory/images/vertexTypes/{id}.png" 
            alt="Vertex type {name}" 
            class="w-full h-full object-contain transition-all {isSelected ? 'scale-105' : 'grayscale group-hover:opacity-90 group-hover:grayscale-0 group-hover:scale-105'}"
        />
    </div>
</button> 