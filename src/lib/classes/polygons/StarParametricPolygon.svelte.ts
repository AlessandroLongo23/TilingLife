import { Vector, StarPolygon } from '$classes';

export class StarParametricPolygon extends StarPolygon {
    constructor(n: number, alpha: number) {
        super(n);

        this.alpha = alpha;
        this.beta = 2 * Math.PI * (1 - 1 / n) - alpha;

        this.outerRadius = Math.sin(this.beta / 2) / Math.sin(Math.PI / n);
        this.innerRadius = Math.sin(this.alpha / 2) / Math.sin(Math.PI / n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, alpha: number): StarParametricPolygon => {
        const polygon: StarParametricPolygon = new StarParametricPolygon(n, alpha);

        polygon.anchor = anchor;
        polygon.dir = dir;

        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    static fromCentroidAndAngle = (n: number, alpha: number, centroid: Vector = new Vector(), angle: number = 0): StarParametricPolygon => {
        const polygon: StarParametricPolygon = new StarParametricPolygon(n, alpha);

        polygon.centroid = centroid;
        polygon.angle = angle;

        polygon.calculateVerticesFromCentroidAndAngle();
        polygon.calculateHalfways();
        polygon.calculateHue();

        return polygon;
    }

    clone = (): StarParametricPolygon => {
        return StarParametricPolygon.fromCentroidAndAngle(this.n, this.alpha, this.centroid.copy(), this.angle);
    }
}