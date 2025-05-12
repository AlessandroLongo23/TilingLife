import { tolerance, lineWidth, colorParams, liveChartMode, controls } from '$lib/stores/configuration.js';
import { Vector } from '$lib/classes/Vector.svelte.js';
import { map } from '$lib/utils/math.svelte.js';
import { get } from 'svelte/store';

const PHI = (1 + Math.sqrt(5)) / 2;

export class Polygon {
    constructor(data) {
        this.centroid = data.centroid;
        this.n = data.n;
        this.angle = data.angle;
        
        this.neighbors = [];
        this.state = 0;
        this.nextState = 0;

        this.calculateCentroid();
        this.calculateVertices();
        this.calculateHalfways();
    }

    containsPoint = (point) => {
        let inside = false;
        
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x + get(controls).offset.x / get(controls).zoom;
            const yi = this.vertices[i].y - get(controls).offset.y / get(controls).zoom;
            const xj = this.vertices[j].x + get(controls).offset.x / get(controls).zoom;
            const yj = this.vertices[j].y - get(controls).offset.y / get(controls).zoom;
            
            const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            
            if (intersect) 
                inside = !inside;
        }
        
        return inside;
    }

    show = (ctx, showPolygonPoints, customColor = null, opacity = 0.80) => {
        if (this.centroid.x < -ctx.width / 2 - 10 || this.centroid.y < -ctx.height / 2 - 10 || this.centroid.x > ctx.width / 2 + 10 || this.centroid.y > ctx.height / 2 + 10)
            return;

        ctx.push();

        this.calculateHue();
        
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0, opacity);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue * opacity); // Use lineWidth as opacity
        }

        ctx.fill(customColor || this.hue, 40, 100 / opacity, 0.80 * opacity);
        ctx.beginShape();
        for (let i = 0; i < this.vertices.length; i++) {
            ctx.vertex(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.endShape(ctx.CLOSE);
        
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

    showGameOfLife = (ctx, ruleType, parsedGolRule, rules) => {
        ctx.push();
        
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue); // Use lineWidth as opacity
        }
        
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
            if (this.behavior === 'decreasing') {
                ctx.fill(0, 0, 100);
            } else if (this.behavior === 'increasing') {
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

    calculateCentroid = () => {
        if (Math.abs(this.centroid.x) < tolerance)
            this.centroid.x = 0;

        if (Math.abs(this.centroid.y) < tolerance)
            this.centroid.y = 0;
    }

    calculateVertices = () => {
        this.vertices = [];
        let radius = 0.5 / Math.sin(Math.PI / this.n);
        for (let i = 0; i < this.n; i++) {
            this.vertices.push(new Vector(
                this.centroid.x + radius * Math.cos(i * 2 * Math.PI / this.n + this.angle),
                this.centroid.y + radius * Math.sin(i * 2 * Math.PI / this.n + this.angle)
            ));

            if (Math.abs(this.vertices[i].x) < tolerance)
                this.vertices[i].x = 0;

            if (Math.abs(this.vertices[i].y) < tolerance)
                this.vertices[i].y = 0;
        }
    }

    calculateHalfways = () => {
        this.halfways = [];
        for (let i = 0; i < this.n; i++) {
            this.halfways.push(Vector.midpoint(this.vertices[i], this.vertices[(i + 1) % this.n]));

            if (Math.abs(this.halfways[i].x) < tolerance)
                this.halfways[i].x = 0;

            if (Math.abs(this.halfways[i].y) < tolerance)
                this.halfways[i].y = 0;
        }
    }
}

export class RegularPolygon extends Polygon {
    constructor(data) {
        super(data);

        this.calculateHue();
    }

    calculateHue = () => {
        this.hue = map(Math.log(this.vertices.length), Math.log(3), Math.log(40), 0, 300);
    }

    clone = () => {
        return new RegularPolygon({
            centroid: this.centroid.copy(),
            n: this.n,
            angle: this.angle
        });
    }
}

export class DualPolygon extends Polygon {
    constructor(data) {
        super({
            centroid: data.centroid,
            n: 3,
            angle: 0
        });
        this.vertices = data.vertices;
        this.halfways = data.halfways;

        this.calculateHue();
    }

    calculateHue = () => {
        this.hue = this.calculateAnglesHash();
    }

    calculateAnglesHash() {
        let angles = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const prev = (i === 0) ? this.vertices.length - 1 : i - 1;
            const curr = i;
            const next = (i === this.vertices.length - 1) ? 0 : i + 1;
            
            const v1 = Vector.sub(this.vertices[prev], this.vertices[curr]);
            const v2 = Vector.sub(this.vertices[next], this.vertices[curr]);
            
            const mag1 = v1.mag();
            const mag2 = v2.mag();
            const dot = v1.dot(v2);
            
            const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
            angles.push(Math.round(angle)); 
        }

        let minRotation = [...angles]; 
        
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < angles.length; i++) {
                const rotation = [...angles.slice(i), ...angles.slice(0, i)];
                
                let isSmaller = false;
                for (let j = 0; j < angles.length; j++) {
                    if (rotation[j] < minRotation[j]) {
                        isSmaller = true;
                        break;
                    } else if (rotation[j] > minRotation[j]) {
                        break;
                    }
                }
                
                if (isSmaller)
                    minRotation = [...rotation];
            }

            angles = angles.reverse();
        }

        const params = get(colorParams);
        const a = params.a;
        const b = params.b;
        
        let hash = 0;
        for (let i = 0; i < minRotation.length; i++)
            hash = (hash * PHI + minRotation[i] * Math.sqrt(2)) % 1447;
        
        const baseHue = hash % 360;
        const rotatedHue = (baseHue + a) % 360;
        const displacedHue = rotatedHue + b * Math.sin(rotatedHue * Math.PI / 180);
        
        return (displacedHue + 360) % 360;
    }

    clone = () => {
        return new DualPolygon({
            centroid: this.centroid.copy(),
            vertices: [...this.vertices],
            halfways: [...this.halfways]
        });
    }
}

export class StarPolygon extends Polygon {
    constructor(data) {
        super({
            centroid: data.centroid,
            n: data.n,
            angle: data.angle
        });

        this.alfa = data.alfa;
        this.calculateVertices();
        this.calculateHalfways();
        this.calculateHue();
    }

    calculateVertices = () => {
        this.vertices = [];
        let gamma = Math.PI * (this.n - 2) / (2 * this.n);
        let alfa = this.alfa / 2;
        let beta = gamma - alfa;

        let radius = Math.cos(beta) / Math.cos(gamma);
        let intRadius = Math.tan(gamma) * Math.cos(beta) - Math.sin(beta);
        for (let i = 0; i < this.n; i++) {
            this.vertices.push(new Vector(
                this.centroid.x + radius * Math.cos(i * 2 * Math.PI / this.n + this.angle + Math.PI),
                this.centroid.y + radius * Math.sin(i * 2 * Math.PI / this.n + this.angle + Math.PI)
            ));

            this.vertices.push(new Vector(
                this.centroid.x + intRadius * Math.cos((i + .5) * 2 * Math.PI / this.n + this.angle + Math.PI),
                this.centroid.y + intRadius * Math.sin((i + .5) * 2 * Math.PI / this.n + this.angle + Math.PI)
            ));

            if (Math.abs(this.vertices[i].x) < tolerance)
                this.vertices[i].x = 0;

            if (Math.abs(this.vertices[i].y) < tolerance)
                this.vertices[i].y = 0;
        }
    }

    calculateHalfways = () => {
        this.halfways = [];
        for (let i = 0; i < this.vertices.length; i++) {
            this.halfways.push(Vector.midpoint(this.vertices[i], this.vertices[(i + 1) % this.vertices.length]));
        }
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    clone = () => {
        return new StarPolygon({
            centroid: this.centroid.copy(),
            n: this.n,
            angle: this.angle,
            alfa: this.alfa
        });
    }
}