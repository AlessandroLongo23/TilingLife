/**
 * Encode/decode helpers for pipeline storage (polygons, expanded seeds, translational cells).
 * Shared by run-pipeline and API routes.
 */

import {
	Vector,
	PolygonType,
	RegularPolygon,
	StarRegularPolygon,
	StarParametricPolygon,
	EquilateralPolygon,
	GenericPolygon,
	type Polygon,
} from '$classes';

/** Encode polygon for storage (short format). */
export function polygonToShort(enc: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = { t: enc.type, n: enc.n };
	if (enc.vertices && Array.isArray(enc.vertices)) {
		out.v = (enc.vertices as { x: number; y: number }[]).map((v) => [v.x, v.y]);
	}
	if (enc.sides) out.s = enc.sides;
	if (enc.angles) out.a = enc.angles;
	if (enc.d != null) out.d = enc.d;
	if (enc.alpha != null) out.alpha = enc.alpha;
	return out;
}

/** Decode polygon from short format to Polygon instance. */
export function polygonFromShort(enc: Record<string, unknown>): Polygon {
	const v = enc.v as [number, number][] | undefined;
	const vertices = v
		? v.map((p) => new Vector(p[0], p[1]))
		: (enc.vertices as { x: number; y: number }[])?.map((p) =>
				Array.isArray(p) ? new Vector(p[0], p[1]) : new Vector(p.x, p.y)
			) ?? [];
	const type = (enc.t ?? enc.type) as string;
	switch (type) {
		case PolygonType.REGULAR:
			return RegularPolygon.fromVertices(vertices);
		case PolygonType.STAR_REGULAR:
			return StarRegularPolygon.fromVertices(vertices);
		case PolygonType.STAR_PARAMETRIC:
			return StarParametricPolygon.fromVertices(vertices);
		case PolygonType.EQUILATERAL:
			return EquilateralPolygon.fromVertices(vertices);
		case PolygonType.GENERIC:
			return GenericPolygon.fromVertices(vertices);
		default:
			return RegularPolygon.fromVertices(vertices);
	}
}
