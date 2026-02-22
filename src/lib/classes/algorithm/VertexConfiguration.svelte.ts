import { Polygon, PolygonType, PolygonSignature, RegularPolygon, StarParametricPolygon, StarRegularPolygon, StarRegularVertexTypes, Vector } from '$classes';
import { isWithinTolerance, toRadians } from '$utils';
import { tolerance } from '$stores';
import { regularStarRegex, parametricStarRegex } from './regex';

export class VertexConfiguration {
    polygons: Polygon[];
    angle: number;
    name: string;
    current_dir: Vector;
    valid: boolean = true;
    neighboringVertices: Vector[];

    constructor(polygons: Polygon[], angle: number | null = null, name: string | null = null, current_dir: Vector | null = null) {
        this.polygons = polygons;
        this.angle = angle || this.computeAngle();
        this.name = name || this.computeName();
        this.current_dir = current_dir || new Vector(1, 0);
        this.neighboringVertices = [];
    }

    static fromName = (name: string): VertexConfiguration => {
        let polygons: Polygon[] = [];
        let current_dir: Vector = new Vector(1, 0);

        const polygonsData = name.split(',');
        for (const p of polygonsData) {
            let polygon: Polygon | null = null;

            if (p.startsWith('{')) {
                const regularStarMatch = p.match(regularStarRegex);
                if (regularStarMatch) {
                    const [, n, d, suffix] = regularStarMatch;
                    const startsWith = suffix === 'i' ? StarRegularVertexTypes.INNER : StarRegularVertexTypes.OUTER;
                    polygon = StarRegularPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), parseInt(d), startsWith);
                } else {
                    const parametricStarMatch = p.match(parametricStarRegex);
                    if (parametricStarMatch) {
                        const [, n, value, suffix] = parametricStarMatch;
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

        // FIRST CHECK: check if any polygon intersects with any other polygon
        if (this.polygons.length > 1) {
            const lastPolygon = this.polygons[this.polygons.length - 1];
            
            for (let i = 0; i < this.polygons.length - 1; i++) {
                const prevPolygon = this.polygons[i];
                if (lastPolygon.intersects(prevPolygon)) {
                    this.valid = false;
                    return;
                }
            }
        }

        // SECOND CHECK: check the vertex configuration validity by checking the sum of the interior angles of the two last polygons on the adjacent vertex
        if (this.polygons.length > 1) {
            const lastPolygon = this.polygons[this.polygons.length - 1];
            const secondLastPolygon = this.polygons[this.polygons.length - 2];
            
            const adjacentVertex = this.current_dir.copy();

            const angleA = lastPolygon.getAngleAtVertex(adjacentVertex);
            const angleB = secondLastPolygon.getAngleAtVertex(adjacentVertex);
            const sum = angleA + angleB;
            if (sum > 2 * Math.PI + tolerance) {
                this.valid = false;
                return;
            }
        }

        if (isWithinTolerance(this.angle, 2 * Math.PI)) {
            const firstPolygon = this.polygons[0];
            const lastPolygon = this.polygons[this.polygons.length - 1];
            const adjacentVertex = new Vector(1, 0);

            const angleA = lastPolygon.getAngleAtVertex(adjacentVertex);
            const angleB = firstPolygon.getAngleAtVertex(adjacentVertex);
            const sum = angleA + angleB;
            if (sum > 2 * Math.PI + tolerance) {
                this.valid = false;
                return;
            }

            this.computeNeighboringVertices();
        }

        this.current_dir.rotate(-polygon.interior_angle);
        this.name = this.computeName();
    }

    computeNeighboringVertices = (): void => {
        this.neighboringVertices = this.polygons.map(p => p.vertices[1]);
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

    isCompatible = (other: VertexConfiguration): boolean => {
        // FIRST CHECK: filter out vcs that do not share at least two polygons
        const thisNames = this.polygons.map(p => p.name);
        const otherNames = other.polygons.map(p => p.name);
        const sharedNames = thisNames.filter(name => otherNames.includes(name));
        if (sharedNames.length < 2) {
            return false;
        }

        // SECOND CHECK: filter out vcs that don't share an inverted pair of cyclically consecutive polygons, e.g. {a, b, c} and {a, e, b}
        let found = false;
        const len1 = thisNames.length;
        const len2 = otherNames.length;
        for (let i = 0; i < len1; i++) {
            const thisA = thisNames[i];
            const thisB = thisNames[(i + 1) % len1];
            for (let j = 0; j < len2; j++) {
                const otherA = otherNames[j];
                const otherB = otherNames[(j + 1) % len2];
                if (thisA === otherB && thisB === otherA) {
                    found = true;
                    break;
                }
            }
        }
        if (!found) return false;

        // THIRD CHECK: for each neighboring vertex, check if the other vcs can be inserted there without conflicts
        // TODO: implement this check

        return true;
    }

    clone = (): VertexConfiguration => {
        return new VertexConfiguration([...this.polygons], this.angle, this.name, this.current_dir.copy());
    }
}