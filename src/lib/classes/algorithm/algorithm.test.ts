import { PolygonsGenerator, VCGenerator, PolygonType, type GeneratorParameters, PolygonSignature, CompatibilityGraph, SeedSetExtractor } from '$classes';
import { describe, it } from 'vitest';
import fs from 'fs';

describe('VCGenerator', () => {
    it('generates vertex configurations for regular polygons', () => {
        const parameters: GeneratorParameters = {
            [PolygonType.REGULAR]: {
                n_max: 42
            },
            // [PolygonType.STAR_REGULAR]: {
            //     n_max: 12,
            //     angle: toRadians(30)
            // },
            // [PolygonType.STAR_PARAMETRIC]: {
            //     n_max: 6,
            //     angle: toRadians(30)
            // },
            // [PolygonType.EQUILATERAL]: {
            //     n_max: 6,
            //     angle: toRadians(30)
            // }
        };
        const additionalPolygons: PolygonSignature[] = [];

        // STEP 1: generate the polygons based on the selected parameters
        const polygonsGenerator = new PolygonsGenerator(parameters, additionalPolygons);
        const polygonsFilePath = 'src/lib/classes/algorithm/polygons.json';
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
        fs.writeFileSync(polygonsFilePath, JSON.stringify(savedPolygons, null, 4));
        
        // STEP 2: generate all vertex configurations from the selected polygon set
        const vcGenerator = new VCGenerator(polygonsGenerator.polygons);
        const vertexConfigurations = vcGenerator.generateVertexConfigurations();
        const vcFilePath = 'src/lib/classes/algorithm/vcs.json';
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
        fs.writeFileSync(vcFilePath, JSON.stringify(savedVCs, null, 4));

        // STEP 3: incrementally build the compatibility graph (adjacency list keyed by VC name)
        const cgFilePath = 'src/lib/classes/algorithm/compatibilityGraph.json';
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

        // STEP 4: extract seed sets from the compatibility graph
        // save in different folders for each k and different files for each m, where m is the number of unique vcs in the seed set
        const compatibilityGraph = CompatibilityGraph.fromAdjacencyList(adjacencyList, vertexConfigurations);
        const extractor = new SeedSetExtractor(compatibilityGraph);

        for (let k = 2; k <= 10; k++) {
            const folderPath = `src/lib/classes/algorithm/seedSets/k=${k}`;
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            const start: number = performance.now();
            const seedSets = extractor.findSeedSets(k);
            const end: number = performance.now();
            console.log(`\nk=${k}: ${seedSets.length} (${(end - start).toFixed(0)}ms)`);

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
                console.log(` - m=${m}: ${seedSets.length}`);
                const filePath = `${folderPath}/m=${m}.json`;
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, JSON.stringify(seedSets, null, 4));
                }
            }
        }
    }, 120 * 1000);
});