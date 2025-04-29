<script>
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	
	let { content = '', targetSection = '' } = $props();
	
	let containerElement;
	let activeSection = $state('');
	
	const dispatch = createEventDispatcher();
	
	$effect(() => {
		if (targetSection && containerElement) {
			scrollToSection(targetSection);
		}
	});
	
	function scrollToSection(sectionId) {
		if (!containerElement) return;
		
		const section = containerElement.querySelector(`#${sectionId}`);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth', block: 'start' });
			
			activeSection = sectionId;
			dispatch('sectionActive', { sectionId });
		}
	}
	
	function handleScroll(e) {
		if (!containerElement) return;
		
		const scrollPosition = containerElement.scrollTop;
		const headings = containerElement.querySelectorAll('h2, h3');
		
		for (let i = headings.length - 1; i >= 0; i--) {
			const heading = headings[i];
			if (scrollPosition >= heading.offsetTop - 100) {
				const newActiveSection = heading.id;
				if (activeSection !== newActiveSection) {
					activeSection = newActiveSection;
					dispatch('sectionActive', { sectionId: activeSection });
				}
				break;
			}
		}
	}
	
	onMount(() => {
		if (containerElement) {
			setTimeout(() => {
				handleScroll({ target: containerElement });
			}, 100);
		}
	});
</script>

<div 
	class="markdown-content w-full h-full overflow-y-auto p-6 md:p-8 bg-zinc-900" 
	bind:this={containerElement}
	onscroll={handleScroll}
>
	<div class="max-w-4xl mx-auto">
		{#if content}
			<div class="content" id="content-container">
				{@html content}
			</div>
		{:else}
			<div class="p-4 text-center text-zinc-400">
				<p>Loading content...</p>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(.markdown-content h1) {
		@apply text-3xl font-bold text-white mb-8;
	}
	
	:global(.markdown-content h2) {
		@apply text-2xl font-semibold text-white mb-4 mt-12 scroll-mt-20;
	}
	
	:global(.markdown-content h3) {
		@apply text-xl font-medium text-white mb-3 mt-8 ml-4 border-l-2 border-zinc-700/50 pl-4 scroll-mt-16;
	}
	
	:global(.markdown-content p) {
		@apply text-zinc-300 mb-6;
	}
	
	:global(.markdown-content ul) {
		@apply list-disc ml-6 mb-6 text-zinc-300;
	}
	
	:global(.markdown-content ol) {
		@apply list-decimal ml-6 mb-6 text-zinc-300;
	}
	
	:global(.markdown-content li) {
		@apply mb-2;
	}
	
	:global(.markdown-content img) {
		@apply mt-4 rounded-lg overflow-hidden border border-zinc-700/50 bg-zinc-800/30 max-w-full h-auto;
	}
	
	:global(.markdown-content blockquote) {
		@apply border-l-4 border-green-500/30 pl-4 italic text-zinc-400 my-4;
	}
	
	:global(.markdown-content code) {
		@apply font-mono text-sm bg-zinc-800 px-1.5 py-0.5 rounded text-green-400;
	}
	
	:global(.markdown-content pre) {
		@apply bg-zinc-800/50 p-4 rounded-md overflow-x-auto mb-6 border border-zinc-700/30;
	}
	
	:global(.markdown-content pre code) {
		@apply bg-transparent p-0 text-zinc-300;
	}
	
	:global(.markdown-content a) {
		@apply text-green-400 hover:text-green-300 underline;
	}
	
	:global(.markdown-content hr) {
		@apply my-8 border-zinc-700/50;
	}
	
	:global(.markdown-content table) {
		@apply w-full border-collapse mb-6;
	}
	
	:global(.markdown-content th) {
		@apply bg-zinc-800 text-left p-2 text-zinc-200 border border-zinc-700/50;
	}
	
	:global(.markdown-content td) {
		@apply p-2 border border-zinc-700/50 text-zinc-300;
	}
</style> 