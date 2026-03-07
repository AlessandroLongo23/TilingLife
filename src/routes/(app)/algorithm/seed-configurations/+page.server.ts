import { SeedConfiguration } from '$classes';
import { BATCH_SIZE } from '$stores';
import { seedMatchesSearch } from '$lib/utils/compactSeedName';
import { deduplicateEncodedPolygons } from '$utils';

const PAGE_SIZE = 24;

const seedConfigModules: Record<string, () => Promise<{ default: unknown }>> = {
	...import.meta.glob<{ default: unknown }>('$lib/data/seedConfigurations/**/*.json'),
	...import.meta.glob<{ default: unknown }>('$lib/data/seedConfigurations/**/*.json.gz'),
};

/** Computes grouping label from seed name: e.g. AAABC → "3:1:1", AABBC → "2:2:1". */
function getGroupingLabel(name: string): string {
	const inner = name.slice(1, -1);
	if (!inner) return '';
	const vcNames = inner.split(';');
	const counts = new Map<string, number>();
	for (const vc of vcNames) {
		counts.set(vc, (counts.get(vc) ?? 0) + 1);
	}
	return [...counts.values()].sort((a, b) => b - a).join(':');
}

/** Find module path. Handles both legacy and new layouts. Prefers .json.gz over .json for batch files. */
function getModulePath(k: number, m: number, file: string, paramsFolder: string | null): string | null {
	const baseSuffix = paramsFolder
		? `seedConfigurations/${paramsFolder}/k=${k}/m=${m}/${file}`
		: `seedConfigurations/k=${k}/m=${m}/${file}`;
	const keys = Object.keys(seedConfigModules);
	const normalizedKeys = keys.map((k) => ({ orig: k, norm: k.replace(/\\/g, '/') }));
	// Prefer .json.gz for batch files (seedConfigurations_*.json, tilings_*.json)
	if (file.includes('_') && file.endsWith('.json') && !file.endsWith('.json.gz')) {
		const gzSuffix = baseSuffix + '.gz';
		const gzMatch = normalizedKeys.find(({ norm }) => norm.endsWith(gzSuffix));
		if (gzMatch) return gzMatch.orig;
	}
	const match = normalizedKeys.find(({ norm }) => norm.endsWith(baseSuffix));
	return match?.orig ?? null;
}

async function loadManifest(
	k: number,
	m: number,
	paramsFolder: string | null
): Promise<{ total: number; format: string; batchSize: number; vcLibrary?: string[] } | null> {
	const path = getModulePath(k, m, 'manifest.json', paramsFolder);
	if (!path) return null;
	const mod = await seedConfigModules[path]();
	const manifest = mod.default as { total: number; format: string; batchSize: number; vcLibrary?: boolean };
	const result: { total: number; format: string; batchSize: number; vcLibrary?: string[] } = {
		total: manifest.total,
		format: manifest.format ?? 'compact',
		batchSize: manifest.batchSize ?? 1000,
	};
	if (manifest.vcLibrary && paramsFolder) {
		const vcLibPath = getVcLibraryPath(paramsFolder);
		if (vcLibPath) {
			const vcMod = await seedConfigModules[vcLibPath]();
			result.vcLibrary = vcMod.default as string[];
		}
	}
	return result;
}

function getVcLibraryPath(paramsFolder: string): string | null {
	const suffix = `seedConfigurations/${paramsFolder}/vcLibrary.json`;
	const key = Object.keys(seedConfigModules).find((k) => {
		const normalized = k.replace(/\\/g, '/');
		return normalized.endsWith(suffix);
	});
	return key ?? null;
}

async function loadBatch(
	k: number,
	m: number,
	batchIndex: number,
	paramsFolder: string | null
): Promise<any[]> {
	const file = `seedConfigurations_${String(batchIndex).padStart(4, '0')}.json`;
	const path = getModulePath(k, m, file, paramsFolder);
	if (!path) return [];
	const mod = await seedConfigModules[path]();
	const data = mod.default;
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

/** Load raw batches and compute groupings only (no decode/encode). Much faster than loadAllData. */
async function loadGroupingsOnly(
	k: number,
	m: number,
	paramsFolder: string | null
): Promise<{ groupings: { label: string; count: number }[] }> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (manifest) {
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
	const legacy = await loadLegacy(k, m, paramsFolder);
	if (!legacy) return { groupings: [] };
	const byLabel = new Map<string, number>();
	for (const item of legacy) {
		const name = getNameFromRaw(item, 'full');
		if (name) {
			const label = getGroupingLabel(name);
			byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
		}
	}
	return { groupings: sortGroupings(byLabel) };
}

/** Load raw batches once, return groupings and filtered count. */
async function loadGroupingsAndFilteredCount(
	k: number,
	m: number,
	paramsFolder: string | null,
	format: string,
	grouping: string | null,
	search: string | null,
	total: number
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
			const label = getGroupingLabel(name);
			byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
			if (grouping && label !== grouping) continue;
			if (search && !seedMatchesSearch(name, search)) continue;
			filteredTotal++;
		}
	}
	return { groupings: sortGroupings(byLabel), filteredTotal: grouping || search ? filteredTotal : total };
}

async function loadLegacy(
	k: number,
	m: number,
	paramsFolder: string | null
): Promise<any[] | null> {
	const path = getModulePath(k, m, 'seedConfigurations.json', paramsFolder);
	if (!path) return null;
	const mod = await seedConfigModules[path]();
	const data = mod.default;
	return Array.isArray(data) ? data : null;
}

async function loadAllData(
	k: number,
	m: number,
	paramsFolder: string | null
): Promise<{ data: any[]; format: string } | null> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (manifest) {
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
	const legacyData = await loadLegacy(k, m, paramsFolder);
	if (!legacyData) return null;
	return {
		data: legacyData.map((item: any) => {
			const encoded = SeedConfiguration.decodeFull(item).encode();
			encoded.polygons = deduplicateEncodedPolygons(encoded.polygons);
			return encoded;
		}),
		format: 'full',
	};
}

async function loadPageData(
	k: number,
	m: number,
	page: number,
	grouping: string | null,
	search: string | null,
	paramsFolder: string | null
): Promise<{ data: any[]; total: number; groupings: { label: string; count: number }[] }> {
	const manifest = await loadManifest(k, m, paramsFolder);
	if (manifest) {
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
				total
			);
			return { data: [], total: filteredTotal, groupings: g };
		}

		let data: any[];
		let filteredTotal: number;

		let groupings: { label: string; count: number }[] = [];

		if (grouping || search) {
			const all = await loadAllData(k, m, paramsFolder);
			if (!all) return { data: [], total: 0, groupings: [] };
			let filtered = all.data;
			if (grouping) {
				filtered = filtered.filter((sc: any) => getGroupingLabel(sc.name) === grouping);
			}
			if (search) {
				filtered = filtered.filter((sc: any) => seedMatchesSearch(sc.name, search));
			}
			filteredTotal = filtered.length;
			data = filtered.slice(start, start + PAGE_SIZE);
			// Build groupings from full data
			const byLabel = new Map<string, number>();
			for (const sc of all.data) {
				const label = getGroupingLabel(sc.name);
				byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
			}
			groupings = [...byLabel.entries()]
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

	const legacyData = await loadLegacy(k, m, paramsFolder);
	if (!legacyData) return { data: [], total: 0, groupings: [] };
	let data = legacyData;
	if (grouping) {
		data = data.filter((sc: any) => getGroupingLabel(sc.name) === grouping);
	}
	if (search) {
		data = data.filter((sc: any) => seedMatchesSearch(sc.name, search));
	}
	const total = data.length;
	const start = (page - 1) * PAGE_SIZE;
	const paginated = data.slice(start, start + PAGE_SIZE);

	const byLabel = new Map<string, number>();
	for (const sc of legacyData) {
		const label = getGroupingLabel(sc.name);
		byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
	}
	const groupings = [...byLabel.entries()]
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

	return { data: paginated, total, groupings };
}

type DiscoveredEntry = { paramsFolder: string | null; k: number; m: number; count: number };

function discoverAvailable(): DiscoveredEntry[] {
	const available: DiscoveredEntry[] = [];
	// New format: seedConfigurations/reg_12/k=5/m=3/manifest.json
	const newManifestRegex = /seedConfigurations\/([^/]+)\/k=(\d+)\/m=(\d+)\/manifest\.json$/;
	const newLegacyRegex = /seedConfigurations\/([^/]+)\/k=(\d+)\/m=(\d+)\/seedConfigurations\.json$/;
	// Legacy format (no paramsFolder): seedConfigurations/k=5/m=3/manifest.json
	const legacyManifestRegex = /seedConfigurations\/k=(\d+)\/m=(\d+)\/manifest\.json$/;
	const legacyLegacyRegex = /seedConfigurations\/k=(\d+)\/m=(\d+)\/seedConfigurations\.json$/;

	for (const key of Object.keys(seedConfigModules)) {
		const normalized = key.replace(/\\/g, '/');
		// New format: has paramsFolder (must not match k=\d+ to avoid legacy collision)
		let match = normalized.match(newManifestRegex);
		if (match) {
			const paramsFolder = match[1];
			const k = parseInt(match[2]);
			const m = parseInt(match[3]);
			// Skip if paramsFolder looks like "k=5" (legacy path misclassified)
			if (!paramsFolder.startsWith('k=')) {
				available.push({ paramsFolder, k, m, count: 0 });
				continue;
			}
		}
		match = normalized.match(newLegacyRegex);
		if (match) {
			const paramsFolder = match[1];
			const k = parseInt(match[2]);
			const m = parseInt(match[3]);
			if (!paramsFolder.startsWith('k=')) {
				available.push({ paramsFolder, k, m, count: 0 });
				continue;
			}
		}
		// Legacy format
		match = normalized.match(legacyManifestRegex);
		if (match) {
			const k = parseInt(match[1]);
			const m = parseInt(match[2]);
			available.push({ paramsFolder: null, k, m, count: 0 });
			continue;
		}
		match = normalized.match(legacyLegacyRegex);
		if (match) {
			const k = parseInt(match[1]);
			const m = parseInt(match[2]);
			available.push({ paramsFolder: null, k, m, count: 0 });
		}
	}

	// Dedupe by paramsFolder+k+m
	return [...new Map(available.map((a) => [`${a.paramsFolder ?? 'legacy'}-${a.k}-${a.m}`, a])).values()];
}

export async function load({ url }) {
	const discovered = discoverAvailable();

	// Get counts for each - load manifest or legacy
	const available: DiscoveredEntry[] = [];
	for (const { paramsFolder, k, m } of discovered) {
		const manifest = await loadManifest(k, m, paramsFolder);
		if (manifest) {
			available.push({ paramsFolder, k, m, count: manifest.total });
		} else {
			const legacy = await loadLegacy(k, m, paramsFolder);
			available.push({ paramsFolder, k, m, count: legacy?.length ?? 0 });
		}
	}

	available.sort((a, b) => (a.paramsFolder ?? '').localeCompare(b.paramsFolder ?? '') || a.k - b.k || a.m - b.m);

	const paramsFolderValues = [...new Set(available.map((a) => a.paramsFolder ?? 'default'))].sort((a, b) => {
		// Put 'default' (legacy) first for backward compatibility
		if (a === 'default') return -1;
		if (b === 'default') return 1;
		return a.localeCompare(b);
	});

	const selectedParamsFolder = url.searchParams.get('polygons') || paramsFolderValues[0] || null;
	const effectiveParamsFolder = selectedParamsFolder === 'default' ? null : selectedParamsFolder;

	const availableForParams = available.filter(
		(a) => (a.paramsFolder ?? 'default') === (effectiveParamsFolder === null ? 'default' : effectiveParamsFolder)
	);

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

	let seedConfigurations: any[] = [];
	let totalItems = 0;
	let groupings: { label: string; count: number }[] = [];

	if (selectedK !== null && selectedM !== null) {
		const result = await loadPageData(
			selectedK,
			selectedM,
			page,
			selectedGrouping,
			selectedSearch,
			effectiveParamsFolder
		);
		seedConfigurations = result.data;
		totalItems = result.total;
		groupings = result.groupings;
	}

	return {
		available: availableForParams,
		paramsFolderValues: paramsFolderValues.length > 0 ? paramsFolderValues : ['default'],
		selectedParamsFolder: effectiveParamsFolder === null ? 'default' : effectiveParamsFolder,
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
	};
}
