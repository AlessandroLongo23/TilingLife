<script>
  let { tabs = [] } = $props();
  let activeTab = $state(0);
  
  function setActiveTab(index) {
    activeTab = index;
  }
</script>

<div class="w-full">
  <div class="flex border-b border-zinc-600">
    {#each tabs as tab, index}
      <button
        onclick={() => setActiveTab(index)}
        class="px-4 py-2 text-sm font-medium {activeTab === index ? 'text-white border-b-2 border-blue-500' : 'text-zinc-300 hover:text-white'}"
        aria-selected={activeTab === index}
        role="tab"
      >
        {tab}
      </button>
    {/each}
  </div>
  
  <div class="py-4 overflow-y-auto">
    {#if activeTab === 0}
      <slot name="tab-0" />
    {:else if activeTab === 1}
      <slot name="tab-1" />
    {:else if activeTab === 2}
      <slot name="tab-2" />
    {:else}
      <slot />
    {/if}
  </div>
</div> 