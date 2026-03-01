<script lang="ts">
	import MarkdownRenderer from '$components/MarkdownRenderer.svelte';
	import TheorySidebar from '$components/TheorySidebar.svelte';
	import { headerStore } from '$stores';

	let { data } = $props();
	let content = $derived(data?.content ?? '');
	let sections = $derived(data?.sections ?? []);

	let targetSection = $state('');
	let activeTheorySection = $state('');

	$effect(() => {
		headerStore.set({ title: 'Theory', badge: null, subtitle: null });
	});

	function handleSectionSelect(e: CustomEvent<{ sectionId: string }>) {
		targetSection = e.detail.sectionId;
	}

	function handleActiveSectionChange(e: CustomEvent<{ sectionId: string }>) {
		activeTheorySection = e.detail.sectionId;
	}
</script>

<div class="flex-1 min-h-0 flex overflow-hidden">
	<!-- Sidebar with table of contents -->
	<aside
		class="w-80 shrink-0 border-r border-zinc-700/50 bg-zinc-800/30 flex flex-col overflow-hidden"
	>
		<TheorySidebar
			sections={sections}
			activeSection={activeTheorySection}
			on:sectionSelect={handleSectionSelect}
		/>
	</aside>

	<!-- Main content -->
	<div class="flex-1 min-w-0 flex flex-col overflow-hidden">
		{#if content}
			<MarkdownRenderer
				content={content}
				targetSection={targetSection}
				on:sectionActive={handleActiveSectionChange}
			/>
		{:else}
			<div class="flex-1 flex items-center justify-center p-8">
				<p class="text-zinc-400">No content available.</p>
			</div>
		{/if}
	</div>
</div>
