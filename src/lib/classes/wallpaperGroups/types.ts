import { Vector } from "$classes";

export enum TriangleType {
    EQUILATERAL = 'equilateral', // all sides are equal
    ISOSCELES = 'isosceles', // two sides are equal and the third side is different
    RIGHT = 'right', // all sides are different and one angle is 90 degrees
    SCALENE = 'scalene', // all sides are different and all angles are different
    INVALID = 'invalid', // the triangle is invalid
}

export enum QuadrilateralType {
    PARALLELOGRAM = 'parallelogram', // opposite sides are equal and parallel
    RECTANGLE = 'rectangle', // all sides are different and all angles are 90 degrees
    RHOMBUS = 'rhombus', // all sides are equal and opposite angles are equal
    HEX_UNIT = 'hex_unit', // rhombus with 60 and 120 degrees angles
    SQUARE = 'square', // all sides are equal and all angles are 90 degrees
    INVALID = 'invalid', // the quadrilateral is invalid
}

export interface TriangleSignature {
    types: TriangleType[];
    vertices: Vector[];
    rightVertexIndex?: number | null;
}

export interface QuadrilateralSignature {
    types: QuadrilateralType[];
    vertices: Vector[];
    acuteVertexIndex?: number | null;
}

export type FundamentalDomain = TriangleSignature | QuadrilateralSignature;