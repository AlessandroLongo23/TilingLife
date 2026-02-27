import { WallpaperGroup } from "./WallpaperGroup.svelte";
import { Vector, SeedConfiguration } from "$classes";
import { isWithinTolerance, toDegrees } from "$utils";

export class cmm extends WallpaperGroup { 
    constructor() {
        super('cmm', 3);
    }

    checkValidity = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        if (!this.checkShape(vertices)) return false;

        const cell: SeedConfiguration = this.buildCell(seed, vertices);
        if (!cell.isValid()) return false;

        return this.checkSymmetries(cell, vertices);
    }

    checkShape = (vertices: Vector[]): boolean => {
        return this.checkAngles(vertices) && this.checkSides(vertices);
    }
    
    checkSymmetries = (cell: SeedConfiguration, vertices: Vector[]): boolean => {
        return this.checkRotationalSymmetries(cell, vertices) && this.checkMirrorSymmetries(cell, vertices);
    }

    checkAngles = (vertices: Vector[]): boolean => {
        if (vertices.length !== this.sides) return false;
        const angles = vertices.map(v => this.getAngleAtVertex(vertices, v));

        // cmm's fundamental domain is a rect triangle
        return (
            toDegrees(angles[0]) === 90 &&
            toDegrees(angles[1] + angles[2]) === 90
        )
    }

    getAngleAtVertex = (vertices: Vector[], coordinate: Vector): number => {
        const vertex = vertices.find(v => isWithinTolerance(v, coordinate));
        if (vertex) {
            const index = vertices.indexOf(vertex);
            const dir1 = Vector.sub(vertices[(index + 1) % vertices.length], vertex);
            const dir2 = Vector.sub(vertex, vertices[(index - 1 + vertices.length) % vertices.length]);
            return (dir2.heading() - dir1.heading() + 5 * Math.PI) % (2 * Math.PI);
        }
        return 0;
    }

    checkSides = (vertices: Vector[]): boolean => {
        if (vertices.length !== this.sides) return false;
        const sides = vertices.map(v => Vector.distance(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));

        // cmm's fundamental domain is a rect triangle, so we check with the Pythagorean theorem
        return isWithinTolerance(sides[0] ** 2 + sides[2] ** 2, sides[1] ** 2);
    }

    buildCell = (seed: SeedConfiguration, vertices: Vector[]): SeedConfiguration => {
        // to build cmm's cell we reflect the seed configuration across the diagonals of the rhomboid
        const axis1 = Vector.sub(vertices[1], vertices[2]);
        const axis2 = Vector.sub(vertices[2], vertices[0]);

        let cellStructure: SeedConfiguration = seed.clone();
        cellStructure = cellStructure.mirror(vertices[0], axis1.normalize());
        cellStructure = cellStructure.mirror(vertices[0], axis2.normalize());
        
        return cellStructure;
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
        // cmm has 2 mirror symmetries with axis through the diagonals of the rhomboid
        const diagonal1 = Vector.sub(vertices[0], vertices[2]);
        const diagonal2 = Vector.sub(vertices[1], vertices[3]);
        const mirrorAxes: Vector[] = [diagonal1, diagonal2];

        for (const mirrorAxis of mirrorAxes) {
            const mirroredSeed = seed.mirror(mirrorAxis, mirrorAxis.normalize());
            const mergedSeed = SeedConfiguration.merge(seed, mirroredSeed);
            if (!mergedSeed.isValid()) return false;
        }

        // and four glide symmetries with axis through consecutive midpoints of the sides
        const midpoints = vertices.map(v => Vector.midpoint(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));
        const glideAxes: Vector[] = midpoints.map(m => Vector.sub(m, midpoints[(midpoints.indexOf(m) + 1) % midpoints.length]));

        for (const glideAxis of glideAxes) {

            const glidedSeed = seed.glide(glideAxis, glideAxis.normalize());
        }

        return true;
    }
}