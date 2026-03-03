import { StarPolygon, Vector, StarVertexTypes, PolygonType } from '$classes';

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
        polygon.calculateSides();
        polygon.calculateAngles();
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
        polygon.calculateSides();
        polygon.calculateAngles();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateHue();

        return polygon;
    }

    static fromVertices = (vertices: Vector[]): StarRegularPolygon => {
        const angle1: number = Vector.angleBetween(vertices[0], vertices[1]);
        const angle2: number = Vector.angleBetween(vertices[1], vertices[2]);
        let alpha: number, beta: number;
        if (angle1 > angle2) {
            [alpha, beta] = [angle2, angle1];
        } else {
            [alpha, beta] = [angle1, angle2];
        }

        const d = vertices.length / 2 * (1 - alpha / Math.PI);
        const startsWith = angle1 === alpha ? StarVertexTypes.OUTER : StarVertexTypes.INNER;
        const anchor = vertices[0].copy();
        const dir = Vector.sub(vertices[1], vertices[0]).copy();
        
        return StarRegularPolygon.fromAnchorAndDir(vertices.length, anchor, dir, d, startsWith);
    }

    clone = (): StarRegularPolygon => {
        const anchor = this.vertices[0].copy();
        const dir = Vector.sub(this.vertices[1], this.vertices[0]).copy().normalize();
        return StarRegularPolygon.fromAnchorAndDir(this.n, anchor, dir, this.d, this.startsWith);
    }

    encode = (): Object => {
        return {
            type: PolygonType.STAR_REGULAR,
            n: this.n,
            d: this.d,
            vertices: this.vertices.map(v => v.encode()),
        };
    }
}