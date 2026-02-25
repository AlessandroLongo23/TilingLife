import { GenericPolygon, Vector } from '$classes';
import { isWithinTolerance, map, toDegrees } from '$utils';

export class EquilateralPolygon extends GenericPolygon {
    constructor(n: number) {
        super(n);
    }

    static fromAnchorAndDir = (n: number, anchor: Vector, dir: Vector, angles: number[]): EquilateralPolygon => {
        const polygon: EquilateralPolygon = new EquilateralPolygon(n);

        polygon.sides = Array(n).fill(1);
        polygon.angles = angles;
        polygon.name = `${n}(${angles.map(a => toDegrees(a)).join(';')})`;
        polygon.anchor = anchor;
        polygon.dir = dir.copy();
        polygon.interior_angle = angles[0];

        polygon.calculateVerticesFromAnchorAndDir();
        polygon.calculateHalfways();
        polygon.calculateCentroid();
        polygon.calculateAngle();
        polygon.calculateHue();

        return polygon;
    }

    calculateHue = () => {
        this.hue = map(this.vertices.length / 2, 3, 12, 300, 0) + 300 / 12;
    }

    getName = (coordinate: Vector | null = null): string => {
        if (!coordinate) return this.name;
        
        const index = this.vertices.findIndex(v => isWithinTolerance(v, coordinate));
        if (index === -1) {
            console.error('Vertex not found');
            return '';
        }

        let name = `${this.n}(`;
        for (let i = 0; i < this.n; i++) {
            name += toDegrees(this.angles[(index + i) % this.n]);
            if (i < this.n - 1) {
                name += ';';
            }
        }
        name += ')';
        return name;
    }

    clone = (): EquilateralPolygon => {
        return EquilateralPolygon.fromAnchorAndDir(this.n, this.anchor.copy(), this.dir.copy(), [...this.angles]);
    }
}