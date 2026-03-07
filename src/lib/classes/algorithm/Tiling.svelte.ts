import { SeedConfiguration, type Polygon } from "$classes";
import type { Gyration, Reflection } from "$classes";
import type { FullSeedConfiguration } from "./SeedConfiguration.svelte";
import { encodeGenerator, decodeGenerator } from "$lib/algorithm/generatorEncoding";
import type { EncodedGenerator } from "$lib/algorithm/generatorEncoding";

export interface EncodedTiling {
    seed: FullSeedConfiguration | Record<string, unknown>;
    generators: (EncodedGenerator | Record<string, unknown>)[];
    iterations: number;
}

export class AlgorithmTiling {
    seed: SeedConfiguration;
    generators: (Gyration | Reflection)[];
    iterations: number;

    constructor(seed: SeedConfiguration, generators: (Gyration | Reflection)[], iterations: number) {
        this.seed = seed;
        this.generators = generators;
        this.iterations = iterations;
    }

    static fromSeedAndGenerators = (
        seed: SeedConfiguration,
        generators: (Gyration | Reflection)[],
        iterations: number
    ): AlgorithmTiling => {
        return new AlgorithmTiling(seed, generators, iterations);
    }

    encode = (shortKeys = false): EncodedTiling => {
        if (shortKeys) {
            return {
                seed: this.seed.encodeShort(),
                generators: this.generators.map((g) => {
                    if ("order" in g) {
                        return { t: "gyration" as const, c: [g.center.x, g.center.y] as [number, number], o: g.order };
                    }
                    return {
                        t: "reflection" as const,
                        a: [g.axis.x, g.axis.y] as [number, number],
                        pt: [g.point.x, g.point.y] as [number, number],
                    };
                }),
                iterations: this.iterations,
            };
        }
        return {
            seed: this.seed.encode(),
            generators: this.generators.map((g) => encodeGenerator(g)),
            iterations: this.iterations,
        };
    }

    /** Expand the tiling by applying generators, return polygon encodings for drawing. */
    expandToPolygons = (): object[] => {
        let expanded = this.seed.clone();
        for (let i = 0; i < this.iterations; i++) {
            expanded = SeedConfiguration.applyGenerators(expanded, this.generators);
        }
        return expanded.polygons.map((p: Polygon) => p.encode());
    }

    /** Decode and expand an encoded tiling to polygon encodings for drawing. */
    static expandToPolygons = (data: EncodedTiling): object[] => {
        const seed = SeedConfiguration.decodeFull(data.seed);
        const generators = data.generators.map(decodeGenerator);
        let expanded = seed.clone();
        for (let i = 0; i < (data.iterations ?? 3); i++) {
            expanded = SeedConfiguration.applyGenerators(expanded, generators);
        }
        return expanded.polygons.map((p: Polygon) => p.encode());
    }
}

