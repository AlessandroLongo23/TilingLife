import { BATCH_SIZE } from '$stores';

const PAGE_SIZE = 12;

const tilingModules: Record<string, () => Promise<{ default: unknown }>> = {
	...import.meta.glob<{ default: unknown }>('$lib/data/tilings/**/*.json'),
	...import.meta.glob<{ default: unknown }>('$lib/data/tilings/**/*.json.gz'),
};

function getModulePath(suffix: string): string | null {
	const keys = Object.keys(tilingModules);
	// Prefer .json.gz for batch files (tilings_*.json)
	if (suffix.includes('tilings_') && suffix.endsWith('.json') && !suffix.endsWith('.json.gz')) {
		const gzKey = keys.find((k) => k.endsWith(suffix + '.gz'));
		if (gzKey) return gzKey;
	}
	return keys.find((k) => k.endsWith(suffix)) ?? null;
}

async function loadManifest(
	k: number,
	m: number
): Promise<{ total: number; format: string; batchSize: number } | null> {
	const path = getModulePath(`k=${k}/m=${m}/manifest.json`);
	if (!path) return null;
	const mod = await tilingModules[path]();
	const manifest = mod.default as { total: number; format: string; batchSize: number };
	return manifest;
}

async function loadBatch(k: number, m: number, batchIndex: number): Promise<any[]> {
	const path = getModulePath(
		`k=${k}/m=${m}/tilings_${String(batchIndex).padStart(4, '0')}.json`
	);
	if (!path) return [];
	const mod = await tilingModules[path]();
	const data = mod.default;
	return Array.isArray(data) ? data : [];
}

async function loadPageData(
	k: number,
	m: number,
	page: number
): Promise<{ data: any[]; total: number }> {
	const manifest = await loadManifest(k, m);
	if (!manifest) return { data: [], total: 0 };

	const { total } = manifest;
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
	return { data: pageData, total };
}

function discoverAvailable(): { k: number; m: number }[] {
	const available: { k: number; m: number }[] = [];
	const regex = /tilings\/k=(\d+)\/m=(\d+)\/manifest\.json$/;

	for (const key of Object.keys(tilingModules)) {
		const match = key.match(regex);
		if (match) {
			available.push({ k: parseInt(match[1]), m: parseInt(match[2]) });
		}
	}

	return [...new Map(available.map((a) => [`${a.k}-${a.m}`, a])).values()];
}

export async function load({ url }) {
	const discovered = discoverAvailable();

	const available: { k: number; m: number; count: number }[] = [];
	for (const { k, m } of discovered) {
		const manifest = await loadManifest(k, m);
		available.push({ k, m, count: manifest?.total ?? 0 });
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
	const layers = Math.max(1, Math.min(5, parseInt(url.searchParams.get('layers') ?? '2')));

	let tilings: any[] = [];
	let totalItems = 0;

	if (selectedK !== null && selectedM !== null) {
		const result = await loadPageData(selectedK, selectedM, page);
		tilings = result.data;
		totalItems = result.total;
	}

	return {
		available,
		kValues,
		selectedK,
		selectedM,
		page,
		layers,
		totalItems,
		tilings,
		pageSize: PAGE_SIZE,
	};
}
