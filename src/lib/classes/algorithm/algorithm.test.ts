import { VCGenerator, PolygonCategory, type GeneratorParameters } from '$classes/algorithm';
import { CompatibilityGraph } from './CompatibilityGraph.svelte';
import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('VCGenerator', () => {
    it('generates vertex configurations for regular polygons', () => {
        // STEP 1: select the categories and parameters and run the polygons generation 
        const parameters: GeneratorParameters = {
            categories: [
                PolygonCategory.REGULAR,
                // PolygonCategory.STAR_REGULAR,
                // PolygonCategory.STAR_PARAMETRIC,
            ],
            angle: Math.PI / 6,
            n_max: 42
        };
        const vcGenerator = new VCGenerator(parameters);

        // STEP 2: generate all vertex configurations from the selected polygon set
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


        // STEP 3: generate the compatibility graph of all vertex configurations
        const compatibilityGraph = new CompatibilityGraph(vertexConfigurations);
        // save the compatibility adjacency matrix to a file, with 0 and 1 instead of false and true
        const compatibilityGraphFilePath = 'src/lib/classes/algorithm/compatibilityGraph.json';
        fs.writeFileSync(compatibilityGraphFilePath, JSON.stringify(compatibilityGraph.adjacencyMatrix.map(row => row.map(cell => cell ? 1 : 0)).join('\n'), null, 4));
    });
});