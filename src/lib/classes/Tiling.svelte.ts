import { lineWidth, showDualConnections, controls } from '$stores';
import { sortPointsByAngleAndDistance, isWithinTolerance } from '$utils';
import { get } from 'svelte/store';
import { type GameOfLifeRule, GOLRuleType, Behavior, State, Polygon, Vector } from '$classes';

export class Tiling {
    nodes: Polygon[];
    anchorNodes: Polygon[];
    parsedGolRule: GameOfLifeRule;
    golRuleType: GOLRuleType;
    rules: { [key: number]: GameOfLifeRule };
    newLayerNodes: Polygon[];
    seedNodes: Polygon[];
    coreNode: Polygon | null;

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

    show = (ctx, showPolygonPoints: boolean, opacity: number = 1): void => {
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
        
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].show(ctx, showPolygonPoints, null, opacity);
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
                console.error(`No rule found for node with n=${node.n}`);
                node.nextState = State.DEAD;
                continue;
            }

            let aliveRate = node.alive_neighbors / node.neighbors.length;

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

                if (hasBirthNeighbors) {
                    node.nextState = State.ALIVE;
                } else {
                    node.nextState = State.DEAD;
                }
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

    drawGameOfLife = (ctx) => {
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

        for (let i = 0; i < this.nodes.length; i++)
            this.nodes[i].showGameOfLife(ctx, this.golRuleType, this.parsedGolRule, this.rules);
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