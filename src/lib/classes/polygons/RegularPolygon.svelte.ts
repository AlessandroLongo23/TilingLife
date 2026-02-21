import { Polygon } from './Polygon.svelte';
import { map } from '$utils';
import { Vector } from '../Vector.svelte';

export class RegularPolygon extends Polygon {
    internal_angle: number;

    constructor(n: number) {
        super(n);
    }

    static fromCentroidAndAngle = (n: number, centroid: Vector, angle: number): RegularPolygon => {
        let polygon: RegularPolygon = new RegularPolygon(n);
        
        polygon.centroid = centroid;
        polygon.angle = angle;

        polygon.calculateVerticesFromCentroidAndAngle();
        polygon.calculateHalfways();
        polygon.calculateHue();

        return polygon;
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector): RegularPolygon => {
        const polygon: RegularPolygon = new RegularPolygon(n);
        
        polygon.anchor = anchor;
        polygon.dir = dir;
        polygon.internal_angle = Math.PI * (n - 2) / n;
        
        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    calculateVerticesFromCentroidAndAngle = () => {
        this.vertices = [];
        let radius = 0.5 / Math.sin(Math.PI / this.n);
        for (let i = 0; i < this.n; i++) {
            this.vertices.push(new Vector(
                this.centroid.x + radius * Math.cos(i * 2 * Math.PI / this.n + this.angle),
                this.centroid.y + radius * Math.sin(i * 2 * Math.PI / this.n + this.angle)
            ));

            this.vertices[i].snapToGrid();
        }
    }

    calculateVerticesFromAnchorAndDir = () => {
        this.vertices = [new Vector(this.anchor.x, this.anchor.y)];
        let current_dir: Vector = this.dir.copy();
        for (let i = 1; i < this.n; i++) {
            const prev_vertex = this.vertices[this.vertices.length - 1];
            this.vertices.push(Vector.add(prev_vertex.copy(), current_dir.copy()));
            current_dir.rotate(-(Math.PI - this.internal_angle));

            this.vertices[i].snapToGrid();
        }
    }

    calculateHue = () => {
        this.hue = map(Math.log(this.vertices.length), Math.log(3), Math.log(40), 0, 300);
    }

    clone = (): RegularPolygon => {
        return RegularPolygon.fromCentroidAndAngle(this.n, this.centroid.copy(), this.angle);
    }
}