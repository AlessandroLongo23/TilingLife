import { writable } from 'svelte/store';

export const tilingModalOpen = writable(false);

export const tilingFilters = writable({
    searchTerm: '',
    selectedTypes: [],
    selectedPolygons: [],
    selectedVertexTypes: [],
    showDual: false,
    polygonFilterMode: 'exact',
    vertexTypeFilterMode: 'exact'
}); 