/**
 * Standalone script to run the tiling generation pipeline with real-time progress logging.
 * Run with: npm run pipeline
 *
 * Unlike the test file, this shows progress immediately (like tqdm in Python).
 */

import {
	PolygonsGenerator,
	VCGenerator,
	PolygonType,
	type GeneratorParameters,
	PolygonSignature,
	CompatibilityGraph,
	SeedSetExtractor,
	VertexConfiguration,
	SeedBuilder,
	SeedExpander,
	SeedConfiguration,
	TranslationalCellExtractor,
	Vector,
	RegularPolygon,
	StarRegularPolygon,
	StarParametricPolygon,
	EquilateralPolygon,
	GenericPolygon,
} from '$classes';
import { AlgorithmTilingGenerator } from '$classes/algorithm/TilingGenerator.svelte';
import { comparePolygonNames, compareVertexConfigurationNames, roundNumbersInJson, toRadians, getEffectiveUniqueCount } from '$utils';
import { BATCH_SIZE } from '$stores';
import { PipelineLogger } from '$lib/algorithm/PipelineLogger';
import { buildParamsFolderName } from '$lib/algorithm/paramsFolder';
import fs from 'fs';

import zlib from 'zlib';

/** Output path for CLI pipeline. Use ./pipeline-output when running locally (src/lib/data removed). */
const DATA_FOLDER_PATH = 'pipeline-output';

/** Base path for a polygon type (paramsFolder). Type is the outer folder. */
function typeBasePath(paramsFolder: string): string {
	return `${DATA_FOLDER_PATH}/${paramsFolder}`;
}

/** Encode polygon for storage (short format). */
function polygonToShort(enc: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = { t: enc.type, n: enc.n };
	if (enc.vertices && Array.isArray(enc.vertices)) {
		out.v = (enc.vertices as { x: number; y: number }[]).map((v) => [v.x, v.y]);
	}
	if (enc.sides) out.s = enc.sides;
	if (enc.angles) out.a = enc.angles;
	if (enc.d != null) out.d = enc.d;
	if (enc.alpha != null) out.alpha = enc.alpha;
	return out;
}

/** Decode polygon from short format to Polygon instance. */
function polygonFromShort(enc: Record<string, unknown>) {
	const v = enc.v as [number, number][] | undefined;
	const vertices = v
		? v.map((p) => new Vector(p[0], p[1]))
		: (enc.vertices as { x: number; y: number }[])?.map((p) =>
				Array.isArray(p) ? new Vector(p[0], p[1]) : new Vector(p.x, p.y)
			) ?? [];
	const type = (enc.t ?? enc.type) as string;
	switch (type) {
		case PolygonType.REGULAR:
			return RegularPolygon.fromVertices(vertices);
		case PolygonType.STAR_REGULAR:
			return StarRegularPolygon.fromVertices(vertices);
		case PolygonType.STAR_PARAMETRIC:
			return StarParametricPolygon.fromVertices(vertices);
		case PolygonType.EQUILATERAL:
			return EquilateralPolygon.fromVertices(vertices);
		case PolygonType.GENERIC:
			return GenericPolygon.fromVertices(vertices);
		default:
			return RegularPolygon.fromVertices(vertices);
	}
}

const MAX_K = 4;

const parameters: GeneratorParameters = {
	// [PolygonType.REGULAR]: {
	// 	n_max: 12
	// },
	// [PolygonType.STAR_REGULAR]: {
	//     n_max: 12,
	//     // angle: toRadians(30)
	// },
	// [PolygonType.STAR_PARAMETRIC]: {
	// 	n_max: 12,
	// },
	// [PolygonType.EQUILATERAL]: {
	//     n_max: 5,
	//     angle: toRadians(30)
	// },
	// [PolygonType.DUAL]: {
	//     n_max: 12
	// }
};

main();

function main() {
	const additionalPolygons: PolygonSignature[] = [
		new PolygonSignature({type: PolygonType.REGULAR, n: 4}),
		new PolygonSignature({type: PolygonType.EQUILATERAL, n: 4, angles: [60, 120, 60, 120].map(a => toRadians(a))}),
		new PolygonSignature({type: PolygonType.EQUILATERAL, n: 6, angles: [90, 150, 120, 90, 150, 120].map(a => toRadians(a))}),
	];

	for (const p of additionalPolygons) {
		if (parameters[p.type] === PolygonType.EQUILATERAL) {
			for (let i = 1; i <= p.angles.length; i++) {
				const cycledAngles = p.angles.slice(i).concat(p.angles.slice(0, i));
				additionalPolygons.push(new PolygonSignature({
					type: PolygonType.EQUILATERAL,
					n: p.n,
					angles: cycledAngles.map(a => toRadians(a))
				}))
			}
		}
	}

	const log = new PipelineLogger();
	log.log('Tiling generation pipeline\n' + '='.repeat(50));

	if (!fs.existsSync(DATA_FOLDER_PATH)) fs.mkdirSync(DATA_FOLDER_PATH, { recursive: true });

	const paramsFolder = buildParamsFolderName(parameters);
	log.log(`Polygon set: ${paramsFolder}\n`);

	const polygonSignatures = polygonGeneration(parameters, additionalPolygons, paramsFolder, log);
	const vertexConfigurations = vertexConfigurationGeneration(polygonSignatures, paramsFolder, log);
	const adjacencyList = compatibilityGraphGeneration(vertexConfigurations, paramsFolder, log);
	seedSetExtraction(adjacencyList, vertexConfigurations, paramsFolder, log);
	seedsGeneration(paramsFolder, null, null, log);
	seedsExpansion(paramsFolder, null, null, log);
	extractTranslationalCell(paramsFolder, null, null, log);
	tilingsGeneration(paramsFolder, 1, 1, log);

	log.log('='.repeat(50));
	log.log('Pipeline complete!');
}

function polygonGeneration(
	parameters: GeneratorParameters,
	additionalPolygons: PolygonSignature[],
	paramsFolder: string,
	log: PipelineLogger
): PolygonSignature[] {
	return log.runStep('Polygon generation', () => {
		const polygonsGenerator = new PolygonsGenerator(parameters, additionalPolygons);
		const base = typeBasePath(paramsFolder);
		if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
		const polygonsPath = `${base}/polygons.json`;
		let savedPolygons: string[] = [];
		if (fs.existsSync(polygonsPath)) {
			const fileData = fs.readFileSync(polygonsPath, 'utf-8');
			if (fileData.trim()) {
				savedPolygons = JSON.parse(fileData);
			}
		}
		const newPolygonNames = polygonsGenerator.polygons.map((p) => p.name);
		for (const name of newPolygonNames) {
			if (!savedPolygons.includes(name)) {
				savedPolygons.push(name);
			}
		}
		savedPolygons.sort((a, b) => comparePolygonNames(a, b));
		fs.writeFileSync(polygonsPath, JSON.stringify(savedPolygons, null, 4));
		return polygonsGenerator.polygons;
	});
}

function vertexConfigurationGeneration(
	polygonSignatures: PolygonSignature[],
	paramsFolder: string,
	log: PipelineLogger
): VertexConfiguration[] {
	return log.runStep('Vertex configuration generation', () => {
		const vcGenerator = new VCGenerator(polygonSignatures);
		const vertexConfigurations = vcGenerator.generateVertexConfigurations();
		const base = typeBasePath(paramsFolder);
		if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
		const vcsPath = `${base}/vcs.json`;
		let savedVCs: string[] = [];
		if (fs.existsSync(vcsPath)) {
			const fileData = fs.readFileSync(vcsPath, 'utf-8');
			if (fileData.trim()) {
				savedVCs = JSON.parse(fileData);
			}
		}
		const newVCNames = vertexConfigurations.map((vc) => vc.name);
		for (const name of newVCNames) {
			if (!savedVCs.includes(name)) {
				savedVCs.push(name);
			}
		}
		savedVCs.sort((a, b) => compareVertexConfigurationNames(a, b));
		fs.writeFileSync(vcsPath, JSON.stringify(savedVCs, null, 4));
		return vertexConfigurations;
	});
}

function compatibilityGraphGeneration(
	vertexConfigurations: VertexConfiguration[],
	paramsFolder: string,
	log: PipelineLogger
): Record<string, string[]> {
	return log.runStep('Compatibility graph', () => {
		const base = typeBasePath(paramsFolder);
		if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
		const compatPath = `${base}/compatibilityGraph.json`;
		let adjacencyList: Record<string, string[]> = {};
		if (fs.existsSync(compatPath)) {
			const fileData = fs.readFileSync(compatPath, 'utf-8');
			if (fileData.trim()) {
				try {
					const parsed = JSON.parse(fileData);
					if (typeof parsed === 'object' && !Array.isArray(parsed)) {
						adjacencyList = parsed;
					}
				} catch {}
			}
		}

		for (const vc of vertexConfigurations) {
			if (!adjacencyList[vc.name]) adjacencyList[vc.name] = [];
		}

		const total = (vertexConfigurations.length * (vertexConfigurations.length - 1)) / 2;
		let checked = 0;
		for (let i = 0; i < vertexConfigurations.length; i++) {
			const nameA = vertexConfigurations[i].name;
			for (let j = i + 1; j < vertexConfigurations.length; j++) {
				checked++;
				log.progress('Pairs', checked, total);
				const nameB = vertexConfigurations[j].name;
				if (adjacencyList[nameA].includes(nameB)) continue;

				if (vertexConfigurations[i].isCompatible(vertexConfigurations[j])) {
					adjacencyList[nameA].push(nameB);
					adjacencyList[nameB].push(nameA);
				}
			}
		}

		fs.writeFileSync(compatPath, JSON.stringify(adjacencyList));
		log.clearLine();
		return adjacencyList;
	});
}

function seedSetExtraction(
	adjacencyList: Record<string, string[]>,
	vertexConfigurations: VertexConfiguration[],
	paramsFolder: string,
	log: PipelineLogger
): void {
	log.runStep('Seed set extraction', () => {
		const compatibilityGraph = CompatibilityGraph.fromAdjacencyList(
			adjacencyList,
			vertexConfigurations
		);
		const extractor = new SeedSetExtractor(compatibilityGraph);

		const baseFolderPath = `${typeBasePath(paramsFolder)}/seedSets`;
		if (!fs.existsSync(baseFolderPath)) {
			fs.mkdirSync(baseFolderPath, { recursive: true });
		}

		for (let k = 1; k <= MAX_K; k++) {
			// log.progress('k', k, MAX_K);
			const folderPath = `${baseFolderPath}/k=${k}`;
			if (!fs.existsSync(folderPath)) {
				fs.mkdirSync(folderPath, { recursive: true });
			}
			const start: number = performance.now();
			const seedSets: string[][] = extractor.findSeedSets(k);
			const end: number = performance.now();
			console.log(`k=${k}: found ${seedSets.length} seed sets in ${end - start} milliseconds`);

			const seedSetsByM = new Map<number, string[][]>();
			for (const seedSet of seedSets) {
				const m = new Set(seedSet).size;
				if (!seedSetsByM.has(m)) {
					seedSetsByM.set(m, []);
				}
				seedSetsByM.get(m)?.push(seedSet);
			}

			for (const [m, sets] of seedSetsByM.entries()) {
				console.log(`k=${k}, m=${m}: writing ${sets.length} seed sets`);
				const filePath = `${baseFolderPath}/k=${k}/m=${m}.json`;
				if (!fs.existsSync(filePath)) {
					fs.writeFileSync(filePath, JSON.stringify(sets, null, 4));
				}
			}
		}
		log.clearLine();
	});
}

function seedsGeneration(
	paramsFolder: string,
	k: number | null,
	m: number | null,
	log: PipelineLogger
): void {
	const loadAllForK = loadAllSeedSetsForK(paramsFolder);
	if (k === null) {
		for (let kVal = 1; kVal <= MAX_K; kVal++) {
			generateSeedsForK(paramsFolder, loadAllForK, kVal, log);
		}
	} else {
		generateSeedsForK(paramsFolder, loadAllForK, k, log);
	}
}

function generateSeedsForK(
	paramsFolder: string,
	loadAllForK: (k: number) => Map<number, string[][]>,
	k: number,
	log: PipelineLogger
): void {
	log.runStep(
		`Seeds generation for k=${k}`,
		() => {
			const byM = loadAllForK(k);
			const allSeedSets = [...byM.values()].flat();
			if (allSeedSets.length === 0) return 0;

			const seedSetLoader = (_k: number, _m: number) => allSeedSets;
			const vcLibrary = ensureVcLibrary(paramsFolder);
			const seedBuilder = new SeedBuilder();
			const seedConfigurations = seedBuilder.buildSeeds(k, 1, {
				seedSetLoader,
				onProgress: log.progressForSeeds('Seed sets')
			});
			log.clearLine();

			const byEffectiveM = new Map<number, typeof seedConfigurations>();
			for (const sc of seedConfigurations) {
				const vcNames = sc.vertexConfigurations.map((vc) => vc.name);
				const effectiveM = getEffectiveUniqueCount(vcNames);
				if (!byEffectiveM.has(effectiveM)) byEffectiveM.set(effectiveM, []);
				byEffectiveM.get(effectiveM)!.push(sc);
			}

			let totalWritten = 0;
			for (const [effectiveM, seeds] of byEffectiveM.entries()) {
				const folderPath = `${typeBasePath(paramsFolder)}/seedConfigurations/k=${k}/m=${effectiveM}`;
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath, { recursive: true });
				}

				const compactData = log.mapWithProgress(
					seeds,
					`Encoding m=${effectiveM}`,
					(sc) => sc.encodeCompact(vcLibrary, true),
					1
				);

				const total = compactData.length;
				const totalBatches = Math.ceil(total / BATCH_SIZE);
				for (let i = 0; i < total; i += BATCH_SIZE) {
					const batchIndex = Math.floor(i / BATCH_SIZE);
					log.progress('Writing batches', batchIndex + 1, totalBatches);
					const batch = compactData.slice(i, i + BATCH_SIZE);
					const rounded = roundNumbersInJson(batch) as typeof batch;
					const json = JSON.stringify(rounded);
					const compressed = zlib.gzipSync(json, { level: 9 });
					const filePath = `${folderPath}/seedConfigurations_${String(batchIndex).padStart(4, '0')}.json.gz`;
					fs.writeFileSync(filePath, compressed);
				}

				const manifest = { format: 'compact', vcLibrary: true, shortKeys: true, compressed: true, total, batchSize: BATCH_SIZE };
				fs.writeFileSync(`${folderPath}/manifest.json`, JSON.stringify(manifest));
				totalWritten += total;
			}
			log.clearLine();
			return totalWritten;
		},
		(count) => log.log(`  → ${count} seeds`)
	);
}

function seedsExpansion(
	paramsFolder: string,
	k: number | null,
	m: number | null,
	log: PipelineLogger
): void {
	if (k === null) {
		for (let kVal = 1; kVal <= MAX_K; kVal++) {
			expandSeedsForK(paramsFolder, kVal, m, log);
		}
	} else {
		expandSeedsForK(paramsFolder, k, m, log);
	}
}

function expandSeedsForK(
	paramsFolder: string,
	k: number,
	m: number | null,
	log: PipelineLogger
): void {
	log.runStep(
		`Seed expansion for k=${k}`,
		() => {
			const expander = new SeedExpander(k);
			let processed = 0;
			let expanded = 0;
			let entropyWalls = 0;
			let deadEnds = 0;

			const basePath = `${typeBasePath(paramsFolder)}/seedConfigurations/k=${k}`;
			if (!fs.existsSync(basePath)) return 0;

			// Pre-compute total for this k
			let totalToProcess = 0;
			const mDirsToProcess: { mDir: string; mVal: number }[] = [];
			const mDirs = fs.readdirSync(basePath).filter((d) => d.startsWith('m='));
			for (const mDir of mDirs) {
				const mVal = parseInt(mDir.replace('m=', ''), 10);
				if (m !== null && mVal !== m) continue;
				const manifestPath = `${basePath}/${mDir}/manifest.json`;
				if (!fs.existsSync(manifestPath)) continue;
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
				totalToProcess += manifest.total ?? 0;
				mDirsToProcess.push({ mDir, mVal });
			}

			if (totalToProcess === 0) return 0;

			for (const { mDir, mVal } of mDirsToProcess) {
				const { configs, vcLibrary } = loadSeedConfigBatches(paramsFolder, k, mVal);
				const folderPath = `${typeBasePath(paramsFolder)}/expandedSeeds/k=${k}/m=${mVal}`;
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath, { recursive: true });
				}

				let batch: { n: string; p: Record<string, unknown>[] }[] = [];
				let batchIndex = 0;
				let totalItems = 0;

				for (let i = 0; i < configs.length; i++) {
					processed++;
					log.progress('Seeds', processed, totalToProcess);
					const seed = SeedConfiguration.decodeCompact(configs[i], vcLibrary);
					const count = expander.expand(seed, (patch) => {
						const encodedPolygons = patch.map((p) =>
							polygonToShort(p.encode() as Record<string, unknown>)
						);
						batch.push({
							n: seed.name,
							p: roundNumbersInJson(encodedPolygons) as Record<string, unknown>[],
						});
						if (batch.length >= BATCH_SIZE) {
							const json = JSON.stringify(batch);
							const compressed = zlib.gzipSync(json, { level: 9 });
							fs.writeFileSync(
								`${folderPath}/expandedSeeds_${String(batchIndex).padStart(4, '0')}.json.gz`,
								compressed
							);
							totalItems += batch.length;
							batch = [];
							batchIndex++;
						}
					}) as number;
					if (count > 0) {
						expanded += count;
					} else {
						deadEnds++;
					}
				}

				// Flush remaining batch
				if (batch.length > 0) {
					const json = JSON.stringify(batch);
					const compressed = zlib.gzipSync(json, { level: 9 });
					fs.writeFileSync(
						`${folderPath}/expandedSeeds_${String(batchIndex).padStart(4, '0')}.json.gz`,
						compressed
					);
					totalItems += batch.length;
				}

				if (totalItems > 0) {
					fs.writeFileSync(
						`${folderPath}/manifest.json`,
						JSON.stringify({
							format: 'full',
							shortKeys: true,
							compressed: true,
							total: totalItems,
							batchSize: BATCH_SIZE,
						})
					);
				}
			}
			log.clearLine();
			return { expanded, entropyWalls, deadEnds, processed };
		},
		(result) => {
			if (typeof result === 'number' && result === 0) return;
			const r = result as { expanded: number; entropyWalls: number; deadEnds: number; processed: number };
			log.log(
				`  → ${r.expanded} fully expanded, ${r.entropyWalls} entropy walls, ${r.deadEnds} dead ends (${r.processed} total)`
			);
		}
	);
}

function extractTranslationalCell(
	paramsFolder: string,
	k: number | null,
	m: number | null,
	log: PipelineLogger
): void {
	if (k === null) {
		for (let kVal = 1; kVal <= MAX_K; kVal++) {
			extractTranslationalCellForK(paramsFolder, kVal, m, log);
		}
	} else {
		extractTranslationalCellForK(paramsFolder, k, m, log);
	}
}

function extractTranslationalCellForK(
	paramsFolder: string,
	k: number,
	m: number | null,
	log: PipelineLogger
): void {
	log.runStep(
		`Translational cell extraction for k=${k}`,
		() => {
			const extractor = new TranslationalCellExtractor();
			let processed = 0;
			let extracted = 0;
			let skipped = 0;

			const basePath = `${typeBasePath(paramsFolder)}/expandedSeeds/k=${k}`;
			if (!fs.existsSync(basePath)) return 0;

			let totalToProcess = 0;
			const mDirsToProcess: { mDir: string; mVal: number }[] = [];
			const mDirs = fs.readdirSync(basePath).filter((d) => d.startsWith('m='));
			for (const mDir of mDirs) {
				const mVal = parseInt(mDir.replace('m=', ''), 10);
				if (m !== null && mVal !== m) continue;
				const manifestPath = `${basePath}/${mDir}/manifest.json`;
				if (!fs.existsSync(manifestPath)) continue;
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
				totalToProcess += manifest.total ?? 0;
				mDirsToProcess.push({ mDir, mVal });
			}

			if (totalToProcess === 0) return 0;

			const byM = new Map<
				number,
				{ n: string; p: Record<string, unknown>[]; b: [[number, number], [number, number]]; o: [number, number] }[]
			>();

			for (const { mDir, mVal } of mDirsToProcess) {
				const items = loadExpandedSeedsBatches(paramsFolder, k, mVal);
				if (!byM.has(mVal)) byM.set(mVal, []);

				for (let i = 0; i < items.length; i++) {
					processed++;
					log.progress('Seeds', processed, totalToProcess);
					const item = items[i];
					const polygons = (item.p ?? []).map((p: Record<string, unknown>) => polygonFromShort(p));
					if (polygons.length === 0) {
						skipped++;
						continue;
					}

					const result = extractor.extract(polygons);
					if (!result) {
						skipped++;
						continue;
					}

					extracted++;
					const encodedCell = result.cellPolygons.map((p) =>
						polygonToShort(p.encode() as Record<string, unknown>)
					);
					const [v1, v2] = result.basis;
					byM.get(mVal)!.push({
						n: item.n ?? '',
						p: roundNumbersInJson(encodedCell) as Record<string, unknown>[],
						b: [
							[v1.x, v1.y],
							[v2.x, v2.y],
						],
						o: [result.origin.x, result.origin.y],
					});
				}
			}

			log.clearLine();

			for (const [mVal, cells] of byM.entries()) {
				if (cells.length === 0) continue;
				const folderPath = `${typeBasePath(paramsFolder)}/translationalCells/k=${k}/m=${mVal}`;
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath, { recursive: true });
				}
				const total = cells.length;
				const totalBatches = Math.ceil(total / BATCH_SIZE);
				for (let i = 0; i < total; i += BATCH_SIZE) {
					const batchIndex = Math.floor(i / BATCH_SIZE);
					log.progress('Writing batches', batchIndex + 1, totalBatches);
					const batch = cells.slice(i, i + BATCH_SIZE);
					const json = JSON.stringify(batch);
					const compressed = zlib.gzipSync(json, { level: 9 });
					fs.writeFileSync(
						`${folderPath}/translationalCells_${String(batchIndex).padStart(4, '0')}.json.gz`,
						compressed
					);
				}
				fs.writeFileSync(
					`${folderPath}/manifest.json`,
					JSON.stringify({
						format: 'full',
						shortKeys: true,
						compressed: true,
						total,
						batchSize: BATCH_SIZE,
					})
				);
			}
			log.clearLine();
			return { extracted, skipped, processed };
		},
		(result) => {
			if (typeof result === 'number' && result === 0) return;
			const r = result as { extracted: number; skipped: number; processed: number };
			log.log(`  → ${r.extracted} cells extracted, ${r.skipped} skipped (${r.processed} total)`);
		}
	);
}

function loadExpandedSeedsBatches(
	paramsFolder: string,
	k: number,
	m: number
): { n: string; p: Record<string, unknown>[] }[] {
	const folder = `${typeBasePath(paramsFolder)}/expandedSeeds/k=${k}/m=${m}`;
	if (!fs.existsSync(folder)) return [];
	const manifest = JSON.parse(fs.readFileSync(`${folder}/manifest.json`, 'utf8'));
	const total = manifest.total;
	const totalBatches = Math.ceil(total / BATCH_SIZE);
	const items: { n: string; p: Record<string, unknown>[] }[] = [];
	for (let i = 0; i < total; i += BATCH_SIZE) {
		const batchIndex = Math.floor(i / BATCH_SIZE);
		const baseName = `expandedSeeds_${String(batchIndex).padStart(4, '0')}`;
		const gzPath = `${folder}/${baseName}.json.gz`;
		const jsonPath = `${folder}/${baseName}.json`;
		let batch: { n: string; p: Record<string, unknown>[] }[];
		if (fs.existsSync(gzPath)) {
			batch = JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8'));
		} else {
			batch = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
		}
		items.push(...batch);
	}
	return items;
}

function tilingsGeneration(
	paramsFolder: string,
	k: number | null,
	m: number | null,
	log: PipelineLogger
): void {
	if (k === null) {
		generateTilings(paramsFolder, 1, 1, log);

		for (let k = 2; k <= MAX_K; k++) {
			for (let m = 2; m <= k; m++) {
				generateTilings(paramsFolder, k, m, log);
			}
		}
	} else {
		if (m === null) {
			for (let m = 2; m <= k; m++) {
				generateTilings(paramsFolder, k, m, log);
			}
		} else {
			generateTilings(paramsFolder, k, m, log);
		}
	}
}

function loadSeedConfigBatches(
	paramsFolder: string,
	k: number,
	m: number,
	onProgress?: (phase: string, current: number, total: number, msg?: string) => void
): { format: string; configs: any[]; vcLibrary?: string[] } {
	const folder = `${typeBasePath(paramsFolder)}/seedConfigurations/k=${k}/m=${m}`;
	const manifest = JSON.parse(fs.readFileSync(`${folder}/manifest.json`, 'utf8'));
	const total = manifest.total;
	const format = manifest.format || 'compact';
	const configs: any[] = [];
	let vcLibrary: string[] | undefined;
	if (manifest.vcLibrary) {
		try {
			const vcLibraryPath = `${typeBasePath(paramsFolder)}/seedConfigurations/vcLibrary.json`;
			vcLibrary = JSON.parse(fs.readFileSync(vcLibraryPath, 'utf8'));
		} catch {
			vcLibrary = undefined;
		}
	}
	const totalBatches = Math.ceil(total / BATCH_SIZE);
	for (let i = 0; i < total; i += BATCH_SIZE) {
		const batchIndex = Math.floor(i / BATCH_SIZE);
		onProgress?.('load', batchIndex + 1, totalBatches, `Loading batch ${batchIndex + 1}/${totalBatches}`);
		const baseName = `seedConfigurations_${String(batchIndex).padStart(4, '0')}`;
		const gzPath = `${folder}/${baseName}.json.gz`;
		const jsonPath = `${folder}/${baseName}.json`;
		let batch: any[];
		if (fs.existsSync(gzPath)) {
			batch = JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8'));
		} else {
			batch = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
		}
		configs.push(...batch);
	}
	return { format, configs, vcLibrary };
}

function generateTilings(
	paramsFolder: string,
	k: number,
	m: number,
	log: PipelineLogger
): void {
	log.runStep(
		`Tilings generation for k=${k} and m=${m}`,
		() => {
			const progress = log.progressForPhases({
				load: 'Loading seed configs',
				seed: 'Processing seeds',
				generators: 'Testing generator sets'
			});
			const seedConfigs = loadSeedConfigBatches(paramsFolder, k, m, progress);
			const tilingGenerator = new AlgorithmTilingGenerator(paramsFolder);
			const tilings = tilingGenerator.generateTilings(
				k,
				m,
				progress,
				seedConfigs
			);
			log.clearLine(70, 2);

			const tilingsFolderPath = `${typeBasePath(paramsFolder)}/tilings/k=${k}/m=${m}`;
			if (!fs.existsSync(tilingsFolderPath)) {
				fs.mkdirSync(tilingsFolderPath, { recursive: true });
			}

			const encoded = log.mapWithProgress(tilings, 'Encoding tilings', (t) => t.encode(true), 1);

			const total = encoded.length;
			const totalBatches = Math.ceil(total / BATCH_SIZE);
			for (let i = 0; i < total; i += BATCH_SIZE) {
				const batchIndex = Math.floor(i / BATCH_SIZE);
				log.progress('Writing batches', batchIndex + 1, totalBatches);
				const batch = encoded.slice(i, i + BATCH_SIZE);
				const rounded = roundNumbersInJson(batch) as typeof batch;
				const json = JSON.stringify(rounded);
				const compressed = zlib.gzipSync(json, { level: 9 });
				const filePath = `${tilingsFolderPath}/tilings_${String(batchIndex).padStart(4, '0')}.json.gz`;
				fs.writeFileSync(filePath, compressed);
			}
			const manifest = { format: 'full', compressed: true, total, batchSize: BATCH_SIZE };
			fs.writeFileSync(`${tilingsFolderPath}/manifest.json`, JSON.stringify(manifest));
			log.clearLine();
			return tilings.length;
		},
		(count) => log.log(`  → ${count} tilings`)
	);
}

function loadSeedSets(paramsFolder: string): (k: number, m: number) => string[][] {
	return (k: number, m: number) => {
		const filePath = `${typeBasePath(paramsFolder)}/seedSets/k=${k}/m=${m}.json`;
		const content = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(content);
	};
}

/** Load all seed sets for k (from m=1 to m=k). Returns (k, m) => seedSets for that m. */
function loadAllSeedSetsForK(paramsFolder: string): (k: number) => Map<number, string[][]> {
	return (k: number) => {
		const byM = new Map<number, string[][]>();
		for (let m = 1; m <= k; m++) {
			const filePath = `${typeBasePath(paramsFolder)}/seedSets/k=${k}/m=${m}.json`;
			if (!fs.existsSync(filePath)) continue;
			const content = fs.readFileSync(filePath, 'utf8');
			byM.set(m, JSON.parse(content));
		}
		return byM;
	};
}

/** Ensure vcLibrary.json exists for paramsFolder; return the VC name array. */
function ensureVcLibrary(paramsFolder: string): string[] {
	const base = typeBasePath(paramsFolder);
	const vcLibraryPath = `${base}/seedConfigurations/vcLibrary.json`;
	const baseFolder = `${base}/seedConfigurations`;
	if (!fs.existsSync(baseFolder)) {
		fs.mkdirSync(baseFolder, { recursive: true });
	}
	let vcLibrary: string[];
	if (fs.existsSync(vcLibraryPath)) {
		vcLibrary = JSON.parse(fs.readFileSync(vcLibraryPath, 'utf8'));
	} else {
		const vcsPath = `${typeBasePath(paramsFolder)}/vcs.json`;
		vcLibrary = fs.existsSync(vcsPath)
			? JSON.parse(fs.readFileSync(vcsPath, 'utf8'))
			: [];
		fs.writeFileSync(vcLibraryPath, JSON.stringify(vcLibrary));
	}
	return vcLibrary;
}
