import { PolygonType, StarRegularVertexTypes } from '$classes';
import { toDegrees } from '$utils';

export interface PolygonSignatureData {
    d?: number;
    alpha?: number;
    startsWith?: StarRegularVertexTypes;
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
    startsWith?: StarRegularVertexTypes;

    constructor(type: PolygonType, n: number, data: PolygonSignatureData = {}) {
        this.type = type;
        this.n = n;

        if (type === PolygonType.REGULAR) {
            this.sides = Array(n).fill(1);
            this.angles = Array(n).fill(Math.PI * (n - 2) / n);
            this.name = `${n}`;
        } else if (type === PolygonType.STAR_REGULAR) {
            this.sides = Array(n).fill(1);
            this.d = data.d;
            this.alpha = Math.PI * (1 - 2 * data.d / n);
            this.beta = Math.PI * (1 + 2 * (data.d - 1) / n);
            let angles = [this.alpha, this.beta];
            if (data.startsWith === StarRegularVertexTypes.INNER) {
                angles.reverse();
            }
            this.startsWith = data.startsWith;
            this.angles = Array(n).fill(angles).flat();
            this.name = `{${n}.${data.d}${data.startsWith === StarRegularVertexTypes.OUTER ? 'o' : 'i'}}`;
        } else if (type === PolygonType.STAR_PARAMETRIC) {
            this.sides = Array(n).fill(1);
            this.alpha = data.alpha;
            this.beta = 2 * Math.PI * (1 - 1 / n) - this.alpha;
            let angles = [this.alpha, this.beta];
            if (data.startsWith === StarRegularVertexTypes.INNER) {
                angles.reverse();
            }
            this.startsWith = data.startsWith;
            this.angles = Array(n).fill(angles).flat();
            this.name = `{${n}|${toDegrees(data.alpha)}${data.startsWith === StarRegularVertexTypes.OUTER ? 'o' : 'i'}}`;
        }
        this.interior_angle = this.angles[0];
    }
}