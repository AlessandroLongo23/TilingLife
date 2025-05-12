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

export function renderMarkdown(markdownContent) {
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
			const level = match[1].length;
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