/**
 * Fetch pipeline data from Supabase storage (public URLs).
 * Handles gzip decompression for .json.gz files.
 */

import zlib from 'zlib';

/** Fetch JSON from URL. Decompresses if response is gzip. */
export async function fetchPipelineJson(url: string): Promise<unknown> {
	const res = await fetch(url);
	if (!res.ok) return null;
	const buf = Buffer.from(await res.arrayBuffer());
	const contentType = res.headers.get('content-type') ?? '';
	const isGzip = contentType.includes('gzip') || url.endsWith('.gz');
	const jsonStr = isGzip ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
	try {
		return JSON.parse(jsonStr);
	} catch {
		return null;
	}
}

/** Fetch JSON array from URL. Returns empty array on failure. */
export async function fetchPipelineJsonArray<T = unknown>(url: string): Promise<T[]> {
	const data = await fetchPipelineJson(url);
	return Array.isArray(data) ? (data as T[]) : [];
}