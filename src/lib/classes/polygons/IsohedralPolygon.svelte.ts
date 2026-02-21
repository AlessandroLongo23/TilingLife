import { GeneralPolygon } from './GeneralPolygon.svelte';
import { Vector } from '../Vector.svelte';

export class IsohedralPolygon extends GeneralPolygon {
    constructor(n: number) {
        super(n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, sides: number[]): IsohedralPolygon => {
        const polygon: IsohedralPolygon = new IsohedralPolygon(n);

        polygon.sides = sides;
        polygon.angles = Array(n).fill(Math.PI * (n - 2) / n);
        polygon.anchor = anchor;
        polygon.dir = dir;

        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    clone = (): IsohedralPolygon => {
        return IsohedralPolygon.fromAnchorAndDir(this.n, this.anchor.copy(), this.dir.copy(), [...this.sides]);
    }
}