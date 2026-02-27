import { 
    Vector, 
    Polygon, 
    PolygonType, 
    PolygonSignature, 
    StarVertexTypes, 
    RegularPolygon, 
    StarRegularPolygon,
    StarParametricPolygon, 
    EquilateralPolygon, 
    GenericPolygon,
    SeedConfiguration,
    type PartialConfiguration,
    type SurroundingPolygon
} from '$classes';
import { isWithinAngularTolerance, isWithinTolerance, toRadians } from '$utils';
import { regularPolygonRegex, regularStarRegex, parametricStarRegex, equilateralPolygonRegex } from './regex';
import { tolerance } from '$stores';

export class VertexConfiguration {
    polygons: Polygon[];
    angle: number;
    name: string;
    current_dir: Vector;
    valid: boolean = true;
    neighboringVertices: Vector[];

    private _polygonBaseNames: string[] | null = null;
    private _edgePairs: Set<string> | null = null;
    private _partialConfigs: PartialConfiguration[] | null = null;
    private _partialDoubledReversed: string[] | null = null;

    constructor(polygons: Polygon[], angle: number | null = null, name: string | null = null, current_dir: Vector | null = null) {
        this.polygons = polygons;
        this.angle = angle || this.computeAngle();
        this.name = name || this.getName();
        this.current_dir = current_dir || new Vector(1, 0);
        this.neighboringVertices = [];
    }

    static fromName = (name: string): VertexConfiguration => {
        let polygons: Polygon[] = [];
        let current_dir: Vector = new Vector(1, 0);

        const polygonsData = name.split(',');
        for (const p of polygonsData) {
            let polygon: Polygon | null = null;

            if (p.match(regularPolygonRegex)) {
                polygon = RegularPolygon.fromAnchorAndDir(parseInt(p), new Vector(0, 0), current_dir.copy());
            } else if (p.match(regularStarRegex)) {
                const regularStarMatch = p.match(regularStarRegex);
                const [, n, d, suffix] = regularStarMatch;
                const startsWith = suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER;
                polygon = StarRegularPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), parseInt(d), startsWith);
            } else if (p.match(parametricStarRegex)) {
                const parametricStarMatch = p.match(parametricStarRegex);
                const [, n, value, suffix] = parametricStarMatch;
                const startsWith = suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER;
                if (suffix) {
                    polygon = StarParametricPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), toRadians(parseInt(value)), startsWith);
                } else {
                    polygon = StarRegularPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), parseInt(value), startsWith);
                }
            } else if (p.match(equilateralPolygonRegex)) {
                const equilateralPolygonMatch = p.match(equilateralPolygonRegex);
                const [, n, angles] = equilateralPolygonMatch;
                polygon = EquilateralPolygon.fromAnchorAndDir(parseInt(n), new Vector(0, 0), current_dir.copy(), angles.split(';').map(a => toRadians(parseInt(a))));
            }

            if (polygon) {
                polygons.push(polygon);
                current_dir.rotate(polygon.interior_angle);
            }
        }
        return new VertexConfiguration(polygons, null, name);
    }

    static merge = (vcA: VertexConfiguration, vcB: VertexConfiguration, a: PartialConfiguration, b: PartialConfiguration): SeedConfiguration => {
        const clonedB = vcB.clone();

        // first map the second vc to the first vc based on the partial configurations
        const dirA = Vector.sub(a.partialVertex, a.fullVertex).heading();
        const dirB = Vector.sub(b.partialVertex, b.fullVertex).heading();
        clonedB.rotate(b.fullVertex, dirA - dirB + Math.PI);
        clonedB.translate(Vector.sub(a.partialVertex, b.fullVertex));

        // then filter out the duplicated polygons, i.e., polygons that ended up in the same position
        const mergedPolygons = [...vcA.polygons, ...clonedB.polygons].filter((polygon, index, self) => {
            const firstIndex = self.findIndex(p => isWithinTolerance(p.centroid, polygon.centroid));
            return index === firstIndex;
        });

        return new SeedConfiguration(mergedPolygons);
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
            case PolygonType.EQUILATERAL:
                polygon = EquilateralPolygon.fromAnchorAndDir(polygonData.n, new Vector(0, 0), this.current_dir, polygonData.angles);
                break;
            case PolygonType.GENERIC:
                polygon = GenericPolygon.fromAnchorAndDir(polygonData.n, new Vector(0, 0), this.current_dir, polygonData.sides, polygonData.angles);
                break;
        }
        
        this.polygons.push(polygon);
        this.angle += polygon.interior_angle;

        // FIRST CHECK: check if any polygon conflicts with any other polygon
        if (this.polygons.length > 1) {
            const lastPolygon = this.polygons[this.polygons.length - 1];
            
            for (let i = 0; i < this.polygons.length - 1; i++) {
                if (lastPolygon.intersects(this.polygons[i])) {
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

        if (isWithinAngularTolerance(this.angle, 2 * Math.PI)) {
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
        }

        this.name = this.getName();
        this.current_dir.rotate(polygon.interior_angle);
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

    getName = (): string => {
        return this.polygons.map(p => p.getName(new Vector())).join(',');
    }

    private getPolygonBaseNames = (): string[] => {
        if (!this._polygonBaseNames) {
            this._polygonBaseNames = this.polygons.map(p => p.getName());
        }
        return this._polygonBaseNames;
    }

    private getEdgePairs = (): Set<string> => {
        if (!this._edgePairs) {
            const names = this.getPolygonBaseNames();
            this._edgePairs = new Set<string>();
            for (let i = 0; i < names.length; i++) {
                this._edgePairs.add(names[i] + '\0' + names[(i + 1) % names.length]);
            }
        }
        return this._edgePairs;
    }

    private getPartialConfigs = (): PartialConfiguration[] => {
        if (!this._partialConfigs) {
            this.computeNeighboringVertices();
            this._partialConfigs = this.neighboringVertices.map(nv => this.evaluatePartialconfiguration(nv));
        }
        return this._partialConfigs;
    }

    private getPartialDoubledReversed = (): string[] => {
        if (!this._partialDoubledReversed) {
            this._partialDoubledReversed = this.getPartialConfigs().map(pc => {
                return (pc.name + ',' + pc.name).split(',').reverse().join(',');
            });
        }
        return this._partialDoubledReversed;
    }

    isCompatible = (other: VertexConfiguration): boolean => {
        const thisEdgePairs = this.getEdgePairs();
        const otherEdgePairs = other.getEdgePairs();

        let hasInvertedPair = false;
        for (const pair of thisEdgePairs) {
            const sep = pair.indexOf('\0');
            const reversed = pair.substring(sep + 1) + '\0' + pair.substring(0, sep);
            if (otherEdgePairs.has(reversed)) {
                hasInvertedPair = true;
                break;
            }
        }
        if (!hasInvertedPair) return false;

        const vcAPartials = this.getPartialConfigs();
        const vcBPartials = other.getPartialConfigs();
        const vcAReversed = this.getPartialDoubledReversed();
        const vcBReversed = other.getPartialDoubledReversed();

        for (let i = 0; i < vcAPartials.length; i++) {
            for (let j = 0; j < vcBPartials.length; j++) {
                if (vcAReversed[i].includes(vcBPartials[j].name) ||
                    vcBReversed[j].includes(vcAPartials[i].name)) {
                    if (checkMergeCompatibility(this, other, vcAPartials[i], vcBPartials[j])) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    rotate = (origin: Vector, angle: number): void => {
        this.current_dir.rotate(angle);
        for (let polygon of this.polygons) {
            polygon.rotate(origin, angle);
        }
    }

    translate = (vector: Vector): void => {
        for (let polygon of this.polygons) {
            polygon.translate(vector);
        }
    }

    evaluatePartialconfiguration = (vertex: Vector): PartialConfiguration => {
        // 1. Find the surrounding polygons, i.e., the polygons that have a vertex at the coordinate
        const surroundingPolygons: SurroundingPolygon[] = [];
        for (let j = 0; j < this.polygons.length; j++) {
            const p = this.polygons[j];
            const vertexIndex = p.vertices.findIndex(v => isWithinTolerance(v, vertex));
            // Note: in the other direction, we consider the next vertex to be the previous vertex and vice versa
            if (vertexIndex !== -1) {
                const previousVertex = p.vertices[(vertexIndex + 1) % p.vertices.length];
                const currentVertex = p.vertices[vertexIndex];
                const nextVertex = p.vertices[(vertexIndex - 1 + p.vertices.length) % p.vertices.length];

                const previousDir = Vector.sub(currentVertex, previousVertex).heading();
                const nextDir = Vector.sub(currentVertex, nextVertex).heading();
                
                surroundingPolygons.push({ 
                    polygon: p, 
                    prevDir: previousDir,
                    nextDir: nextDir,
                });
            }
        }

        // find the polygon that has no previous polygon. If it doesn't exist, use the first polygon
        let firstPolygon: SurroundingPolygon = surroundingPolygons.find(p => {
            const previousPolygon: SurroundingPolygon | undefined = surroundingPolygons.find(other => isWithinAngularTolerance(other.nextDir, p.prevDir));
            return previousPolygon === undefined;
        }) || surroundingPolygons[0];

        // now order the surrounding polygons such that the nextDir of each polygon is the prevDir of the next polygon
        let currentPolygon: SurroundingPolygon = firstPolygon;
        const orderedPolygons: SurroundingPolygon[] = [];
        while (orderedPolygons.length < surroundingPolygons.length) {
            orderedPolygons.push(currentPolygon);
            currentPolygon = surroundingPolygons.find(p => isWithinAngularTolerance(p.prevDir, currentPolygon.nextDir))!;
        }

        const partialConfiguration: Polygon[] = orderedPolygons.map(p => p.polygon);
        const partialConfigurationName = partialConfiguration.map(p => p.getName()).join(',');

        return {
            name: partialConfigurationName,
            fullVertex: new Vector(),
            partialVertex: vertex.copy(),
        }
    }

    clone = (): VertexConfiguration => {
        return new VertexConfiguration(this.polygons.map(p => p.clone()), this.angle, this.name, this.current_dir.copy());
    }
}

const checkMergeCompatibility = (
    vcA: VertexConfiguration,
    vcB: VertexConfiguration,
    a: PartialConfiguration,
    b: PartialConfiguration
): boolean => {
    const clonedB = vcB.clone();

    const dirA = Vector.sub(a.partialVertex, a.fullVertex).heading();
    const dirB = Vector.sub(b.partialVertex, b.fullVertex).heading();
    clonedB.rotate(b.fullVertex, dirA - dirB + Math.PI);
    clonedB.translate(Vector.sub(a.partialVertex, b.fullVertex));

    const newBPolygons: Polygon[] = [];
    for (const bp of clonedB.polygons) {
        if (!vcA.polygons.some(ap => isWithinTolerance(ap.centroid, bp.centroid))) {
            newBPolygons.push(bp);
        }
    }

    for (const ap of vcA.polygons) {
        for (const bp of newBPolygons) {
            if (ap.intersects(bp)) return false;
        }
    }

    return true;
}