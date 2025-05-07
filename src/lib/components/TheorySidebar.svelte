<script>
	import { createEventDispatcher } from 'svelte';
	import { contentService } from '$lib/services/contentService';
	import { ChevronDown } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	
	let sections = $derived(contentService.sections || []);
	let isLoading = $derived(contentService.isLoading);
	let error = $derived(contentService.error);
	let { activeSection = '' } = $props();
	
	let expandedSections = $state({});
	
	$effect(() => {
		if (sections.length > 0 && Object.keys(expandedSections).length === 0) {
			const initialState = {};
			sections.forEach(section => {
				initialState[section.id] = true;
				
				if (section.subsections) {
					section.subsections.forEach(subsection => {
						if (subsection.id) {
							initialState[subsection.id] = true;
						}
					});
				}
			});
			expandedSections = initialState;
		}
	});
	
	const dispatch = createEventDispatcher();
	
	function scrollToSection(sectionId) {
		dispatch('sectionSelect', { sectionId });
	}
	
	function toggleSection(sectionId, event) {
		event.stopPropagation();
		expandedSections[sectionId] = !expandedSections[sectionId];
	}
	
	function hasSubsections(section) {
		return section.subsections && section.subsections.length > 0;
	}
	
	function isH1(section) {
		return section.level === 1;
	}
</script>

<div class="h-full flex flex-col">
	<div class="flex-1 overflow-y-auto p-3 bg-zinc-800/30">
		<h3 class="font-medium text-xs text-white/80 uppercase tracking-wider mb-4">Table of Contents</h3>
		
		{#if isLoading}
			<div class="p-3 text-sm text-zinc-400">
				<p>Loading content...</p>
			</div>
		{:else if error}
			<div class="p-3 text-sm text-red-400">
				<p>Error loading content: {error}</p>
			</div>
		{:else if sections.length === 0}
			<div class="p-3 text-sm text-zinc-400">
				<p>No sections available</p>
			</div>
		{:else}
			<div class="theory-toc">
				{#each sections as section}
					<div class="mb-4">
						<!-- H1 Section -->
						<div class="flex items-center">
							<button 
								class="text-left flex-1 py-1.5 px-2 rounded text-sm
									{isH1(section) ? 'font-bold' : 'font-medium'} 
									{activeSection === section.id ? 'text-green-400' : 'text-zinc-400 hover:text-white'}"
								onclick={() => scrollToSection(section.id)}
							>
								{section.title}
							</button>
							
							{#if hasSubsections(section)}
								<button 
									class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
									onclick={(e) => toggleSection(section.id, e)}
									aria-label={expandedSections[section.id] ? "Collapse section" : "Expand section"}
									title={expandedSections[section.id] ? "Collapse section" : "Expand section"}
								>
									<ChevronDown 
										size={14} 
										class="transition-transform duration-200 {expandedSections[section.id] ? 'rotate-180' : ''}"
									/>
								</button>
							{/if}
						</div>
						
						<!-- H2 Sections inside H1 -->
						{#if hasSubsections(section) && expandedSections[section.id]}
							<div class="ml-3 border-l border-zinc-700/50 pl-2 mt-1" transition:slide={{ duration: 150 }}>
								{#each section.subsections as subsection}
									<div class="my-2">
										<div class="flex items-center">
											<button 
												class="text-left flex-1 py-1 px-2 rounded text-xs font-medium 
													{activeSection === subsection.id ? 'text-green-400' : 'text-zinc-400 hover:text-white'}"
												onclick={() => scrollToSection(subsection.id)}
											>
												{subsection.title}
											</button>
											
											{#if hasSubsections(subsection)}
												<button 
													class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
													onclick={(e) => toggleSection(subsection.id, e)}
													aria-label={expandedSections[subsection.id] ? "Collapse section" : "Expand section"}
													title={expandedSections[subsection.id] ? "Collapse section" : "Expand section"}
												>
													<ChevronDown 
														size={12} 
														class="transition-transform duration-200 {expandedSections[subsection.id] ? 'rotate-180' : ''}"
													/>
												</button>
											{/if}
										</div>
										
										<!-- H3 Sections inside H2 -->
										{#if hasSubsections(subsection) && expandedSections[subsection.id]}
											<div class="ml-3 border-l border-zinc-700/50 pl-2 mt-1" transition:slide={{ duration: 150 }}>
												{#each subsection.subsections as subsubsection}
													<button 
														class="text-left w-full py-1 px-2 rounded text-xs 
															{activeSection === subsubsection.id ? 'text-green-400' : 'text-zinc-400 hover:text-white'}"
														onclick={() => scrollToSection(subsubsection.id)}
													>
														{subsubsection.title}
													</button>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	button {
		transition: all 0.15s ease;
	}
</style> 