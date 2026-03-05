import { Polygon, PolygonType, Vector } from '$classes';
import { getAngleAtVertex, isWithinTolerance, map, toDegrees } from '$utils';

export class GenericPolygon extends Polygon {
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
        polygon.calculateSides();
        polygon.calculateAngles();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    static fromVertices = (vertices: Vector[]): GenericPolygon => {
        const angles = vertices.map(v => getAngleAtVertex(vertices, v));
        const sides = vertices.map((v, index) => Vector.distance(v, vertices[(index + 1) % vertices.length]));
        const anchor = vertices[0].copy();
        const dir = Vector.sub(vertices[1], vertices[0]).copy();
        return GenericPolygon.fromAnchorAndDir(vertices.length, anchor, dir, sides, angles);
    }

    calculateVerticesFromAnchorAndDir = () => {
        this.vertices = [this.anchor.copy()];
        let current_dir: Vector = this.dir.copy().normalize();
        for (let i = 1; i < this.n; i++) {
            const prev_vertex = this.vertices[this.vertices.length - 1];
            this.vertices.push(Vector.add(prev_vertex.copy(), Vector.scale(current_dir, this.sides[i - 1])));
            current_dir.rotate(Math.PI - this.angles[i]);
        }
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    rotate = (origin: Vector, angle: number): GenericPolygon => {
        this.centroid = Vector.add(origin, Vector.sub(this.centroid, origin).rotate(angle));
        this.angle = (this.angle + angle) % (Math.PI * 2);

        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = Vector.add(origin, Vector.sub(this.vertices[i], origin).rotate(angle));
        }
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i] = Vector.add(origin, Vector.sub(this.halfways[i], origin).rotate(angle));
        }
        
        this.anchor = Vector.add(origin, Vector.sub(this.anchor, origin).rotate(angle));
        this.dir = this.dir.copy().rotate(angle);
        
        return this;
    }

    translate = (vector: Vector): GenericPolygon => {
        this.centroid.add(vector);
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = Vector.add(this.vertices[i], vector);
        }
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i] = Vector.add(this.halfways[i], vector);
        }
        
        this.anchor = Vector.add(this.anchor, vector);
        
        return this;
    }

    mirror = (point: Vector, mirrorDir: Vector): GenericPolygon => {
        this.angle = (2 * mirrorDir.heading() - this.angle + 2 * Math.PI) % (2 * Math.PI);
        
        this.centroid.mirrorByPointAndDir(point, mirrorDir);
        
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].mirrorByPointAndDir(point, mirrorDir);
        }
        this.vertices.reverse();

        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i].mirrorByPointAndDir(point, mirrorDir);
        }
        this.halfways.reverse();
        
        this.anchor.mirrorByPointAndDir(point, mirrorDir);
        this.dir.mirrorByPointAndDir(new Vector(), mirrorDir);
        
        return this;
    }

    getName = (coordinate: Vector | null = null): string => {
        if (!coordinate) return this.name;
        
        const index = this.vertices.findIndex(v => isWithinTolerance(v, coordinate));
        if (index === -1) {
            console.error('Vertex not found');
            return '';
        }

        // const rotatedSides = Array.from({ length: this.n }, (_, i) => this.sides[(vertexIndex + i) % this.n]);
        // const rotatedAngles = Array.from({ length: this.n }, (_, i) => toDegrees(this.angles[(vertexIndex + i) % this.n]));
        let name = `${this.n}[`;
        for (let i = 0; i < this.n; i++) {
            name += this.sides[(index + i) % this.n].toFixed(3);
            if (i < this.n - 1) {
                name += ';';
            }
        }
        name += '](';
        for (let i = 0; i < this.n; i++) {
            name += toDegrees(this.angles[(index + i) % this.n]);
            if (i < this.n - 1) {
                name += ';';
            }
        }
        name += ')';
        return name;
    }

    clone = (): GenericPolygon => {
        const anchor = this.vertices[0].copy();
        const dir = Vector.sub(this.vertices[1], this.vertices[0]).copy().normalize();
        return GenericPolygon.fromAnchorAndDir(this.n, anchor, dir, [...this.sides], [...this.angles]);
    }

    encode = (): Object => {
        return {
            type: PolygonType.GENERIC,
            n: this.n,
            sides: this.sides.map(s => s.toFixed(3)),
            angles: this.angles.map(a => toDegrees(a)),
            vertices: this.vertices.map(v => v.encode()),
        };
    }
}