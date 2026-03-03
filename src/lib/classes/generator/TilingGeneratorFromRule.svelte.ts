import { tolerance, debugView, transformSteps, offsets, debugManager } from '$stores';
import { getClockwiseAngle, getSpatialKey, isWithinTolerance } from '$utils';
import { 
    PolygonType, 
    RegularPolygon, 
    StarRegularPolygon, 
    StarParametricPolygon, 
    IsohedralPolygon, 
    EquilateralPolygon,
    GenericPolygon, 
    type Polygon, 
    type ShapeSeed, 
    TilingGenerator, 
    Tiling, 
    Vector, 
    Transformer, 
    Parser,
    TransformType 
} from '$classes';

export class TilingGeneratorFromRule extends TilingGenerator {
    parser: Parser;
    transformer: Transformer;

    constructor() {
        super();

        this.parser = new Parser();
        this.transformer = new Transformer();
    }

    generateFromRule(rule: string): Tiling {
        this.tiling = new Tiling();
        this.parser.parseRule(rule);
        this.transformer.transforms = this.parser.transforms;

        if (debugView) {
            debugManager.reset();
            debugManager.startTimer("Tiling generation");
        }
        this.tiling.nodes = [];
        
        this.generateSeed();
        this.applyTransformations();

        if (this.parser.dual) this.computeDual();

        this.calculateNeighbors();

        // this.golEngine.calculateGoLNeighbors();
        
        // if (debugView) debugManager.endTimer("Tiling generation");
        // updateDebugStore();

        this.tilingChecker.findVertexConfigurations(this.tiling);

        return this.tiling;
    }

    generateSeed = () => {
        if (debugView) debugManager.startTimer("Seed");
        this.addCoreNode();

        for (let i = 1; i < this.parser.shapeSeed.length; i++) {
            let newNodes: Polygon[] = [];
            let indexOff: number = 0;
            for (let j = 0; j < this.parser.shapeSeed[i].length; j++) {
                if (this.parser.shapeSeed[i][j].n == 0) {
                    indexOff += 1;
                    continue;
                }

                const [anchor, dir] = this.findAnchor(newNodes, indexOff);
                
                let newNode: Polygon | null = null;
                const shapeSeed: ShapeSeed = this.parser.shapeSeed[i][j];
                switch (shapeSeed.type) {
                    case PolygonType.REGULAR:
                        newNode = RegularPolygon.fromAnchorAndDir(shapeSeed.n, anchor, dir);
                        break;
                    case PolygonType.STAR_REGULAR:
                        newNode = StarRegularPolygon.fromAnchorAndDir(shapeSeed.n, anchor, dir, shapeSeed.alpha || 0);
                        break;
                    case PolygonType.STAR_PARAMETRIC:
                        newNode = StarParametricPolygon.fromAnchorAndDir(shapeSeed.n, anchor, dir, shapeSeed.alpha || 0);
                        break;
                    case PolygonType.EQUILATERAL:
                        newNode = EquilateralPolygon.fromAnchorAndDir(shapeSeed.n, anchor, dir, shapeSeed.angles || []);
                        break;
                    case PolygonType.ISOHEDRAL:
                        newNode = IsohedralPolygon.fromAnchorAndDir(shapeSeed.n, anchor, dir, shapeSeed.sides || []);
                        break;
                    case PolygonType.GENERIC:
                        newNode = GenericPolygon.fromAnchorAndDir(shapeSeed.n, anchor, dir, shapeSeed.sides || [], shapeSeed.angles || []);
                        break;
                    default:
                        throw new Error('Invalid shape seed type');
                }

                if (newNode) newNodes.push(newNode);
            }

            this.tiling.nodes = this.tiling.nodes.concat(newNodes);
        }

        this.tiling.newLayerNodes = [...this.tiling.nodes];
        this.tiling.seedNodes = [...this.tiling.nodes];
        if (debugView) debugManager.endTimer("Seed");
    }

    addCoreNode = () => {
        const coreNode = this.parser.shapeSeed[0][0];

        let centerCoreToOrigin = true;
        switch (coreNode.type) {
            case PolygonType.REGULAR:
                if (coreNode.n == 3) {
                    if (coreNode.special) {
                        this.tiling.coreNode = RegularPolygon.fromAnchorAndDir(3, new Vector(), new Vector(1, 0));
                    } else {
                        centerCoreToOrigin = false;
                        this.tiling.coreNode = RegularPolygon.fromAnchorAndDir(3, new Vector(), new Vector(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)));
                    }
                } else {
                    this.tiling.coreNode = RegularPolygon.fromAnchorAndDir(coreNode.n, new Vector(), new Vector(0, 1));
                }
                break;
            case PolygonType.STAR_REGULAR:
                this.tiling.coreNode = StarRegularPolygon.fromCentroidAndAngle(coreNode.n, coreNode.d || 0, new Vector(), 0);
                break;
            case PolygonType.STAR_PARAMETRIC:
                this.tiling.coreNode = StarParametricPolygon.fromCentroidAndAngle(coreNode.n, coreNode.alpha || 0, new Vector(), 0);
                break;
            case PolygonType.EQUILATERAL:
                this.tiling.coreNode = EquilateralPolygon.fromAnchorAndDir(coreNode.n, new Vector(), new Vector(0, 1), coreNode.angles || []);
                break;
            case PolygonType.ISOHEDRAL:
                this.tiling.coreNode = IsohedralPolygon.fromAnchorAndDir(coreNode.n, new Vector(), new Vector(0, 1), coreNode.sides || []);
                break;
            case PolygonType.GENERIC:
                this.tiling.coreNode = GenericPolygon.fromAnchorAndDir(coreNode.n, new Vector(), new Vector(0, 1), coreNode.sides || [], coreNode.angles || []);
                break;
            default:
                throw new Error('Invalid core node type');
        }

        if (centerCoreToOrigin) {
            this.tiling.coreNode.translate(new Vector(-this.tiling.coreNode.centroid.x, -this.tiling.coreNode.centroid.y));
        }

        this.tiling.nodes.push(this.tiling.coreNode);
    }

    applyTransformations = () => {
        if (debugView) debugManager.startTimer("Transformations");
        let layers;
        transformSteps.subscribe((v) => {
            layers = v;
        });

        const start: number = performance.now();
        
        for (let s = 0; s < layers; s++) {
            if (debugView) debugManager.startTimer(`Transform ${s+1}`);

            let newNodes: Polygon[] = [];
            for (let i = 0; i < this.transformer.transforms.length; i++) {
                if (s == layers - 1 && i == this.transformer.transforms.length - 1) break;

                if (debugView) debugManager.startTimer(`Transform ${s+1}.${i+1}`);

                if (s == 0) this.tiling.anchorNodes = [...this.tiling.nodes, ...newNodes];

                if (this.transformer.transforms[i].type === TransformType.MIRROR && this.transformer.transforms[i].relativeTo) {
                    newNodes = newNodes.concat(this.transformer.mirrorRelativeTo(this.tiling, i, newNodes));
                } else if (this.transformer.transforms[i].type === TransformType.MIRROR && this.transformer.transforms[i].angle) {
                    newNodes = newNodes.concat(this.transformer.mirrorByAngle(this.tiling, this.transformer.transforms[i].angle, newNodes));
                } else if (this.transformer.transforms[i].type === TransformType.ROTATE && this.transformer.transforms[i].relativeTo) {
                    newNodes = newNodes.concat(this.transformer.rotateRelativeTo(this.tiling, i, newNodes));
                } else if (this.transformer.transforms[i].type === TransformType.ROTATE && this.transformer.transforms[i].angle) {
                    newNodes = newNodes.concat(this.transformer.rotateByAngle(this.tiling, this.transformer.transforms[i].angle, newNodes));
                } else if (this.transformer.transforms[i].type === TransformType.TRANSLATE) {
                    newNodes = newNodes.concat(this.transformer.translateRelativeTo(this.tiling, i, newNodes));
                }
                
                if (debugView) debugManager.endTimer(`Transform ${s+1}.${i+1}`);
            }

            this.tiling.newLayerNodes = this.addNewNodes(newNodes);
            const end: number = performance.now();
            if (end - start > 1000) break;
            if (debugView) debugManager.endTimer(`Transform ${s + 1}`);
        }
        if (debugView) debugManager.endTimer("Transformations");
    }

    findAnchor = (newNodes: Polygon[], indexOff: number): [Vector, Vector] => {
        const allNodes = this.tiling.nodes.concat(newNodes);

        let freeHalfways: { node: Polygon, halfwayPointIndex: number }[] = [];
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            for (let s = 0; s < this.tiling.nodes[i].halfways.length; s++) {
                let isFree = true;

                for (let j = 0; j < allNodes.length; j++) {
                    if (isWithinTolerance(this.tiling.nodes[i].centroid, allNodes[j].centroid))
                        continue;

                    for (let k = 0; k < allNodes[j].halfways.length; k++) {
                        if (isWithinTolerance(this.tiling.nodes[i].halfways[s], allNodes[j].halfways[k])) {
                            isFree = false;
                            break;
                        }
                    }
                    
                    if (!isFree) 
                        break;
                }

                if (isFree) {
                    freeHalfways.push({
                        node: this.tiling.nodes[i],
                        halfwayPointIndex: s
                    });
                }
            }
        }

        freeHalfways = freeHalfways.sort((a, b) => {
            const angleA = getClockwiseAngle(a.node.halfways[a.halfwayPointIndex]);
            const angleB = getClockwiseAngle(b.node.halfways[b.halfwayPointIndex]);
            
            if (Math.abs(angleA - angleB) < tolerance) {
                const distA = a.node.halfways[a.halfwayPointIndex].mag();
                const distB = b.node.halfways[b.halfwayPointIndex].mag();
                return distA - distB;
            }
            
            return angleA - angleB;
        });

        const selectedHalfway: { node: Polygon, halfwayPointIndex: number } = freeHalfways[indexOff];

        const dir: Vector = Vector.sub(
            selectedHalfway.node.vertices[selectedHalfway.halfwayPointIndex],
            selectedHalfway.node.vertices[(selectedHalfway.halfwayPointIndex + 1) % selectedHalfway.node.vertices.length],
        ).normalize();
        const anchor: Vector = selectedHalfway.node.vertices[(selectedHalfway.halfwayPointIndex + 1) % selectedHalfway.node.vertices.length] as Vector;
        return [anchor, dir];
    }

    addNewNodes = (newNodes: Polygon[]): Polygon[] => {
        let newLayerNodes: Polygon[] = [];
        
        const spatialMap = new Map();
        for (let i = 0; i < this.tiling.nodes.length; i++) {
            const node = this.tiling.nodes[i];
            const key = getSpatialKey(node.centroid.x, node.centroid.y);
            
            if (!spatialMap.has(key)) {
                spatialMap.set(key, []);
            }
            spatialMap.get(key).push(i);
        }
        
        for (let i = 0; i < newNodes.length; i++) {
            const newNode: Polygon = newNodes[i];
            const key = getSpatialKey(newNode.centroid.x, newNode.centroid.y);
            
            let isDuplicate = false;
            
            const baseX = Math.floor(newNode.centroid.x / (tolerance * 2));
            const baseY = Math.floor(newNode.centroid.y / (tolerance * 2));
            
            for (const [dx, dy] of offsets) {
                const adjKey = `${baseX + dx},${baseY + dy}`;
                const existingIndices = spatialMap.get(adjKey) || [];
                
                for (const idx of existingIndices) {
                    if (isWithinTolerance(this.tiling.nodes[idx].centroid, newNode.centroid)) {
                        isDuplicate = true;
                        break;
                    }
                }
                
                if (isDuplicate) break;
            }
            
            if (!isDuplicate) {
                this.tiling.nodes.push(newNode);
                newLayerNodes.push(newNode as Polygon);
                
                if (!spatialMap.has(key)) {
                    spatialMap.set(key, []);
                }
                spatialMap.get(key).push(this.tiling.nodes.length - 1);
            }
        }

        return newLayerNodes;
    }
}