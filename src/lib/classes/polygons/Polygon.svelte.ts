import { lineWidth, liveChartMode, controls, islamicAngle, isIslamic } from '$stores';
import { isWithinConvexHull, segmentsIntersect, getAngleAtVertex, isWithinTolerance } from '$utils';
import { Vector, Behavior, State } from '$classes';
import { get } from 'svelte/store';
import { tolerance } from '$stores';

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
    sides: number[];
    angles: number[];

    constructor(n: number = 3) {
        this.n = n;
        this.angle = 0;
        this.neighbors = [];
        this.state = State.DEAD;
        this.nextState = State.DEAD;
        this.sides = [];
        this.angles = [];

        this.hue = 0;
        this.alive_neighbors = 0;
    }

    calculateSides = () => {
        this.sides = this.vertices.map((v, index) => Vector.distance(v, this.vertices[(index + 1) % this.vertices.length]));
    }

    calculateAngles = () => {
        this.angles = this.vertices.map(v => getAngleAtVertex(this.vertices, v));
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
    }

    calculateHalfways = () => {
        this.halfways = [];
        for (let i = 0; i < this.vertices.length; i++) {
            this.halfways.push(Vector.midpoint(this.vertices[i], this.vertices[(i + 1) % this.vertices.length]));
        }
    }

    calculateAngle = (): void => {
        this.angle = Vector.sub(this.vertices[0], this.centroid).heading();
    }

    rotate = (origin: Vector, angle: number): Polygon => {
        this.centroid = Vector.add(origin, Vector.sub(this.centroid, origin).rotate(angle));
        this.angle = (this.angle + angle) % (Math.PI * 2);

        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = Vector.add(origin, Vector.sub(this.vertices[i], origin).rotate(angle));
        }
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i] = Vector.add(origin, Vector.sub(this.halfways[i], origin).rotate(angle));
        }

        return this;
    }

    translate = (vector: Vector): Polygon => {
        this.centroid.add(vector);
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = Vector.add(this.vertices[i], vector);
        }
        for (let i = 0; i < this.halfways.length; i++) {
            this.halfways[i] = Vector.add(this.halfways[i], vector);
        }

        return this;
    }

    mirror = (point: Vector, dir: Vector): Polygon => {
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

        return this;
    }

    /**
     * @param point - the point of the reflection
     * @param dir - the direction of the reflection axis
     * @param delta - the amount it translates in the same direction as the reflection axis
     * @returns the polygon after the glide
     * @description A glide is a reflection followed by a translation in the same direction to the reflection axis
     */
    glide = (point: Vector, dir: Vector, delta: number): Polygon => {
        dir = dir.normalize();

        // first apply the reflection
        this.mirror(point, dir);

        // then translate in the same direction as the reflection axis
        this.translate(Vector.scale(dir, delta));

        return this;
    }

    containsPoint = (point: Vector, tol: number = tolerance): boolean => {
        return isWithinConvexHull(this.vertices, point, tol);
    }

    intersects = (other: Polygon, tol: number = tolerance): boolean => {
        if (this.containsPoint(other.centroid, tol)) return true;
        if (other.containsPoint(this.centroid, tol)) return true;

        for (let i = 0; i < this.vertices.length; i++) {
            if (other.containsPoint(this.vertices[i], tol)) return true;
            if (other.containsPoint(this.halfways[i], tol)) return true;
        }

        for (let i = 0; i < other.vertices.length; i++) {
            if (this.containsPoint(other.vertices[i], tol)) return true;
            if (this.containsPoint(other.halfways[i], tol)) return true;
        }

        for (let i = 0; i < this.vertices.length; i++) {
            const p1 = this.vertices[i];
            const p2 = this.vertices[(i + 1) % this.vertices.length];
            for (let j = 0; j < other.vertices.length; j++) {
                const p3 = other.vertices[j];
                const p4 = other.vertices[(j + 1) % other.vertices.length];
                if (segmentsIntersect(p1, p2, p3, p4, tol)) return true;
            }
        }

        return false;
    }

    getAngleAtVertex = (vertex: Vector): number => {
        return getAngleAtVertex(this.vertices, vertex);
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

    getName = (coordinate: Vector | null = null): string => {
        throw new Error('Abstract method called');
    }

    isEquivalent = (other: Polygon, tol: number = tolerance): boolean => {
        if (this.vertices.length !== other.vertices.length) return false;

        if (!isWithinTolerance(this.centroid, other.centroid, tol)) return false;

        for (let vertex of this.vertices) {
            if (!other.vertices.some(v => isWithinTolerance(v, vertex, tol))) return false;
        }
        
        for (let halfway of this.halfways) {
            if (!other.halfways.some(h => isWithinTolerance(h, halfway, tol))) return false;
        }
        return true;
    }

    isTranslated = (other: Polygon, tol: number = tolerance): boolean => {
        const translationVector: Vector = Vector.sub(other.centroid, this.centroid);
        if (translationVector.mag() < tol) return false;
        const translatedPolygon: Polygon = this.clone().translate(translationVector);
        return translatedPolygon.isEquivalent(other, tol);
    }

    clone = (): Polygon => {
        throw new Error('Abstract method called');
    }

    calculateVerticesFromCentroidAndAngle = (): void => {
        throw new Error('Abstract method called');
    }

    encode = (): Object => {
        throw new Error('Abstract method called');
    }
}