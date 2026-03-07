import { Vector, type Gyration, type Reflection } from "$classes";

export type EncodedGyration = { type: "gyration"; center: { x: number; y: number }; order: number };
export type EncodedReflection = {
    type: "reflection";
    axis: { x: number; y: number };
    point: { x: number; y: number };
};
export type EncodedGenerator = EncodedGyration | EncodedReflection;

export function encodeGenerator(g: Gyration | Reflection): EncodedGenerator {
    if ("order" in g) {
        return { type: "gyration", center: g.center.encode(), order: g.order };
    }
    return { type: "reflection", axis: g.axis.encode(), point: g.point.encode() };
}

export function decodeGenerator(g: EncodedGenerator | Record<string, unknown>): Gyration | Reflection {
    const type = (g.t ?? g.type) as string;
    if (type === "gyration") {
        const c = g.c ?? g.center;
        const [x, y] = Array.isArray(c) ? c : [c.x, c.y];
        return { center: new Vector(x, y), order: (g.o ?? g.order) as number };
    }
    const a = g.a ?? g.axis;
    const pt = g.pt ?? g.point;
    return {
        axis: new Vector(Array.isArray(a) ? a[0] : a.x, Array.isArray(a) ? a[1] : a.y),
        point: new Vector(Array.isArray(pt) ? pt[0] : pt.x, Array.isArray(pt) ? pt[1] : pt.y),
    };
}
