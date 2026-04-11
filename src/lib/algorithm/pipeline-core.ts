/**
 * Pure pipeline logic (no fs) - used by API routes and run-pipeline script.
 * Extracted from run-pipeline.ts for reuse.
 */

import {
	PolygonsGenerator,
	VCGenerator,
	PolygonType,
	type GeneratorParameters,
	PolygonSignature,
	VertexConfiguration,
} from '$classes';
import { comparePolygonNames, compareVertexConfigurationNames } from '$utils';
import { extractDataFromPolygonName } from '$utils/geometry';
import { buildParamsFolderName } from '$lib/algorithm/paramsFolder';

/** Generate polygons from parameters. Returns polygon signatures and sorted names. */
export function generatePolygons(
	parameters: GeneratorParameters,
	additionalPolygons: PolygonSignature[] = []
): { signatures: PolygonSignature[]; names: string[]; paramsFolder: string } {
	const paramsFolder = buildParamsFolderName(parameters);
	const polygonsGenerator = new PolygonsGenerator(parameters, additionalPolygons);
	const names = polygonsGenerator.polygons.map((p) => p.name).sort((a, b) => comparePolygonNames(a, b));
	return { signatures: polygonsGenerator.polygons, names, paramsFolder };
}

/** Convert polygon names to PolygonSignature[]. Skips names that cannot be parsed. */
export function polygonNamesToSignatures(names: string[]): PolygonSignature[] {
	const signatures: PolygonSignature[] = [];
	for (const name of names) {
		try {
			const data = extractDataFromPolygonName(name);
			if (data) {
				signatures.push(new PolygonSignature(data));
			}
		} catch {
			// Skip invalid names
		}
	}
	return signatures;
}

/** Generate vertex configurations from polygon names. Returns VC names. */
export function generateVCs(polygonNames: string[]): string[] {
	const signatures = polygonNamesToSignatures(polygonNames);
	if (signatures.length === 0) return [];
	const vcGenerator = new VCGenerator(signatures);
	const vcs = vcGenerator.generateVertexConfigurations();
	return vcs.map((vc: VertexConfiguration) => vc.name).sort((a, b) => compareVertexConfigurationNames(a, b));
}

/** Generate VCs and compatibility graph. Returns vcNames and adjacency list for all generated VCs. */
export function generateVCsWithCompatibilityGraph(polygonNames: string[]): {
	vcNames: string[];
	adjacencyList: Record<string, string[]>;
} {
	const signatures = polygonNamesToSignatures(polygonNames);
	if (signatures.length === 0) return { vcNames: [], adjacencyList: {} };
	const vcGenerator = new VCGenerator(signatures);
	const vcs = vcGenerator.generateVertexConfigurations();
	const vcNames = vcs.map((vc: VertexConfiguration) => vc.name).sort((a, b) => compareVertexConfigurationNames(a, b));

	const adjacencyList: Record<string, string[]> = {};
	for (const vc of vcs) {
		adjacencyList[vc.name] = [];
	}
	const n = vcs.length;
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			if (vcs[i].isCompatible(vcs[j])) {
				adjacencyList[vcs[i].name].push(vcs[j].name);
				adjacencyList[vcs[j].name].push(vcs[i].name);
			}
		}
	}
	return { vcNames, adjacencyList };
}

export { buildParamsFolderName };
