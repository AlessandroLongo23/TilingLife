import { Polygon, PolygonType, RegularPolygon, StarParametricPolygon, StarRegularPolygon, StarRegularVertexTypes, Vector } from '$classes';
import { PolygonSignature } from './PolygonSignature.svelte';
import { isWithinTolerance, toDegrees, toRadians } from '$utils';

const dotStarRegex = /\{(\d+)\.(\d+)(o|i)?\}/;
const pipeStarRegex = /\{(\d+)\|(\d+)(o|i)?\}/;

export class VertexConfiguration {
    polygons: Polygon[];
    angle: number;
    name: string;
    current_dir: Vector;
    valid: boolean = true;

    constructor(polygons: Polygon[], angle: number | null = null, name: string | null = null, current_dir: Vector | null = null) {
        this.polygons = polygons;
        this.angle = angle || this.computeAngle();
        this.name = name || this.computeName();
        this.current_dir = current_dir || new Vector(1, 0);
    }

    static fromName = (name: string): VertexConfiguration => {
        let polygons: Polygon[] = [];
        let current_dir: Vector = new Vector(1, 0);

        const polygonsData = name.split(',');
        for (const p of polygonsData) {
            let polygon: Polygon | null = null;

            if (p.startsWith('{')) {
                const dotMatch = p.match(dotStarRegex);
                if (dotMatch) {
                    const [, n, d, suffix] = dotMatch;
                    const startsWith = suffix === 'i' ? StarRegularVertexTypes.INNER : StarRegularVertexTypes.OUTER;
                    polygon = StarRegularPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), parseInt(d), startsWith);
                } else {
                    const pipeMatch = p.match(pipeStarRegex);
                    if (pipeMatch) {
                        const [, n, value, suffix] = pipeMatch;
                        const startsWith = suffix === 'i' ? StarRegularVertexTypes.INNER : StarRegularVertexTypes.OUTER;
                        if (suffix) {
                            polygon = StarParametricPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), toRadians(parseInt(value)), startsWith);
                        } else {
                            polygon = StarRegularPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), parseInt(value), startsWith);
                        }
                    }
                }
            } else {
                polygon = RegularPolygon.fromAnchorAndDir(parseInt(p), new Vector(0, 0), current_dir.copy());
            }

            if (polygon) {
                polygons.push(polygon);
                current_dir.rotate(-polygon.interior_angle);
            }
        }
        return new VertexConfiguration(polygons, null, name);
    }
    
    addPolygon = (polygonData: PolygonSignature) => {
        let polygon: Polygon;
        switch (polygonData.type) {
            case PolygonType.REGULAR:
                polygon = RegularPolygon.fromAnchorAndDir(polygonData.n, new Vector(0, 0), this.current_dir);
                break;
            case PolygonType.STAR_REGULAR:
                polygon = StarRegularPolygon.fromAnchorAndDir(polygonData.n, new Vector(0, 0), this.current_dir, polygonData.d, polygonData.startsWith);
                break;
            case PolygonType.STAR_PARAMETRIC:
                polygon = StarParametricPolygon.fromAnchorAndDir(polygonData.n, new Vector(0, 0), this.current_dir, polygonData.alpha, polygonData.startsWith);
                break;
        }
        
        this.polygons.push(polygon);
        this.angle += polygon.interior_angle;

        // check the vertex configuration validity by:
        // 1. find the adjacent vertex to the origin vertex which is shared by the two last polygons
        // if (this.polygons.length > 1) {
        //     const lastPolygon = this.polygons[this.polygons.length - 1];
        //     const secondLastPolygon = this.polygons[this.polygons.length - 2];
        //     const adjacentVertex = lastPolygon.vertices
        //         .filter(v1 => secondLastPolygon.vertices
        //             .find(v2 => isWithinTolerance(v1, v2)))
        //         .find(v => isWithinTolerance(v.distance(new Vector(0, 0)), 1));

        //     // 2. check if the sum of the interior angles of the two last polygons on that vertex is less than 360°
        //     const angleA = lastPolygon.getAngleAtVertex(adjacentVertex);
        //     const angleB = secondLastPolygon.getAngleAtVertex(adjacentVertex);
        //     console.log(lastPolygon.name, secondLastPolygon.name, toDegrees(angleA), toDegrees(angleB));
        //     const sum = angleA + angleB;
        //     if (!isWithinTolerance(sum, 2 * Math.PI) && !(sum < 2 * Math.PI)) {
        //         this.valid = false;
        //     }
        // }

        if (this.polygons.length > 2) {
            const newPolygon = this.polygons[this.polygons.length - 1];

            for (let i = 0; i < this.polygons.length - 1; i++) {
                const oldPolygon = this.polygons[i];
                for (let j = 0; j < newPolygon.vertices.length; j++) {
                    if (oldPolygon.containsPoint(newPolygon.vertices[j])) {
                        this.valid = false;
                        return;
                    }
                }

                for (let j = 0; j < oldPolygon.vertices.length; j++) {
                    if (newPolygon.containsPoint(oldPolygon.vertices[j])) {
                        this.valid = false;
                        return;
                    }
                }
            }
        }

        this.current_dir.rotate(-polygon.interior_angle);
        this.name = this.computeName();
    }

    computeAngle = (): number => {
        if (this.polygons.length === 0) {
            return 0;
        }

        let angle = 0;
        for (let polygon of this.polygons) {
            angle += polygon.interior_angle;
        }
        return angle;
    }

    computeName = (): string => {
        if (this.polygons.length === 0) {
            return '';
        }

        let name = this.polygons[0].name;
        for (let i = 1; i < this.polygons.length; i++) {
            name += ',' + this.polygons[i].name;
        }
        return name;
    }

    clone = (): VertexConfiguration => {
        return new VertexConfiguration([...this.polygons], this.angle, this.name, this.current_dir.copy());
    }
}