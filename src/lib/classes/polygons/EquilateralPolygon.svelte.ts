import { GenericPolygon, PolygonType, Vector } from '$classes';
import { getAngleAtVertex, isWithinTolerance, map, toDegrees } from '$utils';

export class EquilateralPolygon extends GenericPolygon {
    constructor(n: number) {
        super(n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, angles: number[]): EquilateralPolygon => {
        const polygon: EquilateralPolygon = new EquilateralPolygon(n);

        polygon.angles = angles;
        polygon.name = `${n}(${angles.map(a => toDegrees(a)).join(';')})`;
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

    static fromVertices = (vertices: Vector[]): EquilateralPolygon => {
        const angles = vertices.map(v => getAngleAtVertex(vertices, v));
        const anchor = vertices[0].copy();
        const dir = Vector.sub(vertices[1], vertices[0]).copy();
        return EquilateralPolygon.fromAnchorAndDir(vertices.length, anchor, dir, angles);
    }

    calculateVerticesFromAnchorAndDir = () => {
        this.vertices = [this.anchor.copy()];
        let current_dir: Vector = this.dir.copy().normalize();
        for (let i = 1; i < this.n; i++) {
            const prev_vertex = this.vertices[this.vertices.length - 1];
            this.vertices.push(Vector.add(prev_vertex, current_dir));
            current_dir.rotate(Math.PI - this.angles[i]);
            this.vertices[i].snapToGrid();
        }
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    getName = (coordinate: Vector | null = null): string => {
        if (!coordinate) return this.name;
        
        const index = this.vertices.findIndex(v => isWithinTolerance(v, coordinate));
        if (index === -1) {
            console.error('Vertex not found');
            return '';
        }

        let name = `${this.n}(`;
        for (let i = 0; i < this.n; i++) {
            name += toDegrees(this.angles[(index + i) % this.n]);
            if (i < this.n - 1) {
                name += ';';
            }
        }
        name += ')';
        return name;
    }

    clone = (): EquilateralPolygon => {
        const anchor = this.vertices[0].copy();
        const dir = Vector.sub(this.vertices[1], this.vertices[0]).copy().normalize();
        return EquilateralPolygon.fromAnchorAndDir(this.n, anchor, dir, [...this.angles]);
    }

    encode = (): Object => {
        return {
            type: PolygonType.EQUILATERAL,
            n: this.n,
            angles: this.angles.map(a => toDegrees(a)),
            vertices: this.vertices.map(v => v.encode()),
        };
    }
}