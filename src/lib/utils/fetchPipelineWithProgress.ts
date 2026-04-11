/**
 * Fetches pipeline API endpoints with progress streaming.
 * Opens the progress dialog, streams progress updates, and handles completion/errors.
 */

import {
	openPipelineProgress,
	updatePipelineProgress,
	completePipelineProgress,
	failPipelineProgress,
} from '$stores';

const encoder = new TextEncoder();

/** Write a progress line to the stream (NDJSON format). */
export function writeProgress(
	controller: ReadableStreamDefaultController<Uint8Array>,
	data: { progress?: number; message: string; done?: boolean; [key: string]: unknown }
) {
	controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
}

export type PipelineFetchOptions = {
	url: string;
	method?: 'POST';
	body?: Record<string, unknown>;
	title: string;
	initialMessage?: string;
};

/**
 * Fetches a pipeline API that supports streaming (returns application/x-ndjson).
 * Updates the progress store as lines are received.
 * Returns the final result or throws on error.
 */
export async function fetchPipelineWithProgress<T = Record<string, unknown>>(
	options: PipelineFetchOptions
): Promise<T> {
	const { url, method = 'POST', body = {}, title, initialMessage = 'Starting…' } = options;

	openPipelineProgress(title, initialMessage);

	try {
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...body, stream: true }),
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({}));
			throw new Error(errData.error ?? `Request failed: ${res.status}`);
		}

		const contentType = res.headers.get('content-type') ?? '';
		if (!contentType.includes('ndjson') && !contentType.includes('x-ndjson')) {
			// Non-streaming response - just parse JSON
			const data = (await res.json()) as T;
			completePipelineProgress('Done');
			return data;
		}

		const reader = res.body?.getReader();
		if (!reader) {
			completePipelineProgress('Done');
			return {} as T;
		}

		const decoder = new TextDecoder();
		let buffer = '';
		let finalResult: T | null = null;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				try {
					const data = JSON.parse(trimmed) as {
						progress?: number;
						message?: string;
						done?: boolean;
						error?: string;
						[key: string]: unknown;
					};

					if (data.error) {
						failPipelineProgress(data.error);
						throw new Error(data.error);
					}

					if (data.message) {
						updatePipelineProgress(data.progress ?? null, data.message);
					}

					if (data.done) {
						finalResult = data as unknown as T;
						completePipelineProgress(data.message ?? 'Done');
					}
				} catch (e) {
					if (e instanceof SyntaxError) continue;
					throw e;
				}
			}
		}

		if (buffer.trim()) {
			try {
				const data = JSON.parse(buffer.trim()) as { done?: boolean };
				if (data.done) finalResult = data as unknown as T;
			} catch {
				// Ignore parse errors for trailing partial line
			}
		}

		return (finalResult ?? {}) as T;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		failPipelineProgress(message);
		throw err;
	}
}
