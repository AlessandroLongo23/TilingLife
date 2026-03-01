/**
 * Lists tiling images from Supabase Storage.
 * Uses parseStoragePath (restoreFromStorage) to map sanitized paths back to rulestrings.
 * Separate from tilingImages to avoid circular dependency with tilingStore.
 */

import { supabase } from '$services/supabase.js';
import { restoreFromStorage } from '$utils/storageKey';

const BUCKET = 'tilings';

/**
 * Parse a storage path back to groupId and rulestring.
 * Restores sanitized paths to original names for matching with tiling data.
 * Handles both new format (_XX_ encoding) and old format (_ for / and *).
 */
export function parseStoragePath(path: string): { groupId: string; rulestring: string; isDual: boolean } | null {
    const pathWithoutQuery = path.split('?')[0];
    const parts = pathWithoutQuery.split('/');
    if (parts.length < 2) return null;
    const groupId = restoreFromStorage(parts[0]);
    const filename = parts[parts.length - 1];
    const isDual = filename.endsWith('_dual.webp');
    const basename = isDual ? filename.slice(0, -'_dual.webp'.length) : filename.replace(/\.webp$/, '');
    let rulestring = restoreFromStorage(basename);
    if (!/_([0-9A-Fa-f]{2})_/.test(basename)) {
        rulestring = basename.replace(/_/g, '/');
        if (isDual && rulestring.endsWith('/')) rulestring = rulestring.slice(0, -1) + '*';
    }
    return { groupId, rulestring, isDual };
}

/**
 * List all tiling images from storage and return a map of (groupId:rulestring) -> { standard, dual } URLs.
 * Uses parseStoragePath to restore sanitized paths for matching with tilings from the database.
 */
export async function listTilingImagesFromStorage(): Promise<
    Map<string, { standard: string; dual: string }>
> {
    const map = new Map<string, { standard: string; dual: string }>();
    if (!supabase) return map;

    try {
        const { data: folders } = await supabase.storage.from(BUCKET).list('', { limit: 500 });
        if (!folders) return map;

        for (const folder of folders) {
            if (!folder.name || folder.name.startsWith('.')) continue;
            const { data: files } = await supabase.storage.from(BUCKET).list(folder.name, { limit: 500 });
            if (!files) continue;

            for (const file of files) {
                if (!file.name || file.name.endsWith('/') || file.name === '.keep') continue;
                const path = `${folder.name}/${file.name}`;
                const parsed = parseStoragePath(path);
                if (!parsed) continue;

                const key = `${parsed.groupId}:${parsed.rulestring}`;
                const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
                const existing = map.get(key) ?? { standard: '', dual: '' };

                if (parsed.isDual) {
                    map.set(key, { ...existing, dual: data.publicUrl });
                } else {
                    map.set(key, { ...existing, standard: data.publicUrl });
                }
            }
        }
    } catch (err) {
        console.error('listTilingImagesFromStorage error:', err);
    }
    return map;
}
