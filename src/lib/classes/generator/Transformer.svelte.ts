import { tolerance, debugView, offsets, debugManager } from '$stores';
import { sortPointsByAngleAndDistance, getSpatialKey, isWithinTolerance } from '$utils';
import { Polygon } from '../polygons/Polygon.svelte';
import { Vector } from '../Vector.svelte';
import { Tiling } from '../Tiling.svelte';
import { RelativeToType, Transform } from '../Transform';

export class Transformer {
    private _transforms: Transform[];

    constructor() {}

    get transforms() {
        return this._transforms;
    }

    set transforms(transforms: Transform[]) {
        this._transforms = transforms;
    }

    mirrorRelativeTo = (tiling: Tiling, transformationIndex: number, additionalNodes: Polygon[]) => {
        let origin = this.transforms[transformationIndex].anchor; 
        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo?.type;
            let index = this.transforms[transformationIndex].relativeTo?.index;

            origin = this.findOrigin(tiling.anchorNodes, type!, index!);
            this.transforms[transformationIndex].anchor = origin;
        }
        
        const newNodes: Polygon[] = [];
        for (let newLayerNode of  [...tiling.newLayerNodes, ...tiling.seedNodes, ...additionalNodes]) {
            let newNode = newLayerNode.clone();

            if (this.transforms[transformationIndex].relativeTo?.type === RelativeToType.HALFWAY) {
                let dir: Vector | null = null;
                
                for (let i = 0; i < tiling.anchorNodes.length; i++) {
                    for (let k = 0; k < tiling.anchorNodes[i].halfways.length; k++) {
                        if (isWithinTolerance(tiling.anchorNodes[i].halfways[k], origin)) {
                            const v1 = tiling.anchorNodes[i].vertices[k];
                            const v2 = tiling.anchorNodes[i].vertices[(k + 1) % tiling.anchorNodes[i].n];
                            
                            dir = Vector.sub(v2, v1).normalize();
                            break;
                        }
                    }

                    if (dir) break;
                }

                newNode.mirror(origin, dir!);
            } else {
                newNode.mirror(origin, new Vector(0, 1));
            }

            newNodes.push(newNode);
        }

        return this.filterDuplicates([...tiling.nodes, ...tiling.seedNodes, ...additionalNodes], newNodes);
    }

    mirrorByAngle = (tiling: Tiling, alpha: number, additionalNodes: Polygon[]): Polygon[] => {
        const newNodes: Polygon[] = [];
        for (let angle = alpha; angle < 2 * Math.PI; angle *= 2) {
            const anchor = new Vector();
            const dir = Vector.fromAngle(angle + Math.PI / 2);
            for (let newLayerNode of [...tiling.newLayerNodes, ...tiling.seedNodes, ...additionalNodes, ...newNodes]) {
                newNodes.push(newLayerNode.clone().mirror(anchor, dir));
            }
        }

        return this.filterDuplicates([...tiling.nodes, ...tiling.seedNodes, ...additionalNodes], newNodes);
    }

    rotateRelativeTo = (tiling: Tiling, transformationIndex: number, additionalNodes: Polygon[]) => {
        let origin = this.transforms[transformationIndex].anchor;

        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo?.type;
            let index = this.transforms[transformationIndex].relativeTo?.index;

            origin = this.findOrigin(tiling.anchorNodes, type!, index!);
            this.transforms[transformationIndex].anchor = origin;
        }

        const newNodes: Polygon[] = [];
        const rotationAngle = this.transforms[transformationIndex].angle;
        for (let angle = rotationAngle; angle < 2 * Math.PI; angle += rotationAngle)
            for (const newLayerNode of [...tiling.newLayerNodes, ...tiling.seedNodes, ...additionalNodes])
                newNodes.push(newLayerNode.clone().rotate(origin, angle));

        return this.filterDuplicates([...tiling.nodes, ...tiling.seedNodes, ...additionalNodes], newNodes);
    }

    rotateByAngle = (tiling: Tiling, alpha: number, additionalNodes: Polygon[]) => {
        const newNodes: Polygon[] = [];
        for (let angle = alpha; angle < 2 * Math.PI; angle += alpha)
            for (const newLayerNode of [...tiling.newLayerNodes, ...tiling.seedNodes, ...additionalNodes])
                newNodes.push(newLayerNode.clone().rotate(new Vector(), angle));

        return this.filterDuplicates([...tiling.nodes, ...tiling.seedNodes, ...additionalNodes], newNodes);
    }

    translateRelativeTo = (tiling: Tiling, transformationIndex: number, additionalNodes: Polygon[]) => {
        let origin = this.transforms[transformationIndex].anchor;

        if (!origin) {
            let type = this.transforms[transformationIndex].relativeTo?.type;
            let index = this.transforms[transformationIndex].relativeTo?.index;

            origin = this.findOrigin(tiling.anchorNodes, type!, index!);
            this.transforms[transformationIndex].anchor = origin;
        }
        
        const newNodes: Polygon[] = [];
        for (let newLayerNode of [...tiling.newLayerNodes, ...tiling.seedNodes, ...additionalNodes, ...newNodes]) {
            newNodes.push(newLayerNode.clone().translate(origin));
        }

        return this.filterDuplicates([...tiling.nodes, ...tiling.seedNodes, ...additionalNodes], newNodes);
    }

    filterDuplicates = (nodes: Polygon[], newNodes: Polygon[]): Polygon[] => {
        const spatialMap = new Map();
        for (let node of nodes) {
            const key = getSpatialKey(node.centroid.x, node.centroid.y);
            if (!spatialMap.has(key)) {
                spatialMap.set(key, []);
            }
            spatialMap.get(key).push(node);
        }
        return newNodes.filter(newNode => !spatialMap.has(getSpatialKey(newNode.centroid.x, newNode.centroid.y)));
    }

    findOrigin = (nodes: Polygon[], type: RelativeToType, index: number): Vector => {
        if (debugView) debugManager.startTimer(`findOrigin (${type}${index})`);
        
        const deduplicatePoints = (points: Vector[]): Vector[] => {
            const spatialMap = new Map();
            let uniquePoints: Vector[] = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const baseKey = getSpatialKey(point.x, point.y);
                const baseX = Math.floor(point.x / (tolerance * 2));
                const baseY = Math.floor(point.y / (tolerance * 2));
                
                let isDuplicate = false;
                
                for (const [dx, dy] of offsets) {
                    const key = `${baseX + dx},${baseY + dy}`;
                    
                    const potentialDuplicates = spatialMap.get(key) || [];
                    
                    for (const uniqueIndex of potentialDuplicates) {
                        if (isWithinTolerance(uniquePoints[uniqueIndex], point)) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (isDuplicate) break;
                }
                
                if (!isDuplicate) {
                    const newIndex = uniquePoints.length;
                    uniquePoints.push(point);
                    
                    if (!spatialMap.has(baseKey)) {
                        spatialMap.set(baseKey, []);
                    }
                    spatialMap.get(baseKey).push(newIndex);
                }
            }
            
            return uniquePoints;
        };
        
        let result: Vector;
        
        if (type === RelativeToType.CENTROID) {
            let centroids = nodes.map(node => node.centroid);
            
            let uniqueCentroids = deduplicatePoints(centroids);
            let sortedCentroids = sortPointsByAngleAndDistance(uniqueCentroids);

            sortedCentroids = sortedCentroids.filter(centroid => !isWithinTolerance(centroid, new Vector()));

            result = sortedCentroids[index - 1];
        } 
        
        else if (type === RelativeToType.HALFWAY) {
            let halfways = nodes.map(node => node.halfways).flat();
            
            let uniqueHalfways = deduplicatePoints(halfways);
            let sortedHalfways = sortPointsByAngleAndDistance(uniqueHalfways);

            result = sortedHalfways[index - 1];
        } 
        
        else if (type === RelativeToType.VERTEX) {
            let vertices = nodes.map(node => node.vertices).flat();
            
            let uniqueVertices = deduplicatePoints(vertices);
            let sortedVertices = sortPointsByAngleAndDistance(uniqueVertices);

            result = sortedVertices[index - 1];
        }
        
        if (debugView) debugManager.endTimer(`findOrigin (${type}${index})`);
        
        return result!;
    }
}