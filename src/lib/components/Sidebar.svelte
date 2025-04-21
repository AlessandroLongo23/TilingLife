<script>
	import { golRule, golRules, tilingRule, transformSteps, side, showConstructionPoints, showInfo, speed, ruleType, isDual } from '$lib/stores/configuration';
	import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { gameOfLifeRules } from '$lib/stores/gameOfLifeRules.js';
	import { tilingRules } from '$lib/stores/tilingRules.js';
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';

	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import ShapeIcon from '$lib/components/ShapeIcon.svelte';
	import RuleCard from '$lib/components/RuleCard.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';

	let { 
		isSidebarOpen = $bindable(true),
		sidebarElement = $bindable(''),
	} = $props();

	// Track expanded state of each group
	let expandedGroups = $state({});
	
	// Initialize all groups as expanded by default
	$effect(() => {
		// Only set initial state if expandedGroups is empty
		if (Object.keys(expandedGroups).length === 0) {
			let initialState = {};
			tilingRules.forEach(group => {
				initialState[group.title] = true; // Start expanded
			});
			expandedGroups = initialState;
		}
	});
	
	// Toggle group expansion
	const toggleGroup = (groupTitle) => {
		expandedGroups[groupTitle] = !expandedGroups[groupTitle];
	};

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
		
		// Notify parent of toggling
		dispatch('toggle', { isSidebarOpen });
		
		// Force a repaint after the transition
		if (isSidebarOpen) {
			// For opening, emit resize event after transition
			setTimeout(() => {
				window.dispatchEvent(new Event('resize'));
			}, 300);
		}
	}

	const loadGameRule = (selectedRule) => {
        $golRule = selectedRule;
    }
    
    const loadTiling = (selectedTiling) => {
        $tilingRule = selectedTiling;
    }
</script>

<div id="sidebar" class="h-full fixed left-0 top-0 transition-all duration-300 flex flex-col shadow-2xl {isSidebarOpen ? 'w-96' : 'w-12'}" bind:this={sidebarElement}>
	<div class="bg-zinc-800/90 backdrop-blur-sm text-white h-full overflow-hidden flex flex-col border-r border-zinc-700/50">
		<div class="p-3 flex items-center justify-between border-b border-zinc-700/50 flex-shrink-0 bg-zinc-900/30">
			{#if isSidebarOpen}
				<h2 class="text-sm font-medium text-white/90 uppercase tracking-wider">Controls</h2>
			{/if}

			<button
				onclick={toggleSidebar}
				class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
				aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
			>
				{#if isSidebarOpen}
					<ChevronLeft size={18} />
				{:else}
					<ChevronRight size={18} />
				{/if}
			</button>
		</div>
		
		{#if isSidebarOpen}
			<div class="flex-1 overflow-hidden">
				<Tabs tabs={["Tilings", "Game of Life"]}>
					<div slot="tab-0" class="h-full flex flex-col">
						<!-- Fixed options section -->
						<div class="p-3 flex-shrink-0 border-b border-zinc-700/50 bg-zinc-800/40">
							<div class="flex flex-col gap-3">
								<div class="flex flex-row gap-3">
									<Input 
										id="tilingRule"
										label="Tiling Rule"
										bind:value={$tilingRule}
										placeholder="4/m90/r(h1)"
									/>

									<!-- <Checkbox 
										id="isDual"
										label="Dual"
										position="top"
										bind:checked={$isDual}
									/> -->
								</div>	

								<div class="flex flex-row gap-3">
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

								<div class="space-y-2 pt-1">
									<Checkbox 
										id="showConstructionPoints"
										label="Show Construction Points"
										position="right"
										bind:checked={$showConstructionPoints}
									/>
									
									<Checkbox 
										id="showInfo"
										label="Show Info"
										position="right"
										bind:checked={$showInfo}
									/>
								</div>
							</div>
						</div>
						
						<!-- Scrollable rules section -->
						<div class="flex-1 overflow-y-auto p-3">
							<div class="flex flex-col gap-3">
								<h3 class="font-medium text-xs text-white/80 uppercase tracking-wider">Tiling Patterns <span class="text-white/80 font-normal">({tilingRules.reduce((acc, curr) => acc + curr.rules.length, 0)})</span></h3>
								<div>
									{#each tilingRules as tilingPatternGroup}
										<div class="mb-3">
											<button 
												class="w-full flex items-center justify-between font-medium text-sm text-zinc-300 mb-2 hover:text-white focus:outline-none transition-colors"
												onclick={() => toggleGroup(tilingPatternGroup.title)}
												aria-expanded={expandedGroups[tilingPatternGroup.title]}
											>
												<span>{tilingPatternGroup.title} <span class="text-green-400/80 font-normal">({tilingPatternGroup.rules.length})</span></span>
												<ChevronDown 
                                                    size={14} 
                                                    class="transition-transform duration-200 {expandedGroups[tilingPatternGroup.title] ? 'rotate-180' : ''}"
                                                />
											</button>
											
											{#if expandedGroups[tilingPatternGroup.title]}
												<div class="grid grid-cols-2 gap-2 pl-1 space-y-1" transition:slide={{ duration: 200 }}>
													{#each tilingPatternGroup.rules as tilingPattern}
														<RuleCard 
															title={tilingPattern}
															value={tilingPattern}
															onClick={loadTiling}
														/>

														{#if tilingPatternGroup.dual}
															<RuleCard 
																title={'Dual of: ' + tilingPattern}
																value={tilingPattern.concat('*')}
																onClick={loadTiling}
															/>
														{/if}
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>

					<div slot="tab-1" class="h-full flex flex-col">
						<!-- Fixed options section -->
						<div class="p-3 flex-shrink-0 border-b border-zinc-700/50 bg-zinc-800/40">
							<div class="flex flex-col gap-3">
								<h3 class="font-medium text-xs text-white/80 uppercase tracking-wider">Game of Life Simulation</h3>
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
									<div class="font-medium text-xs text-white/80 uppercase tracking-wider mb-2">Rules by Shape</div>
									<div class="max-h-48 overflow-y-auto pr-2 mb-2 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3">
										{#each shapes as shape}
											<div class="flex flex-row gap-3 items-center mb-2 last:mb-0">
												<div class="w-7 flex justify-center">
													<ShapeIcon sides={shape} size={24} />
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
									</div>
								{/if}

								<Slider
									id="speed"
									label="Simulation Speed"
									bind:value={$speed}
									min={1}
									max={60}
									step={1}
								/>
							</div>
						</div>
						
						<!-- Scrollable rules section -->
						{#if $ruleType === 'Single'}
							<div class="flex-1 overflow-y-auto p-3">
								<div class="flex flex-col gap-3">
									<h3 class="font-medium text-xs text-white/80 uppercase tracking-wider">Game of Life Rules</h3>
									<div class="grid grid-cols-2 gap-2">
										{#each gameOfLifeRules as gameRule}
										<RuleCard 
											title={gameRule}
											value={gameRule}
											onClick={loadGameRule}
										/>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</Tabs>
			</div>
		{/if}
	</div>
</div> 