import { StarPolygon } from './StarPolygon.svelte';
import { Vector } from '../Vector.svelte';

export class StarRegularPolygon extends StarPolygon {
    d: number;

    constructor(n: number, d: number) {
        super(n);

        this.d = d;
        this.alpha = Math.PI * (1 - 2 * d / n);
        this.beta = Math.PI * (1 - 2 * (d - 1) / n);

        this.outerRadius = Math.sin(this.beta / 2) / Math.sin(Math.PI / n);
        this.innerRadius = Math.sin(this.alpha / 2) / Math.sin(Math.PI / n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, d: number): StarRegularPolygon => {
        let polygon: StarRegularPolygon = new StarRegularPolygon(n, d);

        polygon.anchor = anchor;
        polygon.dir = dir;

        polygon.calculateVerticesFromAnchorAndDir();
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