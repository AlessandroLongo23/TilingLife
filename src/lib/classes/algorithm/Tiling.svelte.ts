import { SeedConfiguration, type Polygon } from "$classes";
import type { Gyration, Reflection } from "$classes";
import type { FullSeedConfiguration } from "./SeedConfiguration.svelte";
import { encodeGenerator, decodeGenerator } from "$lib/algorithm/generatorEncoding";
import type { EncodedGenerator } from "$lib/algorithm/generatorEncoding";

export interface EncodedTiling {
    seed: FullSeedConfiguration;
    generators: EncodedGenerator[];
    iterations: number;
}

export class Tiling {
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
    ): Tiling => {
        return new Tiling(seed, generators, iterations);
    }

    encode = (): EncodedTiling => {
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

