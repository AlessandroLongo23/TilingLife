import { SeedConfiguration } from './SeedConfiguration.svelte';
import { VertexConfiguration } from './VertexConfiguration.svelte';
import { Vector } from '../Vector.svelte';
import type { Polygon } from '../polygons/Polygon.svelte';
import { deduplicatePolygons, isWithinTolerance, isWithinAngularTolerance } from '$utils';

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

/** Cached VC template: base VC at origin + precomputed neighboring vertices. */
type CachedVC = { vc: VertexConfiguration; neighboringVertices: Vector[] };

const mirrorVCNameCache = new Map<string, string>();

/** Returns the mirror (chiral opposite) VC name. Achiral VCs return the same name. Cached. */
function getMirrorVCName(name: string): string {
    let cached = mirrorVCNameCache.get(name);
    if (!cached) {
        const reversed = name.split(',').reverse().join(',');
        cached = VertexConfiguration.fromName(reversed).getName();
        mirrorVCNameCache.set(name, cached);
    }
    return cached;
}

/** True if the set has 2+ VCs that are all chiral-equivalent — effectively k=1, so skip to avoid k=2 output. */
function isChiralOnlySet(seedSet: string[]): boolean {
    if (seedSet.length <= 1) return false;
    const first = seedSet[0].split(',');
    for (let i = 1; i < seedSet.length; i++) {
        if (!vcNamesMatch(first, seedSet[i].split(','))) return false;
    }
    return true;
}

function vcNamesMatch(a: string[], b: string[]): boolean {
    const n = a.length;
    if (n !== b.length) return false;
    
    for (let i = 0; i < n; i++) {
        const rotated = a.slice(i).concat(a.slice(0, i));
        if (rotated.every((v, j) => v === b[j])) return true;
    }

    const reversed = a.slice().reverse();
    for (let i = 0; i < n; i++) {
        const rotated = reversed.slice(i).concat(reversed.slice(0, i));
        if (rotated.every((v, j) => v === b[j])) return true;
    }
    
    return false;
}

export class SeedBuilder {
    seedConfigurations: SeedConfiguration[] = [];
    /** Cache VertexConfiguration by name to avoid repeated fromName + computeNeighboringVertices. */
    private vcCache: Map<string, CachedVC> = new Map();

    constructor() {}

    private getCachedVC = (name: string): CachedVC => {
        let cached = this.vcCache.get(name);
        if (!cached) {
            const vc = VertexConfiguration.fromName(name);
            vc.computeNeighboringVertices();
            cached = { vc, neighboringVertices: vc.neighboringVertices.map((v) => v.copy()) };
            this.vcCache.set(name, cached);
        }
        return cached;
    };

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
        this.vcCache.clear();
        mirrorVCNameCache.clear();
        const seedSets = seedSetLoader(k, m);

        const seedConfigurations: SeedConfiguration[] = [];
        for (let i = 0; i < seedSets.length; i++) {
            if (isChiralOnlySet(seedSets[i])) continue;
            const before = seedConfigurations.length;
            seedConfigurations.push(...this.buildSeedsFromSet(seedSets[i]));
            onProgress?.(i + 1, seedSets.length, seedConfigurations.length - before);
        }

        return this.deduplicateSeeds(seedConfigurations);
    }

    buildSeedsFromSet = (seedSet: string[]): SeedConfiguration[] => {
        const initialNames = [seedSet[0], getMirrorVCName(seedSet[0])];
        const seenInitial = new Set<string>();

        const makeInitialNode = (name: string): BFSNode => {
            const vc = VertexConfiguration.fromName(name);
            vc.computeNeighboringVertices();
            const seed = new SeedConfiguration([vc]);
            const placedVCs: PlacedVC[] = [{
                center: new Vector(0, 0),
                neighboringVertices: vc.neighboringVertices.map((v) => v.copy()),
            }];
            return { seed, placedVCs, remaining: seedSet.slice(1) };
        };

        if (seedSet.length === 1) {
            const results: SeedConfiguration[] = [];
            for (const name of initialNames) {
                if (seenInitial.has(name)) continue;
                seenInitial.add(name);
                const node = makeInitialNode(name);
                if (this.passesFinalVertexCheck(node, seedSet)) results.push(node.seed);
            }
            return results;
        }

        let currentLayer: BFSNode[] = [];
        for (const name of initialNames) {
            if (seenInitial.has(name)) continue;
            seenInitial.add(name);
            currentLayer.push(makeInitialNode(name));
        }

        while (currentLayer.length > 0) {
            const nextLayer: BFSNode[] = [];

            for (const node of currentLayer) {
                nextLayer.push(...this.expandNode(node, seedSet));
            }

            if (nextLayer.length === 0) return [];

            currentLayer = this.deduplicateLayer(nextLayer);

            if (currentLayer[0].remaining.length === 0) break;
        }

        // Final vertex check: filter out seeds that fail the adjacent-vertex validation
        currentLayer = currentLayer.filter(node => this.passesFinalVertexCheck(node, seedSet));
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
        const seedCount = seed.polygons.length;

        for (const { vertex: v, directions } of availableVertices) {
            const triedNames = new Set<string>();

            for (let i = 0; i < remaining.length; i++) {
                const vcName = remaining[i];
                const mirrorName = getMirrorVCName(vcName);
                const namesToTry = [vcName, mirrorName].filter((n) => !triedNames.has(n));
                for (const nameToTry of namesToTry) triedNames.add(nameToTry);

                for (const nameToTry of namesToTry) {
                    const { vc: templateVC, neighboringVertices } = this.getCachedVC(nameToTry);

                    const triedRotations = new Set<string>();

                    for (const dirCtoV of directions) {
                        for (const nv of neighboringVertices) {
                            const rotation = dirCtoV - nv.heading() + Math.PI;
                            const normalizedRot = (rotation + 2 * Math.PI) % (2 * Math.PI);
                            const rotKey = normalizedRot.toFixed(4);
                            if (triedRotations.has(rotKey)) continue;
                            triedRotations.add(rotKey);

                            const clonedVC = templateVC.clone();
                            clonedVC.rotate(new Vector(0, 0), rotation);
                            clonedVC.translate(v);
                            clonedVC.computeNeighboringVertices();

                            const vcCount = clonedVC.polygons.length;
                            const mergedPolygons = deduplicatePolygons([...seed.polygons, ...clonedVC.polygons]);
                            if (mergedPolygons.length === seedCount + vcCount) continue;

                            const newSeed = new SeedConfiguration([...seed.vertexConfigurations, clonedVC]);
                            if (newSeed.isValid()) {
                                const newPlacedVCs: PlacedVC[] = [
                                    ...placedVCs,
                                    {
                                        center: v.copy(),
                                        neighboringVertices: clonedVC.neighboringVertices.map((nv) => nv.copy()),
                                    },
                                ];
                                const newRemaining = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
                                children.push({
                                    seed: newSeed,
                                    placedVCs: newPlacedVCs,
                                    remaining: newRemaining,
                                });
                            }
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
        const effectiveNames = new Set<string>();
        for (const n of allVCNames) {
            effectiveNames.add(n);
            effectiveNames.add(getMirrorVCName(n));
        }

        const seedCount = seed.polygons.length;

        for (const vcName of effectiveNames) {
            const { vc: templateVC, neighboringVertices } = this.getCachedVC(vcName);
            const triedRotations = new Set<string>();

            for (const dirCtoV of directions) {
                for (const nv of neighboringVertices) {
                    const rotation = dirCtoV - nv.heading() + Math.PI;
                    const normalizedRot = (rotation + 2 * Math.PI) % (2 * Math.PI);
                    const rotKey = normalizedRot.toFixed(4);
                    if (triedRotations.has(rotKey)) continue;
                    triedRotations.add(rotKey);

                    const clonedVC = templateVC.clone();
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

    /** Remove duplicate seeds from the final output (e.g. from chiral seed sets producing same seeds). */
    private deduplicateSeeds = (seeds: SeedConfiguration[]): SeedConfiguration[] => {
        const seen = new Map<string, SeedConfiguration>();
        for (const seed of seeds) {
            const key = this.computeCanonicalForm(seed);
            if (!seen.has(key)) seen.set(key, seed);
        }
        return Array.from(seen.values());
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

    /**
     * Final check on vertices adjacent to placed VC centers.
     * - If surrounded: emerging VC must match one in the seed set.
     * - If open: at least one VC from the set must fit.
     */
    private passesFinalVertexCheck = (node: BFSNode, seedSet: string[]): boolean => {
        const availableVertices = this.computeAvailableVertices(node.placedVCs);

        for (const { vertex, directions } of availableVertices) {
            const polygonsAtVertex = this.getPolygonsAtVertex(vertex, node.seed.polygons);
            const angleSum = polygonsAtVertex.reduce((sum, p) => sum + p.getAngleAtVertex(vertex), 0);
            const isSurrounded = isWithinAngularTolerance(angleSum, 2 * Math.PI);

            if (isSurrounded) {
                const emergingVCName = this.getEmergingVCNameAtVertex(vertex, polygonsAtVertex);
                if (emergingVCName === null) return false;
                if (!this.isVCNameInSet(emergingVCName, seedSet)) return false;
            } else {
                if (!this.canAnyVCFitAtVertex(vertex, directions, node.seed, seedSet)) return false;
            }
        }
        return true;
    };

    private getPolygonsAtVertex = (vertex: Vector, polygons: Polygon[]): Polygon[] => {
        return polygons.filter((p) => p.vertices.some((v) => isWithinTolerance(v, vertex)));
    };

    private getEmergingVCNameAtVertex = (vertex: Vector, polygons: Polygon[]): string | null => {
        if (polygons.length === 0) return null;
        const vc = new VertexConfiguration(polygons);
        return vc.getName();
    };

    /** Check if a VC name matches any in the set (considering rotation and chirality). */
    private isVCNameInSet = (emergingName: string, seedSet: string[]): boolean => {
        const emerging = emergingName.split(',');
        for (const seedName of seedSet) {
            const seed = seedName.split(',');
            if (emerging.length !== seed.length) continue;
            if (this.vcNamesMatch(emerging, seed)) return true;
        }
        return false;
    };

    private vcNamesMatch = (a: string[], b: string[]): boolean => {
        const n = a.length;
        for (let i = 0; i < n; i++) {
            const rotated = a.slice(i).concat(a.slice(0, i));
            if (rotated.every((v, j) => v === b[j])) return true;
        }
        const reversed = a.slice().reverse();
        for (let i = 0; i < n; i++) {
            const rotated = reversed.slice(i).concat(reversed.slice(0, i));
            if (rotated.every((v, j) => v === b[j])) return true;
        }
        return false;
    };

    computeAvailableVertices = (placedVCs: PlacedVC[]): { vertex: Vector; directions: number[] }[] => {
        const available: { vertex: Vector; directions: number[] }[] = [];

        for (const pvc of placedVCs) {
            for (const v of pvc.neighboringVertices) {
                if (placedVCs.some((other) => isWithinTolerance(v, other.center))) continue;

                let entry = available.find((av) => isWithinTolerance(av.vertex, v));
                if (!entry) {
                    entry = { vertex: v.copy(), directions: [] };
                    available.push(entry);
                }
                const dirCtoV = Vector.sub(v, pvc.center).heading();
                entry.directions.push(dirCtoV);
            }
        }

        return available;
    }

}