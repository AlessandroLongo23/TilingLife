import { Polygon, Vector } from '$classes';
import { map, toDegrees } from '$utils';

export class GenericPolygon extends Polygon {
    sides: number[];
    angles: number[];

    constructor(n: number) {
        super(n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, sides: number[], angles: number[]): GenericPolygon => {
        const polygon: GenericPolygon = new GenericPolygon(n);

        polygon.sides = sides;
        polygon.angles = angles;
        polygon.name = `${n}[${sides.join(';')}](${angles.map(a => toDegrees(a)).join(';')})`;
        polygon.anchor = anchor;
        polygon.dir = dir.copy();
        polygon.interior_angle = angles[0];

        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    static fromVertices = (vertices: Vector[]): GenericPolygon => {
        const sides = vertices.map(v => Vector.distance(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));
        const angles = vertices.map(v => Vector.angleBetween(v, vertices[(vertices.indexOf(v) + 1) % vertices.length]));
        const anchor = vertices[0].copy();
        const dir = Vector.sub(vertices[1], vertices[0]).copy();

        return GenericPolygon.fromAnchorAndDir(vertices.length, anchor, dir, sides, angles);
    }

    calculateVerticesFromAnchorAndDir = () => {
        this.vertices = [this.anchor.copy()];
        let current_dir: Vector = this.dir.copy();
        for (let i = 1; i < this.n; i++) {
            const prev_vertex = this.vertices[this.vertices.length - 1];
            this.vertices.push(Vector.add(prev_vertex.copy(), current_dir.scale(this.sides[i])));
            current_dir.rotate(Math.PI - this.angles[i]);
            this.vertices[i].snapToGrid();
        }
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    rotate = (origin: Vector, angle: number): GenericPolygon => {
        this.centroid = Vector.add(origin, Vector.sub(this.centroid, origin).rotate(angle));
        this.centroid.snapToGrid();
        this.angle = (this.angle + angle) % (Math.PI * 2);

        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = Vector.add(origin, Vector.sub(this.vertices[i], origin).rotate(angle));
            this.vertices[i].snapToGrid();
        }
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i] = Vector.add(origin, Vector.sub(this.halfways[i], origin).rotate(angle));
            this.halfways[i].snapToGrid();
        }
        
        this.anchor = Vector.add(origin, Vector.sub(this.anchor, origin).rotate(angle));
        this.anchor.snapToGrid();
        this.dir = this.dir.copy().rotate(angle);
        
        return this;
    }

    translate = (vector: Vector): GenericPolygon => {
        this.centroid.add(vector);
        this.centroid.snapToGrid();
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = Vector.add(this.vertices[i], vector);
            this.vertices[i].snapToGrid();
        }
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i] = Vector.add(this.halfways[i], vector);
            this.halfways[i].snapToGrid();
        }
        
        this.anchor = Vector.add(this.anchor, vector);
        this.anchor.snapToGrid();
        
        return this;
    }

    mirror = (point: Vector, mirrorDir: Vector): GenericPolygon => {
        this.angle = (2 * mirrorDir.heading() - this.angle + 2 * Math.PI) % (2 * Math.PI);
        
        this.centroid.mirrorByPointAndDir(point, mirrorDir);
        this.centroid.snapToGrid();
        
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].mirrorByPointAndDir(point, mirrorDir);
            this.vertices[i].snapToGrid();
        }
        this.vertices.reverse();

        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i].mirrorByPointAndDir(point, mirrorDir);
            this.halfways[i].snapToGrid();
        }
        this.halfways.reverse();
        
        this.anchor.mirrorByPointAndDir(point, mirrorDir);
        this.anchor.snapToGrid();
        this.dir.mirrorByPointAndDir(new Vector(), mirrorDir);
        
        return this;
    }

    clone = (): GenericPolygon => {
        return GenericPolygon.fromAnchorAndDir(this.n, this.vertices[0].copy(), Vector.sub(this.vertices[1], this.vertices[0]).copy(), [...this.sides], [...this.angles]);
    }
}