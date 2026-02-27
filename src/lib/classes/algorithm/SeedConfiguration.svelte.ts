import {
    Vector,
    type Polygon,
    PolygonType,
    RegularPolygon,
    StarRegularPolygon,
    StarParametricPolygon,
    EquilateralPolygon,
    GenericPolygon,
    StarVertexTypes,
} from "$classes";
import { toRadians } from "$utils";

export class SeedConfiguration {
    polygons: Polygon[];

    constructor(polygons: Polygon[]) {
        this.polygons = polygons;
    }

    static merge = (seedA: SeedConfiguration, seedB: SeedConfiguration): SeedConfiguration => {
        return new SeedConfiguration([...seedA.polygons, ...seedB.polygons]);
    }

    rotate = (origin: Vector, angle: number): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.rotate(origin, angle)));
    }

    translate = (vector: Vector): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.translate(vector)));
    }

    mirror = (point: Vector, dir: Vector): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.mirror(point, dir)));
    }

    glide = (point: Vector, dir: Vector, delta: number): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.glide(point, dir, delta)));
    }

    isValid = (): boolean => {
        // check if any polygon conflicts with any other polygon
        for (let i = 0; i < this.polygons.length - 1; i++) {
            const polygon = this.polygons[i];
            for (let j = i + 1; j < this.polygons.length; j++) {
                const otherPolygon = this.polygons[j];
                if (polygon.intersects(otherPolygon)) {
                    return false;
                }
            }
        }

        return true;
    }

    encode = (): Object => {
        return {
            polygons: this.polygons.map(p => p.encode()),
        };
    }

    /** Compact format: anchor + dir instead of full vertices. ~3–6x smaller. */
    encodeCompact = (): object => {
        return {
            polygons: this.polygons.map(p => {
                const a = p.vertices[0];
                const d = Vector.sub(p.vertices[1], p.vertices[0]);
                const compact: Record<string, unknown> = {
                    t: PolygonType.REGULAR,
                    n: p.n,
                    a: [a.x, a.y],
                    d: [d.x, d.y],
                };
                if (p instanceof RegularPolygon) {
                    compact.t = PolygonType.REGULAR;
                } else if (p instanceof StarRegularPolygon) {
                    compact.t = PolygonType.STAR_REGULAR;
                    compact.density = p.d;
                    compact.s = p.startsWith === StarVertexTypes.OUTER ? 'o' : 'i';
                } else if (p instanceof StarParametricPolygon) {
                    compact.t = PolygonType.STAR_PARAMETRIC;
                    compact.alpha = p.alpha;
                    compact.s = p.startsWith === StarVertexTypes.OUTER ? 'o' : 'i';
                } else if (p instanceof EquilateralPolygon) {
                    compact.t = PolygonType.EQUILATERAL;
                    compact.angles = p.angles.map(a => Math.round(a * 180 / Math.PI));
                } else if (p instanceof GenericPolygon) {
                    compact.t = PolygonType.GENERIC;
                    compact.sides = p.sides;
                    compact.angles = p.angles.map(a => Math.round(a * 180 / Math.PI));
                }
                return compact;
            }),
        };
    }

    /** Decode compact format to full format (with vertices) for display. */
    static decodeCompact = (data: { polygons: Record<string, unknown>[] }): { polygons: object[] } => {
        const polygons: object[] = [];
        for (const c of data.polygons) {
            const anchor = new Vector((c.a as number[])[0], (c.a as number[])[1]);
            const dir = new Vector((c.d as number[])[0], (c.d as number[])[1]);
            let p: Polygon;
            switch (c.t) {
                case PolygonType.REGULAR:
                    p = RegularPolygon.fromAnchorAndDir(c.n as number, anchor, dir);
                    break;
                case PolygonType.STAR_REGULAR:
                    p = StarRegularPolygon.fromAnchorAndDir(
                        c.n as number, anchor, dir, c.density as number,
                        (c.s as string) === 'o' ? StarVertexTypes.OUTER : StarVertexTypes.INNER
                    );
                    break;
                case PolygonType.STAR_PARAMETRIC:
                    p = StarParametricPolygon.fromAnchorAndDir(
                        c.n as number, anchor, dir, c.alpha as number,
                        (c.s as string) === 'o' ? StarVertexTypes.OUTER : StarVertexTypes.INNER
                    );
                    break;
                case PolygonType.EQUILATERAL:
                    p = EquilateralPolygon.fromAnchorAndDir(
                        c.n as number, anchor, dir,
                        (c.angles as number[]).map(a => toRadians(a))
                    );
                    break;
                case PolygonType.GENERIC:
                    p = GenericPolygon.fromAnchorAndDir(
                        c.n as number, anchor, dir,
                        c.sides as number[],
                        (c.angles as number[]).map(a => toRadians(a))
                    );
                    break;
                default:
                    throw new Error(`Unknown polygon type: ${c.t}`);
            }
            polygons.push(p.encode());
        }
        return { polygons };
    }

    clone = (): SeedConfiguration => {
        return new SeedConfiguration(this.polygons.map(p => p.clone()));
    }
}