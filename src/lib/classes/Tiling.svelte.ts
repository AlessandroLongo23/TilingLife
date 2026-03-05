import { type GameOfLifeRule, GOLRuleType, Behavior, State, Polygon, Vector, type Gyration, type Reflection, type GlideReflection } from '$classes';
import { lineWidth, showDualConnections, controls, liveChartMode, tolerance } from '$stores';
import { sortPointsByAngleAndDistance, isWithinTolerance, deduplicatePolygons } from '$utils';
import { get } from 'svelte/store';

export type VCWithOccurrences = { vc: { polygons: Polygon[]; name: string }; occurrences: number };

export class Tiling {
    nodes: Polygon[];
    anchorNodes: Polygon[];
    vcs: VCWithOccurrences[] = [];
    parsedGolRule: GameOfLifeRule;
    golRuleType: GOLRuleType;
    rules: { [key: number]: GameOfLifeRule };
    newLayerNodes: Polygon[];
    seedNodes: Polygon[];
    coreNode: Polygon | null;

    // tiling check
    translationalCellBasis: [Vector, Vector] | null = null;
    originPolygon: Polygon | null = null;
    gyrations: Gyration[] | null = null;
    reflections: Reflection[] | null = null;
    glideReflections: GlideReflection[] | null = null;

    constructor() {
        this.nodes = [];
        this.anchorNodes = [];

        this.parsedGolRule = {};
        this.golRuleType = GOLRuleType.SINGLE;
        this.rules = {};

        this.newLayerNodes = [];
        this.seedNodes = [];
        this.coreNode = null;
    }

    show = (ctx, showPolygonPoints: boolean, opacity: number = 1, circlePacking: boolean = false): void => {
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue);
        }

        if (circlePacking) {
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                const radius = node.halfways?.length > 0
                    ? Vector.distance(node.centroid, node.halfways[0])
                    : 0;
                if (radius > 0) {
                    ctx.fill(node.hue, 40, 100 / opacity, 0.80 * opacity);
                    ctx.ellipse(node.centroid.x, node.centroid.y, radius * 2, radius * 2);
                }
            }
        } else {
            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].show(ctx, showPolygonPoints, null, opacity);
            }
        }
        
        const showDualConnectionsValue = get(showDualConnections);
        if (showDualConnectionsValue)
            this.drawDualConnections(ctx);
    }

    showGraph = (ctx): void => {
        this.show(ctx, false, 0.5);

        ctx.stroke(0, 0, 100);
        ctx.fill(240, 7, 8);
        ctx.strokeWeight(1 / get(controls).zoom);
        
        for (let node of this.nodes) {
            for (let neighbor of node.neighbors) {
                ctx.line(
                    node.centroid.x,
                    node.centroid.y,
                    neighbor.centroid.x,
                    neighbor.centroid.y
                );
            }
        }
        
        for (let node of this.nodes) {
            ctx.ellipse(
                node.centroid.x,
                node.centroid.y,
                1/5,
                1/5
            );
        }
    }

    drawConstructionPoints = (ctx): void => {
        let uniqueCentroids: Vector[] = [];
        for (let anchorNode of this.anchorNodes)
            if (!uniqueCentroids.some(c => isWithinTolerance(c, anchorNode.centroid)))
                uniqueCentroids.push(anchorNode.centroid);
        let uniqueCentroidsSorted = sortPointsByAngleAndDistance(uniqueCentroids);
        uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => !isWithinTolerance(centroid, new Vector()));

        let uniqueHalfways: Vector[] = [];
        for (let anchorNode of this.anchorNodes)
            for (let halfway of anchorNode.halfways)
                if (!uniqueHalfways.some(h => isWithinTolerance(h, halfway)))
                    uniqueHalfways.push(halfway);
        let uniqueHalfwaysSorted = sortPointsByAngleAndDistance(uniqueHalfways);

        let uniqueVertices: Vector[] = [];
        for (let anchorNode of this.anchorNodes)
            for (let vertex of anchorNode.vertices)
                if (!uniqueVertices.some(v => isWithinTolerance(v, vertex)))
                    uniqueVertices.push(vertex);
        let uniqueVerticesSorted = sortPointsByAngleAndDistance(uniqueVertices);


        let offset = new Vector(6 / get(controls).zoom, 0 / get(controls).zoom)
        let pointSize = 6 / get(controls).zoom

        ctx.scale(1, -1);
        ctx.textSize(18 / get(controls).zoom);
        ctx.fill(0, 0, 100);
        ctx.stroke(0, 0, 0);

        ctx.strokeWeight(1 / get(controls).zoom);

        for (let i in uniqueCentroidsSorted)
            ctx.ellipse(uniqueCentroidsSorted[i].x, -uniqueCentroidsSorted[i].y, pointSize);

        for (let i in uniqueHalfwaysSorted)
            ctx.ellipse(uniqueHalfwaysSorted[i].x, -uniqueHalfwaysSorted[i].y, pointSize);

        for (let i in uniqueVerticesSorted)
            ctx.ellipse(uniqueVerticesSorted[i].x, -uniqueVerticesSorted[i].y, pointSize);

        ctx.strokeWeight(3 / get(controls).zoom);

        for (let i in uniqueCentroidsSorted)
            ctx.text('c' + (i + 1), uniqueCentroidsSorted[i].x + offset.x, -uniqueCentroidsSorted[i].y + offset.y);

        for (let i in uniqueHalfwaysSorted)
            ctx.text('h' + (i + 1), uniqueHalfwaysSorted[i].x + offset.x, -uniqueHalfwaysSorted[i].y + offset.y);

        for (let i in uniqueVerticesSorted)
            ctx.text('v' + (i + 1), uniqueVerticesSorted[i].x + offset.x, -uniqueVerticesSorted[i].y + offset.y);

        
        const showDualConnectionsValue = get(showDualConnections);
        if (showDualConnectionsValue)
            this.drawDualConnections(ctx, true);
    }

    drawDualConnections = (ctx, flipY = false): void => {
        ctx.strokeWeight(1 / get(controls).zoom);
        ctx.stroke(0, 0, 0, 0.10);
        
        for (let node of this.nodes) {        
            for (let neighbor of node.neighbors) {
                ctx.line(
                    node.centroid.x,
                    flipY ? -node.centroid.y : node.centroid.y, 
                    neighbor.centroid.x, 
                    flipY ? -neighbor.centroid.y : neighbor.centroid.y
                );
            }
        }
    }

    rotate = (origin: Vector, angle: number): void => {
        for (let node of this.nodes) {
            node.rotate(origin, angle);
        }
    }

    static rotate = (tiling: Tiling, origin: Vector, angle: number): Tiling => {
        const rotatedTiling: Tiling = tiling.clone();
        rotatedTiling.rotate(origin, angle);
        return rotatedTiling;
    }

    translate = (vector: Vector): void => {
        for (let node of this.nodes) {
            node.translate(vector);
        }
    }

    static translate = (tiling: Tiling, vector: Vector): Tiling => {
        const translatedTiling: Tiling = tiling.clone();
        translatedTiling.translate(vector);
        return translatedTiling;
    }

    clone = (): Tiling => {
        const newTiling: Tiling = new Tiling();
        newTiling.nodes = this.nodes.map(node => node.clone());
        newTiling.anchorNodes = this.anchorNodes.map(node => node.clone());
        return newTiling;
    }

    static merge = (tilingA: Tiling, tilingB: Tiling): Tiling => {
        const mergedTiling: Tiling = tilingA.clone();
        mergedTiling.nodes.push(...tilingB.nodes);
        mergedTiling.nodes = deduplicatePolygons(mergedTiling.nodes);
        return mergedTiling;
    }

    isEquivalent = (other: Tiling): boolean => {
        if (!other) return false;

        const mergedTiling: Tiling = Tiling.merge(this, other);

        for (let i = 0; i < mergedTiling.nodes.length - 1; i++) {
            const polygon = mergedTiling.nodes[i];
            for (let j = i + 1; j < mergedTiling.nodes.length; j++) {
                const otherPolygon = mergedTiling.nodes[j];
                if (polygon.intersects(otherPolygon)) {
                    return false;
                }
            }
        }

        return true;
    }

    showNeighbors = (ctx, showPolygonPoints: boolean): void => {
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue);
        }
        
        const mouseWorldX = (ctx.mouseX - ctx.width / 2) / get(controls).zoom;
        const mouseWorldY = (-ctx.mouseY + ctx.height / 2) / get(controls).zoom;
        const mousePoint = new Vector(mouseWorldX, mouseWorldY);
        
        for (let node of this.nodes) {
            if (node.containsPoint(mousePoint)) {
                node.show(ctx, showPolygonPoints, ctx.color(0, 0, 100));

                for (let neighbor of node.neighbors) {
                    neighbor.show(ctx, showPolygonPoints, ctx.color(240, 100, 100, 0.5));
                    ctx.line(
                        node.centroid.x,
                        node.centroid.y,
                        neighbor.centroid.x,
                        neighbor.centroid.y
                    );
                    ctx.ellipse(
                        neighbor.centroid.x,
                        neighbor.centroid.y,
                        1/5,
                        1/5
                    );
                }

                ctx.fill(0, 0, 0);
                ctx.ellipse(
                    node.centroid.x,
                    node.centroid.y,
                    1/5,
                    1/5
                );
            }
        }
        
        const showDualConnectionsValue = get(showDualConnections);
        if (showDualConnectionsValue)
            this.drawDualConnections(ctx);
    }

    randomizeGameOfLifeGrid = (): void => {
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].state = Math.random() < 0.5 ? State.ALIVE : State.DEAD;
            this.nodes[i].nextState = State.DEAD;
            this.nodes[i].alive_neighbors = 0;
            this.nodes[i].behavior = Behavior.DECREASING;
        }
    }

    updateGameOfLife = (): void => {
        for (let i = 0; i < this.nodes.length; i++)
            this.nodes[i].alive_neighbors = 0;
        
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].state !== State.ALIVE)
                continue;

            for (let j = 0; j < this.nodes[i].neighbors.length; j++) 
                this.nodes[i].neighbors[j].alive_neighbors++;
        }

        for (let node of this.nodes) {
            if (!node.neighbors || node.neighbors.length === 0) {
                node.nextState = State.DEAD;
                continue;
            }
            
            let nodeRule = this.golRuleType === GOLRuleType.SINGLE ? this.parsedGolRule : this.rules[node.n];
            if (!nodeRule) {
                node.nextState = State.DEAD;
                continue;
            }

            const aliveRate: number = node.alive_neighbors / node.neighbors.length;

            if (node.state === State.DEAD) {
                let hasBirthNeighbors = false;
                if (nodeRule.birth?.min !== undefined) {
                    if (nodeRule.birth?.min <= 1 && nodeRule.birth?.max <= 1) {
                        hasBirthNeighbors = aliveRate >= nodeRule.birth?.min && aliveRate <= nodeRule.birth?.max;
                    } else {
                        hasBirthNeighbors = node.alive_neighbors >= nodeRule.birth?.min && node.alive_neighbors <= nodeRule.birth?.max;
                        if (hasBirthNeighbors) {
                            node.behavior = Behavior.INCREASING;
                        } else {
                            if (
                                node.alive_neighbors == nodeRule.birth?.min - 1 ||
                                node.alive_neighbors == nodeRule.birth?.max + 1
                            ) {
                                node.behavior = Behavior.CHAOTIC;
                            } else {
                                node.behavior = Behavior.INCREASING;
                            }
                        }
                    }
                } else {
                    hasBirthNeighbors = nodeRule.birth?.includes(node.alive_neighbors);
                    if (hasBirthNeighbors) {
                        node.behavior = Behavior.INCREASING;
                    } else {
                        let edge = nodeRule.birth?.includes(node.alive_neighbors + 1) || nodeRule.birth?.includes(node.alive_neighbors - 1);
                        node.behavior = edge ? Behavior.CHAOTIC : Behavior.DECREASING;
                    }
                }

                node.nextState = hasBirthNeighbors ? State.ALIVE : State.DEAD;
            }
                                
            else if (node.state === State.ALIVE) {
                let hasSurvivalNeighbors = false;
                if (nodeRule.survival?.min !== undefined) {
                    if (nodeRule.survival?.min <= 1 && nodeRule.survival?.max <= 1) {
                        hasSurvivalNeighbors = aliveRate >= nodeRule.survival?.min && aliveRate <= nodeRule.survival?.max;
                    } else {
                        hasSurvivalNeighbors = node.alive_neighbors >= nodeRule.survival?.min && node.alive_neighbors <= nodeRule.survival?.max;
                        node.behavior = Behavior.INCREASING;
                    }
                } else {
                    hasSurvivalNeighbors = nodeRule.survival?.includes(node.alive_neighbors);
                    node.behavior = Behavior.INCREASING;
                }

                if (hasSurvivalNeighbors) {
                    node.nextState = State.ALIVE;
                } else {
                    node.nextState = node.state + 1 >= nodeRule.generations ? State.DEAD : node.state + 1;
                    node.behavior = Behavior.DECREASING;
                }
            }

            else {
                node.nextState = node.state + 1 === nodeRule.generations ? State.DEAD : node.state + 1;
            }
        }

        for (let i = 0; i < this.nodes.length; i++)
            this.nodes[i].state = this.nodes[i].nextState;
    }

    drawGameOfLife = (ctx, circlePacking: boolean = false) => {
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue);
        }

        if (circlePacking) {
            const liveChartModeValue = get(liveChartMode);
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                const radius = node.halfways?.length > 0
                    ? Vector.distance(node.centroid, node.halfways[0])
                    : 0;
                if (radius > 0) {
                    ctx.push();
                    if (liveChartModeValue === 'count') {
                        if (node.state === 0) ctx.fill(0, 0, 100);
                        else if (node.state === 1) ctx.fill(0, 0, 0);
                        else {
                            const maxGen = this.golRuleType === GOLRuleType.SINGLE ? this.parsedGolRule.generations : this.rules[node.n].generations;
                            const progress = (node.state - 1) / (maxGen - 1);
                            ctx.fill(0, 0, progress * 100);
                        }
                    } else {
                        if (node.behavior === Behavior.DECREASING) ctx.fill(0, 0, 100);
                        else if (node.behavior === Behavior.INCREASING) ctx.fill(0, 0, 0);
                        else ctx.fill(345, 50, 100);
                    }
                    ctx.ellipse(node.centroid.x, node.centroid.y, radius * 2, radius * 2);
                    ctx.pop();
                }
            }
        } else {
            for (let i = 0; i < this.nodes.length; i++)
                this.nodes[i].showGameOfLife(ctx, this.golRuleType, this.parsedGolRule, this.rules);
        }
    }

    exportGraph = () => {
        let graph = {
            n: this.nodes.length,
            edges: []
        };
        
        const nodeMap = new Map();
        this.nodes.forEach((node, index) => {
            nodeMap.set(node, index);
        });
        
        this.nodes.forEach((node, nodeIndex) => {
            if (node.neighbors && node.neighbors.length > 0) {
                node.neighbors.forEach(neighbor => {
                    const neighborIndex = nodeMap.get(neighbor);
                    if (neighborIndex !== undefined) {
                        const edgeExists = graph.edges.some(e => 
                            (e.source === nodeIndex && e.target === neighborIndex) || 
                            (e.source === neighborIndex && e.target === nodeIndex)
                        );
                        
                        if (!edgeExists) {
                            graph.edges.push({
                                source: nodeIndex,
                                target: neighborIndex,
                                type: 'neighbor'
                            });
                        }
                    }
                });
            }
        });
        
        const jsonData = JSON.stringify(graph, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tiling-graph.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return graph;
    }
}