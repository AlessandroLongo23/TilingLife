import { StarPolygon, Vector, StarRegularVertexTypes } from '$classes';

export class StarRegularPolygon extends StarPolygon {
    d: number;

    constructor(n: number, d: number, startsWith: StarRegularVertexTypes = StarRegularVertexTypes.OUTER) {
        super(n, startsWith);

        this.d = d;
        this.name = '{' + n.toString() + '.' + d.toString() + (startsWith === StarRegularVertexTypes.OUTER ? 'o' : 'i') + '}';
        this.alpha = Math.PI * (1 - 2 * d / n);
        this.beta = Math.PI * (1 + 2 * (d - 1) / n);

        this.outerRadius = Math.sin(this.beta / 2) / Math.sin(Math.PI / n);
        this.innerRadius = Math.sin(this.alpha / 2) / Math.sin(Math.PI / n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, d: number, startsWith: StarRegularVertexTypes = StarRegularVertexTypes.OUTER): StarRegularPolygon => {
        let polygon: StarRegularPolygon = new StarRegularPolygon(n, d, startsWith);

        polygon.anchor = anchor;
        polygon.dir = dir;
        polygon.interior_angle = startsWith === StarRegularVertexTypes.OUTER ? polygon.alpha : polygon.beta;

        polygon.calculateVerticesFromAnchorAndDir(startsWith);
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();
        
        return polygon;
    }

    static fromCentroidAndAngle = (n: number, d: number, centroid: Vector = new Vector(), angle: number = 0): StarRegularPolygon => {
        let polygon: StarRegularPolygon = new StarRegularPolygon(n, d);

        polygon.centroid = centroid;
        polygon.angle = angle;

        polygon.calculateVerticesFromCentroidAndAngle();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateHue();

        return polygon;
    }

    clone = (): StarRegularPolygon => {
        return StarRegularPolygon.fromCentroidAndAngle(this.n, this.d, this.centroid.copy(), this.angle);
    }
}