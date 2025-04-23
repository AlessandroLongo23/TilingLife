import { patch } from '$lib/stores/configuration.js';

export class Cr {
    constructor(crString) {
        this.crString = crString;
        this.vertices = this.parseCr(crString);
        this.side = 25
    }

    parseCr(crString) {
        crString = crString.trim().split('_')[0];

        let pieces;
        if (crString.includes('[')) {
            pieces = crString.slice(1, -1).split(';');
        } else {
            pieces = [crString];
        }

        let vertices = [];
        for (let i = 0; i < pieces.length; i++) {
            vertices[i] = [];
            let rule = pieces[i].split('.');
            for (let j = 0; j < rule.length; j++) {
                let [base, exponent] = rule[j].split('^');
                base = parseInt(base);
                exponent = exponent ? parseInt(exponent) : 1;

                for (let j = 0; j < exponent; j++) {
                    vertices[i].push(base);
                }
            }
        }

        return vertices;
    }

    draw(context, vertexIndex, ctx) {
        let baseAngle = 0;

        context.push();
        context.translate(-context.width / 2 + patch.padding, -context.height / 2 + patch.padding);
        context.noStroke();
        context.textAlign(ctx.LEFT, ctx.TOP);
        context.textSize(16);
        context.fill(0, 0, 100);
        context.text(this.vertices[vertexIndex].join('.'), 0, 0);
        context.pop();

        context.stroke(0, 0, 0);
        for (let shapeSides of this.vertices[vertexIndex]) {
            let beta = 2 * Math.PI / shapeSides;
            let radius = this.side / 2 / Math.sin(beta / 2);
            
            let alpha = (shapeSides - 2) / shapeSides * Math.PI;
            let center = {
                x: radius * Math.cos(baseAngle + alpha / 2),
                y: radius * Math.sin(baseAngle + alpha / 2)
            };

            context.fill(context.map(shapeSides, 3, 12, 0, 300), 40, 100, 0.80);
            context.beginShape();
            for (let angle = 0; angle < 2 * Math.PI; angle += beta) {
                context.vertex(
                    center.x + radius * Math.cos(baseAngle + alpha / 2 - Math.PI + angle),
                    center.y + radius * Math.sin(baseAngle + alpha / 2 - Math.PI + angle)
                );
            }
            context.endShape(context.CLOSE);

            baseAngle += alpha;
        }
    }
}