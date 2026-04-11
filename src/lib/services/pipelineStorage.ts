/**
 * Supabase Storage for pipeline data (polygons.json, vcs.json).
 * URL helpers are client-safe. Upload/list functions are in the API route (server-only).
 *
 * Setup required:
 * 1. Create bucket "pipeline-data" in Supabase Dashboard
 * 2. Set bucket to public (for reads)
 * 3. Add SUPABASE_SERVICE_ROLE_KEY to .env (from Supabase Dashboard > Settings > API)
 */

import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export const PIPELINE_BUCKET = 'pipeline-data';

/** Get public URL for polygons.json */
export function getPolygonsUrl(paramsFolder: string): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/polygons.json`;
}

/** Get public URL for vcs.json */
export function getVCsUrl(paramsFolder: string): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/vcs.json`;
}

/** Get public URL for compatibilityGraph.json */
export function getCompatibilityGraphUrl(paramsFolder: string): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/compatibilityGraph.json`;
}

/** Get public URL for seedConfigurations vcLibrary.json */
export function getSeedConfigurationsVcLibraryUrl(paramsFolder: string): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/seedConfigurations/vcLibrary.json`;
}

/** Get public URL for seedConfigurations manifest (k=X/m=Y) */
export function getSeedConfigurationsManifestUrl(paramsFolder: string, k: number, m: number): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/seedConfigurations/k=${k}/m=${m}/manifest.json`;
}

/** Get public URL for expandedSeeds manifest (k=X/m=Y) */
export function getExpandedSeedsManifestUrl(paramsFolder: string, k: number, m: number): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/expandedSeeds/k=${k}/m=${m}/manifest.json`;
}

/** Get public URL for translationalCells manifest (k=X/m=Y) */
export function getTranslationalCellsManifestUrl(paramsFolder: string, k: number, m: number): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/translationalCells/k=${k}/m=${m}/manifest.json`;
}

/** Get public URL for seedConfigurations batch file */
export function getSeedConfigurationsBatchUrl(
	paramsFolder: string,
	k: number,
	m: number,
	batchIndex: number
): string {
	const name = `seedConfigurations_${String(batchIndex).padStart(4, '0')}.json.gz`;
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/seedConfigurations/k=${k}/m=${m}/${name}`;
}

/** Get public URL for expandedSeeds batch file */
export function getExpandedSeedsBatchUrl(
	paramsFolder: string,
	k: number,
	m: number,
	batchIndex: number
): string {
	const name = `expandedSeeds_${String(batchIndex).padStart(4, '0')}.json.gz`;
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/expandedSeeds/k=${k}/m=${m}/${name}`;
}

/** Get public URL for translationalCells batch file */
export function getTranslationalCellsBatchUrl(
	paramsFolder: string,
	k: number,
	m: number,
	batchIndex: number
): string {
	const name = `translationalCells_${String(batchIndex).padStart(4, '0')}.json.gz`;
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}/${paramsFolder}/translationalCells/k=${k}/m=${m}/${name}`;
}

/** Base URL for pipeline bucket (for path construction) */
export function getPipelineBaseUrl(): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PIPELINE_BUCKET}`;
}
