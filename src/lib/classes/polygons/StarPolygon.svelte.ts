import { Polygon, Vector } from '$classes';
import { map, isWithinTolerance } from '$utils';

export enum StarVertexTypes {
    INNER = 'inner',
    OUTER = 'outer',
}

export class StarPolygon extends Polygon {
    alpha: number;
    beta: number;
    innerRadius: number;
    outerRadius: number;
    startsWith: StarVertexTypes;

    constructor(n: number, startsWith: StarVertexTypes = StarVertexTypes.OUTER) {
        super(n);

        this.startsWith = startsWith;
    }

    calculateVerticesFromAnchorAndDir = (startsWith: StarVertexTypes = StarVertexTypes.OUTER) => {
        let angles = [this.alpha, this.beta];
        if (startsWith === StarVertexTypes.INNER)
            angles.reverse();

        this.vertices = [new Vector(this.anchor.x, this.anchor.y)];
        let current_dir: Vector = this.dir.copy();
        for (let i = 1; i < this.n * 2; i++) {
            const prev_vertex: Vector = this.vertices[this.vertices.length - 1];
            this.vertices.push(Vector.add(prev_vertex.copy(), current_dir.copy()));
            current_dir.rotate(Math.PI - angles[i % 2]);
        }
    }

    calculateVerticesFromCentroidAndAngle = () => {
        this.vertices = [];

        const angleToCenter = 2 * Math.PI / this.n;
        for (let i = 0; i < this.n; i++) {
            this.vertices.push(new Vector(
                this.centroid.x + this.outerRadius * Math.cos(angleToCenter * (i - 0.5) + this.angle),
                this.centroid.y + this.outerRadius * Math.sin(angleToCenter * (i - 0.5) + this.angle)
            ));

            this.vertices.push(new Vector(
                this.centroid.x + this.innerRadius * Math.cos(angleToCenter * i + this.angle),
                this.centroid.y + this.innerRadius * Math.sin(angleToCenter * i + this.angle)
            ));
        }
    }

    mirror = (point: Vector, dir: Vector): StarPolygon => {
        this.angle = (2 * dir.heading() - this.angle + 2 * Math.PI) % (2 * Math.PI);
        this.centroid.mirrorByPointAndDir(point.copy(), dir.copy());
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].mirrorByPointAndDir(point.copy(), dir.copy());
        }
        this.vertices.reverse();
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i].mirrorByPointAndDir(point.copy(), dir.copy());
        }
        this.halfways.reverse();
        this.halfways.push(this.halfways.shift()!);
        // After vertices.reverse(), the first vertex swaps outer<->inner, so startsWith must flip
        this.startsWith = this.startsWith === StarVertexTypes.OUTER ? StarVertexTypes.INNER : StarVertexTypes.OUTER;
        this.name = this.name.replace(/[oi](?=})/, (m) => (m === 'o' ? 'i' : 'o'));
        this.anchor = this.vertices[0].copy();
        this.dir = Vector.sub(this.vertices[1], this.vertices[0]);
        return this;
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

getName = (coordinate: Vector | null = null): string => {
        // When no coordinate: return full name including i/o (startsWith) for correct VC serialization.
        // The i/o suffix is required to reconstruct star polygons correctly in VertexConfiguration.fromName.
        if (!coordinate) return this.name;

        const vertex = this.vertices.find(v => isWithinTolerance(v, coordinate));
        if (!vertex) {
            console.error('Vertex not found');
            return '';
        }

        if (isWithinTolerance(this.centroid.distance(coordinate), this.outerRadius)) {
            return this.name.replace('i', 'o')
        } else if (isWithinTolerance(this.centroid.distance(coordinate), this.innerRadius)) {
            return this.name.replace('o', 'i')
        } else {
            console.error('Name could not be determined from vertex');
            return '';
        }
    }
}