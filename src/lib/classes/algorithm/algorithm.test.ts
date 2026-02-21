import { describe, it, expect } from 'vitest';
import { VCGenerator, PolygonCategory, type GeneratorParameters } from '$classes/algorithm';
import { toDegrees } from '$utils';
import fs from 'fs';
describe('VCGenerator', () => {
    it('generates vertex configurations for regular polygons', () => {
        const parameters: GeneratorParameters = {
            categories: [
                PolygonCategory.REGULAR,
                PolygonCategory.STAR_REGULAR,
                PolygonCategory.STAR_PARAMETRIC,
            ],
            angle: Math.PI / 6,
            n_max: 24
        };
        const vcGenerator = new VCGenerator(parameters);
        console.log(vcGenerator.polygonsGenerator.polygons.map(p => p.name));

        const vertexConfigurations = vcGenerator.generateVertexConfigurations();
        const filePath = 'src/lib/classes/algorithm/vcs.json';
        let savedVCs: string[] = [];
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, 'utf-8');
            if (fileData.trim()) {
                savedVCs = JSON.parse(fileData);
            }
        }
        const newVCNames = vertexConfigurations.map(vc => vc.name);
        for (const name of newVCNames) {
            if (!savedVCs.includes(name)) {
                savedVCs.push(name);
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(savedVCs, null, 4));
        expect(vertexConfigurations).toBeDefined();
        expect(vertexConfigurations.length).toBeGreaterThan(0);
    });
});