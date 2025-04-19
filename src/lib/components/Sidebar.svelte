<script>
	import { createEventDispatcher } from 'svelte';
	import { golRule, golRules, tilingRule, transformSteps, side, showConstructionPoints, showInfo, speed, ruleType } from '$lib/stores/configuration';
	import { gameOfLifeRules } from '$lib/stores/gameOfLifeRules.js';
	import { tilingRules } from '$lib/stores/tilingRules.js';

	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import RuleCard from '$lib/components/RuleCard.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import ShapeIcon from '$lib/components/ShapeIcon.svelte';

	let { 
		isSidebarOpen = $bindable(true),
		sidebarElement = $bindable(''),
	} = $props();

	let shapes = $derived.by(() => {
		let shapes = new Set();
		let seed = $tilingRule.split('/')[0].replaceAll(',', '-').split('-');
		for (let shape of seed)
			shapes.add(parseInt(shape));

		return Array.from(shapes).sort((a, b) => a - b);
	});
	
	const dispatch = createEventDispatcher();
	
	const toggleSidebar = () => {
		isSidebarOpen = !isSidebarOpen;
		dispatch('toggle', { isSidebarOpen });
	}

	const loadGameRule = (selectedRule) => {
        $golRule = selectedRule;
    }
    
    const loadTiling = (selectedTiling) => {
        $tilingRule = selectedTiling;
    }

	const startSimulation = () => {
		console.log('startSimulation');
	}
</script>

<div id="sidebar" class="h-full fixed left-0 top-0 transition-all duration-300 flex flex-col" class:w-80={isSidebarOpen} class:w-12={!isSidebarOpen} bind:this={sidebarElement}>
	<div class="bg-zinc-800 text-white h-full overflow-hidden flex flex-col">
		<div class="p-4 flex items-center justify-between border-b border-zinc-700 flex-shrink-0">
			{#if isSidebarOpen}
				<h2 class="text-lg font-semibold text-white">Controls</h2>
			{/if}

			<button
				onclick={toggleSidebar}
				class="p-1 rounded-md hover:bg-zinc-700 transition-colors text-white"
				aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="transition-transform"
					class:rotate-180={!isSidebarOpen}
				>
					{#if isSidebarOpen}
						<path d="M15 18l-6-6 6-6" />
					{:else}
						<path d="M9 18l6-6-6-6" />
					{/if}
				</svg>
			</button>
		</div>
		
		{#if isSidebarOpen}
			<div class="flex-1 overflow-y-auto">
				<Tabs tabs={["Tilings", "Game of Life"]}>
					<div slot="tab-0" class="p-4 h-full overflow-y-auto flex flex-col gap-8">
						<div class="flex flex-col gap-4">
							<Input 
								id="tilingRule"
								label="Tiling Rule"
								bind:value={$tilingRule}
								placeholder="4/m90/r(h1)"
							/>

							<div class="flex flex-row gap-4">
								<Input
									id="transformSteps"
									type="number"
									label="Transform Steps"
									bind:value={$transformSteps}
									min={0}
								/>
								
								<Input 
									id="side"
									type="number"
									label="Side Length"
									bind:value={$side}
									min={1}
								/>
							</div>

							<div class="space-y-2 pt-2">
								<Checkbox 
									id="showConstructionPoints"
									label="Show Construction Points"
									bind:checked={$showConstructionPoints}
								/>
								
								<Checkbox 
									id="showInfo"
									label="Show Info"
									bind:checked={$showInfo}
								/>
							</div>
						</div>
						
						<hr class="border-zinc-700">

						<div class="flex flex-col gap-4">
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
					</div>

					<div slot="tab-1" class="p-4 h-full overflow-y-auto flex flex-col gap-8">
						<div class="flex flex-col gap-4">
							<h3 class="font-medium text-base text-white">Game of Life Simulation</h3>
							<Toggle
								id="debug"
								leftValue="Single"
								rightValue="By Shape"
								bind:value={$ruleType}
							/>

							{#if $ruleType === 'Single'}
								<Input 
									id="golRule"
									label="Rule"
									bind:value={$golRule}
									placeholder="B3/S23"
								/>
							{:else}
								<div class="mb-2 font-medium">Rules by Shape</div>
								{#each shapes as shape}
									<div class="flex flex-row gap-4 items-center mb-2">
										<div class="w-8 flex justify-center">
											<ShapeIcon sides={shape} size={32} />
										</div>

										<Input 
											id={`golRule-${shape}`}
											label=""
											value={$golRules[shape] ?? 'B3/S23'}
											onChangeFunction={(e) => {
												$golRules = { ...$golRules, [shape]: e.target.value };
											}}
											placeholder="B3/S23"
										/>
									</div>
								{/each}
							{/if}

							<Slider
								id="speed"
								label="Simulation Speed"
								bind:value={$speed}
								min={1}
								max={60}
								step={1}
							/>

							<Button
								id="startSimulation"
								label="Start Simulation"
								onclick={startSimulation}
							/>
						</div>

						{#if $ruleType === 'Single'}
							<div class="flex flex-col gap-4">
								<h3 class="font-medium text-base text-white">Game of Life Rules</h3>
								<div class="flex flex-col gap-2">
									{#each gameOfLifeRules as gameRule}
									<RuleCard 
										title={gameRule}
										value={gameRule}
										onClick={loadGameRule}
									/>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</Tabs>
			</div>
		{/if}
	</div>
</div> 