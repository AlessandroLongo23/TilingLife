import { patch, lineWidth } from '$lib/stores/configuration.js';
import { Vector } from '$lib/classes/Vector.svelte.js';
import { get } from 'svelte/store';

export class VertexGroup {
    constructor(shapes, molteplicity) {
        this.shapes = shapes;
        this.molteplicity = molteplicity;
        this.side = 25;
    }

    show(ctx, displayText, scale) {
        let baseAngle = 0;

        ctx.push();
        ctx.translate(-ctx.width / 2 + patch.padding, -ctx.height / 2 + patch.padding);
        ctx.noStroke();
        if (displayText) {
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
        }
        ctx.pop();

        ctx.scale(scale);
        
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / scale);
            ctx.stroke(0, 0, 0);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / scale);
            ctx.stroke(0, 0, 0, lineWidthValue);
        }
        
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

    getCompactNotation() {
        let compactNotation = "";
        let exponent = 1;
        for (let j = 0; j < this.shapes.length; j++) {
            if (j < this.shapes.length && this.shapes[j] === this.shapes[j + 1]) {
                exponent++;
            } else {
                if (exponent > 1) {
                    compactNotation += this.shapes[j] + "^" + exponent + ".";
                } else {
                    compactNotation += this.shapes[j] + ".";
                }
                exponent = 1;
            }
        }
        return compactNotation.slice(0, -1);
    }
}

export class Cr {
    constructor(crString) {
        this.crString = crString;
        this.vertexGroups = this.parseCr(crString);
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

        let vertexGroups = [];
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
                    vertexGroups.push(vertex);
                    vertex = [];
                    sum = 0;
                }
            }
        }

        let uniqueVertexGroups = [];
        for (let vertexGroup of vertexGroups) {
            if (!uniqueVertexGroups.some(v => v.shapes.every((value, index) => value === vertexGroup[index]))) {
                uniqueVertexGroups.push(new VertexGroup(vertexGroup, 1));
            } else {
                uniqueVertexGroups.find(v => v.shapes.every((value, index) => value === vertexGroup[index])).molteplicity++;
            }
        }

        return uniqueVertexGroups;
    }

    getCompactNotation() {
        let compactNotation = "";
        for (let i = 0; i < this.vertexGroups.length; i++) {
            compactNotation += this.vertexGroups[i].getCompactNotation();
            if (i < this.vertexGroups.length - 1) {
                compactNotation += ";";
            }
        }
        return compactNotation;
    }

    show(ctx, vertexIndex, displayText = true, scale = 1) {
        this.vertexGroups[vertexIndex].show(ctx, displayText, scale);
    }

    save(ctx, vertexIndex) {
        let scale = 3;
        const filename = `${this.vertexGroups[vertexIndex].getCompactNotation()}.png`;
        
        const canvasCopy = ctx.createGraphics(patch.size.x * scale, patch.size.y * scale);
        canvasCopy.colorMode(ctx.HSB, 360, 100, 100);
        
        canvasCopy.push();
        canvasCopy.fill(240, 7, 24);
        canvasCopy.noStroke();
        canvasCopy.rect(0, 0, canvasCopy.width, canvasCopy.height);
        canvasCopy.translate(canvasCopy.width / 2, canvasCopy.height / 2);
        
        this.show(canvasCopy, vertexIndex, false, scale);
        canvasCopy.pop();
        
        ctx.saveCanvas(canvasCopy, filename, 'png');
        
        canvasCopy.remove();
    }
}