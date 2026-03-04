<script>
    import { ruleType, parameter, selectedTiling, debugView, controls, transformSteps, golRule, golRules, showPolygonPoints, showConstructionPoints, showChart, speed, screenshotButtonHover, takeScreenshot, exportGraphButtonHover, exportGraph, openScreenshotPreview, tilingStore, isTilingRegularOnly, circlePacking } from '$stores';
    import { debugManager, debugStore, updateDebugStore } from '$stores';
    import { sortPointsByAngleAndDistance } from '$utils';
    // import { TilingGeneratorWFC } from '$lib/classes/generator/TilingGeneratorWFC.svelte.ts';
    import { TilingGeneratorFromRule, RegularPolygon } from '$classes';
    import { isWithinTolerance } from '$utils';
    import { Vector } from '$classes';
    import * as ls from 'lucide-svelte';
    import { onMount } from 'svelte';
    import { sounds } from '$utils';

    import LiveChart from '$components/LiveChart.svelte';
    import ColorPad from '$components/ui/ColorPad.svelte';
    import TilingInfo from '$components/TilingInfo.svelte';
    import Input from '$components/ui/Input.svelte';

    let {
        width = 600,
        height = 600,
        showGameOfLife,
        showExtra = true,
        isSidebarOpen = true
    } = $props();
    
    const SIDEBAR_WIDTH = 384;
    let tilingInfoLeft = $derived(isSidebarOpen ? SIDEBAR_WIDTH / 2 + 16 : 64);

    let grab = $state(false);
    let frameMod = $derived(60 / $speed);
    let showNotification = $state(false);
    let notificationMessage = $state('');
    let alivePercentage = $state(0);
    let iterationCount = $state(0);
    let behaviorData = $state({ increasing: 0, chaotic: 0, decreasing: 0 });
    
    let canvasElement = $state(null);

    let prevWidth = width;   
    let prevHeight = height;
    let prevSelectedTiling = $state($selectedTiling);
    let prevTransformSteps = $state($transformSteps);
    let prevRuleType = $state($ruleType);
    let prevGolRule = $state($golRule);
    let prevGolRules = $state($golRules);
    let prevParameter = $state($parameter);

    let tiling = $state();
    let tilingGenerator = $state();
    let canvasError = $state(null);

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

    // Resize canvas when window dimensions change
    $effect(() => {
        if (canvasElement && canvasElement.resizeCanvas && 
            (width !== prevWidth || height !== prevHeight)) {
            canvasElement.resizeCanvas(width, height);
            prevWidth = width;
            prevHeight = height;
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

    $effect(() => {
        if ($takeScreenshot && myp5) {
            (async () => {
                await myp5.takeScreenshot();
                $takeScreenshot = false;
            })();
        }
    });

	let sketch = function(p5) {
        p5.setup = () => {
            p5.createCanvas(width, height);
            canvasElement = p5;
            p5.colorMode(p5.HSB, 360, 100, 100);
            
            $controls.targetZoom = $controls.zoom;
            $controls.targetOffset = $controls.offset.copy();
            
            tilingGenerator = new TilingGeneratorFromRule();
            try {
                if ($debugView) debugManager.reset();

                // generate the tiling
                // tiling = tilingGenerator.generateWithWFC();
                tiling = tilingGenerator.generateFromRule($selectedTiling.rulestring);
                tilingGenerator.golEngine.setupGameOfLife(tiling, $ruleType, $golRule, $golRules);
                
                // check if the tiling is composed only of regular polygons
                const regularOnly = tiling?.nodes?.length > 0 && tiling.nodes.every((n) => n instanceof RegularPolygon);
                isTilingRegularOnly.set(regularOnly);
                if (!regularOnly) circlePacking.set(false);
                
                if ($debugView) updateDebugStore();
                canvasError = null;
            } catch (e) {
                canvasError = e?.message ?? String(e);
            }
        }

        p5.draw = async () => {
            $controls.zoom += ($controls.targetZoom - $controls.zoom) * $controls.dampening;
            $controls.offset.add(Vector.sub($controls.targetOffset, $controls.offset).scale($controls.dampening));
            
            p5.background(240, 7, 16);
            
            canvasError = null;

            try {
                p5.push();
                p5.translate(p5.width / 2, p5.height / 2);
                p5.translate($controls.offset.x, $controls.offset.y);
                p5.scale($controls.zoom);
                p5.scale(1, -1);

                if (showGameOfLife) {
                    p5.showGameOfLife();
                } else {
                    p5.showTiling();
                }
            } catch (e) {
                canvasError = e?.message ?? String(e);
            }

            if (canvasError) {
                p5.noStroke();
                p5.background(240, 7, 16);
                p5.fill(255);
                p5.textSize(16);
                p5.textAlign(p5.CENTER, p5.CENTER);
                p5.text(canvasError, p5.width / 2, p5.height / 2, 32);
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

        p5.showTiling = () => {
            if (
                prevSelectedTiling.rulestring != $selectedTiling.rulestring || 
                parseInt($transformSteps) != parseInt(prevTransformSteps) ||
                prevParameter != $parameter
            ) {
                tiling = tilingGenerator.generateFromRule($selectedTiling.rulestring);
                tilingGenerator.golEngine.setupGameOfLife(tiling, $ruleType, $golRule, $golRules);
                const regularOnly = tiling?.nodes?.length > 0 && tiling.nodes.every((n) => n instanceof RegularPolygon);
                isTilingRegularOnly.set(regularOnly);
                if (!regularOnly) circlePacking.set(false);
            }

            if ($exportGraphButtonHover) {
                tiling.showGraph(p5);
            } else {
                tiling.show(p5, $showPolygonPoints, 1, $circlePacking);
            }

            if ($showConstructionPoints)
                tiling.drawConstructionPoints(p5);
            
            // tiling.showNeighbors(p5, $showPolygonPoints);
            // tilingGenerator.showWFCInfo(p5);

            p5.pop();

            if ($screenshotButtonHover) {
                p5.push();
                let sss = 600;
                p5.noStroke();
                p5.fill(0, 0, 0, 0.5);

                p5.rect(0, 0, p5.width / 2 - sss / 2, p5.height);
                p5.rect(p5.width / 2 + sss / 2, 0, p5.width / 2 - sss / 2, p5.height);
                p5.rect(p5.width / 2 - sss / 2, 0, sss, p5.height / 2 - sss / 2);
                p5.rect(p5.width / 2 - sss / 2, p5.height / 2 + sss / 2, sss, p5.height / 2 - sss / 2);

                let len = 50;
                p5.stroke(255);
                p5.strokeWeight(2);

                p5.line(p5.width / 2 - sss / 2, p5.height / 2 - sss / 2, p5.width / 2 - sss / 2 + len, p5.height / 2 - sss / 2);
                p5.line(p5.width / 2 - sss / 2, p5.height / 2 - sss / 2, p5.width / 2 - sss / 2, p5.height / 2 - sss / 2 + len);

                p5.line(p5.width / 2 + sss / 2, p5.height / 2 - sss / 2, p5.width / 2 + sss / 2 - len, p5.height / 2 - sss / 2);
                p5.line(p5.width / 2 + sss / 2, p5.height / 2 - sss / 2, p5.width / 2 + sss / 2, p5.height / 2 - sss / 2 + len);

                p5.line(p5.width / 2 - sss / 2, p5.height / 2 + sss / 2, p5.width / 2 - sss / 2 + len, p5.height / 2 + sss / 2);
                p5.line(p5.width / 2 - sss / 2, p5.height / 2 + sss / 2, p5.width / 2 - sss / 2, p5.height / 2 + sss / 2 - len);

                p5.line(p5.width / 2 + sss / 2, p5.height / 2 + sss / 2, p5.width / 2 + sss / 2 - len, p5.height / 2 + sss / 2);
                p5.line(p5.width / 2 + sss / 2, p5.height / 2 + sss / 2, p5.width / 2 + sss / 2, p5.height / 2 + sss / 2 - len);

                p5.pop();
            }

            if ($exportGraph) {
                tiling.exportGraph(p5);
                $exportGraph = false;
            }
        }

        p5.showGameOfLife = () => {
            if (
                prevRuleType != $ruleType || 
                ($ruleType == "Single" && !p5.isSameRule(prevGolRule, $golRule)) || 
                ($ruleType == "By Shape" && !p5.isSameRule(prevGolRules, $golRules)) ||
                resetGameOfLife
            ) {
                tilingGenerator.setupGameOfLife($ruleType, $golRule, $golRules);
                resetGameOfLife = false;
            }

            if (p5.frameCount % Math.round(frameMod) == 0) {
                // Store previous states to calculate changes
                const prevStates = tiling.nodes.map(node => node.state);
                
                tiling.updateGameOfLife();
                
                // Calculate state changes
                const changedCells = tiling.nodes.filter((node, index) => node.state !== prevStates[index]).length;
                const totalCells = tiling.nodes.length;
                const changeRatio = totalCells > 0 ? changedCells / totalCells : 0;
                
                // Play state change sound with volume proportional to change ratio
                // and subtle variations based on simulation state
                if (changedCells > 0) {
                    // Use behavior data to influence sound variation
                    const bornCells = tiling.nodes.filter((node, index) => 
                        prevStates[index] === 0 && node.state === 1).length;
                    const diedCells = tiling.nodes.filter((node, index) => 
                        prevStates[index] === 1 && node.state === 0).length;
                    
                    // Calculate additional parameters for sound variation
                    const bornRatio = totalCells > 0 ? bornCells / totalCells : 0;
                    const diedRatio = totalCells > 0 ? diedCells / totalCells : 0;
                    const activityLevel = Math.min(1.0, (bornRatio + diedRatio) * 2);
                    
                    // Adjust volume based on change ratio but ensure it's audible
                    const volume = changeRatio / 5;
                    
                    // Pass simulation parameters to the sound function
                    sounds.stateChange(volume, {
                        bornRatio,
                        diedRatio,
                        activityLevel,
                        iteration: iterationCount
                    });
                }
                
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

            tiling.drawGameOfLife(p5, $circlePacking);
            p5.pop();
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

        p5.takeScreenshot = async () => {
            const filename = `${$selectedTiling.rulestring}.png`;
            
            let screenshotCanvas = p5.createGraphics(300, 300);
            screenshotCanvas.pixelDensity(1);

            screenshotCanvas.colorMode(p5.HSB, 360, 100, 100);
            
            screenshotCanvas.translate(0, 300);
            screenshotCanvas.scale(0.5, -0.5);
            
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
            
            const imageDataUrl = screenshotCanvas.elt.toDataURL('image/png');
            const baseRulestring = $selectedTiling.rulestring.replace(/\*$/, '');
            const dbTiling = tilingStore.getTilingByRulestring($selectedTiling.rulestring)
                ?? tilingStore.getTilingByRulestring(baseRulestring);
            const groupId = dbTiling?.group_id ?? null;

            screenshotCanvas.remove();

            openScreenshotPreview({
                imageDataUrl,
                filename,
                rulestring: $selectedTiling.rulestring,
                groupId,
                allowSupabaseUpload: true
            });
        }
    };

    let canvasContainer = $state();
    let p5;
    let myp5 = $state();
</script>

<div class="relative h-full w-full">
    <div class="cursor-pointer" bind:this={canvasContainer} oncontextmenu={(e) => e.preventDefault()}></div>

    {#if showExtra}
        <div 
            class="fixed top-4 z-50 transition-[left] duration-300 ease-in-out"
            style="left: {tilingInfoLeft}px;"
        >
            <TilingInfo tileCount={tiling?.nodes?.length ?? 0} vcs={tiling?.vcs ?? []} />
        </div>

        {#if !showGameOfLife}
            {#if $selectedTiling.rulestring.includes('*')}
                <div class="absolute bottom-4 right-4 z-20">
                    <ColorPad />
                </div>
            {/if}

            <div class="absolute bottom-8 right-[50%] translate-x-[50%] z-20 w-80">
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