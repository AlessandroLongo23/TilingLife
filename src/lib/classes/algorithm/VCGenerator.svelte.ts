import { type GeneratorParameters, VertexConfiguration } from '$classes';
import { compareArrays, toDegrees } from '$utils';
import { PolygonsGenerator } from './PolygonsGenerator.svelte';

export class VCGenerator {
    polygonsGenerator: PolygonsGenerator;
    vertexConfigurations: VertexConfiguration[] = [];

    constructor(parameters: GeneratorParameters) {
        this.polygonsGenerator = new PolygonsGenerator(parameters);
    }

    generateVertexConfigurations = (): VertexConfiguration[] => {
        this.vertexConfigurations = [];

        let root = new VCTreeNode(null, new VertexConfiguration([]));
        let stack: VCTreeNode[] = [root];
        while (stack.length > 0) {
            let current: VCTreeNode = stack.pop() as VCTreeNode;
            if (toDegrees(current.vertexConfiguration.angle) < 360) {
                for (let polygonData of this.polygonsGenerator.polygons) {
                    let newNode = current.clone();
                    newNode.parent = current;
                    newNode.vertexConfiguration.addPolygon(polygonData);
                    if (newNode.vertexConfiguration.valid) {
                        current.children.push(newNode);
                        stack.unshift(newNode);
                    }
                }
            } else if (toDegrees(current.vertexConfiguration.angle) === 360) {
                this.vertexConfigurations.push(current.vertexConfiguration.clone());
            }
        }

        const uniqueVertexConfigurations = this.vertexConfigurations.filter(vc => {
            const smallest_name = cycleToMinimumLexicographicalOrder(vc.polygons.map(p => p.name)).join(',');
            return isEqual(vc.name.split(','), smallest_name.split(','));
        });

        return uniqueVertexConfigurations;
    }
}

const isEqual = (array1: string[], array2: string[]): boolean => {
    if (array1.length !== array2.length) return false;
    for (let i = 0; i < array1.length; i++)
        if (array1[i] !== array2[i]) return false;
    return true;
}

const cycleToMinimumLexicographicalOrder = (array: string[]): string[] => {
    let min = array.slice(0);
    for (let i = 0; i < array.length; i++) {
        let rotated = array.slice(i).concat(array.slice(0, i));
        if (compareArrays(rotated, min) < 0) {
            min = rotated;
        }
    }

    return min;
}

const cycleToMinimumChiralLexicographicalOrder = (array: string[]): string[] => {
    let min = array.slice(0);
    for (let i = 0; i < array.length; i++) {
        let rotated = array.slice(i).concat(array.slice(0, i));
        if (compareArrays(rotated, min) < 0) {
            min = rotated;
        }
    }

    let reversed = array.slice().reverse();
    for (let i = 0; i < array.length; i++) {
        let rotated = reversed.slice(i).concat(reversed.slice(0, i));
        if (compareArrays(rotated, min) < 0) {
            min = rotated;
        }
    }

    return min;
}

export class VCTreeNode {
    parent: VCTreeNode | null;
    children: VCTreeNode[];
    vertexConfiguration: VertexConfiguration;

    constructor(parent: VCTreeNode | null, vertexConfiguration: VertexConfiguration) {
        this.parent = parent;
        this.children = [];
        this.vertexConfiguration = vertexConfiguration;
    }

    clone = (): VCTreeNode => {
        return new VCTreeNode(this.parent, this.vertexConfiguration.clone());
    }
}