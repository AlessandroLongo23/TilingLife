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
    adjacencyMatrix: boolean[][];

    constructor(vertexConfigurations: VertexConfiguration[]) {
        this.nodes = [];
        this.adjacencyMatrix = [];

        for (let i = 0; i < vertexConfigurations.length; i++) {
            this.nodes.push(new VCNode(vertexConfigurations[i], i));
            this.adjacencyMatrix.push([]);
            for (let j = 0; j < vertexConfigurations.length; j++) {
                this.adjacencyMatrix[i].push(false);
            }
        }

        for (let i = 0; i < vertexConfigurations.length; i++) {
            for (let j = i + 1; j < vertexConfigurations.length; j++) {
                if (vertexConfigurations[i].isCompatible(vertexConfigurations[j])) {
                    this.nodes[i].neighbors.push(this.nodes[j]);
                    this.nodes[j].neighbors.push(this.nodes[i]);

                    this.adjacencyMatrix[i][j] = true;
                    this.adjacencyMatrix[j][i] = true;
                }
            }
        }
    }
}
