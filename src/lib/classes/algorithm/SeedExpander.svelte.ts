/**
 * Seed Expansion: DFS with frontier vertices, graph distance to core, and isometry branching.
 * Expands seeds by placing copies of the seed at frontier vertices via rigid isometries.
 * Valid expansion: only k orbits (every collapsed vertex maps to one core vertex).
 */

import { Vector } from '../Vector.svelte';
import type { Polygon } from '../polygons/Polygon.svelte';
import { SeedConfiguration } from './SeedConfiguration.svelte';
import { deduplicatePolygons, isWithinTolerance } from '$utils';

const POLYGON_BUCKET_GRID_SIDE_LENGTH = 1;
const POLYGON_SEARCH_RADIUS = 3;

export type EdgeInfo = { direction: number };
export type RigidIsometry = {
	origin: Vector;
	angle: number;
	translation: Vector;
	reflect: boolean;
	reflectAxis?: Vector;
};

/** A collapsed vertex: placed VC center, with orbit id and graph distance to nearest core. */
export type CollapsedVertex = {
	vertex: Vector;
	orbitId: number;
};

/** Frontier vertex: not collapsed, adjacent to a collapsed vertex, with distance and boundary edge directions (from seed placements). */
export type FrontierVertex = {
	vertex: Vector;
	distance: number;
	/** Boundary edge directions at this vertex (from vertex toward collapsed), derived from collapsed positions. */
	edgeDirections: EdgeInfo[];
};

export class SeedExpander {
	k: number;
	threshold: number;

	constructor(k: number) {
		this.k = k;
		this.threshold = 6 * k;
	}

	/**
	 * Expand a seed configuration into unique expanded seeds.
	 * Each expanded seed is a collection of polygons representing a valid expansion
	 * where every collapsed vertex maps to one of the k core vertices.
	 *
	 * @param onLeaf - If provided, called for each unique expanded patch (streaming mode).
	 *                 Returns count of unique patches. Otherwise accumulates and returns Polygon[][].
	 */
	expand = (
		seed: SeedConfiguration,
		onLeaf?: (patch: Polygon[]) => void
	): Polygon[][] | number => {
		const coreVertices: Vector[] = seed.vertexConfigurations.map((vc) => vc.sharedVertex.copy());
		const originalPolygons: Polygon[] = seed.polygons;

		const collapsedVertices: CollapsedVertex[] = coreVertices.map((v, idx) => ({
			vertex: v.copy(),
			orbitId: idx,
		}));

		const currentPatch: Polygon[] = originalPolygons.map((p) => p.clone());

		// Pre-compute core local geometry (never changes)
		const coreLocalData: { edges: EdgeInfo[]; polys: Polygon[] }[] = coreVertices.map((core) => ({
			edges: this.getEdgesEmanatingFrom(core, originalPolygons),
			polys: originalPolygons.filter((p) => p.vertices.some((v) => isWithinTolerance(v, core))),
		}));
		const coreCentroids = originalPolygons.map((p) => ({ x: p.centroid.x, y: p.centroid.y }));

		const seenKeys = new Set<string>();
		const expandedSeeds: Polygon[][] = [];
		const streamCount = { value: 0 };

		this.dfsExpandIterative(
			currentPatch,
			collapsedVertices,
			coreVertices,
			originalPolygons,
			coreLocalData,
			coreCentroids,
			expandedSeeds,
			seenKeys,
			onLeaf,
			streamCount,
		);

		if (onLeaf) {
			return streamCount.value;
		}
		return expandedSeeds;
	};

	/** Canonical key for an expanded seed (polygon set) for deduplication. */
	private expandedSeedKey = (polygons: Polygon[]): string => {
		const SCALE = 1e4;
		const entries = polygons.map((p) => {
			const cx = Math.round(p.centroid.x * SCALE);
			const cy = Math.round(p.centroid.y * SCALE);
			const verts = p.vertices
				.map((v) => `${Math.round(v.x * SCALE)},${Math.round(v.y * SCALE)}`)
				.sort()
				.join(';');
			return `${p.getName()}:${cx},${cy}:${verts}`;
		});
		entries.sort();
		return entries.join('|');
	};

	/**
	 * Iterative DFS: pick closest frontier vertex, find valid isometries, branch or merge.
	 * Uses an explicit stack to avoid call stack overflow on deep expansions.
	 * - 0 ways: backtrack (pop)
	 * - 1 way: merge (replace top with new state)
	 * - >1 ways: branch (push children in reverse order for DFS)
	 * - When min frontier distance >= threshold: add leaf to results
	 */
	private dfsExpandIterative = (
		initialPatch: Polygon[],
		initialCollapsed: CollapsedVertex[],
		coreVertices: Vector[],
		originalPolygons: Polygon[],
		coreLocalData: { edges: EdgeInfo[]; polys: Polygon[] }[],
		coreCentroids: { x: number; y: number }[],
		expandedSeeds: Polygon[][],
		seenKeys: Set<string>,
		onLeaf: ((patch: Polygon[]) => void) | undefined,
		streamCount: { value: number },
	): void => {
		type Frame = { patch: Polygon[]; collapsed: CollapsedVertex[] };
		const stack: Frame[] = [{ patch: initialPatch, collapsed: initialCollapsed }];

		while (stack.length > 0) {
			const { patch: currentPatch, collapsed: collapsedVertices } = stack.pop()!;

			// Build spatial hash once per iteration (patch = accumulated placements for collision only)
			const patchSpatialHash = this.buildSpatialHash(currentPatch);

			const vertexDistances = this.computeDistancesToCore(currentPatch, coreVertices);
			const frontier = this.computeFrontier(currentPatch, collapsedVertices, vertexDistances);
			const minDist =
				frontier.length > 0 ? Math.min(...frontier.map((f) => f.distance)) : Infinity;

			if (frontier.length === 0) {
				this.emitLeafIfUnique(
					currentPatch,
					collapsedVertices,
					coreVertices,
					vertexDistances,
					expandedSeeds,
					seenKeys,
					onLeaf,
					streamCount
				);
				continue;
			}

			if (minDist >= this.threshold) {
				this.emitLeafIfUnique(
					currentPatch,
					collapsedVertices,
					coreVertices,
					vertexDistances,
					expandedSeeds,
					seenKeys,
					onLeaf,
					streamCount
				);
				continue;
			}

			const sorted = [...frontier].sort((a, b) => a.distance - b.distance);
			const targetFrontier = sorted[0]!;

			const validTransforms = this.findValidIsometries(
				targetFrontier,
				currentPatch,
				collapsedVertices,
				coreVertices,
				originalPolygons,
				coreLocalData,
				coreCentroids,
				patchSpatialHash
			);

			if (validTransforms.length === 0) continue;

			if (validTransforms.length === 1) {
				const { transform } = validTransforms[0]!;
				const transformedPatch = this.applyIsometryToPolygons(originalPolygons, transform);
				const mergedPatch = deduplicatePolygons([...currentPatch, ...transformedPatch]);
				const newCollapsed = this.addCollapsedFromTransform(
					transform,
					coreVertices,
					collapsedVertices
				);
				stack.push({ patch: mergedPatch, collapsed: newCollapsed });
				continue;
			}

			// Branch: no cloning of currentPatch — we never mutate it; only add transformed polygons
			for (let i = validTransforms.length - 1; i >= 0; i--) {
				const { transform } = validTransforms[i]!;
				const transformedPatch = this.applyIsometryToPolygons(originalPolygons, transform);
				const mergedPatch = deduplicatePolygons([...currentPatch, ...transformedPatch]);
				const newCollapsed = this.addCollapsedFromTransform(
					transform,
					coreVertices,
					collapsedVertices
				);
				stack.push({ patch: mergedPatch, collapsed: newCollapsed });
			}
		}
	};

	/** Emit a leaf if unique (dedupe on the fly). */
	private emitLeafIfUnique = (
		currentPatch: Polygon[],
		collapsedVertices: CollapsedVertex[],
		coreVertices: Vector[],
		vertexDistances: Map<string, number>,
		expandedSeeds: Polygon[][],
		seenKeys: Set<string>,
		onLeaf: ((patch: Polygon[]) => void) | undefined,
		streamCount: { value: number }
	): void => {
		const trimmed = this.trimToThreshold(currentPatch, vertexDistances);
		const key = this.expandedSeedKey(trimmed);
		if (seenKeys.has(key)) return;
		seenKeys.add(key);
		if (onLeaf) {
			streamCount.value++;
			onLeaf(trimmed);
		} else {
			expandedSeeds.push(trimmed);
		}
	};

	/** Trim patch to polygons within threshold distance of a core vertex. */
	private trimToThreshold = (
		patch: Polygon[],
		vertexDistances: Map<string, number>
	): Polygon[] => {
		const hashVertex = (v: Vector) => `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)}`;

		const withinThreshold = new Set<string>();
		for (const [key, d] of vertexDistances) {
			if (d <= this.threshold) withinThreshold.add(key);
		}

		return patch.filter((p) =>
			p.vertices.some((v) => withinThreshold.has(hashVertex(v)))
		);
	};

	/** Add new collapsed vertices from placing the core seed via transform.
	 * Only the k core vertices are added (each placement adds one VC copy per orbit). */
	private addCollapsedFromTransform = (
		transform: RigidIsometry,
		coreVertices: Vector[],
		existing: CollapsedVertex[]
	): CollapsedVertex[] => {
		const result = [...existing];
		for (let i = 0; i < coreVertices.length; i++) {
			const transformedPos = this.applyIsometryToPoint(coreVertices[i]!, transform);
			if (!result.some((c) => isWithinTolerance(c.vertex, transformedPos))) {
				result.push({ vertex: transformedPos.copy(), orbitId: i });
			}
		}
		return result;
	};

	/** BFS from all core vertices to compute distance of every vertex in the graph. */
	private computeDistancesToCore = (
		polygons: Polygon[],
		coreVertices: Vector[]
	): Map<string, number> => {
		const adj = this.buildVertexAdjacency(polygons);
		const hashVertex = (v: Vector) => `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)}`;

		const distances = new Map<string, number>();
		const queue: { v: Vector; d: number }[] = [];

		for (const core of coreVertices) {
			const key = hashVertex(core);
			distances.set(key, 0);
			queue.push({ v: core.copy(), d: 0 });
		}

		const visited = new Set<string>();
		for (const core of coreVertices) {
			visited.add(hashVertex(core));
		}

		while (queue.length > 0) {
			const { v, d } = queue.shift()!;
			const vKey = hashVertex(v);
			for (const neighbor of adj.get(vKey) ?? []) {
				const nKey = hashVertex(neighbor);
				if (visited.has(nKey)) continue;
				visited.add(nKey);
				const newDist = d + 1;
				const existing = distances.get(nKey);
				if (existing === undefined || newDist < existing) {
					distances.set(nKey, newDist);
					queue.push({ v: neighbor.copy(), d: newDist });
				}
			}
		}

		return distances;
	};

	private buildVertexAdjacency = (polygons: Polygon[]): Map<string, Vector[]> => {
		const adj = new Map<string, Vector[]>();
		const hashVertex = (v: Vector) => `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)}`;

		for (const poly of polygons) {
			for (let i = 0; i < poly.vertices.length; i++) {
				const v = poly.vertices[i];
				const next = poly.vertices[(i + 1) % poly.vertices.length];
				const prev = poly.vertices[(i - 1 + poly.vertices.length) % poly.vertices.length];
				const key = hashVertex(v);
				let list = adj.get(key);
				if (!list) {
					list = [];
					adj.set(key, list);
				}
				for (const n of [next, prev]) {
					if (!list.some((u) => isWithinTolerance(u, n))) list.push(n);
				}
			}
		}
		return adj;
	};

	/** Frontier = non-collapsed vertices that share an edge with a collapsed vertex.
	 * Edge directions come from collapsed positions (target -> collapsed), not from patch. */
	private computeFrontier = (
		polygons: Polygon[],
		collapsedVertices: CollapsedVertex[],
		vertexDistances: Map<string, number>
	): FrontierVertex[] => {
		const collapsedSet = new Set(
			collapsedVertices.map((c) => `${Math.round(c.vertex.x * 1e6)},${Math.round(c.vertex.y * 1e6)}`)
		);
		const hashVertex = (v: Vector) => `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)}`;

		const frontierMap = new Map<string, FrontierVertex>();

		for (const center of collapsedVertices) {
			const centerV = center.vertex;
			for (const poly of polygons) {
				const idx = poly.vertices.findIndex((v) => isWithinTolerance(v, centerV));
				if (idx === -1) continue;

				const prev = poly.vertices[(idx - 1 + poly.vertices.length) % poly.vertices.length];
				const next = poly.vertices[(idx + 1) % poly.vertices.length];

				for (const v of [prev, next]) {
					if (collapsedSet.has(hashVertex(v))) continue;
					const key = hashVertex(v);
					const dist = vertexDistances.get(key);
					if (dist === undefined) continue; // unreachable from core
					// Boundary edge direction: from target toward collapsed (derived from core placement)
					const dir = Vector.sub(centerV, v).heading();
					const normalized = (dir + 2 * Math.PI) % (2 * Math.PI);
					const edgeInfo: EdgeInfo = { direction: normalized };
					const existing = frontierMap.get(key);
					if (!existing || dist < existing.distance) {
						frontierMap.set(key, {
							vertex: v.copy(),
							distance: dist,
							edgeDirections: [edgeInfo],
						});
					} else if (existing.distance === dist) {
						// Same distance: add edge direction if not duplicate
						const hasDir = existing.edgeDirections.some(
							(e) => Math.abs(e.direction - normalized) < 1e-6
						);
						if (!hasDir) existing.edgeDirections.push(edgeInfo);
					}
				}
			}
		}

		return Array.from(frontierMap.values());
	};

	/** Find all valid isometries mapping a core vertex to targetVertex.
	 * Uses only core seed (coreLocalData, originalPolygons) for isometry computation.
	 * Boundary edge directions come from frontier (derived from collapsed/core). Patch only for: existing polys at target, collision. */
	private findValidIsometries = (
		targetFrontier: FrontierVertex,
		currentPatch: Polygon[],
		collapsedVertices: CollapsedVertex[],
		coreVertices: Vector[],
		originalPolygons: Polygon[],
		coreLocalData: { edges: EdgeInfo[]; polys: Polygon[] }[],
		coreCentroids: { x: number; y: number }[],
		patchSpatialHash: Map<string, Polygon[]>
	): { transform: RigidIsometry; anchorIdx: number }[] => {
		const targetVertex = targetFrontier.vertex;
		const existingPolysAtTarget = currentPatch.filter((p) =>
			p.vertices.some((v) => isWithinTolerance(v, targetVertex))
		);
		const boundaryEdgesAtTarget = targetFrontier.edgeDirections;
		const seenFootprints = new Set<string>();
		const validTransforms: { transform: RigidIsometry; anchorIdx: number }[] = [];
		const existingBboxCache = new Map<
			Polygon,
			{ minX: number; maxX: number; minY: number; maxY: number }
		>();

		for (let idx = 0; idx < coreVertices.length; idx++) {
			const coreCenter = coreVertices[idx]!;
			const coreData = coreLocalData[idx]!;
			const seedEdgesAtCore = coreData.edges;

			for (const boundaryEdge of boundaryEdgesAtTarget) {
				for (const seedEdge of seedEdgesAtCore) {
					for (const reflect of [false, true]) {
						const T = this.computeIsometry(
							coreCenter,
							seedEdge.direction,
							targetVertex,
							boundaryEdge.direction,
							reflect
						);

						// Orbit integrity: transformed core positions must not conflict with existing orbits
						let orbitMismatch = false;
						for (let i = 0; i < coreVertices.length; i++) {
							const transformedPos = this.applyIsometryToPoint(coreVertices[i]!, T);
							const existing = collapsedVertices.find((c) =>
								isWithinTolerance(c.vertex, transformedPos)
							);
							if (existing && existing.orbitId !== i) {
								orbitMismatch = true;
								break;
							}
						}
						if (orbitMismatch) continue;

						const footprint = this.getIsometryFootprint(T, coreCentroids);
						if (seenFootprints.has(footprint)) continue;
						seenFootprints.add(footprint);

						const transformedCorePolys = this.applyIsometryToPolygons(coreData.polys, T);
						if (!this.passesAlignmentCheck(transformedCorePolys, existingPolysAtTarget)) {
							continue;
						}

						const transformedFullPatch = this.applyIsometryToPolygons(originalPolygons, T);
						if (!this.hasFatalCollision(transformedFullPatch, patchSpatialHash, existingBboxCache)) {
							validTransforms.push({ transform: T, anchorIdx: idx });
						}
					}
				}
			}
		}

		return validTransforms;
	};

	// --- Spatial hash ---
	private polygonBucketKey = (p: Polygon): string => {
		const c = p.centroid;
		return `${Math.round(c.x / POLYGON_BUCKET_GRID_SIDE_LENGTH)},${Math.round(c.y / POLYGON_BUCKET_GRID_SIDE_LENGTH)}`;
	};

	private buildSpatialHash = (polygons: Polygon[]): Map<string, Polygon[]> => {
		const hash = new Map<string, Polygon[]>();
		for (const p of polygons) {
			const key = this.polygonBucketKey(p);
			const list = hash.get(key) ?? [];
			list.push(p);
			hash.set(key, list);
		}
		return hash;
	};

	private getNearbyPolygons = (hash: Map<string, Polygon[]>, p: Polygon): Polygon[] => {
		const cx = Math.round(p.centroid.x / POLYGON_BUCKET_GRID_SIDE_LENGTH);
		const cy = Math.round(p.centroid.y / POLYGON_BUCKET_GRID_SIDE_LENGTH);
		const result: Polygon[] = [];
		for (let dx = -POLYGON_SEARCH_RADIUS; dx <= POLYGON_SEARCH_RADIUS; dx++) {
			for (let dy = -POLYGON_SEARCH_RADIUS; dy <= POLYGON_SEARCH_RADIUS; dy++) {
				result.push(...(hash.get(`${cx + dx},${cy + dy}`) ?? []));
			}
		}
		return result;
	};

	// --- Edge / isometry helpers ---
	private getEdgesEmanatingFrom = (vertex: Vector, polygons: Polygon[]): EdgeInfo[] => {
		const directions = new Set<string>();
		const result: EdgeInfo[] = [];
		for (const poly of polygons) {
			const idx = poly.vertices.findIndex((v) => isWithinTolerance(v, vertex));
			if (idx === -1) continue;

			const next = poly.vertices[(idx + 1) % poly.vertices.length];
			const prev = poly.vertices[(idx - 1 + poly.vertices.length) % poly.vertices.length];
			for (const neighbor of [next, prev]) {
				const dir = Vector.sub(neighbor, vertex).heading();
				const normalized = (dir + 2 * Math.PI) % (2 * Math.PI);
				const key = normalized.toFixed(3);
				if (directions.has(key)) continue;
				directions.add(key);
				result.push({ direction: normalized });
			}
		}
		return result;
	};

	private computeIsometry = (
		coreCenter: Vector,
		seedEdgeDir: number,
		openVertex: Vector,
		patchEdgeDir: number,
		reflect: boolean
	): RigidIsometry => {
		let angle: number;
		if (reflect) {
			angle = patchEdgeDir - seedEdgeDir + Math.PI;
		} else {
			angle = patchEdgeDir - seedEdgeDir;
		}
		angle = (angle + 2 * Math.PI) % (2 * Math.PI);
		const axis = Vector.fromAngle(seedEdgeDir + Math.PI / 2);

		return {
			origin: coreCenter.copy(),
			angle,
			translation: Vector.sub(openVertex, coreCenter.copy()),
			reflect,
			reflectAxis: reflect ? axis : undefined,
		};
	};

	private applyIsometryToPolygon = (p: Polygon, T: RigidIsometry): Polygon => {
		const cloned = p.clone();
		if (T.reflect && T.reflectAxis) {
			cloned.mirror(T.origin, T.reflectAxis);
		}
		cloned.rotate(T.origin, T.angle);
		cloned.translate(T.translation);
		return cloned;
	};

	private applyIsometryToPolygons = (polygons: Polygon[], T: RigidIsometry): Polygon[] => {
		return polygons.map((p) => this.applyIsometryToPolygon(p, T));
	};

	private applyIsometryToPoint = (v: Vector, T: RigidIsometry): Vector => {
		let p = v.copy();
		if (T.reflect && T.reflectAxis) {
			p.mirrorByPointAndDir(T.origin, T.reflectAxis);
		}
		p = Vector.add(T.origin, Vector.sub(p, T.origin).rotate(T.angle));
		return Vector.add(p, T.translation);
	};

	private getPolygonBbox = (p: Polygon): { minX: number; maxX: number; minY: number; maxY: number } => {
		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;
		for (const v of p.vertices) {
			minX = Math.min(minX, v.x);
			maxX = Math.max(maxX, v.x);
			minY = Math.min(minY, v.y);
			maxY = Math.max(maxY, v.y);
		}
		return { minX, maxX, minY, maxY };
	};

	private bboxesOverlap = (
		a: { minX: number; maxX: number; minY: number; maxY: number },
		b: { minX: number; maxX: number; minY: number; maxY: number }
	): boolean => {
		return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
	};

	private hasFatalCollision = (
		transformedPolygons: Polygon[],
		spatialHash: Map<string, Polygon[]>,
		existingBboxCache?: Map<Polygon, { minX: number; maxX: number; minY: number; maxY: number }>
	): boolean => {
		const bboxCache = existingBboxCache ?? new Map();
		for (const tp of transformedPolygons) {
			const tpBbox = this.getPolygonBbox(tp);
			const nearby = this.getNearbyPolygons(spatialHash, tp);
			for (const existing of nearby) {
				if (!bboxCache.has(existing)) bboxCache.set(existing, this.getPolygonBbox(existing));
				if (!this.bboxesOverlap(tpBbox, bboxCache.get(existing)!)) continue;
				if (tp.intersects(existing) && !tp.isEquivalent(existing)) {
					return true;
				}
			}
		}
		return false;
	};

	private passesAlignmentCheck = (
		transformed: Polygon[],
		existingPolysAtOpen: Polygon[]
	): boolean => {
		for (const existing of existingPolysAtOpen) {
			if (!transformed.some((tp) => tp.isEquivalent(existing))) return false;
		}
		return true;
	};

	private getIsometryFootprint = (T: RigidIsometry, centroids: { x: number; y: number }[]): string => {
		const SCALE = 1e4;
		const coords = centroids.map((c) => {
			const transformed = this.applyIsometryToPoint(new Vector(c.x, c.y), T);
			return `${Math.round(transformed.x * SCALE)},${Math.round(transformed.y * SCALE)}`;
		});
		coords.sort();
		return coords.join('|');
	};
}
