/**
 * Vite plugin to load .json.gz files as JSON modules.
 * When a module imports a .json.gz file, decompresses and returns the parsed JSON.
 */
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import type { Plugin } from 'vite';

export function jsonGzPlugin(): Plugin {
	return {
		name: 'vite-plugin-json-gz',
		enforce: 'pre',
		load(id) {
			if (id.endsWith('.json.gz')) {
				try {
					const buffer = readFileSync(id);
					const decompressed = gunzipSync(buffer);
					const json = JSON.parse(decompressed.toString('utf8'));
					return `export default ${JSON.stringify(json)}`;
				} catch (e) {
					return null; // Let other plugins handle
				}
			}
			return null;
		},
	};
}
