import { Polygon, RegularPolygon, StarRegularPolygon, StarParametricPolygon, PolygonCategory, type GeneratorParameters, VertexConfiguration } from '$classes';

const toDegrees = (radians: number): number => {
    let degrees = radians * 180 / Math.PI;
    degrees = Math.round(degrees * 10000) / 10000;
    return degrees;
}

export class VCGenerator {
    availablePolygons: Polygon[] = [];
    vertexConfigurations: VertexConfiguration[] = [];
    tolerance: number;

    constructor(parameters: GeneratorParameters) {
        this.tolerance = 1e-6;
        this.availablePolygons = [];
        if (parameters.categories.includes(PolygonCategory.REGULAR)) {
            for (let n = 3; n <= parameters.n_max; n++) {
                this.availablePolygons.push(new RegularPolygon(n));
            }
        }

        if (parameters.categories.includes(PolygonCategory.STAR_REGULAR)) {
            for (let n = 3; n <= parameters.n_max; n++) {
                for (let d = 2; d <= Math.floor(n / 2); d++) {
                    let a = Math.PI * (1 - 2 * d / n)
                    let b = Math.PI * (1 + 2 * (d - 1) / n)
                    if (this.isMultiple(a, parameters.angle) && this.isMultiple(b, parameters.angle)) {
                        this.availablePolygons.push(new StarRegularPolygon(n, d));
                    }
                }
            }
        }

        if (parameters.categories.includes(PolygonCategory.STAR_PARAMETRIC)) {
            for (let n = 3; n <= parameters.n_max; n++) {
                let alpha = parameters.angle
                let max_alpha = Math.PI * (n - 2) / n
                while (alpha < max_alpha) {
                    let b = 2 * Math.PI * (1 - 1 / n) - alpha
                    if (this.isMultiple(b, parameters.angle)) {
                        this.availablePolygons.push(new StarParametricPolygon(n, alpha));
                    }
                    alpha += parameters.angle
                }
            }
        }
    }

    isMultiple = (value: number, divisor: number): boolean => {
        let rem = value % divisor;
        return Math.abs(rem) < this.tolerance || Math.abs(rem - divisor) < this.tolerance;
    }

    generateVertexConfigurations = (): VertexConfiguration[] => {
        this.vertexConfigurations = [];

        let root = new VCNode(null, [], 0);
        let stack: VCNode[] = [root];
        while (stack.length > 0) {
            let current: VCNode = stack.pop() as VCNode;
            if (toDegrees(current.angle) < 360) {
                for (let polygon of this.availablePolygons) {
                    let newNode = current.clone();
                    newNode.addPolygon(polygon);
                    newNode.angle += polygon.angle;
                    stack.push(newNode);
                }
            } else if (toDegrees(current.angle) === 360) {
                this.vertexConfigurations.push(new VertexConfiguration(current.polygons, current.angle));
            }
        }

        return this.vertexConfigurations;
    }
}

export class VCNode {
    parent: VCNode | null;
    children: VCNode[];
    polygons: Polygon[];
    angle: number;

    constructor(parent: VCNode | null, polygons: Polygon[], angle: number) {
        this.parent = parent;
        this.children = [];
        this.polygons = polygons;
        this.angle = angle;
    }

    addPolygon = (polygon: Polygon) => {
        this.polygons.push(polygon);
        this.angle += polygon.angle;
    }

    clone = (): VCNode => {
        return new VCNode(this.parent, [...this.polygons], this.angle);
    }
}