import type { Polygon } from "../polygons/Polygon.svelte";

export class SeedConfiguration {
    polygons: Polygon[];

    constructor(polygons: Polygon[]) {
        this.polygons = polygons;
    }

    isValid = (): boolean => {
        // check if any polygon intersects with any other polygon
        for (let i = 0; i < this.polygons.length - 1; i++) {
            const polygon = this.polygons[i];
            for (let j = i + 1; j < this.polygons.length; j++) {
                const otherPolygon = this.polygons[j];
                if (polygon.intersects(otherPolygon)) {
                    return false;
                }
            }
        }

        return true;
    }
}