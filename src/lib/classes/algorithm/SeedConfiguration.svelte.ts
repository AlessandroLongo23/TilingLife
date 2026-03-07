import {
    Vector,
    type Polygon,
    VertexConfiguration,
    type Gyration,
    type Reflection,
    RegularPolygon,
    StarRegularPolygon,
    StarParametricPolygon,
    EquilateralPolygon,
    GenericPolygon,
    PolygonType,
} from "$classes";
import type { EncodedGyration, EncodedReflection } from "$lib/algorithm/generatorEncoding";
import { deduplicatePolygons, isWithinTolerance } from "$utils";

function polygonToShort(enc: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { t: enc.type, n: enc.n };
    if (enc.vertices && Array.isArray(enc.vertices)) {
        out.v = (enc.vertices as { x: number; y: number }[]).map((v) => [v.x, v.y]);
    }
    if (enc.sides) out.s = enc.sides;
    if (enc.angles) out.a = enc.angles;
    if (enc.d != null) out.d = enc.d;
    if (enc.alpha != null) out.alpha = enc.alpha;
    return out;
}

function polygonFromShort(enc: Record<string, unknown>): { type: string; n: number; vertices: { x: number; y: number }[]; [k: string]: unknown } {
    const v = enc.v as [number, number][] | undefined;
    const vertices = v
        ? v.map((p) => ({ x: p[0], y: p[1] }))
        : (enc.vertices as { x: number; y: number }[])?.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p)) ?? [];
    return {
        type: (enc.t ?? enc.type) as string,
        n: (enc.n ?? 0) as number,
        vertices,
        ...(enc.s && { sides: enc.s }),
        ...(enc.a && { angles: enc.a }),
        ...(enc.d != null && { d: enc.d }),
        ...(enc.alpha != null && { alpha: enc.alpha }),
    };
}

export interface CompactVC {
    name: string;
    pos: [number, number];
    rot: number;
}

/** Compact format using VC library index instead of name (saves space for long VC names). */
export interface CompactVCWithId {
    vcId: number;
    pos: [number, number];
    rot: number;
}

export interface CompactSeedConfiguration {
    vcs: (CompactVC | CompactVCWithId)[];
}

/** Short-key compact format: v=vcs, i=vcId, n=name, p=pos, r=rot. Points as [x,y]. */
export interface CompactSeedConfigurationShort {
    v: ({ i: number; p: [number, number]; r: number } | { n: string; p: [number, number]; r: number })[];
}

export interface FullSeedConfiguration {
    name: string;
    vcsCenters: { x: number; y: number }[];
    polygons: object[];
    gyrations: EncodedGyration[];
    reflections: EncodedReflection[];
}

export class SeedConfiguration {
    name: string;
    vertexConfigurations: VertexConfiguration[];
    polygons: Polygon[];

    gyrations: Gyration[];
    reflections: Reflection[];

    constructor(vertexConfigurations: VertexConfiguration[]) {
        this.vertexConfigurations = vertexConfigurations;
        this.polygons = deduplicatePolygons(vertexConfigurations.flatMap(vc => vc.polygons));
        this.name = this.computeName();
        this.gyrations = [];
        this.reflections = [];
    }

    static merge = (seedA: SeedConfiguration, seedB: SeedConfiguration): SeedConfiguration => {
        return new SeedConfiguration([...seedA.vertexConfigurations, ...seedB.vertexConfigurations]);
    }

    static applyGenerators = (seed: SeedConfiguration, generators: (Gyration | Reflection)[]): SeedConfiguration => {
        let mergedSeed: SeedConfiguration = seed.clone();
        for (const generator of generators) {
            if ('order' in generator) {
                const g = generator as Gyration;
                for (let i = 1; i < g.order; i++) {
                    const rotatedSeed = SeedConfiguration.rotate(seed, g.center, 2 * Math.PI * i / g.order);
                    mergedSeed = SeedConfiguration.merge(mergedSeed, rotatedSeed);
                }
            } else {
                const r = generator as Reflection;
                const mirroredSeed = SeedConfiguration.mirror(mergedSeed, r.point, r.axis);
                mergedSeed = SeedConfiguration.merge(mergedSeed, mirroredSeed);
            }
        }
        return mergedSeed;
    }

    /**
     * Rotates the seed configuration around the origin.
     * @returns a new seed configuration.
     */
    static rotate = (seed: SeedConfiguration, origin: Vector, angle: number): SeedConfiguration => {
        return new SeedConfiguration(seed.vertexConfigurations.map(vc => VertexConfiguration.rotate(vc, origin, angle)));
    }

    /**
     * Rotates the seed configuration around the origin.
     * Mutates the seed configuration in place.
     */
    rotate = (origin: Vector, angle: number): void => {
        for (let vc of this.vertexConfigurations) {
            vc.rotate(origin, angle);
        }
    }

    /**
     * Translates the seed configuration by the vector.
     * @returns a new seed configuration.
     */
    static translate = (seed: SeedConfiguration, vector: Vector): SeedConfiguration => {
        return new SeedConfiguration(seed.vertexConfigurations.map(vc => VertexConfiguration.translate(vc, vector)));
    }

    /**
     * Translates the seed configuration by the vector.
     * Mutates the seed configuration in place.
     */
    translate = (vector: Vector): void => {
        for (let vc of this.vertexConfigurations) {
            vc.translate(vector);
        }
    }

    /**
     * Mirrors the seed configuration around the point and direction.
     * @returns a new seed configuration.
     */
    static mirror = (seed: SeedConfiguration, point: Vector, dir: Vector): SeedConfiguration => {
        return new SeedConfiguration(seed.vertexConfigurations.map(vc => VertexConfiguration.mirror(vc, point, dir)));
    }

    /**
     * Mirrors the seed configuration around the point and direction.
     * Mutates the seed configuration in place.
     */
    mirror = (point: Vector, dir: Vector): void => {
        for (let vc of this.vertexConfigurations) {
            vc.mirror(point, dir);
        }
    }

    /**
     * Glides the seed configuration by the point, direction and delta.
     * @returns a new seed configuration.
     */
    static glide = (seed: SeedConfiguration, point: Vector, dir: Vector, delta: number): SeedConfiguration => {
        return new SeedConfiguration(seed.vertexConfigurations.map(vc => VertexConfiguration.glide(vc, point, dir, delta)));
    }

    /**
     * Glides the seed configuration by the point, direction and delta.
     * Mutates the seed configuration in place.
     */
    glide = (point: Vector, dir: Vector, delta: number): void => {
        for (let vc of this.vertexConfigurations) {
            vc.glide(point, dir, delta);
        }
    }

    /**
     * Checks if the seed configuration is equivalent to another seed configuration.
     * @returns true if the seed configurations are equivalent, false otherwise.
     */
    isEquivalent = (other: SeedConfiguration): boolean => {
        if (!other) return false;

        const mergedSeed: SeedConfiguration = SeedConfiguration.merge(this, other);

        return mergedSeed.isValid();
    }

    /**
     * Checks if the seed configuration is valid.
     * @returns true if the seed configuration is valid, false otherwise.
     */
    isValid = (): boolean => {
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

    computeName = (): string => {
        return "[" + this.vertexConfigurations.map(vc => vc.name).join(';') + "]";
    }

    encode = (): FullSeedConfiguration => {
        const uniquePolygons = deduplicatePolygons(this.polygons);
        return {
            name: this.name,
            vcsCenters: this.vertexConfigurations.map((vc: VertexConfiguration) => vc.sharedVertex.encode()),
            polygons: uniquePolygons.map((p: Polygon) => p.encode()),
            gyrations: this.gyrations.map((g) => ({ type: "gyration" as const, center: g.center.encode(), order: g.order })),
            reflections: this.reflections.map((r) => ({ type: "reflection" as const, axis: r.axis.encode(), point: r.point.encode() })),
        };
    }

    /** Short-key full format for storage: n, vc, p, g, r. Points as [x,y]. */
    encodeShort = (): Record<string, unknown> => {
        const uniquePolygons = deduplicatePolygons(this.polygons);
        return {
            n: this.name,
            vc: this.vertexConfigurations.map((vc) => [vc.sharedVertex.x, vc.sharedVertex.y] as [number, number]),
            p: uniquePolygons.map((p: Polygon) => polygonToShort(p.encode() as Record<string, unknown>)),
            g: this.gyrations.map((g) => ({ t: "gyration" as const, c: [g.center.x, g.center.y] as [number, number], o: g.order })),
            r: this.reflections.map((r) => ({ t: "reflection" as const, a: [r.axis.x, r.axis.y] as [number, number], pt: [r.point.x, r.point.y] as [number, number] })),
        };
    }

    /** Compact format: VC name + shared-vertex position + rotation. shortKeys uses v,i,n,p,r. */
    encodeCompact = (vcLibrary?: string[], shortKeys = false): CompactSeedConfiguration | CompactSeedConfigurationShort => {
        if (shortKeys) {
            const items = this.vertexConfigurations.map((vc: VertexConfiguration) => {
                const rot = this.getFirstEdgeHeading(vc);
                const pos: [number, number] = [vc.sharedVertex.x, vc.sharedVertex.y];
                if (vcLibrary) {
                    const vcId = vcLibrary.indexOf(vc.name);
                    if (vcId >= 0) return { i: vcId, p: pos, r: rot };
                }
                return { n: vc.name, p: pos, r: rot };
            });
            return { v: items };
        }
        const items = this.vertexConfigurations.map((vc: VertexConfiguration) => {
            const rot = this.getFirstEdgeHeading(vc);
            const pos: [number, number] = [vc.sharedVertex.x, vc.sharedVertex.y];
            if (vcLibrary) {
                const vcId = vcLibrary.indexOf(vc.name);
                if (vcId >= 0) return { vcId, pos, rot } satisfies CompactVCWithId;
            }
            return { name: vc.name, pos, rot } satisfies CompactVC;
        });
        return { vcs: items };
    }

    /** Get the heading of the first edge emanating from the shared vertex (for decode round-trip). */
    private getFirstEdgeHeading = (vc: VertexConfiguration): number => {
        const shared = vc.sharedVertex;
        for (const p of vc.polygons) {
            const idx = p.vertices.findIndex((v) => isWithinTolerance(v, shared));
            if (idx !== -1) {
                const next = p.vertices[(idx + 1) % p.vertices.length];
                const heading = Vector.sub(next, shared).heading();
                return (heading + 2 * Math.PI) % (2 * Math.PI);
            }
        }
        return 0;
    }

    static decodeCompact = (data: CompactSeedConfiguration | CompactSeedConfigurationShort, vcLibrary?: string[]): SeedConfiguration => {
        const arr = 'v' in data ? data.v : data.vcs;
        const vcs: VertexConfiguration[] = arr.map((c: any) => {
            const name = ('i' in c || 'vcId' in c) && vcLibrary
                ? vcLibrary[('i' in c ? c.i : c.vcId) as number]
                : (('n' in c ? c.n : c.name) as string);
            const pos = 'p' in c ? c.p : c.pos;
            const rot = 'r' in c ? c.r : c.rot;
            const vc = VertexConfiguration.fromName(name);
            vc.rotate(new Vector(0, 0), rot);
            vc.translate(new Vector(pos[0], pos[1]));
            return vc;
        });
        return new SeedConfiguration(vcs);
    }

    static decodeFull = (data: FullSeedConfiguration | Record<string, unknown>): SeedConfiguration => {
        const d = data as Record<string, unknown>;
        const name = (d.n ?? d.name) as string;
        const vcNames = name.slice(1, -1).split(';');
        const vcsCentersRaw = d.vc ?? d.vcsCenters;
        const vcsCenters = (Array.isArray(vcsCentersRaw) ? vcsCentersRaw : []).map((c: { x?: number; y?: number } | [number, number]) =>
            Array.isArray(c) ? new Vector(c[0], c[1]) : new Vector(c.x!, c.y!)
        );
        const polygonsRaw = d.p ?? d.polygons ?? [];
        const decodedPolygons = (Array.isArray(polygonsRaw) ? polygonsRaw : []).map((p: Record<string, unknown>) => {
            const norm = polygonFromShort(p);
            const vertices = norm.vertices.map((v) => new Vector(v.x, v.y));
            switch (norm.type) {
                case PolygonType.REGULAR:
                    return RegularPolygon.fromVertices(vertices);
                case PolygonType.STAR_REGULAR:
                    return StarRegularPolygon.fromVertices(vertices);
                case PolygonType.STAR_PARAMETRIC:
                    return StarParametricPolygon.fromVertices(vertices);
                case PolygonType.EQUILATERAL:
                    return EquilateralPolygon.fromVertices(vertices);
                case PolygonType.GENERIC:
                    return GenericPolygon.fromVertices(vertices);
                default:
                    return RegularPolygon.fromVertices(vertices);
            }
        });

        const vcs: VertexConfiguration[] = [];
        for (let i = 0; i < vcNames.length; i++) {
            const center = vcsCenters[i];
            const vcPolygons = decodedPolygons.filter((p) =>
                p.vertices.some((v) => isWithinTolerance(v, center))
            );
            vcs.push(new VertexConfiguration(vcPolygons, null, vcNames[i]));
        }
        const seed = new SeedConfiguration(vcs);
        const gyrationsRaw = d.g ?? d.gyrations ?? [];
        if (Array.isArray(gyrationsRaw) && gyrationsRaw.length) {
            seed.gyrations = gyrationsRaw.map((g: Record<string, unknown>) => {
                const c = g.c ?? g.center;
                const cc = c as { x: number; y: number } | [number, number];
                const [x, y] = Array.isArray(cc) ? cc : [cc.x, cc.y];
                return { center: new Vector(x, y), order: (g.o ?? g.order) as number };
            });
        }
        const reflectionsRaw = d.r ?? d.reflections ?? [];
        if (Array.isArray(reflectionsRaw) && reflectionsRaw.length) {
            seed.reflections = reflectionsRaw.map((r: Record<string, unknown>) => {
                const a = r.a ?? r.axis;
                const pt = r.pt ?? r.point;
                const aa = a as { x: number; y: number } | [number, number];
                const ppt = pt as { x: number; y: number } | [number, number];
                return {
                    axis: new Vector(Array.isArray(aa) ? aa[0] : aa.x, Array.isArray(aa) ? aa[1] : aa.y),
                    point: new Vector(Array.isArray(ppt) ? ppt[0] : ppt.x, Array.isArray(ppt) ? ppt[1] : ppt.y),
                };
            });
        }
        return seed;
    }

    clone = (): SeedConfiguration => {
        const cloned = new SeedConfiguration(this.vertexConfigurations.map(vc => vc.clone()));
        cloned.gyrations = this.gyrations.map((g) => ({ center: g.center.copy(), order: g.order }));
        cloned.reflections = this.reflections.map((r) => ({ axis: r.axis.copy(), point: r.point.copy() }));
        return cloned;
    }
}