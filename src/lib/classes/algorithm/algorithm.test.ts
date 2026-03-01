import { PolygonsGenerator, VCGenerator, PolygonType, type GeneratorParameters, PolygonSignature, CompatibilityGraph, SeedSetExtractor, VertexConfiguration, SeedBuilder } from '$classes';
import { TilingGenerator } from './TilingGenerator.svelte';
import { describe, it } from 'vitest';
import { comparePolygonNames, compareVertexConfigurationNames, toRadians } from '$utils';
import { BATCH_SIZE } from '$stores';
import fs from 'fs';

describe('VCGenerator', () => {
    it('generates vertex configurations for regular polygons', () => {
        const maxK = 1;
        const parameters: GeneratorParameters = {
            [PolygonType.REGULAR]: {
                n_max: 12
            },
            // [PolygonType.STAR_REGULAR]: {
            //     n_max: 12,
            //     // angle: toRadians(30)
            // },
            // [PolygonType.STAR_PARAMETRIC]: {
            //     n_max: 12,
            // },
            // [PolygonType.EQUILATERAL]: {
            //     n_max: 12,
            //     angle: toRadians(30)
            // }
        };
        const additionalPolygons: PolygonSignature[] = [];

        const polygonSignatures = polygonGeneration(parameters, additionalPolygons);
        const vertexConfigurations = vertexConfigurationGeneration(polygonSignatures);
        const adjacencyList = compatibilityGraphGeneration(vertexConfigurations);
        seedSetExtraction(adjacencyList, vertexConfigurations, maxK);
        seedsGeneration(1, 1);
        tilingsGeneration(1, 1);
    }, 15 * 60 * 1000);
});

// STEP 1: generate the polygons based on the selected parameters
const polygonGeneration = (parameters: GeneratorParameters, additionalPolygons: PolygonSignature[]): PolygonSignature[] => {
    const start: number = performance.now();
    const polygonsGenerator = new PolygonsGenerator(parameters, additionalPolygons);
    const polygonsFilePath = 'src/lib/data/polygons.json';
    let savedPolygons: string[] = [];
    if (fs.existsSync(polygonsFilePath)) {
        const fileData = fs.readFileSync(polygonsFilePath, 'utf-8');
        if (fileData.trim()) {
            savedPolygons = JSON.parse(fileData);
        }
    }
    const newPolygonNames = polygonsGenerator.polygons.map(p => p.name);
    for (const name of newPolygonNames) {
        if (!savedPolygons.includes(name)) {
            savedPolygons.push(name);
        }
    }
    savedPolygons.sort((a, b) => comparePolygonNames(a, b));
    fs.writeFileSync(polygonsFilePath, JSON.stringify(savedPolygons, null, 4));
    const end: number = performance.now();
    console.log(`Polygon generation: ${(end - start).toFixed(0)}ms`);
    return polygonsGenerator.polygons;
}

// STEP 2: generate all vertex configurations from the selected polygon set
const vertexConfigurationGeneration = (polygonSignatures: PolygonSignature[]): VertexConfiguration[] => {
    const start: number = performance.now();
    const vcGenerator = new VCGenerator(polygonSignatures);
    const vertexConfigurations = vcGenerator.generateVertexConfigurations();
    const vcFilePath = 'src/lib/data/vcs.json';
    let savedVCs: string[] = [];
    if (fs.existsSync(vcFilePath)) {
        const fileData = fs.readFileSync(vcFilePath, 'utf-8');
        if (fileData.trim()) {
            savedVCs = JSON.parse(fileData);
        }
    }
    const newVCNames = vertexConfigurations.map(vc => vc.name);
    for (const name of newVCNames) {
        if (!savedVCs.includes(name)) {
            savedVCs.push(name);
        }
    }
    savedVCs.sort((a, b) => compareVertexConfigurationNames(a, b));
    fs.writeFileSync(vcFilePath, JSON.stringify(savedVCs, null, 4));
    const end: number = performance.now();
    console.log(`Vertex configuration generation: ${(end - start).toFixed(0)}ms`);
    return vertexConfigurations;
}

// STEP 3: incrementally build the compatibility graph (adjacency list keyed by VC name)
const compatibilityGraphGeneration = (vertexConfigurations: VertexConfiguration[]): Record<string, string[]> => {
    const cgFilePath = 'src/lib/data/compatibilityGraph.json';
    let adjacencyList: Record<string, string[]> = {};
    if (fs.existsSync(cgFilePath)) {
        const fileData = fs.readFileSync(cgFilePath, 'utf-8');
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

    for (let i = 0; i < vertexConfigurations.length; i++) {
        const nameA = vertexConfigurations[i].name;
        for (let j = i + 1; j < vertexConfigurations.length; j++) {
            const nameB = vertexConfigurations[j].name;
            if (adjacencyList[nameA].includes(nameB)) continue;

            if (vertexConfigurations[i].isCompatible(vertexConfigurations[j])) {
                adjacencyList[nameA].push(nameB);
                adjacencyList[nameB].push(nameA);
            }
        }
    }

    fs.writeFileSync(cgFilePath, JSON.stringify(adjacencyList));
    return adjacencyList;
}

// STEP 4: extract seed sets from the compatibility graph
// save in different folders for each k and different files for each m, where m is the number of unique vcs in the seed set
const seedSetExtraction = (adjacencyList: Record<string, string[]>, vertexConfigurations: VertexConfiguration[], maxK: number): void => {
    const start: number = performance.now();
    const compatibilityGraph = CompatibilityGraph.fromAdjacencyList(adjacencyList, vertexConfigurations);
    const extractor = new SeedSetExtractor(compatibilityGraph);

    for (let k = 1; k <= maxK; k++) {
        const folderPath = `src/lib/data/seedSets/k=${k}`;
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        const start: number = performance.now();
        const seedSets = extractor.findSeedSets(k);
        const end: number = performance.now();
        // console.log(`\nk=${k}: ${seedSets.length} (${(end - start).toFixed(0)}ms)`);

        // divide seed sets based on the number of unique vcs in the seed set
        const seedSetsByM = new Map<number, string[][]>();
        for (const seedSet of seedSets) {
            const m = new Set(seedSet).size;
            if (!seedSetsByM.has(m)) {
                seedSetsByM.set(m, []);
            }
            seedSetsByM.get(m)?.push(seedSet);
        }

        for (const [m, seedSets] of seedSetsByM.entries()) {
            // console.log(` - m=${m}: ${seedSets.length}`);
            const filePath = `${folderPath}/m=${m}.json`;
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify(seedSets, null, 4));
            }
        }
    }
    const end: number = performance.now();
    console.log(`Seed set extraction: ${(end - start).toFixed(0)}ms`);
}

// STEP 5: generate seeds from the seed sets
const seedsGeneration = (k: number | null = null, m: number | null = null): void => {
    const start: number = performance.now();
    const seedBuilder = new SeedBuilder();
    const seedConfigurations = seedBuilder.buildSeeds(k, m);
    const seedConfigurationsFolderPath = `src/lib/data/seedConfigurations/k=${k}/m=${m}`;
    if (!fs.existsSync(seedConfigurationsFolderPath)) {
        fs.mkdirSync(seedConfigurationsFolderPath, { recursive: true });
    }

    const compactData = seedConfigurations.map(sc => sc.encodeCompact());
    const total = compactData.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = compactData.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);
        const filePath = `${seedConfigurationsFolderPath}/seedConfigurations_${String(batchIndex).padStart(4, '0')}.json`;
        fs.writeFileSync(filePath, JSON.stringify(batch));
    }

    const manifest = { format: 'compact', total, batchSize: BATCH_SIZE };
    fs.writeFileSync(`${seedConfigurationsFolderPath}/manifest.json`, JSON.stringify(manifest));
    const end: number = performance.now();
    console.log(`Seeds generation: ${(end - start).toFixed(0)}ms`);
}

// STEP 6: generate tilings from the seed configurations
const tilingsGeneration = (k: number, m: number): void => {
    const start: number = performance.now();
    const tilingGenerator = new TilingGenerator();
    const tilings = tilingGenerator.generateTilings(k, m);
    const tilingsFolderPath = `src/lib/data/tilings/k=${k}/m=${m}`;
    if (!fs.existsSync(tilingsFolderPath)) {
        fs.mkdirSync(tilingsFolderPath, { recursive: true });
    }
    const encoded = tilings.map(t => t.encode());
    fs.writeFileSync(`${tilingsFolderPath}/tilings.json`, JSON.stringify(encoded));
    const end: number = performance.now();
    console.log(`Tilings generation: ${tilings.length} tilings in ${(end - start).toFixed(0)}ms`);
}