import { Vector, type Polygon } from "$classes";

export class SeedConfiguration {
    polygons: Polygon[];

    constructor(polygons: Polygon[]) {
        this.polygons = polygons;
    }

    static merge = (seedA: SeedConfiguration, seedB: SeedConfiguration): SeedConfiguration => {
        return new SeedConfiguration([...seedA.polygons, ...seedB.polygons]);
    }

    rotate = (origin: Vector, angle: number): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.rotate(origin, angle)));
    }

    translate = (vector: Vector): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.translate(vector)));
    }

    mirror = (point: Vector, dir: Vector): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.mirror(point, dir)));
    }

    isValid = (): boolean => {
        // check if any polygon conflicts with any other polygon
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

    encode = (): Object => {
        return {
            polygons: this.polygons.map(p => p.encode()),
        };
    }

    clone = (): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.clone()));
    }
}