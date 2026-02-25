import { WallpaperGroup, Vector, SeedConfiguration } from "$classes";
import { toDegrees } from "chart.js/helpers";

export class CMM extends WallpaperGroup {
    sides: number;
    
    constructor() {
        super('cmm');

        this.sides = 4;
    }

    checkValidity = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        return this.checkShape(vertices) && this.checkSymmetries(seed, vertices);
    }

    checkShape = (vertices: Vector[]): boolean => {
        return this.checkAngles(vertices) && this.checkSides(vertices);
    }
    
    checkSymmetries = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        return this.checkRotationalSymmetries(seed, vertices) && this.checkMirrorSymmetries(seed, vertices);
    }

    checkAngles = (vertices: Vector[]): boolean => {
        if (vertices.length !== this.sides) return false;
        const angles = vertices.map(v => Vector.angleBetween(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));

        // cmm is a rhomboid, so opposite angles are equal and the sum of adjacent angles is 180
        return (
            toDegrees(angles[0]) === toDegrees(angles[2]) &&
            toDegrees(angles[1]) === toDegrees(angles[3]) &&
            toDegrees(angles[0]) + toDegrees(angles[1]) === 180
        )
    }

    checkSides = (vertices: Vector[]): boolean => {
        if (vertices.length !== this.sides) return false;
        const sides = vertices.map(v => Vector.distance(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));

        // cmm is a rhomboid, so all sides are equal
        return sides.every(side => side === sides[0]);
    }

    checkRotationalSymmetries = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        // cmm has 180-rotational symmetries in the center, vertices and halfway points of the rhomboid
        const rotationalCenters: Vector[] = [];

        const center = Vector.midpoint(vertices[0], vertices[2]);
        const halfways = vertices.map(v => Vector.midpoint(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));

        rotationalCenters.push(...[center, ...vertices, ...halfways]);

        for (const rotationalCenter of rotationalCenters) {
            const rotatedSeed = seed.rotate(rotationalCenter, Math.PI);
            const mergedSeed = SeedConfiguration.merge(seed, rotatedSeed);
            if (!mergedSeed.isValid()) return false;
        }
            
        return true;
    }

    checkMirrorSymmetries = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        throw new Error('Not implemented');
    }
}