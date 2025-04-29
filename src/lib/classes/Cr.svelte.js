import { patch } from '$lib/stores/configuration.js';
import { Vector } from '$lib/classes/Vector.svelte.js';

export class CrVertex {
    constructor(shapes, molteplicity) {
        this.shapes = shapes;
        this.molteplicity = molteplicity;
        this.side = 25;
    }

    draw(ctx) {
        let baseAngle = 0;

        ctx.push();
        ctx.translate(-ctx.width / 2 + patch.padding, -ctx.height / 2 + patch.padding);
        ctx.noStroke();
        ctx.textAlign(ctx.LEFT, ctx.TOP);
        ctx.textSize(16);
        ctx.fill(0, 0, 100);
        ctx.text(this.shapes.join('.'), 0, 0);
        if (this.molteplicity > 1) {
            ctx.fill(0, 0, 15);
            ctx.ellipse(ctx.width - 36, 7, 24);
            ctx.fill(0, 0, 100);
            ctx.text(this.molteplicity, ctx.width - 40, 0);
        }
        ctx.pop();

        ctx.stroke(0, 0, 0);
        for (let shapeSides of this.shapes) {
            let beta = 2 * Math.PI / shapeSides;
            let radius = this.side / 2 / Math.sin(beta / 2);
            
            let alpha = (shapeSides - 2) / shapeSides * Math.PI;
            let center = new Vector(
                radius * Math.cos(baseAngle + alpha / 2),
                radius * Math.sin(baseAngle + alpha / 2)
            );

            ctx.fill(ctx.map(shapeSides, 3, 12, 0, 300), 40, 100, 0.80);
            ctx.beginShape();
            for (let angle = 0; angle < 2 * Math.PI; angle += beta) {
                ctx.vertex(
                    center.x + radius * Math.cos(baseAngle + alpha / 2 - Math.PI + angle),
                    center.y + radius * Math.sin(baseAngle + alpha / 2 - Math.PI + angle)
                );
            }
            ctx.endShape(ctx.CLOSE);

            baseAngle += alpha;
        }
    }
}

export class Cr {
    constructor(crString) {
        this.crString = crString;
        this.vertices = this.parseCr(crString);
    }

    parseCr(crString) {
        crString = crString.trim().split('_')[0];

        let pieces;
        if (crString.includes(';')) {
            if (crString.startsWith('[')) {
                crString = crString.slice(1);
            }
            if (crString.includes(']')) {
                crString = crString.slice(0, -1);
            }
            pieces = crString.split(';');
        } else {
            pieces = [crString];
        }

        let vertices = [];
        for (let i = 0; i < pieces.length; i++) {
            let base = pieces[i];
            let exponent = 1;
            if (pieces[i].includes('(') && pieces[i].includes(')')) {
                base = pieces[i].split(')')[0].slice(1);
                exponent = parseInt(pieces[i].split(')')[1].slice(1));
            }

            let rule = base.split('.');
            let sum = 0;
            let vertex = [];
            for (let k = 0; k < exponent; k++) {
                for (let j = 0; j < rule.length; j++) {
                    let [base, exponent] = rule[j].split('^');
                    base = parseInt(base);
                    exponent = exponent ? parseInt(exponent) : 1;
                    let innerAngle = Math.PI * (base - 2) / base;
                    
                    for (let l = 0; l < exponent; l++) {
                        vertex.push(base);
                        sum += innerAngle;
                    }
                }

                if (Math.abs(sum - 2 * Math.PI) < 0.01) {
                    vertices.push(vertex);
                    vertex = [];
                    sum = 0;
                }
            }
        }

        let uniqueVertices = [];
        for (let vertex of vertices) {
            if (!uniqueVertices.some(v => v.shapes.every((value, index) => value === vertex[index]))) {
                uniqueVertices.push(new CrVertex(vertex, 1));
            } else {
                uniqueVertices.find(v => v.shapes.every((value, index) => value === vertex[index])).molteplicity++;
            }
        }

        return uniqueVertices;
    }

    draw(ctx, vertexIndex) {
        this.vertices[vertexIndex].draw(ctx);
    }
}