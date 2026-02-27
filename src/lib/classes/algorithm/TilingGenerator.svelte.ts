import { Tiling, SeedConfiguration, Vector, WallpaperGroup, 
    p1, p2, 
    p3, p31m, p3m1,
    p4, p4g, p4m,
    p6, p6m,
    pm, pg, pmm, pgg, pmg,
    cm, cmm
} from "$classes";
import { deduplicatePoints } from "$utils";

export class TilingGenerator {
    wallpaperGroups: WallpaperGroup[];

    constructor() {
        this.wallpaperGroups = [
            new p1(),
            new p2(),
            new p3(),
            new p31m(),
            new p3m1(),
            new p4(),
            new p4g(),
            new p4m(),
            new p6(),
            new p6m(),
            new pm(),
            new pg(),
            new pmm(),
            new pgg(),
            new pmg(),
            new cm(),
            new cmm(),
        ]
    }

    generateTilings = (seedConfiguration: SeedConfiguration): Tiling[] => {
        const tilings: Tiling[] = [];

        // get all unique construction points from the polygons in the seed configuration
        const constructionPoints: Vector[] = seedConfiguration.polygons
            .map(p => [...p.vertices, ...p.halfways, p.centroid])
            .flat()

        const uniqueConstructionPoints: Vector[] = deduplicatePoints(constructionPoints);

        // iterate over all 3-tuples of construction points
        for (let i = 0; i < uniqueConstructionPoints.length; i++) {
            for (let j = i + 1; j < uniqueConstructionPoints.length; j++) {
                for (let k = j + 1; k < uniqueConstructionPoints.length; k++) {
                    const constructionPoints: Vector[] = [
                        uniqueConstructionPoints[i],
                        uniqueConstructionPoints[j],
                        uniqueConstructionPoints[k]
                    ];

                    // check for the wallpaper groups that have a triangle as fundamental domain
                    for (const wallpaperGroup of this.wallpaperGroups) {
                        if (wallpaperGroup.checkValidity(seedConfiguration, constructionPoints)) {
                            // tilings.push(new Tiling(seedConfiguration, wallpaperGroup, constructionPoints));
                        }
                    }
                }
            }
        }

        return tilings;
    }

    isInsideConvexHull = (vertices: Vector[], point: Vector): boolean => {
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % n];
            const crossProduct = Vector.cross(Vector.sub(v2, v1), Vector.sub(point, v1));
            if (crossProduct > 0) return false;
        }
        return true;
    }
}