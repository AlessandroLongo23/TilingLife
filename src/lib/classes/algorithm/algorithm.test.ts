import { describe, it, expect } from 'vitest';
import { VCGenerator, PolygonCategory, type GeneratorParameters } from '$classes/algorithm';

describe('VCGenerator', () => {
    it('generates vertex configurations for regular polygons', () => {
        const parameters: GeneratorParameters = {
            categories: [PolygonCategory.REGULAR],
            angle: Math.PI / 6,
            n_max: 24
        };

        const vcGenerator = new VCGenerator(parameters);
        const vertexConfigurations = vcGenerator.generateVertexConfigurations();

        console.log(vertexConfigurations);

        expect(vertexConfigurations).toBeDefined();
        expect(vertexConfigurations.length).toBeGreaterThan(0);
    });
});