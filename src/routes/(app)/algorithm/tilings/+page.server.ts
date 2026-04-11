import { BATCH_SIZE } from '$stores';
import {
	getTranslationalCellsManifestUrl,
	getTranslationalCellsBatchUrl,
} from '$lib/services/pipelineStorage';
import { fetchPipelineJson } from '$lib/services/pipelineFetch';
import { seedPassesPolygonFilter } from '$lib/utils/filterHelpers';
import type { PolygonCompositionFilter } from '$lib/utils/filterHelpers';

const PAGE_SIZE = 12;

/** Convert short polygon format to display format (same as expanded-seeds). */
function polygonFromShort(enc: Record<string, unknown>): { type: string; n: number; vertices: { x: number; y: number }[] } {
	const v = enc.v as [number, number][] | undefined;
	const vertices = v
		? v.map((p) => ({ x: p[0], y: p[1] }))
		: (enc.vertices as { x: number; y: number }[] | undefined)?.map((p) =>
				Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }
			) ?? [];
	return {
		type: (enc.t ?? enc.type ?? 'regular') as string,
		n: (enc.n ?? 0) as number,
		vertices,
	};
}

async function loadManifest(
	k: number,
	m: number,
	paramsFolder: string
): Promise<{ total: number; format: string; batchSize: number } | null> {
	const manifest = await fetchPipelineJson(
		getTranslationalCellsManifestUrl(paramsFolder, k, m)
	) as { total: number; format: string; batchSize: number } | null;
	return manifest;
}

async function loadBatch(
	k: number,
	m: number,
	batchIndex: number,
	paramsFolder: string
): Promise<any[]> {
	const data = await fetchPipelineJson(
		getTranslationalCellsBatchUrl(paramsFolder, k, m, batchIndex)
	);
	return Array.isArray(data) ? data : [];
}

async function loadPageData(
	k: number,
	m: number,
	page: number,
	paramsFolder: string,
	polygonFilter: PolygonCompositionFilter | null
): Promise<{ data: any[]; total: number }> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (!manifest) return { data: [], total: 0 };

	const { total } = manifest;
	if (polygonFilter) {
		const allData: any[] = [];
		const numBatches = Math.ceil(total / BATCH_SIZE);
		for (let i = 0; i < numBatches; i++) {
			allData.push(...(await loadBatch(k, m, i, paramsFolder)));
		}
		const filtered = allData.filter((cell: any) => {
			const name = cell.n ?? '';
			return name && seedPassesPolygonFilter(name, polygonFilter);
		});
		const start = (page - 1) * PAGE_SIZE;
		const pageData = filtered.slice(start, start + PAGE_SIZE);
		const displayData = pageData.map((cell: any) => ({
			n: cell.n ?? '',
			polygons: (cell.p ?? []).map((p: Record<string, unknown>) => polygonFromShort(p)),
			b: cell.b ?? [
				[1, 0],
				[0, 1],
			],
			o: cell.o ?? [0, 0],
		}));
		return { data: displayData, total: filtered.length };
	}

	const start = (page - 1) * PAGE_SIZE;
	const end = Math.min(start + PAGE_SIZE, total);
	if (start >= total) return { data: [], total };

	const batchStart = Math.floor(start / BATCH_SIZE);
	const batchEnd = Math.floor((end - 1) / BATCH_SIZE);
	const allData: any[] = [];
	for (let i = batchStart; i <= batchEnd; i++) {
		allData.push(...(await loadBatch(k, m, i, paramsFolder)));
	}
	const pageData = allData.slice(
		start - batchStart * BATCH_SIZE,
		end - batchStart * BATCH_SIZE
	);
	const displayData = pageData.map((cell: any) => ({
		n: cell.n ?? '',
		polygons: (cell.p ?? []).map((p: Record<string, unknown>) => polygonFromShort(p)),
		b: cell.b ?? [
			[1, 0],
			[0, 1],
		],
		o: cell.o ?? [0, 0],
	}));
	return { data: displayData, total };
}

type DiscoveredEntry = { paramsFolder: string; k: number; m: number; count: number };

export async function load({ url, fetch }) {
	let supabaseFolders: string[] = [];
	try {
		const res = await fetch(`${url.origin}/api/pipeline/list-folders`);
		const json = await res.json();
		supabaseFolders = json.folders ?? [];
	} catch {
		// Ignore
	}

	const available: DiscoveredEntry[] = [];
	for (const folder of supabaseFolders) {
		try {
			const res = await fetch(`${url.origin}/api/pipeline/structure?folder=${encodeURIComponent(folder)}`);
			const structure = await res.json();
			const entries = structure.translationalCells ?? [];
			for (const e of entries) {
				available.push({
					paramsFolder: folder,
					k: e.k,
					m: e.m,
					count: e.total ?? 0,
				});
			}
		} catch {
			// Skip folder
		}
	}

	available.sort((a, b) => a.paramsFolder.localeCompare(b.paramsFolder) || a.k - b.k || a.m - b.m);

	const paramsFolderValues = supabaseFolders.length > 0 ? supabaseFolders : ['default'];
	const selectedParamsFolder = url.searchParams.get('polygons') || paramsFolderValues[0] || null;
	const effectiveParamsFolder = selectedParamsFolder === 'default' ? null : selectedParamsFolder;

	const availableForParams = effectiveParamsFolder
		? available.filter((a) => a.paramsFolder === effectiveParamsFolder)
		: [];

	const kValues = [...new Set(availableForParams.map((a) => a.k))].sort((a, b) => a - b);
	const selectedK = url.searchParams.has('k')
		? parseInt(url.searchParams.get('k')!)
		: kValues[0] ?? null;
	const mValuesForK = availableForParams.filter((a) => a.k === selectedK);
	const selectedM = url.searchParams.has('m')
		? parseInt(url.searchParams.get('m')!)
		: mValuesForK[0]?.m ?? null;

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const layers = Math.max(1, Math.min(8, parseInt(url.searchParams.get('layers') ?? '2')));
	const showBasisVectors = url.searchParams.get('basis') === '1';

	// Polygon composition filter (Phase 3.6)
	const categoriesParam = url.searchParams.get('categories');
	const selectedCategories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : null;
	const filterNMaxEnabled = url.searchParams.get('nmaxEnabled') === '1';
	const filterNMax = Math.max(3, parseInt(url.searchParams.get('nmax') ?? '12') || 12);
	const filterAngleEnabled = url.searchParams.get('angleEnabled') === '1';
	const filterAngle = Math.max(1, parseInt(url.searchParams.get('angle') ?? '30') || 30);
	const polygonFilter: PolygonCompositionFilter | null =
		selectedCategories && selectedCategories.length > 0
			? {
					categories: selectedCategories,
					n_max: filterNMaxEnabled ? filterNMax : undefined,
					angle: filterAngleEnabled ? filterAngle : undefined,
				}
			: null;

	let tilings: any[] = [];
	let totalItems = 0;

	if (effectiveParamsFolder && selectedK !== null && selectedM !== null) {
		const result = await loadPageData(selectedK, selectedM, page, effectiveParamsFolder, polygonFilter);
		tilings = result.data;
		totalItems = result.total;
	}

	return {
		available: availableForParams,
		paramsFolderValues: paramsFolderValues.length > 0 ? paramsFolderValues : ['default'],
		selectedParamsFolder: effectiveParamsFolder ?? 'default',
		kValues,
		selectedK,
		selectedM,
		page,
		layers,
		showBasisVectors,
		totalItems,
		tilings,
		pageSize: PAGE_SIZE,
		selectedCategories: selectedCategories ?? [],
		filterNMaxEnabled,
		filterNMax,
		filterAngleEnabled,
		filterAngle,
	};
}
