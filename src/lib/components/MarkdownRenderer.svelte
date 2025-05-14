<script>
	import { createEventDispatcher } from 'svelte';
	import katex from 'katex';
	import 'katex/dist/katex.min.css';
	
	let { content = '', targetSection = '' } = $props();
	
	let containerElement;
	let activeSection = $state('');
	let expandedGif = $state(null);
	
	const dispatch = createEventDispatcher();
	
	// Function to handle lazy loading of GIFs
	function setupLazyLoading() {
		if (!containerElement) return;

		const lazyGifs = containerElement.querySelectorAll('.lazy-gif');
		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const img = entry.target;
					img.src = img.dataset.src;
					img.classList.remove('lazy-gif');
					observer.unobserve(img);
				}
			});
		}, {
			rootMargin: '50px 0px',
			threshold: 0.1
		});

		lazyGifs.forEach(gif => observer.observe(gif));
	}
	
	// Function to set CSS variable for column count on tables
	function setTableColumnCounts() {
		if (!containerElement) return;
		
		const tables = containerElement.querySelectorAll('.markdown-content table');
		tables.forEach(table => {
			const headerRow = table.querySelector('tr');
			if (headerRow) {
				const columnCount = headerRow.children.length;
				table.style.setProperty('--col-count', columnCount.toString());
			}
		});
	}
	
	// Handle GIF click events
	function handleGifClick(event) {
		const gifElement = event.target;
		if (gifElement.classList.contains('markdown-gif')) {
			if (expandedGif === gifElement.src) {
				expandedGif = null;
				gifElement.style.width = '';
				gifElement.style.maxWidth = '';
			} else {
				if (expandedGif) {
					// Reset previous expanded GIF
					const prevGif = containerElement.querySelector(`img[src="${expandedGif}"]`);
					if (prevGif) {
						prevGif.style.width = '';
						prevGif.style.maxWidth = '';
					}
				}
				expandedGif = gifElement.src;
				gifElement.style.width = '100%';
				gifElement.style.maxWidth = '100%';
			}
		}
	}
	
	// Process LaTeX with KaTeX and setup GIFs
	$effect(() => {
		if (content && containerElement) {
			// Allow content to be rendered first, then process LaTeX and setup GIFs
			setTimeout(() => {
				const container = containerElement.querySelector('#content-container');
				if (!container) return;
				
				// Add click handler for GIFs
				container.addEventListener('click', handleGifClick);
				
				// Setup lazy loading for GIFs
				setupLazyLoading();
				
				// Process inline math elements
				const inlineMathElements = container.querySelectorAll('.katex-inline');
				inlineMathElements.forEach(el => {
					try {
						const latex = el.textContent;
						el.innerHTML = katex.renderToString(latex, { displayMode: false });
					} catch (e) {
						console.error('KaTeX inline error:', e, el.textContent);
					}
				});
				
				// Process display math elements
				const displayMathElements = container.querySelectorAll('.katex-display .katex-equation');
				displayMathElements.forEach(el => {
					try {
						const latex = el.textContent;
						const rendered = katex.renderToString(latex, { displayMode: true });
						el.parentElement.innerHTML = rendered;
					} catch (e) {
						console.error('KaTeX display error:', e, el.textContent);
					}
				});
				
				setTableColumnCounts();
			}, 100);
		}
	});
	
	// Cleanup effect
	$effect(() => {
		return () => {
			if (containerElement) {
				const container = containerElement.querySelector('#content-container');
				if (container) {
					container.removeEventListener('click', handleGifClick);
				}
			}
		};
	});
	
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
		const headings = containerElement.querySelectorAll('h2, h3, h4');
		
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
	:global(.markdown-content h2) {
		@apply text-4xl font-bold text-white mb-10 mt-24 pb-4 border-b border-green-400/80;
		scroll-margin-top: 1rem;
	}
	
	:global(.markdown-content h3) {
		@apply text-2xl font-semibold text-white mb-4 mt-16 scroll-mt-20;
	}
	
	:global(.markdown-content h4) {
		@apply text-xl font-medium text-white mb-3 mt-8 scroll-mt-16;
	}
	
	:global(.markdown-content p) {
		@apply text-zinc-400 mb-6;
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
		@apply w-full border-collapse mb-6 bg-zinc-800/20;
		table-layout: fixed; /* Uses fixed table layout for better control */
	}
	
	:global(.markdown-content th) {
		@apply bg-zinc-800 text-left p-2 text-zinc-200 border border-zinc-700/50;
	}
	
	:global(.markdown-content td) {
		@apply p-2 border border-zinc-700/50 text-zinc-300 text-center align-middle;
		width: calc(100% / var(--col-count, 10)); /* Distributes columns evenly */
	}
	
	:global(.markdown-content tr:nth-child(odd)) {
		@apply bg-zinc-800/30;
	}
	
	:global(.markdown-content tr:nth-child(even)) {
		@apply bg-zinc-800/10;
	}

	:global(.markdown-content img) {
		@apply object-contain mx-auto block;
		width: 33%;
		height: auto;
		max-width: 33%;
	}
	
	/* GIF-specific styling */
	:global(.markdown-content .markdown-gif) {
		@apply object-contain mx-auto block cursor-pointer;
		width: 50%;  /* GIFs are typically shown larger */
		height: auto;
		max-width: 50%;
		transition: all 0.2s ease-in-out;
	}

	:global(.markdown-content .markdown-gif.lazy-gif) {
		filter: blur(10px);
		transform: scale(0.95);
	}

	:global(.markdown-content .markdown-gif:not(.lazy-gif)) {
		filter: blur(0);
		transform: scale(1);
	}

	:global(.markdown-content .markdown-gif:hover) {
		transform: scale(1.02);  /* Subtle zoom on hover */
	}

	/* Ensure GIFs in tables maintain proper sizing */
	:global(.markdown-content table .markdown-gif) {
		width: 100%;
		max-width: 100%;
	}
	
	/* Table images styling for flexible sizing and distribution */
	:global(.markdown-content table img) {
		@apply object-contain mx-auto block;
		width: 100%;
		height: auto;
		max-width: 100%;
	}
	
	/* Specific styling for tables with custom classes */
	:global(.markdown-content table.cols-3 td) {
		width: 33.333%;
	}
	
	:global(.markdown-content table.cols-3 img) {
		max-width: 120px; /* Larger max-width for tables with fewer columns */
		margin: 0 auto;
	}
	
	:global(.markdown-content table.cols-4 td) {
		width: 25%;
	}
	
	:global(.markdown-content table.cols-4 img) {
		max-width: 100px;
		margin: 0 auto;
	}
	
	:global(.markdown-content table.cols-10 td) {
		width: 10%;
	}
	
	:global(.markdown-content table.cols-10 img) {
		max-width: 60px;
		margin: 0 auto;
	}
	
	/* KaTeX styling */
	:global(.markdown-content .katex) {
		@apply text-zinc-200;
		font-size: 1.1em;
	}
	
	:global(.markdown-content .katex-display) {
		@apply overflow-x-auto overflow-y-hidden my-6 px-2;
	}
	
	:global(.markdown-content .katex-display > .katex) {
		@apply text-zinc-100;
		font-size: 1.21em;
	}
	
	/* Admonition styling */
	:global(.markdown-content .admonition) {
		@apply shadow-lg;
	}
	
	:global(.markdown-content .admonition .content) {
		@apply text-zinc-300;
	}
	
	:global(.markdown-content .admonition .content p) {
		@apply mb-4 last:mb-0;
	}
	
	:global(.markdown-content .admonition .content ul) {
		@apply list-none ml-0 mb-4 last:mb-0;
	}
	
	:global(.markdown-content .admonition .content ul li) {
		@apply flex items-start mb-2 last:mb-0;
	}
	
	:global(.markdown-content .admonition .content ul li::before) {
		content: '';
		@apply inline-block w-2 h-2 mr-3 mt-2 bg-zinc-600 rounded-full;
	}
	
	:global(.markdown-content .admonition .content ol) {
		counter-reset: admonition-ol;
		@apply list-none pl-0 mb-4 last:mb-0;
	}
	
	:global(.markdown-content .admonition .content ol li) {
		counter-increment: admonition-ol;
		@apply flex items-start mb-2 last:mb-0;
	}
	
	:global(.markdown-content .admonition .content ol li::before) {
		content: counter(admonition-ol);
		@apply inline-flex items-center justify-center min-w-6 h-6 mr-2 bg-zinc-700 text-white rounded-full text-sm font-semibold;
	}
	
	:global(.markdown-content .admonition .content code) {
		@apply bg-zinc-800/50;
	}
	
	:global(.markdown-content .admonition .content pre) {
		@apply bg-zinc-800/30;
	}
	
	:global(.markdown-content .admonition .content .katex) {
		@apply text-zinc-200;
	}
</style> 