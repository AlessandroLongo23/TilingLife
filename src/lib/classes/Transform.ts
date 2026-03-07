import type { Vector } from './Vector.svelte';

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

export type Gyration = {
    center: Vector;
    order: number;
}

export type Reflection = {
    axis: Vector;
    point: Vector;
}

export type GlideReflection = {
    axis: Vector;
    point: Vector;
    delta: number;
}