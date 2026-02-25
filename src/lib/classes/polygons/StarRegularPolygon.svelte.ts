import { StarPolygon, Vector, StarVertexTypes } from '$classes';

export class StarRegularPolygon extends StarPolygon {
    d: number;

    constructor(n: number, d: number, startsWith: StarVertexTypes = StarVertexTypes.OUTER) {
        super(n, startsWith);

        this.d = d;
        this.name = '{' + n.toString() + '.' + d.toString() + (startsWith === StarVertexTypes.OUTER ? 'o' : 'i') + '}';
        this.alpha = Math.PI * (1 - 2 * d / n);
        this.beta = Math.PI * (1 + 2 * (d - 1) / n);

        this.outerRadius = Math.sin(this.beta / 2) / Math.sin(Math.PI / n);
        this.innerRadius = Math.sin(this.alpha / 2) / Math.sin(Math.PI / n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, d: number, startsWith: StarVertexTypes = StarVertexTypes.OUTER): StarRegularPolygon => {
        let polygon: StarRegularPolygon = new StarRegularPolygon(n, d, startsWith);

        polygon.anchor = anchor;
        polygon.dir = dir.copy();
        polygon.interior_angle = startsWith === StarVertexTypes.OUTER ? polygon.alpha : polygon.beta;

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
        return StarRegularPolygon.fromAnchorAndDir(this.n, this.vertices[0].copy(), Vector.sub(this.vertices[1], this.vertices[0]), this.d, this.startsWith);
    }
}