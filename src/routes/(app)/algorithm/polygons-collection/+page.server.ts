/**
 * Polygons collection page - loads polygon names from Supabase pipeline-data bucket.
 * Uses list-folders API for paramsFolder discovery.
 */

import { getPolygonsUrl } from '$lib/services/pipelineStorage';
import { fetchPipelineJsonArray } from '$lib/services/pipelineFetch';

export async function load({ url, depends, fetch }) {
	depends('app:polygons-filter');

	let supabaseFolders: string[] = [];
	try {
		const res = await fetch(`${url.origin}/api/pipeline/list-folders`);
		const json = await res.json();
		supabaseFolders = json.folders ?? [];
	} catch {
		// Ignore
	}

	const paramsFolderValues = supabaseFolders.length > 0 ? supabaseFolders : ['default'];
	const selectedParamsFolder = url.searchParams.get('polygons') || paramsFolderValues[0] || null;
	const effectiveFolder = selectedParamsFolder === 'default' ? null : selectedParamsFolder;

	let allPolygonNames: string[] = [];
	if (effectiveFolder) {
		allPolygonNames = await fetchPipelineJsonArray<string>(getPolygonsUrl(effectiveFolder));
	}

	return {
		allPolygonNames,
		paramsFolderValues,
		selectedParamsFolder: effectiveFolder ?? 'default',
	};
}
