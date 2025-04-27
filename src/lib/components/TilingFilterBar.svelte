<script>
    import { tilingRules } from '$lib/stores/tilingRules';
    import { Search } from 'lucide-svelte';
    
    let {
        searchTerm = $bindable(''),
        selectedTypes = $bindable([]),
        selectedPolygons = $bindable([]),
        showDual = $bindable(false),
    } = $props();

    const types = $derived.by(() => {
        let types = [];
        for (let i = 0; i < tilingRules.length; i++) {
            types.push({
                id: tilingRules[i].id,
                label: tilingRules[i].title
            })
        }
        return types;
    });
    
    // Polygon sides available in the tilings
    const polygons = [3, 4, 5, 6, 8, 9, 12];
    
    const toggleType = (typeId) => {
        if (selectedTypes.includes(typeId)) {
            selectedTypes = selectedTypes.filter(t => t !== typeId);
        } else {
            selectedTypes = [...selectedTypes, typeId];
        }
    };
    
    const togglePolygon = (polygon) => {
        if (selectedPolygons.includes(polygon)) {
            selectedPolygons = selectedPolygons.filter(p => p !== polygon);
        } else {
            selectedPolygons = [...selectedPolygons, polygon];
        }
    };
    
    const toggleDual = () => {
        showDual = !showDual;
    };
    
    const clearFilters = () => {
        searchTerm = '';
        selectedTypes = [];
        selectedPolygons = [];
        showDual = false;
    };
</script>

<div class="bg-zinc-900/[0.98] backdrop-blur-xl p-3 rounded-lg border border-zinc-700/50 mb-4">
    <div class="flex flex-col gap-4">
        <!-- Search bar -->
        <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} class="text-zinc-400" />
            </div>
            <input
                type="text"
                class="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700/50 rounded-md text-white text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500/30 focus:outline-none"
                placeholder="Search tilings..."
                bind:value={searchTerm}
            />
        </div>
        
        <!-- Type filter -->
        <div>
            <h3 class="text-xs uppercase text-zinc-400 font-medium mb-2">Type</h3>
            <div class="flex flex-wrap gap-2">
                {#each types as type}
                    <button 
                        class="px-3 py-1 text-xs rounded-full transition-all 
                             {selectedTypes.includes(type.id) ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60'} 
                             border"
                        onclick={() => toggleType(type.id)}
                    >
                        {type.label}
                    </button>
                {/each}
            </div>
        </div>
        
        <!-- Polygon filter -->
        <div>
            <h3 class="text-xs uppercase text-zinc-400 font-medium mb-2">Polygon</h3>
            <div class="flex flex-wrap gap-2">
                {#each polygons as polygon}
                    <button 
                        class="w-9 h-9 flex items-center justify-center rounded-full transition-all 
                             {selectedPolygons.includes(polygon) ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60'} 
                             border text-xs font-medium"
                        onclick={() => togglePolygon(polygon)}
                    >
                        {polygon}
                    </button>
                {/each}
            </div>
        </div>
        
        <!-- Dual toggle -->
        <div class="flex justify-between items-center">
            <div class="text-sm text-zinc-300">Show Dual Tilings</div>
            <button 
                class="w-12 h-6 rounded-full transition-all relative {showDual ? 'bg-green-500/30' : 'bg-zinc-700/50'}"
                onclick={toggleDual}
                aria-label="Toggle dual tilings"
                aria-pressed={showDual}
            >
                <span 
                    class="absolute top-1 w-4 h-4 rounded-full transition-all {showDual ? 'bg-green-400 right-1' : 'bg-zinc-400 left-1'}"
                ></span>
            </button>
        </div>
        
        <!-- Clear filters button -->
        <button 
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md border border-zinc-700/50 transition-all mt-2"
            onclick={clearFilters}
        >
            Clear Filters
        </button>
    </div>
</div> 