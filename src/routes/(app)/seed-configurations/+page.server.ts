import { SeedConfiguration } from '$classes';

const PAGE_SIZE = 24;
const BATCH_SIZE = 1000;

const seedConfigModules = import.meta.glob<{ default: unknown }>(
	'$lib/classes/algorithm/seedConfigurations/**/*.json'
);

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

async function loadPageData(
	k: number,
	m: number,
	page: number
): Promise<{ data: any[]; total: number }> {
	const manifest = await loadManifest(k, m);
	if (manifest) {
		const { total, format } = manifest;
		const start = (page - 1) * PAGE_SIZE;
		const end = Math.min(start + PAGE_SIZE, total);
		if (start >= total) return { data: [], total };

		const batchStart = Math.floor(start / BATCH_SIZE);
		const batchEnd = Math.floor((end - 1) / BATCH_SIZE);
		const allData: any[] = [];
		for (let i = batchStart; i <= batchEnd; i++) {
			allData.push(...(await loadBatch(k, m, i)));
		}
		const pageData = allData.slice(
			start - batchStart * BATCH_SIZE,
			end - batchStart * BATCH_SIZE
		);

		if (format === 'compact') {
			const decoded = pageData.map((item: any) => SeedConfiguration.decodeCompact(item));
			return { data: decoded, total };
		}
		return { data: pageData, total };
	}

	const legacyData = await loadLegacy(k, m);
	if (!legacyData) return { data: [], total: 0 };
	const total = legacyData.length;
	const start = (page - 1) * PAGE_SIZE;
	return { data: legacyData.slice(start, start + PAGE_SIZE), total };
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

	let seedConfigurations: any[] = [];
	let totalItems = 0;

	if (selectedK !== null && selectedM !== null) {
		const result = await loadPageData(selectedK, selectedM, page);
		seedConfigurations = result.data;
		totalItems = result.total;
	}

	return {
		available,
		kValues,
		selectedK,
		selectedM,
		page,
		totalItems,
		seedConfigurations,
		pageSize: PAGE_SIZE,
	};
}
