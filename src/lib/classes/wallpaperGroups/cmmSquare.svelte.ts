import { WallpaperGroup } from "./WallpaperGroup.svelte";
import { Vector, SeedConfiguration, TriangleType, type TriangleSignature } from "$classes";
import { sortPointsByAngle } from "$utils";

export class cmmSquare extends WallpaperGroup { 
    constructor() {
        super('cmm', 3, [TriangleType.RIGHT, TriangleType.ISOSCELES]);
    }

    checkValidity = (seed: SeedConfiguration, signature: TriangleSignature): boolean => {
        const [processedSeed, cellStructure]: [SeedConfiguration, Vector[]] = this.buildCell(seed, signature);
        if (!processedSeed.isValid()) return false;

        return this.checkRotationalSymmetries(processedSeed, cellStructure, signature) && this.checkMirrorSymmetries(processedSeed, cellStructure, signature);
    }

    buildCell = (seed: SeedConfiguration, signature: TriangleSignature): [SeedConfiguration, Vector[]] => {
        // to build cmm's cell we reflect the seed configuration across the diagonals of the rhomboid
        const axis1 = Vector.sub(signature.vertices[1], signature.vertices[2]);
        const axis2 = Vector.sub(signature.vertices[2], signature.vertices[0]);

        let processedSeed: SeedConfiguration = seed.clone();
        processedSeed = processedSeed.mirror(signature.vertices[0], axis1.normalize());
        processedSeed = processedSeed.mirror(signature.vertices[0], axis2.normalize());
        
        let cellStructure: Vector[] = [signature.vertices[0], signature.vertices[1], signature.vertices[2], signature.vertices[3]];
        cellStructure = sortPointsByAngle(cellStructure);

        return [processedSeed, cellStructure];
    }

    checkRotationalSymmetries = (processedSeed: SeedConfiguration, cellStructure: Vector[], signature: TriangleSignature): boolean => {
        // cmm has 180-rotational symmetries in the center, vertices and halfway points of the rhomboid
        const rotationalCenters: Vector[] = [];

        const center = Vector.midpoint(cellStructure[0], cellStructure[2]);
        const halfways = cellStructure.map(v => Vector.midpoint(v, cellStructure[(cellStructure.indexOf(v) + 1) % cellStructure.length]));

        rotationalCenters.push(...[center, ...cellStructure, ...halfways]);

        for (const rotationalCenter of rotationalCenters) {
            const rotatedSeed = processedSeed.rotate(rotationalCenter, Math.PI);
            const mergedSeed = SeedConfiguration.merge(processedSeed, rotatedSeed);
            if (!mergedSeed.isValid()) return false;
        }
            
        return true;
    }

    checkGlideReflectionSymmetries = (processedSeed: SeedConfiguration, cellStructure: Vector[], signature: TriangleSignature): boolean => {
        // and four glide symmetries with axis through consecutive midpoints of the sides
        const midpoints = signature.vertices.map(v => Vector.midpoint(v, signature.vertices[(signature.vertices.indexOf(v) + 1) % signature.vertices.length]));
        const glideAxes: Vector[] = midpoints.map(m => Vector.sub(m, midpoints[(midpoints.indexOf(m) + 1) % midpoints.length]));

        for (const glideAxis of glideAxes) {
            const glidedSeed = processedSeed.glide(glideAxis, glideAxis.normalize(), glideAxis.mag());
            const mergedSeed = SeedConfiguration.merge(processedSeed, glidedSeed);
            if (!mergedSeed.isValid()) return false;
        }

        return true;
    }
}