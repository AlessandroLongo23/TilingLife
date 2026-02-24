/**
 * Shared filter helpers for list/graph pages (polygons, vertex configs, compatibility graph).
 */

/** Returns true if val is (within float tolerance) a multiple of divisor. */
export function isValidMultiple(val: number, divisor: number): boolean {
	if (!divisor || divisor <= 0) return true;
	const rem = val % divisor;
	return Math.abs(rem) < 1e-4 || Math.abs(rem - divisor) < 1e-4;
}
