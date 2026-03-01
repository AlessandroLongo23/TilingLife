/**
 * Service for uploading tiling screenshots to Supabase Storage.
 *
 * Uses the existing "tilings" bucket with structure:
 * - Bucket: tilings (public)
 * - Path: {sanitizedGroupId}/{sanitizedRulestring}.webp
 * - Dual: {sanitizedGroupId}/{sanitizedRulestring}_dual.webp
 *
 * Uses sanitizeForStorage/restoreFromStorage for reversible encoding of unsafe chars (^, |, /, etc.)
 */

import { supabase } from '$services/supabase.js';
import { tilingStore } from '$stores';
import { sanitizeForStorage } from '$utils/storageKey';

const BUCKET = 'tilings';

/**
 * Extract storage path from a Supabase public URL for deletion.
 * URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path][?query]
 */
function extractPathFromSupabaseUrl(url: string): string | null {
    if (!url) return null;
    try {
        const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
        if (!match) return null;
        const path = match[1];
        return path.split('?')[0];
    } catch {
        return null;
    }
}

/**
 * Ensure the group folder exists in the bucket.
 * Supabase Storage creates folders implicitly when uploading; we upload a placeholder to create it if needed.
 */
async function ensureFolderExists(sanitizedGroupId: string): Promise<void> {
    await supabase.storage
        .from(BUCKET)
        .upload(`${sanitizedGroupId}/.keep`, new Blob([]), {
            contentType: 'application/octet-stream',
            upsert: true
        });
}

/**
 * Convert image data URL (PNG/JPEG) to WebP blob for upload.
 * Matches existing bucket format (.webp).
 */
export async function dataUrlToWebPBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
                'image/webp',
                0.9
            );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
    });
}

/**
 * Upload screenshot to Supabase Storage and update the tilings table.
 * If the tiling already has an image_url, deletes the old file from the bucket first.
 */
export async function uploadTilingScreenshot(
    rulestring: string,
    groupId: string,
    imageBlob: Blob,
    isDual = false
): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
        return { success: false, error: 'Supabase client not available' };
    }

    const baseRulestring = rulestring.replace(/\*$/, '');
    const dbRulestring = baseRulestring;
    const sanitizedRulestring = sanitizeForStorage(baseRulestring);
    const sanitizedGroupId = sanitizeForStorage(groupId);
    const filename = isDual ? `${sanitizedRulestring}_dual.webp` : `${sanitizedRulestring}.webp`;
    const storagePath = `${sanitizedGroupId}/${filename}`;

    try {
        await ensureFolderExists(sanitizedGroupId);

        const dbTiling = tilingStore.getTilingByRulestring(dbRulestring);
        const currentImageUrl = isDual ? dbTiling?.dual_image_url : dbTiling?.image_url;

        // Delete old file from bucket if it exists and is from our bucket
        if (currentImageUrl) {
            const oldPath = extractPathFromSupabaseUrl(currentImageUrl);
            if (oldPath) {
                await supabase.storage.from(BUCKET).remove([oldPath]);
                // Ignore delete errors (file might not exist)
            }
        }

        // Upload new file (WebP to match existing bucket convention)
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, imageBlob, {
                contentType: 'image/webp',
                upsert: true
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return { success: false, error: uploadError.message };
        }

        // Get public URL
        const {
            data: { publicUrl }
        } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        // Update tilings table
        const updateField = isDual ? 'dual_image_url' : 'image_url';
        const { error: updateError } = await supabase
            .from('tilings')
            .update({ [updateField]: publicUrl })
            .eq('rulestring', dbRulestring);

        if (updateError) {
            console.error('Update error:', updateError);
            return { success: false, error: updateError.message };
        }

        // Refresh tiling store to reflect new image
        await tilingStore.refresh();

        return { success: true };
    } catch (err) {
        console.error('uploadTilingScreenshot error:', err);
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}
