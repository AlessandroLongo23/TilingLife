<script>
	import { golRule, golRules, selectedTiling, transformSteps, side, showConstructionPoints, showInfo, showCR, speed, ruleType, parameter } from '$lib/stores/configuration.js';
	import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, ChevronsDownUp, ChevronsUpDown } from 'lucide-svelte';
	import { gameOfLifeRules } from '$lib/stores/gameOfLifeRules.js';
	import { tilingRules } from '$lib/stores/tilingRules.js';
	import { tilingModalOpen } from '$lib/stores/modalState.js';
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';

	import GolRuleCard from '$lib/components/GolRuleCard.svelte';
	import TilingCard from '$lib/components/TilingCard.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import ShapeIcon from '$lib/components/ShapeIcon.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';

	let { 
		isSidebarOpen = $bindable(true),
		sidebarElement = $bindable(''),
	} = $props();

	let expandedGroups = $state({});
	
	$effect(() => {
		if (Object.keys(expandedGroups).length === 0) {
			let initialState = {};
			tilingRules.forEach(group => {
				initialState[group.title] = true;
			});
			expandedGroups = initialState;
		}
	});
	
	const toggleGroup = (groupTitle) => {
		expandedGroups[groupTitle] = !expandedGroups[groupTitle];
	};

	let shapes = $derived.by(() => {
		let shapes = new Set();
		let seed = $selectedTiling.rulestring.split('/')[0].replaceAll(',', '-').split('-');
		for (let shape of seed)
			shapes.add(parseInt(shape));

		return Array.from(shapes).sort((a, b) => a - b);
	});
	
	const dispatch = createEventDispatcher();
	
	const toggleSidebar = () => {
		isSidebarOpen = !isSidebarOpen;
		
		dispatch('toggle', { isSidebarOpen });
		
		if (isSidebarOpen) {
			setTimeout(() => {
				window.dispatchEvent(new Event('resize'));
			}, 300);
		}
	}

	const loadGolRule = (selectedRule) => {
        $golRule = selectedRule;
    }
    
    const loadTiling = (tiling) => {
        $selectedTiling = tiling;
    }
    
    const openTilingModal = () => {
        $tilingModalOpen = true;
    }

	const expandAll = () => {
		expandedGroups = tilingRules.reduce((acc, curr) => {
			acc[curr.title] = true;
			return acc;
		}, {});
	}

	const collapseAll = () => {
		expandedGroups = tilingRules.reduce((acc, curr) => {
			acc[curr.title] = false;
			return acc;
		}, {});
	}

	let isParametrized = $derived($selectedTiling.rulestring.includes('a'));
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
									<div class="w-2/3">
										<Input 
											id="tilingRule"
											label="Tiling Rule"
											bind:value={$selectedTiling.rulestring}
											placeholder="4/m90/r(h1)"
										/>
									</div>

									<div class="w-1/3">
										<Input
											id="transformSteps"
											type="number"
											label="Layers"
											bind:value={$transformSteps}
											min={0}
										/>
									</div>

									<!-- <Checkbox 
										id="isDual"
										label="Dual"
										position="top"
										bind:checked={$isDual}
									/> -->
								</div>	

								<Slider 
									id="side"
									label="Side Length"
									bind:value={$side}
									min={1}
									max={100}
									step={1}
									unit="px"
								/>

								{#if isParametrized}
									<Slider 
										id="parameter"
										label="Parameter"
										bind:value={$parameter}
										min={15}
										max={165}
										step={1}
										unit="°"
									/>
								{/if}

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

									<Checkbox 
										id="cr"
										label="Show Cundy & Rollett's Notation"
										position="right"
										bind:checked={$showCR}
									/>
								</div>
							</div>
						</div>
						
						<!-- Scrollable rules section -->
						<div class="flex-1 overflow-y-auto p-3">
							<div class="flex flex-col gap-3">
								<div class="flex items-center justify-between">
									<h3 class="font-medium text-xs text-white/80 uppercase tracking-wider">Tiling Patterns <span class="text-white/80 font-normal">({tilingRules.reduce((acc, curr) => acc + curr.rules.length, 0)})</span></h3>
									
									<div class="flex flex-row gap-2">
										{#if Object.keys(expandedGroups).reduce((acc, curr) => acc + expandedGroups[curr], 0) == tilingRules.length}
											<button
												class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
												onclick={collapseAll}
												aria-label="Collapse all"
												title="Collapse all"
											>
												<ChevronsDownUp size={16} />
											</button>
										{:else}
											<button
												class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
												onclick={expandAll}
												aria-label="Expand all"
												title="Expand all"
											>
												<ChevronsUpDown size={16} />
											</button>
										{/if}

										<button
											class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
											onclick={openTilingModal}
											aria-label="View all tilings"
											title="View all tilings"
										>
											<Maximize2 size={16} />
										</button>
									</div>
								</div>
								<div>
									{#each tilingRules as tilingGroup}
										<div class="mb-3">
											<button 
												class="w-full flex items-center justify-between font-medium text-sm text-zinc-300 mb-2 hover:text-white focus:outline-none transition-colors"
												onclick={() => toggleGroup(tilingGroup.title)}
												aria-expanded={expandedGroups[tilingGroup.title]}
											>
												<span>{tilingGroup.title} <span class="text-green-400/80 font-normal">({tilingGroup.rules.length})</span></span>
												<ChevronDown 
                                                    size={14} 
                                                    class="transition-transform duration-200 {expandedGroups[tilingGroup.title] ? 'rotate-180' : ''}"
                                                />
											</button>
											
											{#if expandedGroups[tilingGroup.title]}
												<div class="grid grid-cols-2 gap-2 pl-1 space-y-1" transition:slide={{ duration: 200 }}>
													{#each tilingGroup.rules as tiling}
														<TilingCard 
															name={tiling.name}
															cr={tiling.cr}
															rulestring={tiling.rulestring}
															onClick={loadTiling}
														/>

														{#if tiling.dualname}
															<TilingCard 
																name={tiling.dualname}
																cr={tiling.cr}
																rulestring={tiling.rulestring.concat('*')}
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
									unit="iterations/s"
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
										<GolRuleCard 
											name={gameRule.name}
											rule={gameRule.rule}
											description={gameRule.description}
											onClick={loadGolRule}
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