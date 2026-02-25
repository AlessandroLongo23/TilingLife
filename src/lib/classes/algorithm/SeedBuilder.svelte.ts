import { SeedConfiguration, VertexConfiguration, Vector } from '$classes';
import { isWithinTolerance } from '$utils';
import fs from 'fs';

type PlacedVC = {
    center: Vector;
    neighboringVertices: Vector[];
};

export class SeedBuilder {
    seedConfigurations: SeedConfiguration[] = [];
    
    constructor() {}

    buildSeeds = (k: number, m: number | null = null): SeedConfiguration[] => {
        const seedSets = this.loadSeedSets(k, m);
        
        const seedConfigurations: SeedConfiguration[] = [];
        for (const seedSet of seedSets) {
            seedConfigurations.push(...this.buildSeedsFromSet(seedSet));
        }

        return seedConfigurations;
    }

    buildSeedsFromSet = (seedSet: string[]): SeedConfiguration[] => {
        const results: SeedConfiguration[] = [];

        const firstVC = VertexConfiguration.fromName(seedSet[0]);
        firstVC.computeNeighboringVertices();

        const initialSeed = new SeedConfiguration(firstVC.polygons.map(p => p.clone()));
        const placedVCs: PlacedVC[] = [{
            center: new Vector(0, 0),
            neighboringVertices: firstVC.neighboringVertices.map(v => v.copy())
        }];

        this.dfs(initialSeed, placedVCs, seedSet.slice(1), results);

        return results;
    }

    dfs = (
        seed: SeedConfiguration,
        placedVCs: PlacedVC[],
        remaining: string[],
        results: SeedConfiguration[]
    ): void => {
        if (remaining.length === 0) {
            if (!this.isDuplicate(seed, results)) {
                results.push(seed);
            }
            return;
        }

        const availableVertices = this.computeAvailableVertices(placedVCs);

        for (const { vertex: v, directions } of availableVertices) {
            const triedNames = new Set<string>();

            for (let i = 0; i < remaining.length; i++) {
                const vcName = remaining[i];
                if (triedNames.has(vcName)) continue;
                triedNames.add(vcName);

                const newVC = VertexConfiguration.fromName(vcName);
                newVC.computeNeighboringVertices();

                const triedRotations = new Set<string>();

                for (const dirCtoV of directions) {
                    for (const nv of newVC.neighboringVertices) {
                        const rotation = dirCtoV - nv.heading() + Math.PI;
                        const normalizedRot = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                        const rotKey = normalizedRot.toFixed(4);
                        if (triedRotations.has(rotKey)) continue;
                        triedRotations.add(rotKey);

                        const clonedVC = newVC.clone();
                        clonedVC.rotate(new Vector(0, 0), rotation);
                        clonedVC.translate(v);
                        clonedVC.computeNeighboringVertices();

                        const seedCount = seed.polygons.length;
                        const vcCount = clonedVC.polygons.length;
                        const allPolygons = [...seed.polygons, ...clonedVC.polygons];
                        const mergedPolygons = allPolygons.filter((p, idx, self) => {
                            return idx === self.findIndex(other => isWithinTolerance(p.centroid, other.centroid));
                        });

                        if (mergedPolygons.length === seedCount + vcCount) continue;

                        const newSeed = new SeedConfiguration(mergedPolygons);
                        if (newSeed.isValid()) {
                            const newPlacedVCs: PlacedVC[] = [...placedVCs, {
                                center: v.copy(),
                                neighboringVertices: clonedVC.neighboringVertices.map(nv => nv.copy())
                            }];
                            const newRemaining = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
                            this.dfs(newSeed, newPlacedVCs, newRemaining, results);
                        }
                    }
                }
            }
        }
    }

    computeAvailableVertices = (placedVCs: PlacedVC[]): { vertex: Vector, directions: number[] }[] => {
        const available: { vertex: Vector, directions: number[] }[] = [];

        for (const pvc of placedVCs) {
            for (const v of pvc.neighboringVertices) {
                if (placedVCs.some(other => isWithinTolerance(v, other.center))) continue;

                let entry = available.find(av => isWithinTolerance(av.vertex, v));
                if (!entry) {
                    entry = { vertex: v, directions: [] };
                    available.push(entry);
                }

                const dirCtoV = Vector.sub(v, pvc.center).heading();
                entry.directions.push(dirCtoV);
            }
        }

        return available;
    }

    isDuplicate = (seed: SeedConfiguration, existing: SeedConfiguration[]): boolean => {
        for (const other of existing) {
            if (seed.polygons.length !== other.polygons.length) continue;
            if (seed.polygons.every(p =>
                other.polygons.some(op => isWithinTolerance(p.centroid, op.centroid))
            )) {
                return true;
            }
        }
        return false;
    }

    loadSeedSets = (k: number | null = null, m: number | null = null): string[][] => {
        const seedSets: string[][] = [];

        // if k is provided, load only the seed sets for the given k
        if (k !== null) {
            const seedSetsFolder = `src/lib/classes/algorithm/seedSets/k=${k}`;

            // if m is provided, load only the seed sets for the given m
            if (m !== null) {
                const seedSetsFile = `${seedSetsFolder}/m=${m}.json`;
                const seedSet = fs.readFileSync(seedSetsFile, 'utf8');
                seedSets.push(...JSON.parse(seedSet));
                return seedSets;
            } 
            
            // if m is not provided, load all seed sets for the given k
            const seedSetsFiles = fs.readdirSync(seedSetsFolder);
            for (const file of seedSetsFiles) {
                const seedSet = fs.readFileSync(`${seedSetsFolder}/${file}`, 'utf8');
                seedSets.push(...JSON.parse(seedSet));
            }
            return seedSets;
        }

        // if k is not provided, load all seed sets
        const seedSetsFolders = fs.readdirSync('src/lib/classes/algorithm/seedSets');
        for (const folder of seedSetsFolders) {
            const seedSetsFolder = `src/lib/classes/algorithm/seedSets/${folder}`;
            const seedSetsFiles = fs.readdirSync(seedSetsFolder);
            for (const file of seedSetsFiles) {
                const seedSet = fs.readFileSync(`${seedSetsFolder}/${file}`, 'utf8');
                seedSets.push(...JSON.parse(seedSet));
            }
        }
        return seedSets;
    }
}