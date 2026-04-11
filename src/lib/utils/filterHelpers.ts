/**
 * Shared filter helpers for list/graph pages (polygons, vertex configs, compatibility graph).
 */

import {
	PolygonType,
	regularPolygonRegex,
	regularStarRegex,
	parametricStarRegex,
	equilateralPolygonRegex,
	genericPolygonRegex,
} from '$classes';

/** Returns true if val is (within float tolerance) a multiple of divisor. */
export function isValidMultiple(val: number, divisor: number): boolean {
	if (!divisor || divisor <= 0) return true;
	const rem = val % divisor;
	return Math.abs(rem) < 1e-4 || Math.abs(rem - divisor) < 1e-4;
}

/** Shared filter schema for VC onward (polygon composition). */
export type PolygonCompositionFilter = {
	categories: string[];
	n_max?: number;
	angle?: number;
};

/** Check if a single polygon part (from VC name) passes the filter. */
export function polygonPartPassesFilter(
	part: string,
	filter: PolygonCompositionFilter
): boolean {
	const { categories, n_max, angle } = filter;

	if (part.match(regularPolygonRegex)) {
		if (!categories.includes(PolygonType.REGULAR)) return false;
		const n = parseInt(part, 10);
		if (n_max != null && n > n_max) return false;
		return true;
	}
	if (part.match(regularStarRegex)) {
		if (!categories.includes(PolygonType.STAR_REGULAR)) return false;
		const m = part.match(regularStarRegex)!;
		const n = parseInt(m[1], 10);
		const d = parseInt(m[2], 10);
		if (n_max != null && n > n_max) return false;
		if (angle != null) {
			const a = 180 * (1 - (2 * d) / n);
			const b = 180 * (1 + (2 * (d - 1)) / n);
			if (!isValidMultiple(a, angle) || !isValidMultiple(b, angle)) return false;
		}
		return true;
	}
	if (part.match(parametricStarRegex)) {
		if (!categories.includes(PolygonType.STAR_PARAMETRIC)) return false;
		const m = part.match(parametricStarRegex)!;
		const n = parseInt(m[1], 10);
		const alpha = parseInt(m[2], 10);
		if (n_max != null && n > n_max) return false;
		if (angle != null) {
			const b = 360 * (1 - 1 / n) - alpha;
			if (!isValidMultiple(alpha, angle) || !isValidMultiple(b, angle)) return false;
		}
		return true;
	}
	if (part.match(equilateralPolygonRegex)) {
		if (!categories.includes(PolygonType.EQUILATERAL)) return false;
		const m = part.match(equilateralPolygonRegex)!;
		const n = parseInt(m[1], 10);
		const angles = m[2].split(';').map((a) => parseInt(a, 10));
		if (n_max != null && n > n_max) return false;
		if (angle != null && angles.some((a) => !isValidMultiple(a, angle))) return false;
		return true;
	}
	if (part.match(genericPolygonRegex)) {
		if (!categories.includes(PolygonType.GENERIC)) return false;
		const m = part.match(genericPolygonRegex)!;
		const n = parseInt(m[1], 10);
		const angles = m[3].split(';').map((a) => parseInt(a, 10));
		if (n_max != null && n > n_max) return false;
		if (angle != null && angles.some((a) => !isValidMultiple(a, angle))) return false;
		return true;
	}
	return false;
}

/** Check if a VC passes the filter (every polygon in the VC must match). */
export function vcPassesPolygonFilter(
	vcName: string,
	filter: PolygonCompositionFilter
): boolean {
	const parts = vcName.split(',');
	if (parts.length === 0) return false;
	return parts.every((p) => polygonPartPassesFilter(p.trim(), filter));
}

/** Extract VC names from a seed name (e.g. "[3,3,3;4,4]" → ["3,3,3", "4,4"]). */
export function getVCNamesFromSeedName(seedName: string): string[] {
	const inner = seedName.slice(1, -1);
	if (!inner) return [];
	return inner.split(';').map((s) => s.trim()).filter(Boolean);
}

/** Check if a seed passes the filter (all VCs in the seed must pass). */
export function seedPassesPolygonFilter(
	seedName: string,
	filter: PolygonCompositionFilter
): boolean {
	const vcNames = getVCNamesFromSeedName(seedName);
	if (vcNames.length === 0) return false;
	return vcNames.every((vc) => vcPassesPolygonFilter(vc, filter));
}
