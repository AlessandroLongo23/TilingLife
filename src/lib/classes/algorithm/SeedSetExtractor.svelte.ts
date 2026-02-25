import type { CompatibilityGraph } from "$classes";

export class SeedSetExtractor {
    compatibilityGraph: CompatibilityGraph;

    constructor(compatibilityGraph: CompatibilityGraph) {
        this.compatibilityGraph = compatibilityGraph;
    }

    findSeedSets = (k: number): string[][] => {
        const graph = new Map<number, number[]>();
        for (const node of this.compatibilityGraph.nodes) {
            graph.set(node.index, node.neighbors.map(n => n.index));
        }

        const subgraphs = new Set<string>();
        const validSubgraphs: number[][] = [];

        const findSubgraphs = (currentSubset: number[], neighbors: Set<number>) => {
            const key = [...currentSubset].sort((a, b) => a - b).join(',');
            if (!subgraphs.has(key)) {
                subgraphs.add(key);
                validSubgraphs.push([...currentSubset]);
                if (currentSubset.length < k) {
                    for (const neighbor of neighbors) {
                        if (!currentSubset.includes(neighbor)) {
                            const newSubset = [...currentSubset, neighbor];
                            const newNeighbors = new Set(neighbors);
                            const neighborEdges = graph.get(neighbor) || [];
                            for (const edge of neighborEdges) {
                                newNeighbors.add(edge);
                            }
                            findSubgraphs(newSubset, newNeighbors);
                        }
                    }
                }
            }
        }

        for (const [node, edges] of graph.entries()) {
            findSubgraphs([node], new Set(edges));
        }

        const seedSets: string[][] = [];
        const seen = new Set<string>();

        for (const subgraph of validSubgraphs) {
            const m = subgraph.length;
            if (m > 1) {
                const extraCount = k - m;
                const distributions = this.getCombinationsWithReplacement(subgraph, extraCount);
                for (const dist of distributions) {
                    const fullSet = [...subgraph, ...dist];
                    const names = fullSet.map(i => this.compatibilityGraph.nodes[i].vertexConfiguration.name).sort();
                    const key = names.join('|');
                    if (!seen.has(key)) {
                        seen.add(key);
                        seedSets.push(names);
                    }
                }
            }
        }

        return seedSets;
    }

    getCombinationsWithReplacement = <T>(elements: T[], count: number): T[][] => {
        if (count === 0) return [[]];
        if (elements.length === 0) return [];
        const [first, ...rest] = elements;
        const combs: T[][] = [];
        for (let i = 0; i <= count; i++) {
            const tailCombs = this.getCombinationsWithReplacement(rest, count - i);
            for (const tail of tailCombs) {
                combs.push([...Array(i).fill(first), ...tail]);
            }
        }
        return combs;
    }
}
