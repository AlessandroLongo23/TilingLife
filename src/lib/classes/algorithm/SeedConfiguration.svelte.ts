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

export interface CompactVC {
    name: string;
    pos: [number, number];
    rot: number;
}

export interface CompactSeedConfiguration {
    vcs: CompactVC[];
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
        return {
            name: this.name,
            vcsCenters: this.vertexConfigurations.map((vc: VertexConfiguration) => vc.sharedVertex.encode()),
            polygons: this.polygons.map((p: Polygon) => p.encode()),
            gyrations: this.gyrations.map((g) => ({ type: "gyration" as const, center: g.center.encode(), order: g.order })),
            reflections: this.reflections.map((r) => ({ type: "reflection" as const, axis: r.axis.encode(), point: r.point.encode() })),
        };
    }

    /** Compact format: VC name + shared-vertex position + rotation. */
    encodeCompact = (): CompactSeedConfiguration => {
        return {
            vcs: this.vertexConfigurations.map((vc: VertexConfiguration) => {
                const edgeDir = Vector.sub(vc.polygons[0].vertices[1], vc.sharedVertex);
                return {
                    name: vc.name,
                    pos: [vc.sharedVertex.x, vc.sharedVertex.y] as [number, number],
                    rot: edgeDir.heading(),
                };
            }),
        };
    }

    static decodeCompact = (data: CompactSeedConfiguration): SeedConfiguration => {
        const vcs: VertexConfiguration[] = data.vcs.map(c => {
            const vc = VertexConfiguration.fromName(c.name);
            vc.rotate(new Vector(0, 0), c.rot);
            vc.translate(new Vector(c.pos[0], c.pos[1]));
            return vc;
        });
        return new SeedConfiguration(vcs);
    }

    static decodeFull = (data: FullSeedConfiguration): SeedConfiguration => {
        const vcNames = data.name.slice(1, -1).split(';');
        const vcsCenters = data.vcsCenters.map(c => new Vector(c.x, c.y));
        const decodedPolygons = data.polygons.map((p: { type: string; n: number; vertices: { x: number; y: number }[]; d?: number; alpha?: number; angles?: number[]; sides?: string[] }) => {
            const vertices = p.vertices.map(v => new Vector(v.x, v.y));
            switch (p.type) {
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
            const vcPolygons = decodedPolygons.filter(p =>
                p.vertices.some(v => isWithinTolerance(v, center))
            );
            vcs.push(new VertexConfiguration(vcPolygons, null, vcNames[i]));
        }
        const seed = new SeedConfiguration(vcs);
        if (data.gyrations?.length) {
            seed.gyrations = data.gyrations.map((g) => ({ center: new Vector(g.center.x, g.center.y), order: g.order }));
        }
        if (data.reflections?.length) {
            seed.reflections = data.reflections.map((r) => ({
                axis: new Vector(r.axis.x, r.axis.y),
                point: new Vector(r.point.x, r.point.y),
            }));
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