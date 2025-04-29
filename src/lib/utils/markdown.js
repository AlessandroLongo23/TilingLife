import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true
});

md.use(anchor, {
	permalink: false,
	slugify: s => s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
});

export function renderMarkdown(markdownContent) {
	return md.render(markdownContent);
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
	
	for (const item of flatToc) {
		if (item.level === 2) {
			currentSection = {
				id: item.id,
				title: item.title,
				subsections: []
			};
			sections.push(currentSection);
		} else if (item.level === 3 && currentSection) {
			currentSection.subsections.push({
				id: item.id,
				title: item.title
			});
		}
	}
	
	return sections;
} 