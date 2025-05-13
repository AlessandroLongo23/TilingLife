import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';

function protectMath(markdown) {
	const placeholders = [];
	
	// First process the block math ($$...$$) to avoid interference with inline math
	let processed = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (match, content) => {
		const placeholder = `DISPLAY_MATH_PLACEHOLDER_${placeholders.length}`;
		placeholders.push({ type: 'display', content: content.trim() });
		return placeholder;
	});
	
	processed = processed.replace(/\$([^$]+?)\$/g, (match, content) => {
		if (match.includes('DISPLAY_MATH_PLACEHOLDER')) {
			return match; // Skip if it's part of a placeholder
		}
		const placeholder = `MATH_PLACEHOLDER_${placeholders.length}`;
		placeholders.push({ type: 'inline', content: content.trim() });
		return placeholder;
	});
	
	return { processed, placeholders };
}

function restoreMath(html, placeholders) {
	let result = html;
	
	// Restore display math first
	result = result.replace(/DISPLAY_MATH_PLACEHOLDER_(\d+)/g, (_, index) => {
		const { content } = placeholders[parseInt(index)];
		return `<div class="katex-display"><span class="katex-equation">${content}</span></div>`;
	});
	
	// Then restore inline math
	result = result.replace(/MATH_PLACEHOLDER_(\d+)/g, (_, index) => {
		const { content } = placeholders[parseInt(index)];
		return `<span class="katex-inline">${content}</span>`;
	});
	
	return result;
}

function tableClassPlugin(md) {
	const originalTable = md.renderer.rules.table_open || function(tokens, idx, options, env, self) {
		return self.renderToken(tokens, idx, options);
	};
	
	md.renderer.rules.table_open = function(tokens, idx, options, env, self) {
		if (env.classMarker && env.classMarker.next === idx) {
			tokens[idx].attrJoin('class', env.classMarker.className);
			delete env.classMarker;
		}
		return originalTable(tokens, idx, options, env, self);
	};
	
	md.core.ruler.after('block', 'table_class_marker', function(state) {
		const tokens = state.tokens;
		
		for (let i = 0; i < tokens.length - 1; i++) {
			if (tokens[i].type === 'paragraph_open' && 
				tokens[i+1].type === 'inline' && 
				tokens[i+1].content.match(/^\{\.([a-zA-Z0-9-]+)\}$/)) {
				
				const className = tokens[i+1].content.match(/^\{\.([a-zA-Z0-9-]+)\}$/)[1];
				
				state.env.classMarker = {
					next: i + 3,
					className: className
				};
				
				tokens.splice(i, 3);
				i--;
			}
		}
		
		return true;
	});
}

// Add admonition plugin
function admonitionPlugin(md) {
	const icons = {
		note: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-5 w-5"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>',
		tip: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-5 w-5"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="M12 10v12"/></svg>',
		warning: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-5 w-5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
		error: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-5 w-5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
		example: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-5 w-5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
		info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-5 w-5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
	};

	const colors = {
		note: {
			border: 'border-blue-900/80',
			header: 'bg-blue-400/20',
			content: 'bg-blue-300/5'
		},
		tip: {
			border: 'border-emerald-900/80',
			header: 'bg-emerald-400/20',
			content: 'bg-emerald-300/5'
		},
		warning: {
			border: 'border-amber-900/80',
			header: 'bg-amber-400/20',
			content: 'bg-amber-300/5'
		},
		error: {
			border: 'border-red-900/80',
			header: 'bg-red-400/20',
			content: 'bg-red-300/5'
		},
		example: {
			border: 'border-gray-900/80',
			header: 'bg-gray-400/20',
			content: 'bg-gray-300/5'
		},
		info: {
			border: 'border-teal-900/80',
			header: 'bg-teal-400/20',
			content: 'bg-teal-300/5'
		}
	};

	md.core.ruler.after('block', 'admonitions', function(state) {
		const tokens = state.tokens;
		let i = 0;

		while (i < tokens.length) {
			const token = tokens[i];
			if (token.type === 'fence' && token.info.startsWith('ad-')) {
				const adType = token.info.substring(3).trim().toLowerCase();
				let title = '';
				let content = token.content.trim();

				// Check if there's a title (first line)
				if (content.length > 0) {
					const contentLines = content.split(/\r?\n/);
					const firstLine = contentLines[0].trim();

					if (firstLine && !firstLine.startsWith('#') && !firstLine.startsWith('-')) {
						title = firstLine;
						contentLines.shift();
						content = contentLines.join('\n');
					}
				}

				// Render the markdown content
				const contentHtml = md.render(content);

				// Create the admonition HTML
				const admonitionToken = new state.Token('html_block', '', 0);
				admonitionToken.content = `
					<div class="admonition my-6 rounded-md overflow-hidden border ${colors[adType].border} shadow-lg">
						<div class="header flex items-center px-4 py-2 text-white ${colors[adType].header}">
							${icons[adType] || icons.note}
							<span class="title font-medium capitalize">${title || adType}</span>
						</div>
						<div class="content ${colors[adType].content} p-4">
							${contentHtml}
						</div>
					</div>
				`;

				// Replace the fence token with our HTML token
				tokens.splice(i, 1, admonitionToken);
			}
			i++;
		}
		return true;
	});
}

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true
});

md.use(anchor, {
	permalink: false,
	slugify: s => s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
});

md.use(tableClassPlugin);
md.use(admonitionPlugin);

export function renderMarkdown(markdownContent) {
	// remove first two lines
	markdownContent = markdownContent.split('\n').slice(2).join('\n');

	const { processed, placeholders } = protectMath(markdownContent);
	
	const html = md.render(processed);
	
	return restoreMath(html, placeholders);
}

export function extractTableOfContents(markdownContent) {
	if (!markdownContent) {
		console.error('extractTableOfContents: Received empty content');
		return [];
	}
	
	const lines = markdownContent.split(/\r?\n/);
	const toc = [];
	const headerRegex = /^(#{1,6})\s+(.+)$/;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		
		if (!line) continue;
		
		const match = line.match(headerRegex);
		if (match) {
			const level = match[1].length - 1;
			const title = match[2].trim();
			const id = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
			
			toc.push({ id, title, level });
		}
	}
	
	return toc;
}

export function structureTableOfContents(flatToc) {
	const sections = [];
	let currentSection = null;
	let currentH1Section = null;
	
	for (const item of flatToc) {
		if (item.level === 1) {
			// Create a new top-level section for h1
			currentH1Section = {
				id: item.id,
				title: item.title,
				subsections: [],
				level: 1
			};
			sections.push(currentH1Section);
			currentSection = null; // Reset current h2 section
		} else if (item.level === 2) {
			// Create a new section for h2
			currentSection = {
				id: item.id,
				title: item.title,
				subsections: [],
				level: 2,
				parent: currentH1Section ? currentH1Section.id : null
			};
			
			// Add to parent h1 or to main sections array
			if (currentH1Section) {
				currentH1Section.subsections.push(currentSection);
			} else {
				sections.push(currentSection);
			}
		} else if (item.level === 3 && currentSection) {
			// Add h3 to the current h2 section
			currentSection.subsections.push({
				id: item.id,
				title: item.title,
				level: 3
			});
		}
	}
	
	return sections;
} 