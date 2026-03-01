import { readFileSync } from 'fs';
import { join } from 'path';
import {
	renderMarkdown,
	extractTableOfContents,
	structureTableOfContents
} from '$lib/utils/markdown.svelte';

export function load() {
	const path = join(process.cwd(), 'static', 'theory', 'algorithm.md');
	let content = '';
	let sections: ReturnType<typeof structureTableOfContents> = [];
	try {
		const raw = readFileSync(path, 'utf-8');
		content = renderMarkdown(raw);
		sections = structureTableOfContents(extractTableOfContents(raw));
	} catch {
		content = renderMarkdown('# Algorithm\n\n*Description coming soon.*');
	}
	return { content, sections };
}
