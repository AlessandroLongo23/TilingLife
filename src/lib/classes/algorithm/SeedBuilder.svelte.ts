import { SeedConfiguration, VertexConfiguration, Vector } from '$classes';
import { deduplicatePolygons, isWithinTolerance } from '$utils';

type PlacedVC = {
    center: Vector;
    neighboringVertices: Vector[];
};

type BFSNode = {
    seed: SeedConfiguration;
    placedVCs: PlacedVC[];
    remaining: string[];
};

const CANONICAL_PRECISION = 3;

export class SeedBuilder {
    seedConfigurations: SeedConfiguration[] = [];
    
    constructor() {}

    buildSeeds = (
        k: number,
        m: number,
        options?: {
            seedSetLoader?: (k: number, m: number) => string[][];
            onProgress?: (current: number, total: number, count: number) => void;
        }
    ): SeedConfiguration[] => {
        const { seedSetLoader, onProgress } = options ?? {};
        if (!seedSetLoader) {
            throw new Error('SeedBuilder.buildSeeds requires options.seedSetLoader (e.g. from run-pipeline)');
        }
        const seedSets = seedSetLoader(k, m);

        const seedConfigurations: SeedConfiguration[] = [];
        for (let i = 0; i < seedSets.length; i++) {
            const before = seedConfigurations.length;
            seedConfigurations.push(...this.buildSeedsFromSet(seedSets[i]));
            onProgress?.(i + 1, seedSets.length, seedConfigurations.length - before);
        }

        return seedConfigurations;
    }

    buildSeedsFromSet = (seedSet: string[]): SeedConfiguration[] => {
        const firstVC: VertexConfiguration = VertexConfiguration.fromName(seedSet[0]);
        firstVC.computeNeighboringVertices();

        const initialSeed = new SeedConfiguration([firstVC]);
        const initialPlacedVCs: PlacedVC[] = [{
            center: new Vector(0, 0),
            neighboringVertices: firstVC.neighboringVertices.map(v => v.copy())
        }];

        if (seedSet.length === 1) {
            return [initialSeed];
        }

        let currentLayer: BFSNode[] = [{
            seed: initialSeed,
            placedVCs: initialPlacedVCs,
            remaining: seedSet.slice(1)
        }];

        while (currentLayer.length > 0) {
            const nextLayer: BFSNode[] = [];

            for (const node of currentLayer) {
                nextLayer.push(...this.expandNode(node, seedSet));
            }

            if (nextLayer.length === 0) return [];

            currentLayer = this.deduplicateLayer(nextLayer);

            if (currentLayer[0].remaining.length === 0) break;
        }

        return currentLayer.map(node => node.seed);
    }

    private expandNode = (node: BFSNode, seedSet: string[]): BFSNode[] => {
        const { seed, placedVCs, remaining } = node;
        const children: BFSNode[] = [];

        const availableVertices = this.computeAvailableVertices(placedVCs);

        // Forward Checking: if any open vertex has entropy 0 (no VC from the full set can fit), prune this branch
        for (const { vertex, directions } of availableVertices) {
            if (!this.canAnyVCFitAtVertex(vertex, directions, seed, seedSet)) {
                return [];
            }
        }

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
                        const normalizedRot = (rotation + 2 * Math.PI) % (2 * Math.PI);
                        const rotKey = normalizedRot.toFixed(4);
                        if (triedRotations.has(rotKey)) continue;
                        triedRotations.add(rotKey);

                        const clonedVC = newVC.clone();
                        clonedVC.rotate(new Vector(0, 0), rotation);
                        clonedVC.translate(v);
                        clonedVC.computeNeighboringVertices();

                        const seedCount = seed.polygons.length;
                        const vcCount = clonedVC.polygons.length;
                        const mergedPolygons = deduplicatePolygons([...seed.polygons, ...clonedVC.polygons]);

                        if (mergedPolygons.length === seedCount + vcCount) continue;

                        const newSeed = new SeedConfiguration([...seed.vertexConfigurations, clonedVC]);
                        if (newSeed.isValid()) {
                            const newPlacedVCs: PlacedVC[] = [...placedVCs, {
                                center: v.copy(),
                                neighboringVertices: clonedVC.neighboringVertices.map(nv => nv.copy())
                            }];
                            const newRemaining = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
                            children.push({
                                seed: newSeed,
                                placedVCs: newPlacedVCs,
                                remaining: newRemaining
                            });
                        }
                    }
                }
            }
        }

        return children;
    }

    /**
     * Forward Checking: tests whether at least one of the k original VCs can fit at this open vertex.
     * Uses the FULL seed set (all k VCs), not just remaining—an open vertex may host another copy
     * of an already-placed orbit in the infinite tiling.
     */
    private canAnyVCFitAtVertex = (
        vertex: Vector,
        directions: number[],
        seed: SeedConfiguration,
        allVCNames: string[]
    ): boolean => {
        const seedCount = seed.polygons.length;

        for (const vcName of allVCNames) {
            const vc = VertexConfiguration.fromName(vcName);
            vc.computeNeighboringVertices();

            const triedRotations = new Set<string>();

            for (const dirCtoV of directions) {
                for (const nv of vc.neighboringVertices) {
                    const rotation = dirCtoV - nv.heading() + Math.PI;
                    const normalizedRot = (rotation + 2 * Math.PI) % (2 * Math.PI);
                    const rotKey = normalizedRot.toFixed(4);
                    if (triedRotations.has(rotKey)) continue;
                    triedRotations.add(rotKey);

                    const clonedVC = vc.clone();
                    clonedVC.rotate(new Vector(0, 0), rotation);
                    clonedVC.translate(vertex);
                    clonedVC.computeNeighboringVertices();

                    const vcCount = clonedVC.polygons.length;
                    const mergedPolygons = deduplicatePolygons([...seed.polygons, ...clonedVC.polygons]);

                    if (mergedPolygons.length === seedCount + vcCount) continue;

                    const newSeed = new SeedConfiguration([...seed.vertexConfigurations, clonedVC]);
                    if (newSeed.isValid()) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    private deduplicateLayer = (nodes: BFSNode[]): BFSNode[] => {
        const seen = new Map<string, BFSNode>();

        for (const node of nodes) {
            const remainingKey = [...node.remaining].sort().join('\0');
            const canonical = this.computeCanonicalForm(node.seed);
            const key = remainingKey + '|' + canonical;

            if (!seen.has(key)) {
                seen.set(key, node);
            }
        }

        return Array.from(seen.values());
    }

    private computeCanonicalForm = (seed: SeedConfiguration): string => {
        const polygons = seed.polygons;
        const n = polygons.length;
        if (n === 0) return '';

        const P = CANONICAL_PRECISION;
        const profiles: string[] = new Array(n);

        for (let i = 0; i < n; i++) {
            const neighbors: string[] = new Array(n - 1);
            let k = 0;
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const dist = polygons[i].centroid.distance(polygons[j].centroid).toFixed(P);
                neighbors[k++] = polygons[j].getName() + '@' + dist;
            }
            neighbors.sort();
            profiles[i] = polygons[i].getName() + ':' + neighbors.join(',');
        }

        profiles.sort();
        return profiles.join('|');
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

}