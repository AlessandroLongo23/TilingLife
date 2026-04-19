import { lineWidth, liveChartMode, controls, islamicAngle, islamicAnimate, isIslamic } from '$stores';
import { isWithinConvexHull, segmentsIntersect, getAngleAtVertex, isWithinTolerance, islamicAnglesForHalfways, findIntersection } from '$utils';
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
        // After reversing vertices, halfway_i must remain midpoint(vertex_i, vertex_{i+1}).
        // Reverse alone leaves it as midpoint(vertex_{i-1}, vertex_i); shift by 1 to fix.
        this.halfways.push(this.halfways.shift()!);

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
            this.showIslamicFilled(ctx, opacity, customColor);
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

    calculateIslamicTips = (angle: number | number[]): { forward: Vector[]; backward: Vector[] } => {
        const n = this.halfways.length;

        const normals: Vector[] = [];
        for (let i = 0; i < n; i++) {
            const edge = Vector.sub(this.vertices[(i + 1) % n], this.vertices[i]);
            normals.push(Vector.rotate(edge, Math.PI / 2).normalize());
        }

        const angleAt = (i: number) => Array.isArray(angle) ? angle[i] : angle;

        const forwardDir: Vector[] = [];
        const backwardDir: Vector[] = [];
        for (let i = 0; i < n; i++) {
            forwardDir.push(Vector.rotate(normals[i], -angleAt(i) / 2));
            backwardDir.push(Vector.rotate(normals[i], angleAt(i) / 2));
        }

        const rayHit = (p: Vector, dir: Vector, p2: Vector, d2: Vector): { hit: Vector; t: number } | null => {
            const hit = findIntersection(p, dir, p2, d2);
            if (!hit) return null;
            const t = (hit.x - p.x) * dir.x + (hit.y - p.y) * dir.y;
            const s = (hit.x - p2.x) * d2.x + (hit.y - p2.y) * d2.y;
            return t > 0 && s > 0 ? { hit, t } : null;
        };

        // Classic pairing (forward[i] × backward[i+1], symmetric for backward) always
        // converges at convex vertices. At reflex vertices the rays meet behind both
        // halfways and rayHit rejects the hit. Try the other three adjacent-neighbor
        // pairings and pick the nearest positive-t valid intersection as a recovery.
        const nearestTip = (p: Vector, dir: Vector, primary: [Vector, Vector], alts: [Vector, Vector][]): Vector => {
            const classic = rayHit(p, dir, primary[0], primary[1]);
            if (classic) return classic.hit;
            let best: { hit: Vector; t: number } | null = null;
            for (const [p2, d2] of alts) {
                const r = rayHit(p, dir, p2, d2);
                if (r && (!best || r.t < best.t)) best = r;
            }
            if (best) return best.hit;
            // Primary failed and no alternate worked — rays parallel (static aligned
            // angle) or diverging (per-halfway animated angles mismatched). Collapse
            // tip to the midpoint of the primary halfways so the strap draws straight.
            return new Vector((p.x + primary[0].x) / 2, (p.y + primary[0].y) / 2);
        };

        const forward: Vector[] = [];
        const backward: Vector[] = [];
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const k = (i - 1 + n) % n;
            forward.push(nearestTip(
                this.halfways[i], forwardDir[i],
                [this.halfways[j], backwardDir[j]],
                [
                    [this.halfways[j], forwardDir[j]],
                    [this.halfways[k], backwardDir[k]],
                    [this.halfways[k], forwardDir[k]],
                ],
            ));
            backward.push(nearestTip(
                this.halfways[i], backwardDir[i],
                [this.halfways[k], forwardDir[k]],
                [
                    [this.halfways[k], backwardDir[k]],
                    [this.halfways[j], forwardDir[j]],
                    [this.halfways[j], backwardDir[j]],
                ],
            ));
        }
        return { forward, backward };
    }

    showIslamicFilled = (ctx, opacity: number = 0.80, customColor: number | null = null) => {
        const baseAngle = get(islamicAngle) * Math.PI / 180;
        let angle: number | number[] = baseAngle;
        if (get(islamicAnimate)) {
            angle = islamicAnglesForHalfways(ctx, this.halfways);
        }
        const { forward, backward } = this.calculateIslamicTips(angle);
        const n = this.halfways.length;

        ctx.push();
        ctx.noStroke();
        ctx.fill(customColor ?? this.hue, 40, 100 / opacity, 0.80 * opacity);
        ctx.beginShape();
        for (let i = 0; i < n; i++) {
            ctx.vertex(this.halfways[i].x, this.halfways[i].y);
            ctx.vertex(forward[i].x, forward[i].y);
            ctx.vertex(backward[(i + 1) % n].x, backward[(i + 1) % n].y);
        }
        ctx.endShape(ctx.CLOSE);
        ctx.pop();

        ctx.noFill();
        ctx.strokeWeight(get(lineWidth) / get(controls).zoom);
        ctx.stroke(0, 0, 0);
        for (let i = 0; i < n; i++) {
            const h = this.halfways[i];
            ctx.line(h.x, h.y, forward[i].x, forward[i].y);
            ctx.line(h.x, h.y, backward[i].x, backward[i].y);
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