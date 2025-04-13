<script>
  let { title, value, onClick } = $props();
</script>

<button 
  class="w-full p-4 border border-zinc-600 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors mb-4 text-left"
  onclick={() => onClick(value)}
>
  <div class="flex flex-col items-center">
    <h3 class="text-lg font-medium mb-4 text-white">{title}</h3>
    <div class="w-32 h-32 bg-zinc-600 rounded-md flex items-center justify-center mb-2">
      <span class="text-xs text-zinc-300">Preview image</span>
    </div>
  </div>
</button> 