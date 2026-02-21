import { Vector } from '$classes';

export enum TransformType {
    MIRROR = 'm',
    ROTATE = 'r',
    TRANSLATE = 't',
};

export enum RelativeToType {
    HALFWAY = 'h',
    VERTEX = 'v',
    CENTROID = 'c',
};

export type RelativeTo = {
    type: RelativeToType;
    index: number;
};

export type Transform = {
    type: TransformType;
    relativeTo?: RelativeTo;
    angle: number;
    anchor?: Vector;
};