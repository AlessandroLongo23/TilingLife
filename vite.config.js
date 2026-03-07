import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		chunkSizeWarningLimit: 2000, // 2MB - Chart.js, KaTeX, Supabase etc. can exceed default 500KB
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Allow real-time console.log during long-running tests (like the tiling pipeline)
		disableConsoleIntercept: true
	}
});
