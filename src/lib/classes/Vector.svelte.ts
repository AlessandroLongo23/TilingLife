import { tolerance } from "$stores/constants";

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
        const vector = v.copy();
        vector.mirrorByPointAndDir(point.copy(), dir.copy());
        return vector;
    }

    mirrorByPointAndDir(point: Vector, dir: Vector): void {
        const pointVector = Vector.sub(this, point);
        const dirMagSq = dir.dot(dir); 
        const scalar = pointVector.dot(dir) / dirMagSq;
        const projection = Vector.scale(dir, scalar);
        const perpendicular = Vector.sub(pointVector, projection);

        this.set(Vector.sub(Vector.add(point, projection), perpendicular));
    }
    
    static rotate(v: Vector, angle: number): Vector {
        return v.copy().rotate(angle);
    }

    rotate(angle: number): Vector {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;

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

    snapToGrid(): void {
        if (Math.abs(this.x) < tolerance)
            this.x = 0;

        if (Math.abs(this.y) < tolerance)
            this.y = 0;
    }

    encode = (): Object => {
        return {
            x: this.x,
            y: this.y,
        };
    }
}