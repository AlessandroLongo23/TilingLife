import { lineWidth, liveChartMode, controls, islamicAngle, isIslamic, tolerance } from '$stores';
import { Vector, Behavior, State } from '$classes';
import { get } from 'svelte/store';
import { isWithinTolerance } from '$lib/utils';

export class Polygon {
    n: number;
    name: string;
    neighbors: Polygon[];
    state: State;
    nextState: number;
    hue: number;
    vertices: Vector[];
    halfways: Vector[];
    centroid: Vector;
    angle: number;
    anchor: Vector;
    dir: Vector;
    behavior: Behavior;
    golNeighbors?: Polygon[];
    alive_neighbors: number;
    interior_angle: number;

    constructor(n: number = 3) {
        this.n = n;
        this.angle = 0;
        this.neighbors = [];
        this.state = State.DEAD;
        this.nextState = State.DEAD;

        this.hue = 0;
        this.alive_neighbors = 0;
    }

    calculateCentroid = () => {
        this.centroid = new Vector()
        let signed_area = 0
        for (let i = 0; i < this.vertices.length; i++) {
            const curr_vertex = this.vertices[i];
            const next_vertex = this.vertices[(i + 1) % this.vertices.length];
            signed_area += (curr_vertex.x * next_vertex.y - next_vertex.x * curr_vertex.y);
        }
        signed_area /= 2;

        for (let i = 0; i < this.vertices.length; i++) {
            const curr_vertex = this.vertices[i];
            const next_vertex = this.vertices[(i + 1) % this.vertices.length];
            this.centroid.x += (curr_vertex.x + next_vertex.x) * (curr_vertex.x * next_vertex.y - next_vertex.x * curr_vertex.y);
            this.centroid.y += (curr_vertex.y + next_vertex.y) * (curr_vertex.x * next_vertex.y - next_vertex.x * curr_vertex.y);
        }
        this.centroid.x /= 6 * signed_area;
        this.centroid.y /= 6 * signed_area;

        this.centroid.snapToGrid();
    }

    calculateHalfways = () => {
        this.halfways = [];
        for (let i = 0; i < this.vertices.length; i++) {
            this.halfways.push(Vector.midpoint(this.vertices[i], this.vertices[(i + 1) % this.vertices.length]));
            this.halfways[i].snapToGrid();
        }
    }

    calculateAngle = (): void => {
        this.angle = Vector.sub(this.vertices[0], this.centroid).heading();
    }

    rotate = (origin: Vector, angle: number): Polygon => {
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

        return this;
    }

    translate = (vector: Vector): Polygon => {
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

        return this;
    }

    mirror = (point: Vector, dir: Vector): Polygon => {
        this.angle = (2 * dir.heading() - this.angle + 2 * Math.PI) % (2 * Math.PI);
        
        this.centroid.mirrorByPointAndDir(point, dir);
        this.centroid.snapToGrid();
        
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].mirrorByPointAndDir(point, dir);
            this.vertices[i].snapToGrid();
        }
        this.vertices.reverse();

        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i].mirrorByPointAndDir(point, dir);
            this.halfways[i].snapToGrid();
        }
        this.halfways.reverse();

        return this;
    }

    containsPoint = (point: Vector): boolean => {
        let inside = false;
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x;
            const yi = this.vertices[i].y;
            const xj = this.vertices[j].x;
            const yj = this.vertices[j].y;
            const l2 = (xj - xi) ** 2 + (yj - yi) ** 2;
            
            let distToSegment = 0;

            if (l2 === 0) {
                distToSegment = Math.sqrt((point.x - xi) ** 2 + (point.y - yi) ** 2);
            } else {
                let t = ((point.x - xi) * (xj - xi) + (point.y - yi) * (yj - yi)) / l2;
                t = Math.max(0, Math.min(1, t));
                const projX = xi + t * (xj - xi);
                const projY = yi + t * (yj - yi);
                distToSegment = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
            }
            
            if (distToSegment <= tolerance) return false;

            const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) {
                inside = !inside;
            }
        }
        return inside;
    }

    getAngleAtVertex = (coordinate: Vector): number => {
        const vertex = this.vertices.find(v => isWithinTolerance(v, coordinate));
        if (vertex) {
            const index = this.vertices.indexOf(vertex);
            const dir1 = Vector.sub(vertex, this.vertices[(index - 1 + this.vertices.length) % this.vertices.length]);
            const dir2 = Vector.sub(this.vertices[(index + 1) % this.vertices.length], vertex);
            return (dir2.heading() - dir1.heading() + 5 * Math.PI) % (2 * Math.PI);
        }
        return 0;
    }

    show = (ctx, showPolygonPoints, customColor = null, opacity = 0.80) => {
        if (this.centroid.x < -ctx.width / 2 - 10 || this.centroid.y < -ctx.height / 2 - 10 || this.centroid.x > ctx.width / 2 + 10 || this.centroid.y > ctx.height / 2 + 10)
            return;

        ctx.push();

        // this.calculateHue();
        
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0, opacity);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue * opacity);
        }

        if (get(isIslamic)) {
            this.showIslamic(ctx);
        } else {
            ctx.fill(customColor || this.hue, 40, 100 / opacity, 0.80 * opacity);
            ctx.beginShape();
            for (let i = 0; i < this.vertices.length; i++) {
                ctx.vertex(this.vertices[i].x, this.vertices[i].y);
            }
            ctx.endShape(ctx.CLOSE);
        }

            
        if (showPolygonPoints) {
            ctx.fill(0, 100, 100);
            ctx.ellipse(this.centroid.x, this.centroid.y, 5 / get(controls).zoom);
            
            ctx.fill(120, 100, 100);
            for (let i = 0; i < this.halfways.length; i++) {
                ctx.ellipse(this.halfways[i].x, this.halfways[i].y, 5 / get(controls).zoom);
            }
            
            ctx.fill(240, 100, 100);
            for (let i = 0; i < this.vertices.length; i++) {
                ctx.ellipse(this.vertices[i].x, this.vertices[i].y, 5 / get(controls).zoom);
            }
        }

        ctx.pop();
    }

    showIslamic = (ctx) => {
        ctx.noFill();
        ctx.strokeWeight(get(lineWidth) / get(controls).zoom);
        ctx.stroke(0, 0, 100);
        // const noise = ctx.noise(this.centroid.x / 5 + 1000, this.centroid.y / 5 + 1000, ctx.frameCount / 25);
        // const noiseAngle = map(noise, 0, 1, 0, 180);
        // let angle = noiseAngle * Math.PI / 180;
        let angle = get(islamicAngle) * Math.PI / 180;
        for (let i = 0; i < this.halfways.length; i++) {
            let side = 0.5
            let perp = Vector.sub(this.centroid, this.halfways[i]);
            let dir1 = Vector.rotate(perp, angle / 2).normalize();
            let dir2 = Vector.rotate(perp, -angle / 2).normalize();
            
            let beta = Math.PI / this.n;
            let epsilon = Math.PI - beta - angle / 2;
            let gamma = Math.PI / 2 - beta;

            let dist = side * Math.tan(gamma) * Math.sin(beta) / Math.sin(epsilon);

            ctx.line(this.halfways[i].x, this.halfways[i].y, this.halfways[i].x + dir1.x * dist, this.halfways[i].y + dir1.y * dist);
            ctx.line(this.halfways[i].x, this.halfways[i].y, this.halfways[i].x + dir2.x * dist, this.halfways[i].y + dir2.y * dist);
        }
    }

    showGameOfLife = (ctx, ruleType, parsedGolRule, rules) => {
        ctx.push();
        
        if (get(liveChartMode) === 'count') {
            if (this.state === 0) {
                ctx.fill(0, 0, 100);
            } else if (this.state === 1) {
                ctx.fill(0, 0, 0);
            } else {
                const maxGenerations = ruleType === 'Single' ? parsedGolRule.generations : rules[this.n].generations;
                const progress = (this.state - 1) / (maxGenerations - 1);
                const brightness = progress * 100;
                ctx.fill(0, 0, brightness);
            }
        } else {
            if (this.behavior === Behavior.DECREASING) {
                ctx.fill(0, 0, 100);
            } else if (this.behavior === Behavior.INCREASING) {
                ctx.fill(0, 0, 0);
            } else {
                ctx.fill(345, 50, 100);
            }
        }

        ctx.beginShape();
        for (let i = 0; i < this.vertices.length; i++) {
            ctx.vertex(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.endShape(ctx.CLOSE);
        ctx.pop();
    }

    clone = (): Polygon => {
        throw new Error('Abstract method called');
    }

    calculateVerticesFromCentroidAndAngle = (): void => {
        throw new Error('Abstract method called');
    }
}