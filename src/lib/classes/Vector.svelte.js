export class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
    }
    
    sub(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
    }

    mult(scalar) {
        this.x *= scalar;
        this.y *= scalar;
    }

    div(scalar) {
        this.x /= scalar;
        this.y /= scalar;
    }

    mag() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    normalize() {
        let mag = this.mag();
        this.x /= mag;
        this.y /= mag;
    }

    setHeading(heading) {
        let mag = this.mag();
        this.x = Math.cos(heading) * mag;
        this.y = Math.sin(heading) * mag;
    }

    heading() {
        return Math.atan2(this.y, this.x);
    }

    rotate(angle) {
        let newX = this.x * Math.cos(angle) - this.y * Math.sin(angle);
        let newY = this.x * Math.sin(angle) + this.y * Math.cos(angle);
        this.x = newX;
        this.y = newY;
    }
}
