import { GenericPolygon, Vector } from '$classes';

export class IsohedralPolygon extends GenericPolygon {
    constructor(n: number) {
        super(n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, sides: number[]): IsohedralPolygon => {
        const polygon: IsohedralPolygon = new IsohedralPolygon(n);

        polygon.sides = sides;
        polygon.anchor = anchor;
        polygon.dir = dir;
        polygon.interior_angle = Math.PI * (n - 2) / n;
        polygon.angles = Array(n).fill(polygon.interior_angle);
        polygon.name = `${n}[${sides.join(';')}]`;

        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateSides();
        polygon.calculateAngles();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    clone = (): IsohedralPolygon => {
        const anchor = this.vertices[0].copy();
        const dir = Vector.sub(this.vertices[1], this.vertices[0]).copy().normalize();
        return IsohedralPolygon.fromAnchorAndDir(this.n, anchor, dir, [...this.sides]);
    }
}