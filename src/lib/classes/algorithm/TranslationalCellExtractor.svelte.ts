/**
 * Translational cell extraction from an expanded seed patch.
 * Finds the primitive translational cell (polygons whose centroid lies in [0,1) x [0,1)
 * in basis coordinates) and the basis vectors, without using TilingChecker.
 */

import { Vector } from '../Vector.svelte';
import type { Polygon } from '../polygons/Polygon.svelte';
import { Tiling } from '../Tiling.svelte';
import { tolerance } from '$stores';

export type TranslationalCellResult = {
	cellPolygons: Polygon[];
	origin: Vector;
	basis: [Vector, Vector];
};

export class TranslationalCellExtractor {
	constructor() {}

	/**
	 * Extract the translational cell from a patch of polygons.
	 * Returns the cell polygons, origin, and basis vectors, or null if extraction fails.
	 */
	extract(polygons: Polygon[]): TranslationalCellResult | null {
		if (polygons.length === 0) return null;

		const tiling = new Tiling();
		tiling.nodes = polygons;

		const originPolygon: Polygon = this.findOrigin(tiling);
		const basis: [Vector, Vector] = this.findBasis(tiling, originPolygon);
		if (!basis) return null;

		const [v1, v2] = basis;
		const cross = Vector.cross(v1, v2);
		if (Math.abs(cross) < tolerance) return null;

		const cellPolygons: Polygon[] = [];
		for (const node of tiling.nodes) {
			const rel = Vector.sub(node.centroid, originPolygon.centroid);
			const a = Vector.cross(rel, v2) / cross;
			const b = Vector.cross(v1, rel) / cross;
			if (a >= -tolerance && a < 1 && b >= -tolerance && b < 1) {
				cellPolygons.push(node);
			}
		}

		if (cellPolygons.length === 0) return null;

		return { cellPolygons, origin: originPolygon.centroid, basis };
	}

	private findOrigin(tiling: Tiling): Polygon {
		const originPolygon = tiling.nodes.reduce(
			(min, node) => (node.centroid.mag() < min.centroid.mag() ? node : min)
		);
		return originPolygon;
	}

	private findBasis(tiling: Tiling, originPolygon: Polygon): [Vector, Vector] | null {
		const tol = 1e-3;
		const samePolygonsTranslationVectors: Vector[] = tiling.nodes
			.filter((p) => p.n === originPolygon.n)
			.filter((p) => p.isTranslated(originPolygon, tol))
			.map((p) => Vector.sub(p.centroid, originPolygon.centroid))
			.filter((v) => v.mag() > tol)
			.sort((a, b) => a.mag() - b.mag());

		const translationVectors: Vector[] = [];
		for (const tv of samePolygonsTranslationVectors) {
			if (translationVectors.length > 8) break;
			const translated = Tiling.translate(tiling, tv);
			if (translated.isEquivalent(tiling, tol)) {
				translationVectors.push(tv);
			}
		}

		if (translationVectors.length === 0) return null;

		translationVectors.sort((a, b) => a.mag() - b.mag());
		const v1 = translationVectors[0];

		let v2: Vector | null = null;
		for (let i = 1; i < translationVectors.length; i++) {
			if (Math.abs(Vector.cross(v1, translationVectors[i])) > tol) {
				v2 = translationVectors[i];
				break;
			}
		}

		if (!v2) v2 = v1.copy();

		return [v1, v2];
	}
}
