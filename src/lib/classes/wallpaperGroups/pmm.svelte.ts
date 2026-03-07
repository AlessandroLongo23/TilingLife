import { WallpaperGroup } from "./WallpaperGroup.svelte";
import { QuadrilateralType } from "./types";

export class pmm extends WallpaperGroup {
    constructor() {
        super('pmm', 4, [QuadrilateralType.RECTANGLE, QuadrilateralType.SQUARE]);
    }
}