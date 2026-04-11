import {
    SeedConfiguration,
    type Gyration,
    type Reflection,
    type CompactSeedConfiguration,
    type FullSeedConfiguration,
} from "$classes";
import { AlgorithmTiling } from "./Tiling.svelte";
import { isConwayValid, hasValidAxisAngles } from "$lib/algorithm/conwayCost";
import type { PhaseProgressCallback } from "$lib/algorithm/PipelineLogger";
import { BATCH_SIZE } from "$stores";
import fs from 'fs';

export class AlgorithmTilingGenerator {
    private paramsFolder: string;

    constructor(paramsFolder: string = 'reg_12') {
        this.paramsFolder = paramsFolder;
    }

    // generateTilings = (k: number, m: number): Tiling[] => {
    //     const compactConfigs = this.loadSeedConfigurations(k, m);
    //     const tilings: Tiling[] = [];

    //     for (const compact of compactConfigs) {
    //         const seed = SeedConfiguration.decodeCompact(compact);

    //         let uniquePoints = deduplicatePoints(
    //             seed.polygons.flatMap(p => [...p.vertices, ...p.halfways, p.centroid])
    //         );

    //         const sharedVertices = seed.vertexConfigurations.map(vc => vc.sharedVertex);
    //         uniquePoints = uniquePoints.filter(p => !isWithinConvexHull(sharedVertices, p));

    //         for (let i = 0; i < uniquePoints.length; i++) {
    //             for (let j = i + 1; j < uniquePoints.length; j++) {
    //                 for (let ki = j + 1; ki < uniquePoints.length; ki++) {
    //                     const triVertices: Vector[] = [uniquePoints[i], uniquePoints[j], uniquePoints[ki]];
    //                     const triSig: TriangleSignature = evaluateTriangle(triVertices);

    //                     if (!triSig.types.includes(TriangleType.INVALID)) {
    //                         for (const wg of this.wallpaperGroups) {
    //                             if (wg.sides !== 3) continue;
    //                             if (compareArrays(wg.fundamentalDomainShapes, triSig.types) !== 0) continue;
    //                             if (wg.checkValidity(seed, triSig)) {
    //                                 tilings.push(new Tiling(seed, wg, triSig));
    //                             }
    //                         }
    //                     }

    //                     for (let l = ki + 1; l < uniquePoints.length; l++) {
    //                         const quadVertices: Vector[] = [...triVertices, uniquePoints[l]];
    //                         const quadSig: QuadrilateralSignature = evaluateQuadrilateral(quadVertices);
    //                         if (quadSig.types.includes(QuadrilateralType.INVALID)) continue;

    //                         for (const wg of this.wallpaperGroups) {
    //                             if (wg.sides !== 4) continue;
    //                             if (!wg.fundamentalDomainShapes.every(s => quadSig.types.includes(s as QuadrilateralType))) continue;
    //                             if (wg.checkValidity(seed, quadSig)) {
    //                                 tilings.push(new Tiling(seed, wg, quadSig));
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }

    //     return tilings;
    // }

    generateTilings = (
        k: number,
        m: number,
        onProgress?: PhaseProgressCallback,
        seedConfigs?: { format: string; configs: (CompactSeedConfiguration | FullSeedConfiguration)[]; vcLibrary?: string[] }
    ): AlgorithmTiling[] => {
        const { format, configs, vcLibrary } = seedConfigs ?? this.loadSeedConfigurations(k, m, onProgress);
        const tilings: AlgorithmTiling[] = [];

        const configsToProcess = configs;
        for (let configIdx = 0; configIdx < configsToProcess.length; configIdx++) {
            const config = configsToProcess[configIdx];
            onProgress?.('seed', configIdx + 1, configsToProcess.length, 'Decoding seed');

            const seed = format === 'full'
                ? SeedConfiguration.decodeFull(config as FullSeedConfiguration)
                : SeedConfiguration.decodeCompact(config as CompactSeedConfiguration, vcLibrary);

            // Create all triplets of generators whose Conway cost sums to exactly 2
            const generatorsSets: (Gyration | Reflection)[][] = [];
            const transformations: (Gyration | Reflection)[] = [...seed.gyrations, ...seed.reflections];
            for (let i = 0; i < transformations.length; i++) {
                for (let j = i + 1; j < transformations.length; j++) {
                    for (let k = j + 1; k < transformations.length; k++) {
                        const triplet = [transformations[i], transformations[j], transformations[k]];
                        if (isConwayValid(triplet) && hasValidAxisAngles(triplet)) {
                            generatorsSets.push(triplet);
                        }
                    }
                }
            }

            const generatorSetsArray = generatorsSets;
            const outerProgress = { current: configIdx + 1, total: configsToProcess.length };
            onProgress?.(
                'generators',
                0,
                generatorSetsArray.length,
                undefined,
                outerProgress
            );

            // now, for each set of three generators, iterate for a few times over the three
            // in sequence, applying the generators to the seed
            // At each iteration, we check if the expanding seed is still valid
            const maxIterations: number = 2;
            let tested = 0;
            for (const generatorsSet of generatorSetsArray) {
                tested++;
                onProgress?.('generators', tested, generatorSetsArray.length, undefined, outerProgress);

                const generators: (Gyration | Reflection)[] = [...generatorsSet];
                let expandedSeed: SeedConfiguration = seed.clone();

                let isValid: boolean = true;
                for (let i = 0; i < maxIterations; i++) {
                    expandedSeed = this.applyGenerators(expandedSeed, generators);

                    if (!expandedSeed.isValid()) {
                        isValid = false;
                        break;
                    }
                }

                if (isValid) {
                    tilings.push(AlgorithmTiling.fromSeedAndGenerators(seed.clone(), generators, maxIterations));
                }
            }
        }

        return tilings;
    }

    applyGenerators = (seed: SeedConfiguration, generators: (Gyration | Reflection)[]): SeedConfiguration => {
        return SeedConfiguration.applyGenerators(seed, generators);
    }

    loadSeedConfigurations = (
        k: number,
        m: number,
        onProgress?: PhaseProgressCallback
    ): { format: string; configs: (CompactSeedConfiguration | FullSeedConfiguration)[]; vcLibrary?: string[] } => {
        const folder = `src/lib/data/${this.paramsFolder}/seedConfigurations/k=${k}/m=${m}`;
        const manifest = JSON.parse(fs.readFileSync(`${folder}/manifest.json`, 'utf8'));
        const total: number = manifest.total;
        const format: string = manifest.format || 'compact';
        const configs: (CompactSeedConfiguration | FullSeedConfiguration)[] = [];

        let vcLibrary: string[] | undefined;
        if (manifest.vcLibrary) {
            try {
                const vcLibraryPath = `src/lib/data/${this.paramsFolder}/seedConfigurations/vcLibrary.json`;
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
            let batch: (CompactSeedConfiguration | FullSeedConfiguration)[];
            if (fs.existsSync(gzPath)) {
                // zlib is Node-only; when .gz exists, caller must pass pre-loaded configs via generateTilings(,,, seedConfigs)
                throw new Error('Compressed .json.gz batches require pre-loading. Use pipeline or pass seedConfigs.');
            }
            batch = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            configs.push(...batch);
        }

        return { format, configs, vcLibrary };
    }
}
