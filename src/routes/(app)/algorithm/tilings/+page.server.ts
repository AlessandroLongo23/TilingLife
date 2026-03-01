const PAGE_SIZE = 12;

const tilingModules = import.meta.glob<{ default: unknown }>(
	'$lib/data/tilings/**/*.json'
);

function getModulePath(suffix: string): string | null {
	const key = Object.keys(tilingModules).find((k) => k.endsWith(suffix));
	return key ?? null;
}

async function loadTilingsFile(k: number, m: number): Promise<any[]> {
	const path = getModulePath(`k=${k}/m=${m}/tilings.json`);
	if (!path) return [];
	const mod = await tilingModules[path]();
	const data = mod.default;
	return Array.isArray(data) ? data : [];
}

function discoverAvailable(): { k: number; m: number }[] {
	const available: { k: number; m: number }[] = [];
	const regex = /tilings\/k=(\d+)\/m=(\d+)\/tilings\.json$/;

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
		const tilings = await loadTilingsFile(k, m);
		available.push({ k, m, count: tilings.length });
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
		const allTilings = await loadTilingsFile(selectedK, selectedM);
		totalItems = allTilings.length;
		const start = (page - 1) * PAGE_SIZE;
		tilings = allTilings.slice(start, start + PAGE_SIZE);
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
