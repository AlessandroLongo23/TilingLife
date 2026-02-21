import { PolygonCategory, type GeneratorParameters, PolygonType, StarRegularVertexTypes } from '$classes';
import { PolygonSignature } from './PolygonSignature.svelte';
import { tolerance } from '$stores';

export class PolygonsGenerator {
    polygons: PolygonSignature[] = [];

    constructor(parameters: GeneratorParameters) {
        this.polygons = [];

        if (parameters.categories.includes(PolygonCategory.REGULAR)) {
            for (let n = 3; n <= parameters.n_max; n++) {
                this.polygons.push(new PolygonSignature(PolygonType.REGULAR, n));
            }
        }

        if (parameters.categories.includes(PolygonCategory.STAR_REGULAR)) {
            for (let n = 3; n <= parameters.n_max; n++) {
                for (let d = 2; d < Math.floor(n / 2); d++) {
                    let a = Math.PI * (1 - 2 * d / n)
                    let b = Math.PI * (1 + 2 * (d - 1) / n)
                    if (this.isMultiple(a, parameters.angle) && this.isMultiple(b, parameters.angle)) {
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_REGULAR, n, {d: d, startsWith: StarRegularVertexTypes.OUTER}));
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_REGULAR, n, {d: d, startsWith: StarRegularVertexTypes.INNER}));
                    }
                }
            }
        }

        if (parameters.categories.includes(PolygonCategory.STAR_PARAMETRIC)) {
            for (let n = 3; n <= parameters.n_max; n++) {
                let alpha = parameters.angle
                let max_alpha = Math.PI * (n - 2) / n
                while (alpha < max_alpha - tolerance) {
                    let d = n / 2 * (1 - alpha / Math.PI)
                    if (this.isMultiple(d, 1)) {
                        alpha += parameters.angle
                        continue;
                    }

                    let b = 2 * Math.PI * (1 - 1 / n) - alpha
                    if (this.isMultiple(b, parameters.angle)) {
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_PARAMETRIC, n, {alpha: alpha, startsWith: StarRegularVertexTypes.OUTER}));
                        this.polygons.push(new PolygonSignature(PolygonType.STAR_PARAMETRIC, n, {alpha: alpha, startsWith: StarRegularVertexTypes.INNER}));
                    }
                    alpha += parameters.angle
                }
            }
        }
    }

    isMultiple = (value: number, divisor: number): boolean => {
        let rem = value % divisor;
        return Math.abs(rem) < tolerance || Math.abs(rem - divisor) < tolerance;
    }
}