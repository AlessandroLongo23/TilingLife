import algorithmMd from '$lib/content/theory/algorithm.md?raw';
import {
	renderMarkdown,
	extractTableOfContents,
	structureTableOfContents
} from '$lib/utils/markdown';

export function load() {
	const content = renderMarkdown(algorithmMd);
	const sections = structureTableOfContents(extractTableOfContents(algorithmMd));
	return { content, sections };
}
