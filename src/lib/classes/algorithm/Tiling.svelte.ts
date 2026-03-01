import { SeedConfiguration, WallpaperGroup, type FundamentalDomain, type Polygon, Vector } from "$classes";

export class Tiling {
    seedConfiguration: SeedConfiguration;
    wallpaperGroup: WallpaperGroup;
    fundamentalDomain: FundamentalDomain;
    processedSeed: SeedConfiguration;
    cellStructure: Vector[];

    constructor(seedConfiguration: SeedConfiguration, wallpaperGroup: WallpaperGroup, fundamentalDomain: FundamentalDomain) {
        this.seedConfiguration = seedConfiguration;
        this.wallpaperGroup = wallpaperGroup;
        this.fundamentalDomain = fundamentalDomain;
        [this.processedSeed, this.cellStructure] = this.wallpaperGroup.buildCell(this.seedConfiguration, this.fundamentalDomain);
    }

    fillPlane = (layers: number): Polygon[] => {
        return this.wallpaperGroup.apply(this.processedSeed, this.fundamentalDomain, layers);
    }

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