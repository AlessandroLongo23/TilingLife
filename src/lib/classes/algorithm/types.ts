import { Polygon, PolygonType, Vector } from '$classes';

export interface GeneratorParameters {
    [PolygonType.REGULAR]?: {
        n_max: number;
    },
    [PolygonType.STAR_REGULAR]?: {
        n_max: number;
        angle: number;
    },
    [PolygonType.STAR_PARAMETRIC]?: {
        n_max: number;
        angle: number;
    },
    [PolygonType.EQUILATERAL]?: {
        n_max: number;
        angle: number;
    },
}

export type PartialConfiguration = {
    name: string,
    fullVertex: Vector
    partialVertex: Vector,
}

export type SurroundingPolygon = { polygon: Polygon, prevDir: number, nextDir: number };