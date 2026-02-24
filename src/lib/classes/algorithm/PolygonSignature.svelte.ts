import { PolygonType, StarVertexTypes } from '$classes';
import { toDegrees } from '$utils';

export interface PolygonSignatureData {
    d?: number;
    alpha?: number;
    startsWith?: StarVertexTypes;
    sides?: number[];
    angles?: number[];
}

export class PolygonSignature {
    type: PolygonType;
    name: string;
    n: number;
    sides: number[];
    angles: number[];
    interior_angle: number;

    // star polygons
    d?: number;
    alpha?: number;
    beta?: number;
    startsWith?: StarVertexTypes;

    constructor(type: PolygonType, n: number, data: PolygonSignatureData = {}) {
        this.type = type;
        this.n = n;

        switch(type) {
            case PolygonType.REGULAR:
                this.sides = Array(n).fill(1);
                this.angles = Array(n).fill(Math.PI * (n - 2) / n);
                this.name = `${n}`;
                break
            case PolygonType.STAR_REGULAR:
                this.sides = Array(n).fill(1);
                this.d = data.d;
                this.alpha = Math.PI * (1 - 2 * data.d / n);
                this.beta = Math.PI * (1 + 2 * (data.d - 1) / n);
                this.angles = [this.alpha, this.beta];
                if (data.startsWith === StarVertexTypes.INNER) {
                    this.angles.reverse();
                }
                this.startsWith = data.startsWith;
                this.angles = Array(n).fill(this.angles).flat();
                this.name = `{${n}.${data.d}${data.startsWith === StarVertexTypes.OUTER ? 'o' : 'i'}}`;
                break;
            case PolygonType.STAR_PARAMETRIC:
                this.sides = Array(n).fill(1);
                this.alpha = data.alpha;
                this.beta = 2 * Math.PI * (1 - 1 / n) - this.alpha;
                this.angles = [this.alpha, this.beta];
                if (data.startsWith === StarVertexTypes.INNER) {
                    this.angles.reverse();
                }
                this.startsWith = data.startsWith;
                this.angles = Array(n).fill(this.angles).flat();
                this.name = `{${n}|${toDegrees(data.alpha)}${data.startsWith === StarVertexTypes.OUTER ? 'o' : 'i'}}`;
                break;
            case PolygonType.EQUILATERAL:
                this.sides = Array(n).fill(1);
                this.angles = data.angles;
                this.name = `${n}(${data.angles.map(a => toDegrees(a)).join(';')})`;
                break;
            case PolygonType.GENERIC:
                this.sides = data.sides;
                this.angles = data.angles;
                this.name = `${n}[${data.sides.join(';')}](${data.angles.map(a => toDegrees(a)).join(';')})`;
                break;
        }

        this.interior_angle = this.angles[0];
    }
}