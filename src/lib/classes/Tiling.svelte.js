import { screenshotButtonHover, lineWidth, showDualConnections, controls } from '$lib/stores/configuration.js';
import { sortPointsByAngleAndDistance } from '$lib/utils/geometry.svelte';
import { isWithinTolerance } from '$lib/utils/math.svelte';
import { Vector } from '$lib/classes/Vector.svelte.js';
import { get } from 'svelte/store';

export class Tiling {
    constructor() {
        this.nodes = [];
        this.anchorNodes = [];
        this.dual = false;

        this.shapeSeed = [];
        this.transforms = [];

        this.parsedGolRule = {};
        this.golRuleType = 'Single';
        this.rules = {};
        this.rule = {};

        this.vertexGroups = [];
        this.crNotation = '';
    }

    show = (ctx, showPolygonPoints) => {
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
            this.nodes[i].show(ctx, showPolygonPoints);
        }
        
        const showDualConnectionsValue = get(showDualConnections);
        if (showDualConnectionsValue)
            this.drawDualConnections(ctx);
        
        screenshotButtonHover.subscribe(hover => {
            if (hover) {
                ctx.push();
                ctx.noStroke();
                ctx.fill(0, 0, 0, 0.5);
                ctx.rect(0, 0, ctx.width / 2 - 600 / 2, ctx.height);
                ctx.rect(ctx.width / 2 + 600 / 2, 0, ctx.width / 2 - 600 / 2, ctx.height);
                ctx.rect(ctx.width / 2 - 600 / 2, 0, 600, ctx.height / 2 - 600 / 2);
                ctx.rect(ctx.width / 2 - 600 / 2, ctx.height / 2 + 600 / 2, 600, ctx.height / 2 - 600 / 2);

                let len = 50;
                ctx.stroke(255);
                ctx.strokeWeight(2);
                ctx.line(ctx.width / 2 - 600 / 2, ctx.height / 2 - 600 / 2, ctx.width / 2 - 600 / 2 + len, ctx.height / 2 - 600 / 2);
                ctx.line(ctx.width / 2 - 600 / 2, ctx.height / 2 - 600 / 2, ctx.width / 2 - 600 / 2, ctx.height / 2 - 600 / 2 + len);

                ctx.line(ctx.width / 2 + 600 / 2, ctx.height / 2 - 600 / 2, ctx.width / 2 + 600 / 2 - len, ctx.height / 2 - 600 / 2);
                ctx.line(ctx.width / 2 + 600 / 2, ctx.height / 2 - 600 / 2, ctx.width / 2 + 600 / 2, ctx.height / 2 - 600 / 2 + len);

                ctx.line(ctx.width / 2 - 600 / 2, ctx.height / 2 + 600 / 2, ctx.width / 2 - 600 / 2 + len, ctx.height / 2 + 600 / 2);
                ctx.line(ctx.width / 2 - 600 / 2, ctx.height / 2 + 600 / 2, ctx.width / 2 - 600 / 2, ctx.height / 2 + 600 / 2 - len);

                ctx.line(ctx.width / 2 + 600 / 2, ctx.height / 2 + 600 / 2, ctx.width / 2 + 600 / 2 - len, ctx.height / 2 + 600 / 2);
                ctx.line(ctx.width / 2 + 600 / 2, ctx.height / 2 + 600 / 2, ctx.width / 2 + 600 / 2, ctx.height / 2 + 600 / 2 - len);

                ctx.pop();
            }
        });
    }

    drawConstructionPoints = (ctx) => {
        ctx.scale(1, -1);
        ctx.textSize(12 / get(controls).zoom);
        ctx.fill(0, 0, 100);
        ctx.strokeWeight(2 / get(controls).zoom);
        ctx.stroke(0, 0, 0, 0.5);

        let uniqueCentroids = [];
        for (let anchorNode of this.anchorNodes)
            if (!uniqueCentroids.some(c => isWithinTolerance(c, anchorNode.centroid)))
                uniqueCentroids.push(anchorNode.centroid);

        let uniqueCentroidsSorted = sortPointsByAngleAndDistance(uniqueCentroids);
        uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => !isWithinTolerance(centroid, new Vector()));
        for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
            let centroid = uniqueCentroidsSorted[i];
            ctx.text('c' + (i + 1), centroid.x, -centroid.y);
        }

        let uniqueHalfways = [];
        for (let anchorNode of this.anchorNodes)
            for (let halfway of anchorNode.halfways)
                if (!uniqueHalfways.some(h => isWithinTolerance(h, halfway)))
                    uniqueHalfways.push(halfway);

        let uniqueHalfwaysSorted = sortPointsByAngleAndDistance(uniqueHalfways);
        for (let i = 0; i < uniqueHalfwaysSorted.length; i++) {
            let halfway = uniqueHalfwaysSorted[i];
            ctx.text('h' + (i + 1), halfway.x, -halfway.y);
        }

        let uniqueVertices = [];
        for (let anchorNode of this.anchorNodes)
            for (let vertex of anchorNode.vertices)
                if (!uniqueVertices.some(v => isWithinTolerance(v, vertex)))
                    uniqueVertices.push(vertex);

        let uniqueVerticesSorted = sortPointsByAngleAndDistance(uniqueVertices); 
        for (let i = 0; i < uniqueVerticesSorted.length; i++) {
            let vertex = uniqueVerticesSorted[i];
            ctx.text('v' + (i + 1), vertex.x, -vertex.y);
        }
        
        const showDualConnectionsValue = get(showDualConnections);
        if (showDualConnectionsValue)
            this.drawDualConnections(ctx, true);
    }

    drawDualConnections = (ctx, flipY = false) => {
        ctx.strokeWeight(1 / get(controls).zoom);
        ctx.stroke(0, 0, 0, 0.10);
        
        for (let node of this.nodes) {        
            for (let neighbor of node.dualNeighbors) {
                ctx.line(
                    node.centroid.x, 
                    flipY ? -node.centroid.y : node.centroid.y, 
                    neighbor.centroid.x, 
                    flipY ? -neighbor.centroid.y : neighbor.centroid.y
                );
            }
        }
    }

    showNeighbors = (ctx, showPolygonPoints) => {
        const lineWidthValue = get(lineWidth);
        if (lineWidthValue > 1) {
            ctx.strokeWeight(lineWidthValue / get(controls).zoom);
            ctx.stroke(0, 0, 0);
        } else if (lineWidthValue === 0) {
            ctx.noStroke();
        } else {
            ctx.strokeWeight(1 / get(controls).zoom);
            ctx.stroke(0, 0, 0, lineWidthValue); // Use lineWidth as opacity
        }
        
        const mouseWorldX = (ctx.mouseX - ctx.width / 2) / get(controls).zoom;
        const mouseWorldY = (-ctx.mouseY + ctx.height / 2) / get(controls).zoom;
        const mousePoint = { x: mouseWorldX, y: mouseWorldY };
        
        for (let node of this.nodes) {
            if (node.containsPoint(mousePoint)) {
                node.show(ctx, showPolygonPoints, ctx.color(0, 0, 100));

                for (let neighbor of node.neighbors) {
                    neighbor.show(ctx, showPolygonPoints, ctx.color(240, 100, 100, 0.5));
                    // ctx.line(
                    //     node.centroid.x,
                    //     node.centroid.y,
                    //     neighbor.centroid.x,
                    //     neighbor.centroid.y
                    // );
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

    

    randomizeGameOfLifeGrid = () => {
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].state = Math.random() < 0.5 ? 1 : 0;
            this.nodes[i].nextState = 0;
            this.nodes[i].aliveNeighbors = 0;
            this.nodes[i].behavior = 'decreasing';
        }
    }

    updateGameOfLife = () => {
        for (let i = 0; i < this.nodes.length; i++)
            this.nodes[i].aliveNeighbors = 0;
        
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].state !== 1)
                continue;

            for (let j = 0; j < this.nodes[i].neighbors.length; j++) 
                this.nodes[i].neighbors[j].aliveNeighbors++;
        }

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const state = node.state;
            
            if (!node.neighbors || node.neighbors.length === 0) {
                node.nextState = 0;
                continue;
            }
            
            let nodeRule = this.golRuleType === 'Single' ? this.parsedGolRule : this.rules[node.n];
            if (!nodeRule) {
                console.error(`No rule found for node with n=${node.n}`);
                node.nextState = 0;
                continue;
            }
            
            if (state > 1) {
                node.nextState = state + 1 > nodeRule.generations ? 0 : state + 1;
                continue;
            }

            let aliveRate = node.aliveNeighbors / node.neighbors.length;
                                
            if (state === 1) {
                let hasSurvivalNeighbors = false;
                if (nodeRule.survival.min !== undefined) {
                    if (nodeRule.survival.min <= 1 && nodeRule.survival.max <= 1) {
                        hasSurvivalNeighbors = nodeRule.survival.min <= aliveRate && nodeRule.survival.max >= aliveRate;
                    } else {
                        hasSurvivalNeighbors = nodeRule.survival.min <= node.aliveNeighbors && nodeRule.survival.max >= node.aliveNeighbors;
                        node.behavior = 'increasing';
                    }
                } else {
                    hasSurvivalNeighbors = nodeRule.survival.includes(node.aliveNeighbors);
                    node.behavior = 'increasing';
                }

                if (hasSurvivalNeighbors) {
                    node.nextState = 1;
                } else {
                    node.nextState = 0;
                    node.behavior = 'decreasing';
                }
            }

            else if (state === 0) {
                let hasBirthNeighbors = false;
                if (nodeRule.birth.min !== undefined) {
                    if (nodeRule.birth.min <= 1 && nodeRule.birth.max <= 1) {
                        hasBirthNeighbors = nodeRule.birth.min <= aliveRate && nodeRule.birth.max >= aliveRate;
                    } else {
                        hasBirthNeighbors = nodeRule.birth.min <= node.aliveNeighbors && nodeRule.birth.max >= node.aliveNeighbors;
                        if (hasBirthNeighbors) {
                            node.behavior = 'increasing';
                        } else {
                            if (
                                node.aliveNeighbors == nodeRule.birth.min - 1 ||
                                node.aliveNeighbors == nodeRule.birth.max + 1
                            ) {
                                node.behavior = 'chaotic';
                            } else {
                                node.behavior = 'increasing';
                            }
                        }
                    }
                } else {
                    hasBirthNeighbors = nodeRule.birth.includes(node.aliveNeighbors);
                    if (hasBirthNeighbors) {
                        node.behavior = 'increasing';
                    } else {
                        let edge = nodeRule.birth.includes(node.aliveNeighbors + 1) || nodeRule.birth.includes(node.aliveNeighbors - 1);
                        node.behavior = edge ? 'chaotic' : 'decreasing';
                    }
                }

                if (hasBirthNeighbors) {
                    node.nextState = 1;
                } else {
                    node.nextState = 0;
                }
            }
        }

        for (let i = 0; i < this.nodes.length; i++)
            this.nodes[i].state = this.nodes[i].nextState;
    }

    drawGameOfLife = (ctx) => {
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