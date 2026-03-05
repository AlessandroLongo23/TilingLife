import { SeedConfiguration, WallpaperGroup, type FundamentalDomain, type Polygon, Vector } from "$classes";

export class Tiling {
    seedConfiguration: SeedConfiguration;
    wallpaperGroup: WallpaperGroup;
    fundamentalDomain: FundamentalDomain;
    processedSeed: SeedConfiguration;
    cellStructure: Vector[];
    // polygons: Polygon[];

    constructor(seedConfiguration: SeedConfiguration, wallpaperGroup: WallpaperGroup, fundamentalDomain: FundamentalDomain) {
        this.seedConfiguration = seedConfiguration;
        this.wallpaperGroup = wallpaperGroup;
        this.fundamentalDomain = fundamentalDomain;
        [this.processedSeed, this.cellStructure] = this.wallpaperGroup.buildCell(this.seedConfiguration, this.fundamentalDomain);
    }

    // static fromPolygons = (polygons: Polygon[]): Tiling => {
    //     throw new Error("Not implemented");
    // }

    fillPlane = (layers: number): Polygon[] => {
        return this.wallpaperGroup.apply(this.processedSeed, this.fundamentalDomain, layers);
    }

    // rotate = (origin: Vector, angle: number): Tiling => {
        
    // }

    encode = (): object => {
        return {
            seedConfiguration: this.seedConfiguration.encode(),
            wallpaperGroup: this.wallpaperGroup.encode(),
            fundamentalDomain: this.fundamentalDomain,
            processedSeed: this.processedSeed.encode(),
            cellStructure: this.cellStructure.map(v => ({ x: v.x, y: v.y })),
        };
    }
}