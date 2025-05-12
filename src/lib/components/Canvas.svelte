<script>
    import { ruleType, parameter, selectedTiling, showCR, debugView, controls, transformSteps, patch, golRule, golRules, showPolygonPoints, showConstructionPoints, showChart, speed, screenshotButtonHover } from '$lib/stores/configuration.js';
    import { debugManager, debugStore, updateDebugStore } from '$lib/stores/debug.js';
    import { sortPointsByAngleAndDistance } from '$lib/utils/geometry.svelte';
    import { TilingGenerator } from '$lib/classes/TilingGenerator.svelte.js';
    import { isWithinTolerance } from '$lib/utils/math.svelte';
    import { Vector } from '$lib/classes/Vector.svelte.js';
    import { Tiling } from '$lib/classes/Tiling.svelte.js';
    import { Cr } from '$lib/classes/Cr.svelte.js';
    import * as ls from 'lucide-svelte';
    import { onMount } from 'svelte';

    import LiveChart from '$lib/components/LiveChart.svelte';
    import ColorPad from '$lib/components/ColorPad.svelte';
    import Input from '$lib/components/ui/Input.svelte';

    let {
        width = 600,
        height = 600,
        showGameOfLife,
        showExtra = true
    } = $props();

    let grab = $state(false);
    let frameMod = $derived(60 / $speed);
    let takeScreenshot = $state(false);
    let showNotification = $state(false);
    let notificationMessage = $state('');
    let alivePercentage = $state(0);
    let iterationCount = $state(0);
    let behaviorData = $state({ increasing: 0, chaotic: 0, decreasing: 0 });
    
    let canvasElement = $state(null);

    let prevWidth = $state(width);   
    let prevHeight = $state(height);
    let prevSelectedTiling = $state($selectedTiling);
    let prevTransformSteps = $state($transformSteps);
    let prevRuleType = $state($ruleType);
    let prevGolRule = $state($golRule);
    let prevGolRules = $state($golRules);
    let prevParameter = $state($parameter);

    let tiling = $state();
    let tilingGenerator = $state();
    let cr = $state();
    let crCanvases = $state([]);

    let resetGameOfLife = $state(false);

    onMount(async () => {
        if (typeof window !== 'undefined') {
            p5 = (await import('p5')).default;
            myp5 = new p5(sketch, canvasContainer);
            
            canvasElement = myp5;
            
            if (width && height && myp5) {
                myp5.resizeCanvas(width, height);
                prevWidth = width;
                prevHeight = height;
            }
        }
    });

    $effect(() => {
        if (myp5 && (width !== prevWidth || height !== prevHeight)) {
            prevWidth = width;
            prevHeight = height;
            
            if (canvasElement && canvasElement.resizeCanvas) {
                canvasElement.resizeCanvas(width, height);
            }
        }
    });

    $effect(() => {
        debugManager.isEnabled = $debugView;
        if ($debugView) {
            debugManager.reset();
        } else {
            debugManager.disable();
        }
        updateDebugStore();
    });

    $effect(() => {
        if ($selectedTiling.rulestring !== prevSelectedTiling.rulestring || $transformSteps !== prevTransformSteps || prevParameter !== $parameter) {
            if ($debugView) {
                debugManager.reset();
                updateDebugStore();
            }
        }
    });

	let sketch = function(p5) {
        p5.setup = () => {
            p5.createCanvas(width, height);
            canvasElement = p5;
            p5.colorMode(p5.HSB, 360, 100, 100);
            
            $controls.targetZoom = $controls.zoom;
            $controls.targetOffset = $controls.offset.copy();
            
            tilingGenerator = new TilingGenerator();
            try {
                if ($debugView) {
                    debugManager.reset();
                }
                // tiling = tilingGenerator.generateWithWFC();
                tiling = tilingGenerator.generateFromRule($selectedTiling.rulestring);
                tilingGenerator.setupGameOfLife($ruleType, $golRule, $golRules);
                if ($debugView) {
                    updateDebugStore();
                }

                cr = new Cr($selectedTiling.cr || tiling.crNotation);
                crCanvases = Array.from({length: cr.vertexGroups.length}, () => p5.createGraphics(patch.size.x, patch.size.y));
            } catch (e) {
                console.error(e);
            }
        }

        p5.draw = () => {
            $controls.zoom += ($controls.targetZoom - $controls.zoom) * $controls.dampening;
            $controls.offset.add(Vector.sub($controls.targetOffset, $controls.offset).scale($controls.dampening));
            
            p5.push();
            p5.translate(p5.width / 2, p5.height / 2);
            p5.translate($controls.offset.x, $controls.offset.y);
            p5.scale($controls.zoom);
            p5.scale(1, -1);
            p5.background(240, 7, 16);

            try {
                if (showGameOfLife) {
                    if (
                        prevRuleType != $ruleType || 
                        ($ruleType == "Single" && !p5.isSameRule(prevGolRule, $golRule)) || 
                        ($ruleType == "By Shape" && !p5.isSameRule(prevGolRules, $golRules)) ||
                        resetGameOfLife
                    ) {
                        tilingGenerator.setupGameOfLife($ruleType, $golRule, $golRules);
                        resetGameOfLife = false;
                    }

                    if (frameMod > 1) {
                        if (p5.frameCount % Math.round(frameMod) == 0) {
                            tiling.updateGameOfLife();
                            alivePercentage = tiling.nodes.filter(node => node.state === 1).length / tiling.nodes.length * 100;
                            
                            // Update behavior data
                            const totalNodes = tiling.nodes.length;
                            const increasingNodes = tiling.nodes.filter(node => node.behavior === 'increasing').length;
                            const chaoticNodes = tiling.nodes.filter(node => node.behavior === 'chaotic').length;
                            const decreasingNodes = tiling.nodes.filter(node => node.behavior === 'decreasing').length;
                            
                            behaviorData = {
                                increasing: (increasingNodes / totalNodes) * 100,
                                chaotic: (chaoticNodes / totalNodes) * 100,
                                decreasing: (decreasingNodes / totalNodes) * 100
                            };
                            
                            iterationCount++;
                        }
                    } else {
                        for (let s = 0; s < Math.round(1 / frameMod); s++) {
                            tiling.updateGameOfLife();
                            alivePercentage = tiling.nodes.filter(node => node.state === 1).length / tiling.nodes.length * 100;
                            
                            // Update behavior data
                            const totalNodes = tiling.nodes.length;
                            const increasingNodes = tiling.nodes.filter(node => node.behavior === 'increasing').length;
                            const chaoticNodes = tiling.nodes.filter(node => node.behavior === 'chaotic').length;
                            const decreasingNodes = tiling.nodes.filter(node => node.behavior === 'decreasing').length;
                            
                            behaviorData = {
                                increasing: (increasingNodes / totalNodes) * 100,
                                chaotic: (chaoticNodes / totalNodes) * 100,
                                decreasing: (decreasingNodes / totalNodes) * 100
                            };
                            
                            iterationCount++;
                        }
                    }

                    tiling.drawGameOfLife(p5);
                    p5.pop();
                } else {
                    if (
                        prevSelectedTiling.rulestring != $selectedTiling.rulestring || 
                        parseInt($transformSteps) != parseInt(prevTransformSteps) ||
                        prevParameter != $parameter
                    ) {
                        // tiling = tilingGenerator.generateWithWFC();
                        tiling = tilingGenerator.generateFromRule($selectedTiling.rulestring);
                        tilingGenerator.setupGameOfLife($ruleType, $golRule, $golRules);
                        cr = new Cr($selectedTiling.cr || tiling.crNotation);

                        crCanvases = Array.from({length: cr.vertexGroups.length}, () => p5.createGraphics(patch.size.x, patch.size.y));
                    }

                    tiling.show(p5, $showPolygonPoints);

                    if ($showConstructionPoints)
                        tiling.drawConstructionPoints(p5);
                    
                    // tiling.showNeighbors(p5, $showPolygonPoints);
                    p5.pop();

                    if ($showCR)
                        p5.drawCr();

                    if (takeScreenshot) {
                        p5.takeScreenshot();
                        takeScreenshot = false;
                    }
                }
            } catch (e) {
                console.error(e);
            }

            if (grab) {
                const mouse = new Vector(p5.mouseX, p5.mouseY);
                const prevMouse = new Vector(p5.pmouseX, p5.pmouseY);
                $controls.targetOffset.add(Vector.sub(mouse, prevMouse));
            }
            
            prevWidth = width;
            prevHeight = height;
            prevRuleType = $ruleType;
            prevGolRule = $golRule;
            prevGolRules = $golRules;

            prevSelectedTiling = {...$selectedTiling};
            prevTransformSteps = $transformSteps;
            prevParameter = $parameter;
        }

        p5.drawCr = () => {
            for (let i = 0; i < crCanvases.length; i++) {
                crCanvases[i].push();
                crCanvases[i].colorMode(p5.HSB, 360, 100, 100);
                crCanvases[i].fill(240, 7, 24);
                crCanvases[i].noStroke();
                crCanvases[i].rect(0, 0, patch.size.x, patch.size.y, patch.borderRadius);
                crCanvases[i].translate(patch.size.x / 2, patch.size.y / 2);

                cr.show(crCanvases[i], i);
                p5.image(crCanvases[i], patch.padding + i * (patch.size.x + patch.padding), p5.height - patch.size.y - patch.padding);
                crCanvases[i].pop();
            }

            let a = p5.createGraphics(100, 100);
            a.background(240, 7, 24);
            p5.image(a, -100, -100);
        }
        
        p5.mousePressed = (event) => {
            if (event && event.target !== p5.canvas) return;

            if (event.button === 1) {
                const mouse = new Vector(p5.mouseX - p5.width/2, p5.mouseY - p5.height/2);
                const worldPoint = Vector.sub(mouse, $controls.targetOffset).scale(1 / $controls.targetZoom);
                $controls.targetOffset.set(Vector.sub(new Vector(0, 0), Vector.scale(worldPoint, $controls.targetZoom)));
                return;
            }

            if (event.button === 2) {
                event.preventDefault();
                event.stopPropagation();
                $controls.targetOffset.set(new Vector(0, 0));
                $controls.targetZoom = 50;
                return;
            }

            grab = true;

            if (!$showCR) return;
            
            for (let i = 0; i < crCanvases.length; i++) {
                const x = patch.padding + i * (patch.size.x + patch.padding);
                const y = p5.height - patch.size.y - patch.padding;
                
                if (p5.mouseX >= x && p5.mouseX <= x + patch.size.x && 
                    p5.mouseY >= y && p5.mouseY <= y + patch.size.y) {
                    cr.save(p5, i);
                    
                    notificationMessage = `CR image saved as ${cr.vertexGroups[i].getCompactNotation()}.png`;
                    showNotification = true;
                    setTimeout(() => {
                        showNotification = false;
                    }, 3000);
                    
                    break;
                }
            }
        }

        p5.mouseReleased = () => {
            grab = false;
        }

        p5.isSameRule = (prev, current) => {
            if ($ruleType === 'Single') {
                return prev === current;
            } else {
                let isSame = true;
                for (let i = 0; i < Object.keys(prev).length; i++) {
                    let key = Object.keys(prev)[i];

                    if (prev[key] !== current[key]) {
                        isSame = false;
                        break;
                    }
                }
                
                return isSame;
            }
        }

        p5.windowResized = () => {
            if (prevWidth !== width || prevHeight !== height) {
                p5.resizeCanvas(width, height);
                prevWidth = width;
                prevHeight = height;
            }
        }

        p5.mouseWheel = (event) => {
            if (event && event.target !== p5.canvas) return;

            const mouse = new Vector(p5.mouseX - p5.width / 2, p5.mouseY - p5.height / 2);
            const world = Vector.sub(mouse, $controls.targetOffset).scale(1 / $controls.targetZoom);
            
            if (event.deltaY > 0) {
                $controls.targetZoom /= 1.10;
                $controls.targetZoom = Math.max($controls.targetZoom, 10);
            } else if (event.deltaY < 0) {
                $controls.targetZoom *= 1.10;
                $controls.targetZoom = Math.min($controls.targetZoom, 150);
            }
            
            const newScreen = Vector.add(Vector.scale(world, $controls.targetZoom), $controls.targetOffset);
            
            $controls.targetOffset.add(Vector.sub(mouse, newScreen));
        }

        p5.takeScreenshot = () => {
            const filename = `${$selectedTiling.rulestring}.png`;
            
            let screenshotCanvas = p5.createGraphics(600, 600);

            screenshotCanvas.colorMode(p5.HSB, 360, 100, 100);
            
            screenshotCanvas.translate(0, 600);
            screenshotCanvas.scale(1, -1);
            
            
            screenshotCanvas.background(240, 7, 16);
            
            screenshotCanvas.translate(300, 300);
            
            screenshotCanvas.stroke(0);
            screenshotCanvas.strokeWeight(2 / $controls.zoom);

            let maxX = 0;
            let maxY = 0;
            let minX = 0;
            let minY = 0;
            for (let i = 0; i < tiling.nodes.length; i++) {
                for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                    let vertex = tiling.nodes[i].vertices[j];
                    if (vertex.x > maxX) maxX = vertex.x;
                    if (vertex.y > maxY) maxY = vertex.y;
                    if (vertex.x < minX) minX = vertex.x;
                    if (vertex.y < minY) minY = vertex.y;
                }
            }

            screenshotCanvas.scale($controls.zoom);
            screenshotCanvas.translate(-(maxX + minX) / 2, -(maxY + minY) / 2);
            
            for (let i = 0; i < tiling.nodes.length; i++) {
                screenshotCanvas.push();
                const hue = tiling.nodes[i].hue;
                screenshotCanvas.fill(hue, 40, 100, 0.80);
                screenshotCanvas.beginShape();
                for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                    screenshotCanvas.vertex(tiling.nodes[i].vertices[j].x, tiling.nodes[i].vertices[j].y);
                }
                screenshotCanvas.endShape(screenshotCanvas.CLOSE);
                screenshotCanvas.pop();
            }
            
            if ($showConstructionPoints) {
                const drawConstructionPointsOnScreenshot = () => {
                    let uniqueCentroids = [];
                    for (let i = 0; i < tiling.anchorNodes.length; i++) {
                        let centroid = tiling.anchorNodes[i].centroid;
                        if (!uniqueCentroids.some(c => isWithinTolerance(c, centroid))) {
                            uniqueCentroids.push(centroid);
                        }
                    }
                    
                    let uniqueCentroidsSorted = sortPointsByAngleAndDistance(uniqueCentroids);
                    uniqueCentroidsSorted = uniqueCentroidsSorted.filter(centroid => !isWithinTolerance(centroid, new Vector()));
                    
                    for (let i = 0; i < uniqueCentroidsSorted.length; i++) {
                        let centroid = uniqueCentroidsSorted[i];
                        screenshotCanvas.text('c' + (i + 1), centroid.x, centroid.y);
                    }
                    
                    let uniqueHalfways = [];
                    for (let i = 0; i < tiling.anchorNodes.length; i++) {
                        for (let j = 0; j < tiling.anchorNodes[i].halfways.length; j++) {
                            let halfway = tiling.anchorNodes[i].halfways[j];
                            if (!uniqueHalfways.some(h => isWithinTolerance(h, halfway))) {
                                uniqueHalfways.push(halfway);
                            }
                        }
                    }
                    
                    let uniqueHalfwaysSorted = sortPointsByAngleAndDistance(uniqueHalfways);
                    for (let i = 0; i < uniqueHalfwaysSorted.length; i++) {
                        let halfway = uniqueHalfwaysSorted[i];
                        screenshotCanvas.text('h' + (i + 1), halfway.x, halfway.y);
                    }
                    
                    let uniqueVertices = [];
                    for (let i = 0; i < tiling.anchorNodes.length; i++) {
                        for (let j = 0; j < tiling.anchorNodes[i].vertices.length; j++) {
                            let vertex = tiling.anchorNodes[i].vertices[j];
                            if (!uniqueVertices.some(v => isWithinTolerance(v, vertex))) {
                                uniqueVertices.push(vertex);
                            }
                        }
                    }
                    
                    let uniqueVerticesSorted = sortPointsByAngleAndDistance(uniqueVertices);
                    for (let i = 0; i < uniqueVerticesSorted.length; i++) {
                        let vertex = uniqueVerticesSorted[i];
                        screenshotCanvas.text('v' + (i + 1), vertex.x, vertex.y);
                    }
                };
                
                drawConstructionPointsOnScreenshot();
            }
            
            if ($showPolygonPoints) {
                for (let i = 0; i < tiling.nodes.length; i++) {
                    screenshotCanvas.fill(0, 40, 100);
                    screenshotCanvas.ellipse(tiling.nodes[i].centroid.x, tiling.nodes[i].centroid.y, 5 / $controls.zoom);
                    
                    screenshotCanvas.fill(120, 40, 100);
                    for (let j = 0; j < tiling.nodes[i].halfways.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].halfways[j].x, tiling.nodes[i].halfways[j].y, 5 / $controls.zoom);
                    }
                    
                    screenshotCanvas.fill(240, 40, 100);
                    for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].vertices[j].x, tiling.nodes[i].vertices[j].y, 5 / $controls.zoom);
                    }
                }
            }
            
            p5.saveCanvas(screenshotCanvas, filename, 'png');

            screenshotCanvas.remove();
            
            notificationMessage = `Screenshot saved as ${filename}`;
            showNotification = true;
            setTimeout(() => {
                showNotification = false;
            }, 3000);
        }
    };

    let canvasContainer = $state();
    let p5;
    let myp5 = $state();
    
    const captureScreenshot = () => {
        takeScreenshot = true;
    }
</script>

<div class="relative h-full w-full">
    <div class="cursor-pointer" bind:this={canvasContainer} oncontextmenu={(e) => e.preventDefault()}></div>
    
    {#if showExtra}
        {#if !showGameOfLife}
            <div class="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button 
                    class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors duration-200 flex items-center gap-2"
                    onclick={captureScreenshot}
                    onmouseenter={() => { $screenshotButtonHover = true; }}
                    onmouseleave={() => { $screenshotButtonHover = false; }}
                >
                    <ls.Camera />
                    Screenshot
                </button>
                
                <button 
                    class="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors duration-200 flex items-center gap-2"
                    onclick={() => {
                        $debugView = !$debugView;
                        if ($debugView) {
                            debugManager.reset();
                            setTimeout(() => {
                                // tiling = tilingGenerator.generateWithWFC();
                                tiling = tilingGenerator.generateFromRule($selectedTiling.rulestring);
                                updateDebugStore();
                            }, 0);
                        }
                    }}
                >
                    <ls.Bug />
                    {$debugView ? 'Disable Debug' : 'Enable Debug'}
                </button>

                <button 
                    class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors duration-200 flex items-center gap-2"
                    onclick={() => {
                        tiling.exportGraph();
                    }}
                >
                    <ls.Workflow />
                    Export Graph
                </button>
            </div>

            {#if $selectedTiling.rulestring.includes('*')}
                <div class="absolute bottom-4 right-4 w-96 z-20">
                    <ColorPad />
                </div>
            {/if}

            <div class="absolute bottom-16 right-[50%] translate-x-[50%] z-20 w-80">
                <div class="flex flex-col gap-3 bg-zinc-900/90 rounded-lg p-2 pt-3 justify-center items-center w-full">
                    <label for="tilingRule" class="text-lg text-center font-bold leading-none text-zinc-100">Tiling Rule</label>

                    <Input 
                        id="tilingRule"
                        align="center"
                        bind:value={$selectedTiling.rulestring}
                        placeholder="4/m90/r(h1)"
                    />
                </div>
            </div>
        {:else}
            <div class="absolute top-4 right-4 flex flex-col gap-4 z-10">
                <button 
                    class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    onclick={() => resetGameOfLife = true}
                >
                    <ls.RefreshCw size={18} />
                    Randomize
                </button>
                
                <div class="w-72">
                    <LiveChart 
                        bind:alivePercentage={alivePercentage} 
                        bind:iterationCount={iterationCount} 
                        bind:behaviorData={behaviorData}
                    />
                </div>
            </div>
        {/if}
        
        {#if $debugView}
            <div class="absolute bottom-4 right-4 w-96 z-20">
                <ls.PieChart />
                {#if $debugStore.timingData.phases.length === 0}
                    <div class="mt-2 p-3 bg-amber-500/80 text-white text-sm rounded-lg">
                        No timing data available. Try changing the rulestring or layers to generate data.
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

{#if showNotification}
    <div class="fixed bottom-4 right-4 bg-green-500 text-white py-2 px-4 rounded-md shadow-md animate-fade-in-out flex items-center gap-2 z-20">
        <ls.Check />
        {notificationMessage}
    </div>
{/if}

{#if showExtra}
    <div class="flex flex-col gap-3">
        {#if showChart}
            <LiveChart 
                bind:alivePercentage={alivePercentage}
                bind:iterationCount={iterationCount}
                bind:behaviorData={behaviorData}
            />
        {/if}
    </div>
{/if}