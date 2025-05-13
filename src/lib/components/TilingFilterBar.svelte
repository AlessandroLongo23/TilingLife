<script>
    import { tilingRules } from '$lib/stores/tilingRules';
    import { ChevronUp, ChevronDown } from 'lucide-svelte';
    import { vertexTypes } from '$lib/stores/vertexTypes';

    import Toggle from '$lib/components/ui/Toggle.svelte';
    import VertexTypeCard from '$lib/components/VertexTypeCard.svelte';
    
    let {
        selectedTypes = $bindable([]),
        selectedPolygons = $bindable([]),
        showDual = $bindable(false),
        selectedVertexTypes = $bindable([]),
        polygonFilterMode = $bindable('exact'),
        vertexTypeFilterMode = $bindable('exact')
    } = $props();

    let typesSectionExpanded = $state(true);
    let polygonSectionExpanded = $state(true);
    let dualSectionExpanded = $state(true);
    let vertexTypesSectionExpanded = $state(true);

    const toggleSection = (section) => {
        if (section === 'types') typesSectionExpanded = !typesSectionExpanded;
        if (section === 'polygons') polygonSectionExpanded = !polygonSectionExpanded;
        if (section === 'dual') dualSectionExpanded = !dualSectionExpanded;
        if (section === 'vertexTypes') vertexTypesSectionExpanded = !vertexTypesSectionExpanded;
    };

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
    
    const toggleVertexType = (vertexTypeId) => {
        if (selectedVertexTypes.includes(vertexTypeId)) {
            selectedVertexTypes = selectedVertexTypes.filter(vt => vt !== vertexTypeId);
        } else {
            selectedVertexTypes = [...selectedVertexTypes, vertexTypeId];
        }
    };
    
    const toggleDual = () => {
        showDual = !showDual;
    };
    
    const clearFilters = () => {
        selectedTypes = [];
        selectedPolygons = [];
        selectedVertexTypes = [];
        showDual = false;
        polygonFilterMode = 'exact';
        vertexTypeFilterMode = 'exact';
    };
</script>

<div class="h-full overflow-y-auto border-r border-zinc-700/50">
    <div class="flex flex-col gap-6 p-4">
        <div class="filter-section">
            <div 
                role="button"
                tabindex="0"
                onkeydown={() => {}}
                class="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-zinc-800/80 transition-colors" 
                onclick={() => toggleSection('types')}
            >
                <h3 class="text-xs uppercase text-zinc-300 font-medium tracking-wider">Class</h3>
                <button class="p-1.5 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700/50">
                    {#if typesSectionExpanded}
                        <ChevronUp size={14} class="text-green-400" />
                    {:else}
                        <ChevronDown size={14} />
                    {/if}
                </button>
            </div>
            
            {#if typesSectionExpanded}
                <div class="flex flex-wrap gap-2 mt-3 pl-2 animate-in slide-in-from-top-2 duration-200">
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
            {/if}
        </div>
        
        <div class="filter-section border-t border-zinc-800 pt-4">
            <div class="flex flex-col gap-2">
                <div class="flex justify-between items-center p-2 rounded-md hover:bg-zinc-800/80 transition-colors">
                    <div class="flex items-center gap-2">
                        <h3 class="text-xs uppercase text-zinc-300 font-medium tracking-wider">Polygon</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <Toggle
                            leftValue="exact"
                            rightValue="contains"
                            bind:value={polygonFilterMode}
                            padding="py-1 px-4"
                        />
                        <button class="p-1.5 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700/50" onclick={() => toggleSection('polygons')}>
                            {#if polygonSectionExpanded}
                                <ChevronUp size={14} class="text-green-400" />
                            {:else}
                                <ChevronDown size={14} />
                            {/if}
                        </button>
                    </div>
                </div>
                
                {#if polygonSectionExpanded}
                    <div class="pl-2 animate-in slide-in-from-top-2 duration-200">
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
                {/if}
            </div>
        </div>
        
        <!-- Vertex Types filter -->
        <div class="filter-section border-t border-zinc-800 pt-4">
            <div class="flex flex-col gap-2">
                <div class="flex justify-between items-center p-2 rounded-md hover:bg-zinc-800/80 transition-colors">
                    <div class="flex items-center gap-2">
                        <h3 class="text-xs uppercase text-zinc-300 font-medium tracking-wider">Vertex Type</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <Toggle
                            leftValue="exact"
                            rightValue="contains"
                            bind:value={vertexTypeFilterMode}
                            padding="py-1 px-4"
                        />
                        <button class="p-1.5 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700/50" onclick={() => toggleSection('vertexTypes')}>
                            {#if vertexTypesSectionExpanded}
                                <ChevronUp size={14} class="text-green-400" />
                            {:else}
                                <ChevronDown size={14} />
                            {/if}
                        </button>
                    </div>
                </div>
                
                {#if vertexTypesSectionExpanded}
                    <div class="pl-2 animate-in slide-in-from-top-2 duration-200">
                        <div class="grid grid-cols-2 gap-2">
                            {#each $vertexTypes as vertexType}
                                <div class="w-full aspect-square">
                                    <VertexTypeCard 
                                        id={vertexType.id}
                                        name={vertexType.name}
                                        isSelected={selectedVertexTypes.includes(vertexType.id)}
                                        onToggle={toggleVertexType}
                                    />
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
        
        <!-- Dual toggle -->
        <div class="filter-section border-t border-zinc-800 pt-4">
            <div 
                role="button"
                tabindex="0"
                onkeydown={() => {}}
                class="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-zinc-800/80 transition-colors" 
                onclick={() => toggleSection('dual')}
            >
                <h3 class="text-xs uppercase text-zinc-300 font-medium tracking-wider">Dual Tilings</h3>
                <button class="p-1.5 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700/50">
                    {#if dualSectionExpanded}
                        <ChevronUp size={14} class="text-green-400" />
                    {:else}
                        <ChevronDown size={14} />
                    {/if}
                </button>
            </div>
            
            {#if dualSectionExpanded}
                <div class="flex justify-between items-center mt-3 pl-2 animate-in slide-in-from-top-2 duration-200">
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
            {/if}
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