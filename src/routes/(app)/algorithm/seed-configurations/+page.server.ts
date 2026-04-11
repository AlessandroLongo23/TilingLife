import { SeedConfiguration } from '$classes';
import { BATCH_SIZE } from '$stores';
import { seedMatchesSearch } from '$lib/utils/compactSeedName';
import { seedPassesPolygonFilter } from '$lib/utils/filterHelpers';
import type { PolygonCompositionFilter } from '$lib/utils/filterHelpers';
import { deduplicateEncodedPolygons, getEffectiveGrouping } from '$utils';
import {
	getSeedConfigurationsManifestUrl,
	getSeedConfigurationsVcLibraryUrl,
	getSeedConfigurationsBatchUrl,
} from '$lib/services/pipelineStorage';
import { fetchPipelineJson } from '$lib/services/pipelineFetch';

const PAGE_SIZE = 24;

/** Computes grouping label from seed name (chiral-aware): e.g. AAABC → "3:1:1", AABBC → "2:2:1". */
function getGroupingLabel(name: string): string {
	const inner = name.slice(1, -1);
	if (!inner) return '';
	const vcNames = inner.split(';');
	return getEffectiveGrouping(vcNames);
}

async function loadManifest(
	k: number,
	m: number,
	paramsFolder: string
): Promise<{ total: number; format: string; batchSize: number; vcLibrary?: string[] } | null> {
	const manifest = await fetchPipelineJson(
		getSeedConfigurationsManifestUrl(paramsFolder, k, m)
	) as { total: number; format: string; batchSize: number; vcLibrary?: boolean } | null;
	if (!manifest) return null;

	const result: { total: number; format: string; batchSize: number; vcLibrary?: string[] } = {
		total: manifest.total,
		format: manifest.format ?? 'compact',
		batchSize: manifest.batchSize ?? 1000,
	};
	if (manifest.vcLibrary) {
		const vcLibrary = await fetchPipelineJson(
			getSeedConfigurationsVcLibraryUrl(paramsFolder)
		) as string[] | null;
		result.vcLibrary = Array.isArray(vcLibrary) ? vcLibrary : undefined;
	}
	return result;
}

async function loadBatch(
	k: number,
	m: number,
	batchIndex: number,
	paramsFolder: string
): Promise<any[]> {
	const data = await fetchPipelineJson(
		getSeedConfigurationsBatchUrl(paramsFolder, k, m, batchIndex)
	);
	return Array.isArray(data) ? data : [];
}

/** Extract seed name from raw item (no decode). Used for fast grouping. */
function getNameFromRaw(item: any, format: string, vcLibrary?: string[]): string {
	if (format === 'compact') {
		const arr = item.v ?? item.vcs;
		if (arr) {
			const names = arr.map((v: any) => {
				if (('i' in v || 'vcId' in v) && vcLibrary) return vcLibrary[v.i ?? v.vcId] ?? '';
				return v.n ?? v.name ?? '';
			});
			return '[' + names.filter(Boolean).join(';') + ']';
		}
	}
	return item.n ?? item.name ?? '';
}

function sortGroupings(byLabel: Map<string, number>): { label: string; count: number }[] {
	return [...byLabel.entries()]
		.sort((a, b) => {
			const na = a[0].split(':').map(Number);
			const nb = b[0].split(':').map(Number);
			for (let i = 0; i < Math.max(na.length, nb.length); i++) {
				const va = na[i] ?? 0;
				const vb = nb[i] ?? 0;
				if (va !== vb) return vb - va;
			}
			return 0;
		})
		.map(([label, count]) => ({ label, count }));
}

async function loadGroupingsOnly(
	k: number,
	m: number,
	paramsFolder: string
): Promise<{ groupings: { label: string; count: number }[] }> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (!manifest) return { groupings: [] };
	const { total, format, vcLibrary } = manifest;
	const numBatches = Math.ceil(total / BATCH_SIZE);
	const byLabel = new Map<string, number>();
	for (let i = 0; i < numBatches; i++) {
		const batch = await loadBatch(k, m, i, paramsFolder);
		for (const item of batch) {
			const name = getNameFromRaw(item, format, vcLibrary);
			if (name) {
				const label = getGroupingLabel(name);
				byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
			}
		}
	}
	return { groupings: sortGroupings(byLabel) };
}

async function loadGroupingsAndFilteredCount(
	k: number,
	m: number,
	paramsFolder: string,
	format: string,
	grouping: string | null,
	search: string | null,
	total: number,
	polygonFilter: PolygonCompositionFilter | null
): Promise<{ groupings: { label: string; count: number }[]; filteredTotal: number }> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (!manifest) return { groupings: [], filteredTotal: 0 };
	const { vcLibrary } = manifest;
	const numBatches = Math.ceil(total / BATCH_SIZE);
	const byLabel = new Map<string, number>();
	let filteredTotal = 0;
	for (let i = 0; i < numBatches; i++) {
		const batch = await loadBatch(k, m, i, paramsFolder);
		for (const item of batch) {
			const name = getNameFromRaw(item, format, vcLibrary);
			if (!name) continue;
			if (polygonFilter && !seedPassesPolygonFilter(name, polygonFilter)) continue;
			const label = getGroupingLabel(name);
			byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
			if (grouping && label !== grouping) continue;
			if (search && !seedMatchesSearch(name, search)) continue;
			filteredTotal++;
		}
	}
	return { groupings: sortGroupings(byLabel), filteredTotal: grouping || search || polygonFilter ? filteredTotal : total };
}

async function loadAllData(
	k: number,
	m: number,
	paramsFolder: string
): Promise<{ data: any[]; format: string } | null> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (!manifest) return null;
	const { total, format, vcLibrary } = manifest;
	const allData: any[] = [];
	const numBatches = Math.ceil(total / BATCH_SIZE);
	for (let i = 0; i < numBatches; i++) {
		allData.push(...(await loadBatch(k, m, i, paramsFolder)));
	}
	return {
		data: allData.map((item: any) => {
			const seed = format === 'compact'
				? SeedConfiguration.decodeCompact(item, vcLibrary)
				: SeedConfiguration.decodeFull(item);
			const encoded = seed.encode();
			encoded.polygons = deduplicateEncodedPolygons(encoded.polygons);
			return encoded;
		}),
		format,
	};
}

async function loadPageData(
	k: number,
	m: number,
	page: number,
	grouping: string | null,
	search: string | null,
	paramsFolder: string,
	polygonFilter: PolygonCompositionFilter | null
): Promise<{ data: any[]; total: number; groupings: { label: string; count: number }[] }> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (!manifest) return { data: [], total: 0, groupings: [] };
	const { total, format } = manifest;
	const start = (page - 1) * PAGE_SIZE;
	const end = Math.min(start + PAGE_SIZE, total);
	if (start >= total) {
		const { groupings: g, filteredTotal } = await loadGroupingsAndFilteredCount(
			k,
			m,
			paramsFolder,
			format,
			grouping,
			search,
			total,
			polygonFilter
		);
		return { data: [], total: filteredTotal, groupings: g };
	}

	let data: any[];
	let filteredTotal: number;
	let groupings: { label: string; count: number }[] = [];

	if (grouping || search || polygonFilter) {
		const all = await loadAllData(k, m, paramsFolder);
		if (!all) return { data: [], total: 0, groupings: [] };
		let filtered = all.data;
		if (polygonFilter) filtered = filtered.filter((sc: any) => seedPassesPolygonFilter(sc.name, polygonFilter));
		if (grouping) filtered = filtered.filter((sc: any) => getGroupingLabel(sc.name) === grouping);
		if (search) filtered = filtered.filter((sc: any) => seedMatchesSearch(sc.name, search));
		filteredTotal = filtered.length;
		data = filtered.slice(start, start + PAGE_SIZE);
		const byLabel = new Map<string, number>();
		for (const sc of filtered) {
			const label = getGroupingLabel(sc.name);
			byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
		}
		groupings = sortGroupings(byLabel);
	} else {
		const batchStart = Math.floor(start / BATCH_SIZE);
		const batchEnd = Math.floor((end - 1) / BATCH_SIZE);
		const batchData: any[] = [];
		for (let i = batchStart; i <= batchEnd; i++) {
			batchData.push(...(await loadBatch(k, m, i, paramsFolder)));
		}
		const pageData = batchData.slice(
			start - batchStart * BATCH_SIZE,
			end - batchStart * BATCH_SIZE
		);
		data = pageData.map((item: any) => {
			const seed = format === 'compact'
				? SeedConfiguration.decodeCompact(item, manifest.vcLibrary)
				: SeedConfiguration.decodeFull(item);
			const encoded = seed.encode();
			encoded.polygons = deduplicateEncodedPolygons(encoded.polygons);
			return encoded;
		});
		filteredTotal = total;
		const { groupings: g } = await loadGroupingsOnly(k, m, paramsFolder);
		groupings = g;
	}

	return { data, total: filteredTotal, groupings };
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
			const entries = structure.seedConfigurations ?? [];
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
	const selectedGrouping = url.searchParams.get('grouping') || null;
	const selectedSearch = url.searchParams.get('search') || null;

	// Polygon composition filter (Phase 3.4)
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

	let seedConfigurations: any[] = [];
	let totalItems = 0;
	let groupings: { label: string; count: number }[] = [];

	if (effectiveParamsFolder && selectedK !== null && selectedM !== null) {
		const result = await loadPageData(
			selectedK,
			selectedM,
			page,
			selectedGrouping,
			selectedSearch,
			effectiveParamsFolder,
			polygonFilter
		);
		seedConfigurations = result.data;
		totalItems = result.total;
		groupings = result.groupings;
	}

	return {
		available: availableForParams,
		paramsFolderValues: paramsFolderValues.length > 0 ? paramsFolderValues : ['default'],
		selectedParamsFolder: effectiveParamsFolder ?? 'default',
		kValues,
		selectedK,
		selectedM,
		selectedGrouping,
		selectedSearch,
		groupings,
		page,
		totalItems,
		seedConfigurations,
		pageSize: PAGE_SIZE,
		// Filter state for UI
		selectedCategories: selectedCategories ?? [],
		filterNMaxEnabled,
		filterNMax,
		filterAngleEnabled,
		filterAngle,
	};
}
