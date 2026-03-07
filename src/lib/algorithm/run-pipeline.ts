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
	SeedConfiguration
} from '$classes';
import { findGyration, findReflection } from '$lib/algorithm/transformFinder';
import { deduplicatePoints } from '$utils';
import { TilingGenerator } from '$classes/algorithm/TilingGenerator.svelte';
import { Tiling } from '$classes/algorithm/Tiling.svelte';
import { comparePolygonNames, compareVertexConfigurationNames } from '$utils';
import { BATCH_SIZE } from '$stores';
import { PipelineLogger } from '$lib/algorithm/PipelineLogger';
import fs from 'fs';

const DATA_FOLDER_PATH = 'src/lib/data';
const POLYGONS_FILE_PATH = 'src/lib/data/polygons.json';
const VCS_FILE_PATH = 'src/lib/data/vcs.json';
const COMPATIBILITY_GRAPH_FILE_PATH = 'src/lib/data/compatibilityGraph.json';
const SEED_SETS_FOLDER_PATH = 'src/lib/data/seedSets';
const SEED_CONFIGURATIONS_FOLDER_PATH = 'src/lib/data/seedConfigurations';
const TILINGS_FOLDER_PATH = 'src/lib/data/tilings';

const TOTAL_STEPS = 6;
const MAX_K = 5;

main();

function main() {
	const parameters: GeneratorParameters = {
		[PolygonType.REGULAR]: {
			n_max: 12
		},
		// [PolygonType.STAR_REGULAR]: {
		//     n_max: 12,
		//     angle: toRadians(30)
		// },
		// [PolygonType.STAR_PARAMETRIC]: {
		//     n_max: 12,
		// },
		// [PolygonType.EQUILATERAL]: {
		//     n_max: 5,
		//     angle: toRadians(30)
		// },
		// [PolygonType.DUAL]: {
		//     n_max: 12
		// }
	};
	const additionalPolygons: PolygonSignature[] = [];

	const log = new PipelineLogger(TOTAL_STEPS);
	log.log('Tiling generation pipeline\n' + '='.repeat(50));

	if (!fs.existsSync(DATA_FOLDER_PATH)) fs.mkdirSync(DATA_FOLDER_PATH, { recursive: true });

	const polygonSignatures = polygonGeneration(parameters, additionalPolygons, log);
	const vertexConfigurations = vertexConfigurationGeneration(polygonSignatures, log);
	const adjacencyList = compatibilityGraphGeneration(vertexConfigurations, log);
	seedSetExtraction(adjacencyList, vertexConfigurations, log);
	seedsGeneration(5, null, log);
	// tilingsGeneration(1, 1, log);

	log.log('='.repeat(50));
	log.log('Pipeline complete!');
}

function polygonGeneration(
	parameters: GeneratorParameters,
	additionalPolygons: PolygonSignature[],
	log: PipelineLogger
): PolygonSignature[] {
	return log.runStep('Polygon generation', () => {
		const polygonsGenerator = new PolygonsGenerator(parameters, additionalPolygons);
		let savedPolygons: string[] = [];
		if (fs.existsSync(POLYGONS_FILE_PATH)) {
			const fileData = fs.readFileSync(POLYGONS_FILE_PATH, 'utf-8');
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
		fs.writeFileSync(POLYGONS_FILE_PATH, JSON.stringify(savedPolygons, null, 4));
		return polygonsGenerator.polygons;
	});
}

function vertexConfigurationGeneration(
	polygonSignatures: PolygonSignature[],
	log: PipelineLogger
): VertexConfiguration[] {
	return log.runStep('Vertex configuration generation', () => {
		const vcGenerator = new VCGenerator(polygonSignatures);
		const vertexConfigurations = vcGenerator.generateVertexConfigurations();
		let savedVCs: string[] = [];
		if (fs.existsSync(VCS_FILE_PATH)) {
			const fileData = fs.readFileSync(VCS_FILE_PATH, 'utf-8');
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
		fs.writeFileSync(VCS_FILE_PATH, JSON.stringify(savedVCs, null, 4));
		return vertexConfigurations;
	});
}

function compatibilityGraphGeneration(
	vertexConfigurations: VertexConfiguration[],
	log: PipelineLogger
): Record<string, string[]> {
	return log.runStep('Compatibility graph', () => {
		let adjacencyList: Record<string, string[]> = {};
		if (fs.existsSync(COMPATIBILITY_GRAPH_FILE_PATH)) {
			const fileData = fs.readFileSync(COMPATIBILITY_GRAPH_FILE_PATH, 'utf-8');
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

		fs.writeFileSync(COMPATIBILITY_GRAPH_FILE_PATH, JSON.stringify(adjacencyList));
		log.clearLine();
		return adjacencyList;
	});
}

function seedSetExtraction(
	adjacencyList: Record<string, string[]>,
	vertexConfigurations: VertexConfiguration[],
	log: PipelineLogger
): void {
	log.runStep('Seed set extraction', () => {
		const compatibilityGraph = CompatibilityGraph.fromAdjacencyList(
			adjacencyList,
			vertexConfigurations
		);
		const extractor = new SeedSetExtractor(compatibilityGraph);

		for (let k = 1; k <= MAX_K; k++) {
			log.progress('k', k, MAX_K);
			const folderPath = `${SEED_SETS_FOLDER_PATH}/k=${k}`;
			if (!fs.existsSync(folderPath)) {
				fs.mkdirSync(folderPath, { recursive: true });
			}
			const seedSets = extractor.findSeedSets(k);

			const seedSetsByM = new Map<number, string[][]>();
			for (const seedSet of seedSets) {
				const m = new Set(seedSet).size;
				if (!seedSetsByM.has(m)) {
					seedSetsByM.set(m, []);
				}
				seedSetsByM.get(m)?.push(seedSet);
			}

			for (const [m, sets] of seedSetsByM.entries()) {
				const filePath = `${SEED_SETS_FOLDER_PATH}/k=${k}/m=${m}.json`;
				if (!fs.existsSync(filePath)) {
					fs.writeFileSync(filePath, JSON.stringify(sets, null, 4));
				}
			}
		}
		log.clearLine();
	});
}

function seedsGeneration(
	k: number | null,
	m: number | null,
	log: PipelineLogger
): void {
	if (k === null) {
		generateSeeds(1, 1, log);

		for (let k = 2; k <= MAX_K; k++) {
			for (let m = 2; m <= k; m++) {
				generateSeeds(k, m, log);	
			}
		}
	} else {
		if (m === null) {
			for (let m = 2; m <= k; m++) {
				generateSeeds(k, m, log);	
			}
		} else {
			generateSeeds(k, m, log);
		}
	}
}

function generateSeeds(k: number, m: number, log: PipelineLogger): void {
	log.runStep(
		`Seeds generation for k=${k} and m=${m}`,
		() => {
			const seedBuilder = new SeedBuilder();
			const seedConfigurations = seedBuilder.buildSeeds(k, m, log.progressForSeeds('Seed sets'));
			log.clearLine();

			const seedConfigurationsFolderPath = `${SEED_CONFIGURATIONS_FOLDER_PATH}/k=${k}/m=${m}`;
			if (!fs.existsSync(seedConfigurationsFolderPath)) {
				fs.mkdirSync(seedConfigurationsFolderPath, { recursive: true });
			}

			const fullData = log.mapWithProgress(
				seedConfigurations,
				'Encoding',
				(sc) => {
					const points = deduplicatePoints(
						sc.polygons.flatMap((p) => [...p.vertices, ...p.halfways, p.centroid])
					);
					// findGyration(sc, points);
					// findReflection(sc);
					return sc.encode();
				},
				1
			);

			const total = fullData.length;
			const totalBatches = Math.ceil(total / BATCH_SIZE);
			for (let i = 0; i < total; i += BATCH_SIZE) {
				const batchIndex = Math.floor(i / BATCH_SIZE);
				log.progress('Writing batches', batchIndex + 1, totalBatches);
				const batch = fullData.slice(i, i + BATCH_SIZE);
				const filePath = `${seedConfigurationsFolderPath}/seedConfigurations_${String(batchIndex).padStart(4, '0')}.json`;
				fs.writeFileSync(filePath, JSON.stringify(batch));
			}

			const manifest = { format: 'full', total, batchSize: BATCH_SIZE };
			fs.writeFileSync(`${seedConfigurationsFolderPath}/manifest.json`, JSON.stringify(manifest));
			log.clearLine();
			return total;
		},
		(count) => log.log(`  → ${count} seeds`)
	);
}

function tilingsGeneration(k: number, m: number, log: PipelineLogger): void {
	if (k === null) {
		generateTilings(1, 1, log);

		for (let k = 2; k <= MAX_K; k++) {
			for (let m = 2; m <= k; m++) {
				generateTilings(k, m, log);	
			}
		}
	} else {
		if (m === null) {
			for (let m = 2; m <= k; m++) {
				generateTilings(k, m, log);	
			}
		} else {
			generateTilings(k, m, log);
		}
	}
}

function generateTilings(k: number, m: number, log: PipelineLogger): void {
	log.runStep(
		`Tilings generation for k=${k} and m=${m}`,
		() => {
			const tilingGenerator = new TilingGenerator();
			const tilings = tilingGenerator.generateTilings(
				k,
				m,
				log.progressForPhases({
					load: 'Loading seed configs',
					seed: 'Processing seeds',
					generators: 'Testing generator sets'
				})
			);
			log.clearLine(70, 2);

			const tilingsFolderPath = `${TILINGS_FOLDER_PATH}/k=${k}/m=${m}`;
			if (!fs.existsSync(tilingsFolderPath)) {
				fs.mkdirSync(tilingsFolderPath, { recursive: true });
			}

			const encoded = log.mapWithProgress(tilings, 'Encoding tilings', (t) => t.encode(), 1);

			const total = encoded.length;
			const totalBatches = Math.ceil(total / BATCH_SIZE);
			for (let i = 0; i < total; i += BATCH_SIZE) {
				const batchIndex = Math.floor(i / BATCH_SIZE);
				log.progress('Writing batches', batchIndex + 1, totalBatches);
				const batch = encoded.slice(i, i + BATCH_SIZE);
				const filePath = `${tilingsFolderPath}/tilings_${String(batchIndex).padStart(4, '0')}.json`;
				fs.writeFileSync(filePath, JSON.stringify(batch));
			}
			const manifest = { format: 'full', total, batchSize: BATCH_SIZE };
			fs.writeFileSync(`${tilingsFolderPath}/manifest.json`, JSON.stringify(manifest));
			log.clearLine();
			return tilings.length;
		},
		(count) => log.log(`  → ${count} tilings`)
	);
}