import { GeneralPolygon, Vector } from '$classes';
import { map } from '$utils';

export class IsotoxalPolygon extends GeneralPolygon {
    constructor(n: number) {
        super(n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, angles: number[]): IsotoxalPolygon => {
        const polygon: IsotoxalPolygon = new IsotoxalPolygon(n);

        polygon.sides = Array(n).fill(1);
        polygon.angles = angles;
        polygon.anchor = anchor;
        polygon.dir = dir;

        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    clone = (): IsotoxalPolygon => {
        return IsotoxalPolygon.fromAnchorAndDir(this.n, this.anchor.copy(), this.dir.copy(), [...this.angles]);
    }
}