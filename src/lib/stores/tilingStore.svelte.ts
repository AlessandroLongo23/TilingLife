import { writable } from 'svelte/store';
import { supabase } from '$services/supabase.js';
import { listTilingImagesFromStorage } from '$services/tilingStorageList';

let tilingGroups: TilingGroup[] = $state([]);
let tilings: Tiling[] = $state([]);
let storageImageMap = $state<Map<string, { standard: string; dual: string }>>(new Map());
let loading = $state(true);
let error = $state(null);
let initialized = $state(false);
/** Timestamp when tilings were last refreshed - use for cache-busting image URLs */
let tilingsUpdatedAt = $state(Date.now());

/** Writable set when tilings are loaded - use for reactive waiting (e.g. landing page) */
export const tilingStoreReady = writable(false);

interface Tiling {
    original_id: number;
    name: string;
    rulestring: string;
    cr_notation: string;
    group_id: string;
    dual_name: string;
    is_regular: boolean;
    is_semiregular: boolean;
    is_star: boolean;
    is_concave: boolean;
    alternatives: string[];
    image_url: string;
    dual_image_url: string;
}

interface TilingGroup {
    id: string;
    title: string;
    k: number;
    m: number;
    has_dual: boolean;
    is_concave: boolean;
}

interface FilterOptions {
    isRegular?: boolean;
    isSemiregular?: boolean;
    isStar?: boolean;
    isConcave?: boolean;
    groupId?: string;
}

async function fetchGroups() {
    const { data, error: err } = await supabase
        .from('tiling_groups')
        .select('*')
        .order('display_order', { ascending: true });
    
    if (err) {
        console.error('Error fetching tiling groups:', err);
        error = err.message;
        return [];
    }
    
    return data || [];
}

async function fetchTilings() {
    const { data, error: err } = await supabase
        .from('tilings')
        .select(`
            *,
            group:tiling_groups (
                id,
                title,
                k,
                m,
                has_dual,
                is_concave
            )
        `)
        .order('original_id', { ascending: true });
    
    if (err) {
        console.error('Error fetching tilings:', err);
        error = err.message;
        return [];
    }
    
    return data || [];
}

async function initialize() {
    if (initialized || !supabase) return;
    
    loading = true;
    error = null;
    
    try {
        const [groupsData, tilingsData, imageMap] = await Promise.all([
            fetchGroups(),
            fetchTilings(),
            listTilingImagesFromStorage()
        ]);
        
        tilingGroups = groupsData;
        tilings = tilingsData;
        storageImageMap = imageMap;
        initialized = true;
        tilingStoreReady.set(true);
    } catch (err) {
        console.error('Error initializing tiling store:', err);
        error = err.message;
    } finally {
        loading = false;
    }
}

function getLegacyFormat() {
    const groupMap = new Map();
    
    for (const group of tilingGroups) {
        groupMap.set(group.id, {
            title: group.title,
            id: group.id,
            dual: group.has_dual,
            rules: []
        });
    }
    
    for (const tiling of tilings) {
        const group = groupMap.get(tiling.group_id);
        if (group) {
            const storageKey = `${tiling.group_id}:${tiling.rulestring}`;
            const storageImages = storageImageMap.get(storageKey);
            const imageUrl = storageImages?.standard || tiling.image_url;
            const dualImageUrl = storageImages?.dual || tiling.dual_image_url;

            group.rules.push({
                id: tiling.original_id,
                name: tiling.name,
                cr: tiling.cr_notation,
                rulestring: tiling.rulestring,
                dualname: tiling.dual_name,
                alternatives: tiling.alternatives,

                imageUrl: imageUrl ? `${imageUrl}?t=${tilingsUpdatedAt}` : imageUrl,
                dualImageUrl: dualImageUrl ? `${dualImageUrl}?t=${tilingsUpdatedAt}` : dualImageUrl,
                isRegular: tiling.is_regular,
                isSemiregular: tiling.is_semiregular,
                isStar: tiling.is_star,
                isConcave: tiling.is_concave
            });
        }
    }
    
    return Array.from(groupMap.values()).filter(g => g.rules.length > 0);
}

function getTilingByRulestring(rulestring) {
    return tilings.find(t => t.rulestring === rulestring);
}

function getTilingsByGroup(groupId) {
    return tilings.filter(t => t.group_id === groupId);
}

function filterTilings(filters: FilterOptions = {}) {
    return tilings.filter(tiling => {
        if (filters.isRegular !== undefined && tiling.is_regular !== filters.isRegular) {
            return false;
        }
        if (filters.isSemiregular !== undefined && tiling.is_semiregular !== filters.isSemiregular) {
            return false;
        }
        if (filters.isStar !== undefined && tiling.is_star !== filters.isStar) {
            return false;
        }
        if (filters.isConcave !== undefined && tiling.is_concave !== filters.isConcave) {
            return false;
        }
        if (filters.groupId && tiling.group_id !== filters.groupId) {
            return false;
        }
        return true;
    });
}

async function refresh() {
    loading = true;
    try {
        const [groupsData, tilingsData, imageMap] = await Promise.all([
            fetchGroups(),
            fetchTilings(),
            listTilingImagesFromStorage()
        ]);
        tilingGroups = groupsData;
        tilings = tilingsData;
        storageImageMap = imageMap;
        tilingsUpdatedAt = Date.now();
    } catch (err) {
        console.error('Error refreshing tiling store:', err);
    } finally {
        loading = false;
    }
}

export const tilingStore = {
    get groups() { return tilingGroups; },
    get tilings() { return tilings; },
    get loading() { return loading; },
    get error() { return error; },
    get initialized() { return initialized; },
    get tilingsUpdatedAt() { return tilingsUpdatedAt; },
    
    get tilingRules() { return getLegacyFormat(); },
    
    initialize,
    refresh,
    getTilingByRulestring,
    getTilingsByGroup,
    filterTilings
};

export function getTilingRules() {
    return getLegacyFormat();
}

if (typeof window !== 'undefined' && supabase) {
    initialize();
}
