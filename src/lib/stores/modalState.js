import { writable } from 'svelte/store';

// Modal visibility state
export const tilingModalOpen = writable(false);

// Current tiling filter state
export const tilingFilters = writable({
    searchTerm: '',
    selectedTypes: [],
    selectedPolygons: [],
    showDual: false
}); 