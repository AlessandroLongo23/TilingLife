<script>
    import { tilingRules } from '$lib/stores/tilingRules.js';
    import { selectedTiling } from '$lib/stores/configuration.js';
    import { tilingModalOpen, tilingFilters } from '$lib/stores/modalState.js';
    import { Grid, Funnel } from 'lucide-svelte';
    
    import Modal from '$lib/components/ui/Modal.svelte';
    import TilingCard from '$lib/components/TilingCard.svelte';
    import TilingFilterBar from '$lib/components/TilingFilterBar.svelte';
    
    let showFilters = $state(false);
    
    const toggleFilters = () => {
        showFilters = !showFilters;
    };
    
    let selectedTypes = $state([]);
    let selectedPolygons = $state([]);
    let selectedVertexTypes = $state([]);
    let showDual = $state(false);
    let polygonFilterMode = $state('exact');
    let vertexTypeFilterMode = $state('exact');
    
    $effect(() => {
        const currentFilters = $tilingFilters;
        selectedTypes = currentFilters.selectedTypes;
        selectedPolygons = currentFilters.selectedPolygons;
        selectedVertexTypes = currentFilters.selectedVertexTypes || [];
        showDual = currentFilters.showDual;
        polygonFilterMode = currentFilters.polygonFilterMode || 'exact';
        vertexTypeFilterMode = currentFilters.vertexTypeFilterMode || 'exact';
    });
    
    $effect(() => {
        $tilingFilters = {
            selectedTypes,
            selectedPolygons,
            selectedVertexTypes,
            showDual,
            polygonFilterMode,
            vertexTypeFilterMode
        };
    });
    
    const loadTiling = (tiling) => {
        $selectedTiling = tiling;
        $tilingModalOpen = false;
    };
    
    const getTypeId = (title) => {
        for (let i = 0; i < tilingRules.length; i++) {
            if (tilingRules[i].title === title) {
                return tilingRules[i].id;
            }
        }
        return "";
    };
    
    const matchesPolygon = (tiling, sides) => {
        let polygonParts = tiling.split('/')[0].replaceAll(',', '-').split('-');
        let polygonSides = [];
        
        for (let part of polygonParts) {
            let match = part.match(/^(\d+)/);
            if (match) {
                let side = parseInt(match[1]);
                if (side > 0) {
                    polygonSides.push(side);
                }
            }
        }
        
        if (polygonFilterMode === 'exact') {
            return !sides.some(side => !polygonSides.includes(side)) && !polygonSides.some(side => !sides.includes(side));
        } else {
            return !sides.some(side => !polygonSides.includes(side));
        }
    };
    
    const containsVertexType = (tiling, vertexTypes) => {
        if (!tiling.cr) 
            return false;
        
        if (vertexTypeFilterMode === 'exact') {
            return !vertexTypes.some(vt => !tiling.cr.includes(vt)) && !tiling.cr.split(';').some(group => !vertexTypes.some(vt => group.includes(vt)));
        } else {
            return !vertexTypes.some(vt => !tiling.cr.includes(vt));
        }
    };
    
    let filteredTilings = $derived.by(() => {
        let result = [];
        
        tilingRules.forEach(group => {
            const typeId = getTypeId(group.title);
            
            if (selectedTypes.length > 0 && !selectedTypes.includes(typeId)) {
                return;
            }
            
            group.rules.forEach(rule => {
                if (selectedPolygons.length > 0 && !matchesPolygon(rule.rulestring, selectedPolygons)) {
                    return;
                }
                
                if (selectedVertexTypes.length > 0 && !containsVertexType(rule, selectedVertexTypes)) {
                    return;
                }
                
                result.push({
                    ...rule,
                    group: group.title,
                    groupId: group.id,
                });
                if (showDual && group.dual) {
                    result.push({
                        name: rule.dualname,
                        cr: rule.cr,
                        rulestring: rule.rulestring.concat('*'),
                        group: group.title,
                        groupId: group.id,
                    });
                }
            });
        });
        
        return result;
    });
    
    let activeFiltersCount = $derived(
        selectedTypes.length + selectedPolygons.length + selectedVertexTypes.length + (showDual ? 1 : 0)
    );
</script>

<style>
    .modal-container {
        position: relative;
        height: 80vh;
        overflow: hidden;
        display: flex;
    }
    
    .filters-hidden {
        transform: translateX(-100%);
        opacity: 0;
        pointer-events: none;
        width: 0;
        margin-right: 0;
    }
    
    .filters-visible {
        transform: translateX(0);
        opacity: 1;
        width: 20rem;
        margin-right: 1rem;
    }
    
    .filter-sidebar {
        height: 100%;
        transition: all 0.3s ease;
        overflow-y: auto;
        flex-shrink: 0;
        background-color: rgba(24, 24, 27, 0.95);
        /* border-radius: 0.5rem; */
    }
    
    .catalog-container {
        height: 100%;
        overflow-y: auto;
        flex-grow: 1;
        transition: margin-left 0.3s ease;
    }
    
    .with-filters {
        margin-left: 0;
    }
    
    .without-filters {
        margin-left: 0;
    }
</style>

<Modal 
    bind:isOpen={$tilingModalOpen}
    title="Tiling Rules List"
    maxWidth="max-w-7xl"
>
    <svelte:fragment slot="header">
        <button 
            class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100 relative"
            onclick={toggleFilters}
            aria-label={showFilters ? "Hide filters" : "Show filters"}
            title={showFilters ? "Hide filters" : "Show filters"}
        >
            <Funnel size={18} class={showFilters ? 'text-green-400' : ''} />
            {#if activeFiltersCount > 0}
                <span class="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFiltersCount}
                </span>
            {/if}
        </button>
    </svelte:fragment>
    
    <div class="modal-container">
        <div class="filter-sidebar {showFilters ? 'filters-visible' : 'filters-hidden'}">
            <TilingFilterBar 
                bind:selectedTypes
                bind:selectedPolygons
                bind:showDual
                bind:selectedVertexTypes
                bind:polygonFilterMode
                bind:vertexTypeFilterMode
            />
        </div>
        
        <div class="catalog-container p-4 {showFilters ? 'with-filters' : 'without-filters'}">
            {#if filteredTilings.length === 0}
                <div class="py-8 text-center text-zinc-400">
                    <Grid size={48} class="mx-auto mb-4 opacity-40" />
                    <p>No tilings match your filters</p>
                    <button 
                        class="mt-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md border border-zinc-700/50 transition-all"
                        onclick={() => {
                            selectedTypes = [];
                            selectedPolygons = [];
                            selectedVertexTypes = [];
                            showDual = false;
                        }}
                    >
                        Clear Filters
                    </button>
                </div>
            {:else}
                <div class="mb-4">
                    <p class="text-sm text-zinc-400">{filteredTilings.length} tilings found</p>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pb-4">
                    {#each filteredTilings as tiling}
                        <div class="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <TilingCard 
                                name={tiling.name}
                                cr={tiling.cr}
                                rulestring={tiling.rulestring}
                                groupId={tiling.groupId}
                                onClick={loadTiling}
                            />
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</Modal> 