import { renderMarkdown, extractTableOfContents, structureTableOfContents } from '$lib/utils/markdown';

class ContentService {
	content = null;
	sections = [];
	isLoading = false;
	error = null;
	isInitialized = false;
	
	async loadContent(path) {
		if (this.isLoading || (this.content && this.sections.length > 0 && !this.error)) {
			return;
		}
		
		try {
			this.isLoading = true;
			this.error = null;
			
			const response = await fetch(path);
			
			if (!response.ok) {
				throw new Error(`Failed to load content from ${path} (${response.status})`);
			}
			
			const markdownContent = await response.text();
			
			if (!markdownContent || markdownContent.trim() === '') {
				throw new Error('Loaded content is empty');
			}
			
			const flatToc = extractTableOfContents(markdownContent);
			this.sections = structureTableOfContents(flatToc);
			this.content = renderMarkdown(markdownContent);
			this.isLoading = false;
			this.isInitialized = true;
		} catch (error) {
			console.error('Error loading content:', error);
			this.error = error.message;
			this.isLoading = false;
		}
	}
}

export const contentService = new ContentService(); 