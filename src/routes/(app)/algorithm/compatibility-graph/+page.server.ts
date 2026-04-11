/**
 * Compatibility graph page - loads VCs and compatibility graph from Supabase.
 * Uses list-folders API for paramsFolder discovery.
 */

import { getVCsUrl, getCompatibilityGraphUrl } from '$lib/services/pipelineStorage';
import { fetchPipelineJson, fetchPipelineJsonArray } from '$lib/services/pipelineFetch';

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

	let allVCNames: string[] = [];
	let adjacencyListData: Record<string, string[]> = {};

	if (effectiveFolder) {
		allVCNames = await fetchPipelineJsonArray<string>(getVCsUrl(effectiveFolder));
		const compat = await fetchPipelineJson(getCompatibilityGraphUrl(effectiveFolder));
		if (compat && typeof compat === 'object' && !Array.isArray(compat)) {
			adjacencyListData = compat as Record<string, string[]>;
		}
	}

	return {
		allVCNames,
		adjacencyListData,
		paramsFolderValues,
		selectedParamsFolder: effectiveFolder ?? 'default',
	};
}
