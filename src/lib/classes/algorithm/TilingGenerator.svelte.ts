import {
    SeedConfiguration, Vector, WallpaperGroup,
    p1, p2,
    p3, p31m, p3m1,
    p4, p4g, p4m,
    p6, p6m,
    pm, pg, pmm, pgg, pmg,
    cm, cmmRhombic, cmmSquare,
    TriangleType,
    QuadrilateralType,
    type TriangleSignature,
    type QuadrilateralSignature,
    type CompactSeedConfiguration,
} from "$classes";
import { Tiling } from "./Tiling.svelte";
import { deduplicatePoints, evaluateTriangle, evaluateQuadrilateral, compareArrays, isWithinConvexHull } from "$utils";
import { BATCH_SIZE } from "$stores";
import fs from 'fs';

export class TilingGenerator {
    wallpaperGroups: WallpaperGroup[];

    constructor() {
        this.wallpaperGroups = [
            // new p1(), new p2(),
            // new p3(), new p31m(), new p3m1(),
            // new p4(), new p4g(), new p4m(),
            // new p6(), new p6m(),
            // new pm(), new pg(), new pmm(), new pgg(), new pmg(),
            // new cm(), 
            new cmmRhombic(), 
            // new cmmSquare(),
        ];
    }

    generateTilings = (k: number, m: number): Tiling[] => {
        const compactConfigs = this.loadSeedConfigurations(k, m);
        const tilings: Tiling[] = [];

        for (const compact of compactConfigs) {
            const seed = SeedConfiguration.decodeCompact(compact);

            let uniquePoints = deduplicatePoints(
                seed.polygons.flatMap(p => [...p.vertices, ...p.halfways, p.centroid])
            );

            const sharedVertices = seed.vertexConfigurations.map(vc => vc.sharedVertex);
            uniquePoints = uniquePoints.filter(p => !isWithinConvexHull(sharedVertices, p));

            for (let i = 0; i < uniquePoints.length; i++) {
                for (let j = i + 1; j < uniquePoints.length; j++) {
                    for (let ki = j + 1; ki < uniquePoints.length; ki++) {
                        const triVertices: Vector[] = [uniquePoints[i], uniquePoints[j], uniquePoints[ki]];
                        const triSig: TriangleSignature = evaluateTriangle(triVertices);

                        if (!triSig.types.includes(TriangleType.INVALID)) {
                            for (const wg of this.wallpaperGroups) {
                                if (wg.sides !== 3) continue;
                                if (compareArrays(wg.fundamentalDomainShapes, triSig.types) !== 0) continue;
                                if (wg.checkValidity(seed, triSig)) {
                                    tilings.push(new Tiling(seed, wg, triSig));
                                }
                            }
                        }

                        for (let l = ki + 1; l < uniquePoints.length; l++) {
                            const quadVertices: Vector[] = [...triVertices, uniquePoints[l]];
                            const quadSig: QuadrilateralSignature = evaluateQuadrilateral(quadVertices);
                            if (quadSig.types.includes(QuadrilateralType.INVALID)) continue;

                            for (const wg of this.wallpaperGroups) {
                                if (wg.sides !== 4) continue;
                                if (!wg.fundamentalDomainShapes.every(s => quadSig.types.includes(s as QuadrilateralType))) continue;
                                if (wg.checkValidity(seed, quadSig)) {
                                    tilings.push(new Tiling(seed, wg, quadSig));
                                }
                            }
                        }
                    }
                }
            }
        }

        return tilings;
    }

    loadSeedConfigurations = (k: number, m: number): CompactSeedConfiguration[] => {
        const folder = `src/lib/data/seedConfigurations/k=${k}/m=${m}`;
        const manifest = JSON.parse(fs.readFileSync(`${folder}/manifest.json`, 'utf8'));
        const total: number = manifest.total;
        const configs: CompactSeedConfiguration[] = [];

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batchIndex = Math.floor(i / BATCH_SIZE);
            const filePath = `${folder}/seedConfigurations_${String(batchIndex).padStart(4, '0')}.json`;
            const batch: CompactSeedConfiguration[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            configs.push(...batch);
        }

        return configs;
    }
}
