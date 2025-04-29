<script>
	import { createEventDispatcher } from 'svelte';
	import { contentService } from '$lib/services/contentService';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
	
	let { targetSection = '' } = $props();
	
	let content = $derived(contentService.content);
	let isLoading = $derived(contentService.isLoading);
	let error = $derived(contentService.error);
	
	const dispatch = createEventDispatcher();
	
	function handleSectionActive(e) {
		dispatch('activeSection', { sectionId: e.detail.sectionId });
	}
</script>

<div class="w-full h-full overflow-hidden bg-zinc-900">
	{#if isLoading}
		<div class="w-full h-full flex items-center justify-center">
			<div class="text-zinc-400 p-4 text-center">
				<p>Loading theory content...</p>
			</div>
		</div>
	{:else if error}
		<div class="w-full h-full flex items-center justify-center">
			<div class="text-red-400 p-4 text-center">
				<h2 class="text-xl mb-2">Error Loading Content</h2>
				<p>{error}</p>
			</div>
		</div>
	{:else if content}
		<MarkdownRenderer 
			content={content} 
			targetSection={targetSection}
			on:sectionActive={handleSectionActive}
		/>
	{:else}
		<div class="w-full h-full flex items-center justify-center">
			<div class="text-zinc-400 p-4 text-center">
				<p>No content available</p>
			</div>
		</div>
	{/if}
</div> 