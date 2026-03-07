import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { jsonGzPlugin } from './src/lib/vite/jsonGzPlugin.ts';

export default defineConfig({
	plugins: [jsonGzPlugin(), sveltekit()],
	build: {
		chunkSizeWarningLimit: 2000, // 2MB - Chart.js, KaTeX, Supabase etc. can exceed default 500KB
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Allow real-time console.log during long-running tests (like the tiling pipeline)
		disableConsoleIntercept: true
	}
});
