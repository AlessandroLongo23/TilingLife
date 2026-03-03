import { WallpaperGroup } from "./WallpaperGroup.svelte";
import { Vector, SeedConfiguration, TriangleType, type TriangleSignature, Polygon } from "$classes";
import { isWithinTolerance, sortPointsByAngle } from "$utils";

export class cmmRhombic extends WallpaperGroup { 
    constructor() {
        super('cmm', 3, [TriangleType.RIGHT]);
    }

    buildCell = (seed: SeedConfiguration, signature: TriangleSignature): [SeedConfiguration, Vector[]] => {
        // to build cmm's cell we reflect the seed configuration across the diagonals of the rhomboid
        const centerVertex = signature.vertices[signature.rightVertexIndex!];
        const prev = signature.vertices[(signature.rightVertexIndex! - 1 + signature.vertices.length) % signature.vertices.length];
        const next = signature.vertices[(signature.rightVertexIndex! + 1) % signature.vertices.length];
        const axis1 = Vector.sub(centerVertex, prev);
        const axis2 = Vector.sub(centerVertex, next);

        let processedSeed: SeedConfiguration = seed.clone();
        processedSeed = SeedConfiguration.merge(processedSeed, processedSeed.mirror(centerVertex, axis1.normalize()));
        processedSeed = SeedConfiguration.merge(processedSeed, processedSeed.mirror(centerVertex, axis2.normalize()));

        let cellStructure: Vector[] = [prev, next, prev.mirrorByPointAndDir(centerVertex, axis2.normalize()), next.mirrorByPointAndDir(centerVertex, axis2.normalize())];
        cellStructure = sortPointsByAngle(cellStructure);

        return [processedSeed, cellStructure];
    }

    apply = (seed: SeedConfiguration, signature: TriangleSignature, layers: number): Polygon[] => {
        const [processedSeed, cellStructure]: [SeedConfiguration, Vector[]] = this.buildCell(seed, signature);
        const basis: Vector[] = [
            Vector.sub(cellStructure[1], cellStructure[0]),
            Vector.sub(cellStructure[2], cellStructure[0]),
        ];

        const polygons: Polygon[] = [];
        for (let i = -layers; i <= layers; i++) {
            for (let j = -layers; j <= layers; j++) {
                for (let polygon of processedSeed.polygons) {
                    polygons.push(polygon.translate(Vector.linearCombination(i, basis[0], j, basis[1])));
                }
            }
        }

        const uniquePolygons: Polygon[] = polygons.filter((polygon, index, self) =>
            index === self.findIndex((t: Polygon) => isWithinTolerance(t.centroid, polygon.centroid))
        );
        return uniquePolygons;
    }

    checkValidity = (seed: SeedConfiguration, signature: TriangleSignature): boolean => {
        // build the cell structure
        const [processedSeed, cellStructure]: [SeedConfiguration, Vector[]] = this.buildCell(seed, signature);

        // check the validity of the two axial symmetries  
        if (!processedSeed.isValid()) return false;

        // check the remaining rotational and glide reflection symmetries
        return (
            this.checkRotationalSymmetries(processedSeed, cellStructure, signature) &&
            this.checkGlideReflectionSymmetries(processedSeed, cellStructure, signature)
        )
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