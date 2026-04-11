import { tolerance } from "$lib/stores/constants";

export class Vector {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    static fromAngle(angle: number): Vector {
        return new Vector(Math.cos(angle), Math.sin(angle));
    }

    static fromPolar(mag: number, angle: number): Vector {
        return new Vector(mag * Math.cos(angle), mag * Math.sin(angle));
    }

    static midpoint(v1: Vector, v2: Vector): Vector {
        return new Vector((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
    }

    copy(): Vector {
        return new Vector(this.x, this.y);
    }

    static add(v1: Vector, v2: Vector): Vector {
        return new Vector(v1.x + v2.x, v1.y + v2.y);
    }
    
    add(other: Vector): Vector {
        this.x += other.x;
        this.y += other.y;

        return this.copy();
    }

    static sub(v1: Vector, v2: Vector): Vector {
        return new Vector(v1.x - v2.x, v1.y - v2.y);
    }
    
    sub(other: Vector): Vector {
        this.x -= other.x;
        this.y -= other.y;

        return this.copy();
    }

    static mult(v1: Vector, v2: Vector): Vector {
        return new Vector(v1.x * v2.x, v1.y * v2.y);
    }

    mult(other: Vector): Vector {
        this.x *= other.x;
        this.y *= other.y;

        return this.copy();
    }

    static scale(v: Vector, scalar: number): Vector {
        return new Vector(v.x * scalar, v.y * scalar);
    }

    scale(scalar: number): Vector {
        this.x *= scalar;
        this.y *= scalar;

        return this.copy();
    }

    set(x: number | Vector | null, y: number | null = null): Vector {
        if (x instanceof Vector) {
            const other = x;
            this.x = other.x;
            this.y = other.y;
        } else {
            this.x = x ?? 0;
            this.y = y ?? 0;
        }

        return this.copy();
    }

    mag(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    setMag(mag: number): Vector {
        this.scale(mag / this.mag());

        return this.copy();
    }

    dot(other: Vector): number {
        return this.x * other.x + this.y * other.y;
    }

    normalize(): Vector {
        this.scale(1 / this.mag());

        return this.copy();
    }

    setHeading(heading: number): Vector {
        this.set(Vector.fromAngle(heading).scale(this.mag()));

        return this.copy();
    }

    heading(): number {
        return Math.atan2(this.y, this.x);
    }

    static linearCombination(a: number, v1: Vector, b: number, v2: Vector): Vector {
        return new Vector(a * v1.x + b * v2.x, a * v1.y + b * v2.y);
    }

    mirror(angle: number): Vector {
        const dir = Vector.fromAngle(angle);
        const dotProduct = this.dot(dir);

        this.x = 2 * dotProduct * dir.x - this.x;
        this.y = 2 * dotProduct * dir.y - this.y;

        return this.copy();
    }

    static mirrorByPointAndDir(v: Vector, point: Vector, dir: Vector): Vector {
        const vector: Vector = v.copy();
        vector.mirrorByPointAndDir(point.copy(), dir.copy());
        return vector;
    }

    mirrorByPointAndDir(point: Vector, dir: Vector): void {
        const pointVector: Vector = Vector.sub(this, point);
        const dirMagSq: number = dir.dot(dir); 
        const scalar: number = pointVector.dot(dir) / dirMagSq;
        const projection: Vector = Vector.scale(dir, scalar);
        const perpendicular: Vector = Vector.sub(pointVector, projection);

        this.set(Vector.sub(Vector.add(point, projection), perpendicular));
    }
    
    static rotate(v: Vector, angle: number): Vector {
        return v.copy().rotate(angle);
    }

    rotate(angle: number): Vector {
        const cos: number = Math.cos(angle);
        const sin: number = Math.sin(angle);
        const newX: number = this.x * cos - this.y * sin;
        const newY: number = this.x * sin + this.y * cos;

        this.x = newX;
        this.y = newY;

        return this.copy();
    }

    static rotateAround(v: Vector, origin: Vector, angle: number): Vector {
        return v.copy().rotateAround(origin, angle);
    }

    rotateAround(origin: Vector, angle: number): Vector {
        return Vector.add(origin, Vector.sub(this, origin).rotate(angle));
    }

    distance(other: Vector): number {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }

    static distance(v1: Vector, v2: Vector): number {
        return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
    }

    static cross(v1: Vector, v2: Vector): number {
        return v1.x * v2.y - v1.y * v2.x;
    }

    static angleBetween(v1: Vector, v2: Vector): number {
        return Math.atan2(v2.y - v1.y, v2.x - v1.x);
    }

    /**
     * Checks if this vector is parallel to another vector
     * @param other 
     * @returns True if the vectors are parallel, false otherwise.
     */
    isParallelTo(other: Vector): boolean {
        return Math.abs(Vector.cross(this, other)) < tolerance;
    }

    /**
     * Checks if a given point belongs to a line.
     * @param point - The point to check.
     * @param line - The line to check (axis and point of the line)
     * @returns True if the point belongs to the line, false otherwise.
     */
    static belongsToLine(point: Vector, line: { axis: Vector, point: Vector }): boolean {
        // Vector from line start to point: (px - x0, py - y0)
        const dx1: number = point.x - line.point.x;
        const dy1: number = point.y - line.point.y;
    
        // Line direction vector: (dx2, dy2)
        const dx2: number = line.axis.x;
        const dy2: number = line.axis.y;
    
        // 2D Cross Product (Determinant): x1*y2 - y1*x2
        // If this is 0, the vectors are collinear.
        const crossProduct2D: number = dx1 * dy2 - dy1 * dx2;
    
        return Math.abs(crossProduct2D) < tolerance;
    }

    encode = (): { x: number, y: number } => {
        return {
            x: this.x,
            y: this.y,
        };
    }
}