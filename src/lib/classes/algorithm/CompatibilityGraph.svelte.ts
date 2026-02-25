import { Vector } from "../Vector.svelte";
import type { VertexConfiguration } from "./VertexConfiguration.svelte";

export class VCNode {
    vertexConfiguration: VertexConfiguration;
    neighbors: VCNode[];
    index: number;

    pos: Vector = new Vector(0, 0);
    vel: Vector = new Vector(0, 0);
    force: Vector = new Vector(0, 0);

    radius: number = 40;
    pinned: boolean = false;
    thumbnail: HTMLCanvasElement | null = null;

    constructor(vertexConfiguration: VertexConfiguration, index: number = 0) {
        this.vertexConfiguration = vertexConfiguration;
        this.neighbors = [];
        this.index = index;
    }

    resetForce() {
        this.force.set(0, 0);
    }
}

export class CompatibilityGraph {
    nodes: VCNode[];

    constructor(vertexConfigurations: VertexConfiguration[]) {
        this.nodes = [];

        for (let i = 0; i < vertexConfigurations.length; i++) {
            this.nodes.push(new VCNode(vertexConfigurations[i], i));
        }

        for (let i = 0; i < vertexConfigurations.length; i++) {
            for (let j = i + 1; j < vertexConfigurations.length; j++) {
                if (vertexConfigurations[i].isCompatible(vertexConfigurations[j])) {
                    this.nodes[i].neighbors.push(this.nodes[j]);
                    this.nodes[j].neighbors.push(this.nodes[i]);
                }
            }
        }
    }

    static fromAdjacencyList(
        adjacencyList: Record<string, string[]>,
        vertexConfigurations: VertexConfiguration[]
    ): CompatibilityGraph {
        const graph = Object.create(CompatibilityGraph.prototype) as CompatibilityGraph;
        graph.nodes = [];

        const nameToNode = new Map<string, VCNode>();

        for (let i = 0; i < vertexConfigurations.length; i++) {
            const node = new VCNode(vertexConfigurations[i], i);
            graph.nodes.push(node);
            nameToNode.set(vertexConfigurations[i].name, node);
        }

        for (const node of graph.nodes) {
            const neighborNames = adjacencyList[node.vertexConfiguration.name] ?? [];
            for (const neighborName of neighborNames) {
                const neighbor = nameToNode.get(neighborName);
                if (neighbor && neighbor.index > node.index) {
                    node.neighbors.push(neighbor);
                    neighbor.neighbors.push(node);
                }
            }
        }

        return graph;
    }
}
