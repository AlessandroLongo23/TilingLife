import adapter from '@sveltejs/adapter-auto';
import { mdsvex } from 'mdsvex';
import mdsvexConfig from './mdsvex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			$lib: 'src/lib',
			$components: 'src/lib/components',
			$classes: 'src/lib/classes',
			$stores: 'src/lib/stores',
			$utils: 'src/lib/utils',
			$services: 'src/lib/services',
		}
	},
	extensions: ['.svelte', '.md', '.svx'],
	preprocess: [
		mdsvex(mdsvexConfig)
	]
};

export default config;
