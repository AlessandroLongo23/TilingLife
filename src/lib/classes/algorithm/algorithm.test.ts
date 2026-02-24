import { PolygonsGenerator, VCGenerator, PolygonType, type GeneratorParameters, PolygonSignature, CompatibilityGraph } from '$classes';
import { describe, it, expect } from 'vitest';
import { toRadians } from '$utils';
import fs from 'fs';

describe('VCGenerator', () => {
    it('generates vertex configurations for regular polygons', () => {
        const parameters: GeneratorParameters = {
            [PolygonType.REGULAR]: {
                n_max: 42
            },
            // [PolygonType.STAR_REGULAR]: {
            //     n_max: 12,
            //     angle: Math.PI / 12
            // },
            // [PolygonType.STAR_PARAMETRIC]: {
            //     n_max: 12,
            //     angle: Math.PI / 12
            // },
            // [PolygonType.EQUILATERAL]: {
            //     n_max: 8,
            //     angle: Math.PI / 12
            // }
        };
        const additionalPolygons: PolygonSignature[] = [];

        // STEP 1: generate the polygons based on the selected parameters
        const polygonsGenerator = new PolygonsGenerator(parameters, additionalPolygons);
        const polygonsFilePath = 'src/lib/classes/algorithm/polygons.json';
        let savedPolygons: string[] = [];
        if (fs.existsSync(polygonsFilePath)) {
            const fileData = fs.readFileSync(polygonsFilePath, 'utf-8');
            if (fileData.trim()) {
                savedPolygons = JSON.parse(fileData);
            }
        }
        const newPolygonNames = polygonsGenerator.polygons.map(p => p.name);
        for (const name of newPolygonNames) {
            if (!savedPolygons.includes(name)) {
                savedPolygons.push(name);
            }
        }
        fs.writeFileSync(polygonsFilePath, JSON.stringify(savedPolygons, null, 4));
        
        // STEP 2: generate all vertex configurations from the selected polygon set
        const vcGenerator = new VCGenerator(polygonsGenerator.polygons);
        const vertexConfigurations = vcGenerator.generateVertexConfigurations();
        const vcFilePath = 'src/lib/classes/algorithm/vcs.json';
        let savedVCs: string[] = [];
        if (fs.existsSync(vcFilePath)) {
            const fileData = fs.readFileSync(vcFilePath, 'utf-8');
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
        fs.writeFileSync(vcFilePath, JSON.stringify(savedVCs, null, 4));

        // STEP 3: generate the compatibility graph of all vertex configurations
        const compatibilityGraph = new CompatibilityGraph(vertexConfigurations);
        // save the compatibility adjacency matrix to a file, with 0 and 1 instead of false and true
        const compatibilityGraphFilePath = 'src/lib/classes/algorithm/compatibilityGraph.json';
        fs.writeFileSync(compatibilityGraphFilePath, JSON.stringify(compatibilityGraph.adjacencyMatrix.map(row => row.map(cell => cell ? 1 : 0)).join('\n'), null, 4));
    }, 120 * 1000);
});