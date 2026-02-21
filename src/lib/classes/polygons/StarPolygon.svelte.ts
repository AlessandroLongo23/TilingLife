import { Polygon } from './Polygon.svelte';
import { Vector } from '../Vector.svelte';
import { map, findIntersection } from '$utils';
import { get } from 'svelte/store';
import { controls, lineWidth, islamicAngle } from '$stores';

export class StarPolygon extends Polygon {
    alpha: number;
    beta: number;
    innerRadius: number;
    outerRadius: number;

    constructor(n: number) {
        super(n);

        this.alpha
    }

    calculateVerticesFromAnchorAndDir = () => {
        this.vertices = [new Vector(this.anchor.x, this.anchor.y)];
        for (let i = 1; i < this.n * 2; i++) {
            let prev_vertex: Vector = this.vertices[this.vertices.length - 1];
            this.vertices.push(Vector.add(prev_vertex.copy(), this.dir.copy()));
            
            if (i % 2 === 0) {
                this.dir.rotate(-(Math.PI - this.beta));
            } else {
                this.dir.rotate(-(Math.PI - this.alpha));
            }
        }
    }

    calculateVerticesFromCentroidAndAngle = () => {
        this.vertices = [];

        const angleToCenter = -2 * Math.PI / this.n;
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

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    showIslamic = (ctx) => {
        ctx.noFill();
        ctx.strokeWeight(get(lineWidth) / get(controls).zoom);
        ctx.stroke(0, 0, 100);
        let angle = get(islamicAngle) * Math.PI / 180;
        for (let i = 0; i < this.halfways.length; i++) {
            let perp = Vector.sub(this.vertices[i], this.halfways[i]).rotate(Math.PI / 2);
            let dir1 = Vector.rotate(perp, angle / 2).normalize();
            let dir2 = Vector.rotate(perp, -angle / 2).normalize();

            let [vint, vout] = [this.vertices[i], this.vertices[(i + 1) % this.vertices.length]].sort((a, b) => Vector.distance(this.centroid, a) - Vector.distance(this.centroid, b));
            if (i % 2 === 0) {
                // [dir1, dir2] = [dir2, dir1];
            }
            
            let intersection1 = findIntersection(this.halfways[i], dir1, vout, Vector.sub(this.centroid, vout))!;
            let dist1 = Vector.distance(this.halfways[i], intersection1);
            
            let intersection2: Vector | null = findIntersection(this.halfways[i], dir2, vint, Vector.sub(this.centroid, vint));
            let intersection3: Vector | null = findIntersection(this.halfways[i], dir2, vout, Vector.sub(this.centroid, vout));
            let dist2 = Math.min(
                intersection2 ? Vector.distance(this.halfways[i], intersection2) : Infinity,
                intersection3 ? Vector.distance(this.halfways[i], intersection3) : Infinity,
            );

            ctx.line(this.halfways[i].x, this.halfways[i].y, this.halfways[i].x + dir1.x * dist1, this.halfways[i].y + dir1.y * dist1);
            ctx.line(this.halfways[i].x, this.halfways[i].y, this.halfways[i].x + dir2.x * dist2, this.halfways[i].y + dir2.y * dist2);
        }
    }
}