/**
 * Short-key storage format for JSON files.
 * Converts between full format (display) and short format (storage).
 *
 * Short keys: v=vcs, i=vcId, n=name, p=pos/polygons, r=rot, vc=vcsCenters,
 * g=gyrations, t=type, v=vertices, c=center, a=axis, pt=point, o=order, s=sides
 * Points: {x,y} <-> [x,y]
 */

export type PointObj = { x: number; y: number };
export type PointArr = [number, number];

export function isPointObj(p: unknown): p is PointObj {
	return p != null && typeof p === 'object' && 'x' in p && 'y' in p;
}

export function isPointArr(p: unknown): p is PointArr {
	return Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number';
}

export function toPoint(p: PointObj | PointArr): PointObj {
	if (isPointArr(p)) return { x: p[0], y: p[1] };
	return p;
}

export function toPointArr(p: PointObj | PointArr): PointArr {
	if (isPointArr(p)) return p;
	return [p.x, p.y];
}
