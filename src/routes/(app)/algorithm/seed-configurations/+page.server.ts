import { SeedConfiguration } from '$classes';
import { BATCH_SIZE } from '$stores';
import { seedMatchesSearch } from '$lib/utils/compactSeedName';

const PAGE_SIZE = 24;

const seedConfigModules = import.meta.glob<{ default: unknown }>(
	'$lib/data/seedConfigurations/**/*.json' 
);

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

function getModulePath(suffix: string): string | null {
	const key = Object.keys(seedConfigModules).find((k) => k.endsWith(suffix));
	return key ?? null;
}

async function loadManifest(
	k: number,
	m: number
): Promise<{ total: number; format: string; batchSize: number } | null> {
	const path = getModulePath(`k=${k}/m=${m}/manifest.json`);
	if (!path) return null;
	const mod = await seedConfigModules[path]();
	const manifest = mod.default as { total: number; format: string; batchSize: number };
	return manifest;
}

async function loadBatch(k: number, m: number, batchIndex: number): Promise<any[]> {
	const path = getModulePath(
		`k=${k}/m=${m}/seedConfigurations_${String(batchIndex).padStart(4, '0')}.json`
	);
	if (!path) return [];
	const mod = await seedConfigModules[path]();
	const data = mod.default;
	return Array.isArray(data) ? data : [];
}

async function loadLegacy(k: number, m: number): Promise<any[] | null> {
	const path = getModulePath(`k=${k}/m=${m}/seedConfigurations.json`);
	if (!path) return null;
	const mod = await seedConfigModules[path]();
	const data = mod.default;
	return Array.isArray(data) ? data : null;
}

async function loadAllData(k: number, m: number): Promise<{ data: any[]; format: string } | null> {
	const manifest = await loadManifest(k, m);
	if (manifest) {
		const { total, format } = manifest;
		const allData: any[] = [];
		const numBatches = Math.ceil(total / BATCH_SIZE);
		for (let i = 0; i < numBatches; i++) {
			allData.push(...(await loadBatch(k, m, i)));
		}
		if (format === 'compact') {
			return {
				data: allData.map((item: any) => SeedConfiguration.decodeCompact(item).encode()),
				format,
			};
		}
		return { data: allData, format };
	}
	const legacyData = await loadLegacy(k, m);
	if (!legacyData) return null;
	return { data: legacyData, format: 'full' };
}

async function loadPageData(
	k: number,
	m: number,
	page: number,
	grouping: string | null,
	search: string | null
): Promise<{ data: any[]; total: number; groupings: { label: string; count: number }[] }> {
	const manifest = await loadManifest(k, m);
	if (manifest) {
		const { total, format } = manifest;
		const start = (page - 1) * PAGE_SIZE;
		const end = Math.min(start + PAGE_SIZE, total);
		if (start >= total) {
			const all = await loadAllData(k, m);
			const groupings: { label: string; count: number }[] = [];
			let filteredTotal = total;
			if (all) {
				const byLabel = new Map<string, number>();
				for (const sc of all.data) {
					const label = getGroupingLabel(sc.name);
					byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
				}
				groupings.push(
					...[...byLabel.entries()]
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
						.map(([label, count]) => ({ label, count }))
				);
				if (grouping || search) {
					let f = all.data;
					if (grouping) f = f.filter((sc: any) => getGroupingLabel(sc.name) === grouping);
					if (search) f = f.filter((sc: any) => seedMatchesSearch(sc.name, search));
					filteredTotal = f.length;
				}
			}
			return { data: [], total: filteredTotal, groupings };
		}

		let data: any[];
		let filteredTotal: number;

		let groupings: { label: string; count: number }[] = [];

		if (grouping || search) {
			const all = await loadAllData(k, m);
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
				batchData.push(...(await loadBatch(k, m, i)));
			}
			const pageData = batchData.slice(
				start - batchStart * BATCH_SIZE,
				end - batchStart * BATCH_SIZE
			);
			data = format === 'compact'
				? pageData.map((item: any) => SeedConfiguration.decodeCompact(item).encode())
				: pageData;
			filteredTotal = total;
			// Load all to compute groupings
			const all = await loadAllData(k, m);
			if (all) {
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
			}
		}

		return { data, total: filteredTotal, groupings };
	}

	const legacyData = await loadLegacy(k, m);
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

function discoverAvailable(): { k: number; m: number; count: number }[] {
	const available: { k: number; m: number; count: number }[] = [];
	const manifestRegex = /seedConfigurations\/k=(\d+)\/m=(\d+)\/manifest\.json$/;
	const legacyRegex = /seedConfigurations\/k=(\d+)\/m=(\d+)\/seedConfigurations\.json$/;

	for (const key of Object.keys(seedConfigModules)) {
		let match = key.match(manifestRegex);
		if (match) {
			const k = parseInt(match[1]);
			const m = parseInt(match[2]);
			available.push({ k, m, count: 0 }); // Will be filled when we load manifest
			continue;
		}
		match = key.match(legacyRegex);
		if (match) {
			const k = parseInt(match[1]);
			const m = parseInt(match[2]);
			available.push({ k, m, count: 0 }); // Will be filled when we load
			continue;
		}
	}

	// Dedupe by k,m and get counts (we need to load manifests for counts - do it in load)
	return [...new Map(available.map((a) => [`${a.k}-${a.m}`, a])).values()];
}

export async function load({ url }) {
	const discovered = discoverAvailable();

	// Get counts for each - load manifest or legacy
	const available: { k: number; m: number; count: number }[] = [];
	for (const { k, m } of discovered) {
		const manifest = await loadManifest(k, m);
		if (manifest) {
			available.push({ k, m, count: manifest.total });
		} else {
			const legacy = await loadLegacy(k, m);
			available.push({ k, m, count: legacy?.length ?? 0 });
		}
	}

	available.sort((a, b) => a.k - b.k || a.m - b.m);

	const kValues = [...new Set(available.map((a) => a.k))].sort((a, b) => a - b);

	const selectedK = url.searchParams.has('k')
		? parseInt(url.searchParams.get('k')!)
		: kValues[0] ?? null;

	const mValuesForK = available.filter((a) => a.k === selectedK);

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
		const result = await loadPageData(selectedK, selectedM, page, selectedGrouping, selectedSearch);
		seedConfigurations = result.data;
		totalItems = result.total;
		groupings = result.groupings;
	}

	return {
		available,
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
