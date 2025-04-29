<script>
    import { ruleType, parameter, selectedTiling, showCR, debugView, side, transformSteps, patch, golRule, golRules, showConstructionPoints, showInfo, speed, screenshotButtonHover } from '$lib/stores/configuration.js';
    import { debugManager, debugStore, updateDebugStore } from '$lib/stores/debug.js';
    import * as ls from 'lucide-svelte';
    import { Tiling } from '$lib/classes/Tiling.svelte.js';
    import { Cr } from '$lib/classes/Cr.svelte.js';
    import { onMount } from 'svelte';

    import LiveChart from '$lib/components/LiveChart.svelte';

    let {
        width = 600,
        height = 600,
        showGameOfLife,
    } = $props();

    let frameMod = $derived(60 / $speed);
    let takeScreenshot = $state(false);
    let showNotification = $state(false);
    let notificationMessage = $state('');
    let alivePercentage = $state(0);
    let iterationCount = $state(0);
    
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
            
            tiling = new Tiling();
            try {
                tiling.parseRule($selectedTiling.rulestring);
                if ($debugView) {
                    debugManager.reset();
                }
                tiling.generateTiling();
                tiling.setupGameOfLife($ruleType, $golRule, $golRules);
                if ($debugView) {
                    updateDebugStore();
                }

                cr = new Cr($selectedTiling.cr || tiling.crNotation);
                crCanvases = Array.from({length: cr.vertexGroups.length}, () => p5.createGraphics(patch.size.x, patch.size.y));
            } catch (e) {
                console.log(e);
            }
        }

        p5.draw = () => {
            p5.push();
            p5.translate(0, p5.height);
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
                        tiling.setupGameOfLife($ruleType, $golRule, $golRules);
                        resetGameOfLife = false;
                    }

                    if (frameMod > 1) {
                        if (p5.frameCount % Math.round(frameMod) == 0) {
                            tiling.updateGameOfLife();
                            alivePercentage = tiling.nodes.filter(node => node.state === 1).length / tiling.nodes.length * 100;
                            iterationCount++;
                        }
                    } else {
                        for (let s = 0; s < Math.round(1 / frameMod); s++) {
                            tiling.updateGameOfLife();
                            alivePercentage = tiling.nodes.filter(node => node.state === 1).length / tiling.nodes.length * 100;
                            iterationCount++;
                        }
                    }

                    tiling.drawGameOfLife(p5, $side);
                    p5.pop();
                } else {
                    if (
                        prevSelectedTiling.rulestring != $selectedTiling.rulestring || 
                        parseInt($transformSteps) != parseInt(prevTransformSteps) ||
                        prevParameter != $parameter
                    ) {
                        tiling.parseRule($selectedTiling.rulestring);
                        tiling.generateTiling();
                        tiling.setupGameOfLife($ruleType, $golRule, $golRules);
                        cr = new Cr($selectedTiling.cr || tiling.crNotation);

                        crCanvases = Array.from({length: cr.vertexGroups.length}, () => p5.createGraphics(patch.size.x, patch.size.y));
                    }

                    tiling.show(p5, $side, $showConstructionPoints);
                    if ($showInfo) {
                        tiling.drawInfo(p5, $side);
                    }
                    tiling.showNeighbors(p5, $side, $showConstructionPoints);
                    p5.pop();

                    if ($showCR) {
                        p5.drawCr();
                    }

                    if (takeScreenshot) {
                        p5.takeScreenshot();
                        takeScreenshot = false;
                    }
                }
            } catch (e) {
                console.log(e);
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
                crCanvases[i].rect(0, 0, crCanvases[i].width, crCanvases[i].height, patch.borderRadius);
                crCanvases[i].translate(crCanvases[i].width / 2, crCanvases[i].height / 2);

                cr.draw(crCanvases[i], i, p5);
                p5.image(crCanvases[i], patch.padding + i * (patch.size.x + patch.padding), p5.height - patch.size.y - patch.padding);
                crCanvases[i].pop();
            }
        }
        
        p5.mousePressed = (event) => {
            if (!$showCR) return;
            
            if (event && event.target !== p5.canvas) return;
            
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
        
        p5.takeScreenshot = () => {
            const filename = `${$selectedTiling.rulestring}.png`;
            
            const screenshotCanvas = p5.createGraphics(600, 600);
            
            screenshotCanvas.colorMode(p5.HSB, 360, 100, 100);
            
            screenshotCanvas.push();
            screenshotCanvas.translate(0, 600);
            screenshotCanvas.scale(1, -1);
            
            screenshotCanvas.background(240, 7, 16);
            
            screenshotCanvas.translate(300, 300);
            
            screenshotCanvas.stroke(0);
            screenshotCanvas.strokeWeight(2 / $side);
            
            screenshotCanvas.scale($side);
            
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
            
            if ($showInfo) {
                const drawInfoOnScreenshot = () => {
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
                
                drawInfoOnScreenshot();
            }
            
            if ($showConstructionPoints) {
                for (let i = 0; i < tiling.nodes.length; i++) {
                    screenshotCanvas.fill(0, 40, 100);
                    screenshotCanvas.ellipse(tiling.nodes[i].centroid.x, tiling.nodes[i].centroid.y, 5 / $side);
                    
                    screenshotCanvas.fill(120, 40, 100);
                    for (let j = 0; j < tiling.nodes[i].halfways.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].halfways[j].x, tiling.nodes[i].halfways[j].y, 5 / $side);
                    }
                    
                    screenshotCanvas.fill(240, 40, 100);
                    for (let j = 0; j < tiling.nodes[i].vertices.length; j++) {
                        screenshotCanvas.ellipse(tiling.nodes[i].vertices[j].x, tiling.nodes[i].vertices[j].y, 5 / $side);
                    }
                }
            }
            
            screenshotCanvas.pop();
            
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
    <div bind:this={canvasContainer}></div>
    
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
                            tiling.generateTiling();
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
                <LiveChart bind:alivePercentage={alivePercentage} bind:iterationCount={iterationCount}/>
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
</div>

{#if showNotification}
    <div class="fixed bottom-4 right-4 bg-green-500 text-white py-2 px-4 rounded-md shadow-md animate-fade-in-out flex items-center gap-2 z-20">
        <ls.Check />
        {notificationMessage}
    </div>
{/if}

<div class="flex flex-col gap-3">
    {#if showInfo}
        <LiveChart 
            bind:alivePercentage={alivePercentage}
            bind:iterationCount={iterationCount}
        />
    {/if}
</div>