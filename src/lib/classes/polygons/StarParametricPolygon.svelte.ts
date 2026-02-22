import { Vector, StarPolygon, StarRegularVertexTypes } from '$classes';
import { toDegrees } from '$utils';

export class StarParametricPolygon extends StarPolygon {
    constructor(n: number, alpha: number, startsWith: StarRegularVertexTypes = StarRegularVertexTypes.OUTER) {
        super(n, startsWith);

        this.alpha = alpha;
        this.name = '{' + n.toString() + '|' + toDegrees(alpha).toString() + (startsWith === StarRegularVertexTypes.OUTER ? 'o' : 'i') + '}';
        this.beta = 2 * Math.PI * (1 - 1 / n) - alpha;

        this.outerRadius = Math.sin(this.beta / 2) / Math.sin(Math.PI / n);
        this.innerRadius = Math.sin(this.alpha / 2) / Math.sin(Math.PI / n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, alpha: number, startsWith: StarRegularVertexTypes = StarRegularVertexTypes.OUTER): StarParametricPolygon => {
        const polygon: StarParametricPolygon = new StarParametricPolygon(n, alpha, startsWith);

        polygon.anchor = anchor;
        polygon.dir = dir.copy();
        polygon.interior_angle = startsWith === StarRegularVertexTypes.OUTER ? polygon.alpha : polygon.beta;

        polygon.calculateVerticesFromAnchorAndDir(startsWith);
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