import { PolygonType } from '$classes';

export type ShapeSeed = {
    type: PolygonType;
    n: number;
    sides?: number[];
    angles?: number[];
    alpha?: number;
    d?: number;
    special?: boolean;
};