import { PolygonType, StarVertexTypes, Vector } from '$classes';
import { toDegrees } from '$utils';

export interface PolygonSignatureData {
    type: PolygonType;
    n: number;
    d?: number;
    alpha?: number;
    startsWith?: StarVertexTypes;
    angles?: number[];
    sides?: number[];
}

export class PolygonSignature {
    type: PolygonType;
    n: number;
    sides: number[];
    angles: number[];
    interior_angle: number;
    anchor?: Vector;
    dir?: Vector;
    
    // star polygons
    d?: number;
    alpha?: number;
    beta?: number;
    startsWith?: StarVertexTypes;
    
    name?: string;

    constructor(data: PolygonSignatureData) {
        this.type = data.type;
        this.n = data.n;

        switch(this.type) {
            case PolygonType.REGULAR:
                this.sides = Array(this.n).fill(1);
                this.angles = Array(this.n).fill(Math.PI * (this.n - 2) / this.n);
                this.name = `${this.n}`;
                break
            case PolygonType.STAR_REGULAR:
                this.sides = Array(this.n).fill(1);
                this.d = data.d;
                this.alpha = Math.PI * (1 - 2 * data.d / this.n);
                this.beta = Math.PI * (1 + 2 * (data.d - 1) / this.n);
                this.angles = [this.alpha, this.beta];
                if (data.startsWith === StarVertexTypes.INNER) {
                    this.angles.reverse();
                }
                this.startsWith = data.startsWith;
                this.angles = Array(this.n).fill(this.angles).flat();
                this.name = `{${this.n}.${data.d}${data.startsWith === StarVertexTypes.OUTER ? 'o' : 'i'}}`;
                break;
            case PolygonType.STAR_PARAMETRIC:
                this.sides = Array(this.n).fill(1);
                this.alpha = data.alpha;
                this.beta = 2 * Math.PI * (1 - 1 / this.n) - this.alpha;
                this.angles = [this.alpha, this.beta];
                if (data.startsWith === StarVertexTypes.INNER) {
                    this.angles.reverse();
                }
                this.startsWith = data.startsWith;
                this.angles = Array(this.n).fill(this.angles).flat();
                this.name = `{${this.n}|${toDegrees(data.alpha)}${data.startsWith === StarVertexTypes.OUTER ? 'o' : 'i'}}`;
                break;
            case PolygonType.EQUILATERAL:
                this.sides = Array(this.n).fill(1);
                this.angles = data.angles;
                this.name = `${this.n}(${data.angles.map(a => toDegrees(a)).join(';')})`;
                break;
            case PolygonType.GENERIC:
                this.sides = data.sides;
                this.angles = data.angles;
                this.name = `${this.n}[${this.sides.join(';')}](${this.angles.map(a => toDegrees(a)).join(';')})`;
                break;
        }

        this.interior_angle = this.angles[0];
    }
}