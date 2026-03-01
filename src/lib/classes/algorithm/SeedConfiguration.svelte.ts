import {
    Vector,
    type Polygon,
    VertexConfiguration,
} from "$classes";
import { deduplicatePolygons } from "$utils";

export interface CompactVC {
    name: string;
    pos: [number, number];
    rot: number;
}

export interface CompactSeedConfiguration {
    vcs: CompactVC[];
}

export class SeedConfiguration {
    name: string;
    vertexConfigurations: VertexConfiguration[];
    polygons: Polygon[];

    constructor(vertexConfigurations: VertexConfiguration[]) {
        this.vertexConfigurations = vertexConfigurations;
        this.polygons = deduplicatePolygons(vertexConfigurations.flatMap(vc => vc.polygons));
        this.name = this.computeName();
    }

    static merge = (seedA: SeedConfiguration, seedB: SeedConfiguration): SeedConfiguration => {
        return new SeedConfiguration([...seedA.vertexConfigurations, ...seedB.vertexConfigurations]);
    }

    rotate = (origin: Vector, angle: number): SeedConfiguration => {
        return new SeedConfiguration(this.vertexConfigurations.map(vc => VertexConfiguration.rotate(vc, origin, angle)));
    }

    translate = (vector: Vector): SeedConfiguration => {
        return new SeedConfiguration(this.vertexConfigurations.map(vc => VertexConfiguration.translate(vc, vector)));
    }

    mirror = (point: Vector, dir: Vector): SeedConfiguration => {
        return new SeedConfiguration(this.vertexConfigurations.map(vc => VertexConfiguration.mirror(vc, point, dir)));
    }

    glide = (point: Vector, dir: Vector, delta: number): SeedConfiguration => {
        return new SeedConfiguration(this.vertexConfigurations.map(vc => VertexConfiguration.glide(vc, point, dir, delta)));
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

    computeName = (): string => {
        return this.vertexConfigurations.map(vc => vc.name).join(',');
    }

    encode = (): Object => {
        return {
            polygons: this.polygons.map(p => p.encode()),
        };
    }

    /** Compact format: VC name + shared-vertex position + rotation. */
    encodeCompact = (): CompactSeedConfiguration => {
        return {
            vcs: this.vertexConfigurations.map(vc => {
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

    clone = (): SeedConfiguration => {
        return new SeedConfiguration(this.vertexConfigurations.map(vc => vc.clone()));
    }
}