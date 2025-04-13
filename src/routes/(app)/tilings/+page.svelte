<script>
    import { onMount } from 'svelte';
    import Canvas from '$lib/components/Canvas.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Checkbox from '$lib/components/ui/Checkbox.svelte';
    import Sidebar from '$lib/components/ui/Sidebar.svelte';
    import Tabs from '$lib/components/ui/Tabs.svelte';
    import Slider from '$lib/components/ui/Slider.svelte';
    import RuleCard from '$lib/components/RuleCard.svelte';

    import { tilingRules } from '$lib/stores/tilingRules.js';
    import { gameOfLifeRules } from '$lib/stores/gameOfLifeRules.js';

    let rule = $state('B3/S23');
    let tiling = $state('3/m30/r(h1)');
    let transformSteps = $state(0);
    let side = $state(50);
    let showConstructionPoints = $state(false);
    let showGameOfLife = $state(false);
    let showInfo = $state(false);
    let speed = $state(1);

    let width = $state();
    let height = $state();
    
    let canvasContainer;
    
    function updateCanvasSize() {
        if (canvasContainer) {
            width = canvasContainer.clientWidth;
            height = canvasContainer.clientHeight;
        }
    }
    
    onMount(() => {
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        
        return () => {
            window.removeEventListener('resize', updateCanvasSize);
        };
    });

    $effect(() => {
        if (canvasContainer) {
            width = canvasContainer.clientWidth;
            height = canvasContainer.clientHeight;
        }
    });
    
    function loadGameRule(selectedRule) {
        rule = selectedRule;
    }
    
    function loadTiling(selectedTiling) {
        tiling = selectedTiling;
    }
</script>

<div class="flex h-full bg-zinc-900">
    <Sidebar title="Tiling Controls">
        <Tabs tabs={["Options", "Game Rules", "Tilings"]}>
            <div slot="tab-0" class="p-4 h-full overflow-y-auto">
                <h3 class="font-medium text-base mb-4 text-white">Canvas Options</h3>
                <div class="space-y-4">
                    <Input 
                        id="rule"
                        label="Rule"
                        bind:value={rule}
                        placeholder="B3/S23"
                    />
                    
                    <Input 
                        id="tiling"
                        label="Tiling"
                        bind:value={tiling}
                        placeholder="4/m90/r(h1)"
                    />
                    
                    <Input 
                        id="transformSteps"
                        type="number"
                        label="Transform Steps"
                        bind:value={transformSteps}
                        min={0}
                    />
                    
                    <Input 
                        id="side"
                        type="number"
                        label="Side Length"
                        bind:value={side}
                        min={1}
                    />
                    
                    <div class="space-y-2 pt-2">
                        <Checkbox 
                            id="showConstructionPoints"
                            label="Show Construction Points"
                            bind:checked={showConstructionPoints}
                        />
                        
                        <Checkbox 
                            id="showGameOfLife"
                            label="Show Game of Life"
                            bind:checked={showGameOfLife}
                        />
                        
                        <Checkbox 
                            id="showInfo"
                            label="Show Info"
                            bind:checked={showInfo}
                        />
                        
                        {#if showGameOfLife}
                            <Slider
                                id="speed"
                                label="Simulation Speed"
                                bind:value={speed}
                                min={1}
                                max={60}
                                step={1}
                            />
                        {/if}
                    </div>
                </div>
            </div>

            <div slot="tab-1" class="p-4 h-full overflow-y-auto">
                <h3 class="font-medium text-base mb-4 text-white">Game of Life Rules</h3>
                <div class="space-y-2">
                    {#each gameOfLifeRules as gameRule}
                        <RuleCard 
                            title={gameRule}
                            value={gameRule}
                            onClick={loadGameRule}
                        />
                    {/each}
                </div>
            </div>
            
            <div slot="tab-2" class="p-4 h-full overflow-y-auto">
                <h3 class="font-medium text-base mb-4 text-white">Tiling Patterns</h3>
                <div>
                    {#each tilingRules as tilingPattern}
                        <RuleCard 
                            title={tilingPattern}
                            value={tilingPattern}
                            onClick={loadTiling}
                        />
                    {/each}
                </div>
            </div>
        </Tabs>
    </Sidebar>

    <div class="flex-1 ml-80 w-full h-full" bind:this={canvasContainer}>
        <Canvas 
            width={width}
            height={height} 
            rule={rule} 
            tiling={tiling} 
            transformSteps={transformSteps} 
            side={side} 
            showConstructionPoints={showConstructionPoints} 
            showGameOfLife={showGameOfLife}
            showInfo={showInfo}
            speed={speed}
        />
    </div>
</div>
