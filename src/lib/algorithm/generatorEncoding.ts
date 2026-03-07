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

export function decodeGenerator(g: EncodedGenerator): Gyration | Reflection {
    if (g.type === "gyration") {
        return { center: new Vector(g.center.x, g.center.y), order: g.order };
    }
    return {
        axis: new Vector(g.axis.x, g.axis.y),
        point: new Vector(g.point.x, g.point.y),
    };
}
