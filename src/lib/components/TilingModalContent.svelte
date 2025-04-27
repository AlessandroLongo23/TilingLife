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
    
    let searchTerm = $state('');
    let selectedTypes = $state([]);
    let selectedPolygons = $state([]);
    let showDual = $state(false);
    
    $effect(() => {
        const currentFilters = $tilingFilters;
        searchTerm = currentFilters.searchTerm;
        selectedTypes = currentFilters.selectedTypes;
        selectedPolygons = currentFilters.selectedPolygons;
        showDual = currentFilters.showDual;
    });
    
    $effect(() => {
        $tilingFilters = {
            searchTerm,
            selectedTypes,
            selectedPolygons,
            showDual
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
        
        // TODO: match/contains toggle
        return !sides.some(side => !polygonSides.includes(side)) && !polygonSides.some(side => !sides.includes(side));
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
                
                if (
                    searchTerm && 
                    !rule.rulestring.toLowerCase().includes(searchTerm.toLowerCase()) &&
                    !rule.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                    !rule.dualname.toLowerCase().includes(searchTerm.toLowerCase())
                ) {
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
        searchTerm.length > 0 || selectedTypes.length > 0 || selectedPolygons.length > 0 || showDual ? 
        (searchTerm.length > 0 ? 1 : 0) + selectedTypes.length + selectedPolygons.length + (showDual ? 1 : 0) : 
        0
    );
</script>

<style>
    .modal-container {
        position: relative;
        height: 70vh;
        overflow: hidden;
    }
    
    .filters-hidden {
        transform: translateY(-100%);
        opacity: 0;
        pointer-events: none;
    }
    
    .filters-visible {
        transform: translateY(0);
        opacity: 1;
    }
    
    .catalog-container {
        height: 100%;
        overflow-y: auto;
        padding-top: var(--filters-height, 0px);
        transition: padding-top 0.3s ease;
    }
    
    .with-filters {
        --filters-height: 320px;
    }
    
    .without-filters {
        --filters-height: 0px;
    }
</style>

<Modal 
    bind:isOpen={$tilingModalOpen}
    title="Tiling Rules List"
    maxWidth="max-w-6xl"
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
        <div class="absolute top-0 left-0 right-0 z-10 {showFilters ? 'filters-visible' : 'filters-hidden'}">
            <TilingFilterBar 
                bind:searchTerm
                bind:selectedTypes
                bind:selectedPolygons
                bind:showDual
            />
        </div>
        
        <div class="catalog-container {showFilters ? 'with-filters' : 'without-filters'}">
            {#if filteredTilings.length === 0}
                <div class="py-8 text-center text-zinc-400">
                    <Grid size={48} class="mx-auto mb-4 opacity-40" />
                    <p>No tilings match your filters</p>
                    <button 
                        class="mt-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md border border-zinc-700/50 transition-all"
                        onclick={() => {
                            searchTerm = '';
                            selectedTypes = [];
                            selectedPolygons = [];
                            showDual = false;
                        }}
                    >
                        Clear Filters
                    </button>
                </div>
            {:else}
                <div class="mb-4 pt-4">
                    <p class="text-sm text-zinc-400">{filteredTilings.length} tilings found</p>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pb-4">
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