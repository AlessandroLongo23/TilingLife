import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { generateVCs } from '$lib/algorithm/pipeline-core';
import { compareVertexConfigurationNames } from '$utils';
import { PIPELINE_BUCKET } from '$lib/services/pipelineStorage';

function streamLine(controller: ReadableStreamDefaultController<Uint8Array>, data: object) {
	controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'));
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { paramsFolder?: string; polygonNames?: string[]; stream?: boolean };
		const paramsFolder = body?.paramsFolder;
		const polygonNames = Array.isArray(body?.polygonNames) ? body.polygonNames : [];
		const useStream = body?.stream === true;

		if (!paramsFolder || typeof paramsFolder !== 'string') {
			return json({ error: 'paramsFolder is required' }, { status: 400 });
		}

		if (polygonNames.length === 0) {
			return json({ error: 'At least one polygon must be selected' }, { status: 400 });
		}

		if (useStream) {
			const stream = new ReadableStream({
				async start(controller) {
					try {
						streamLine(controller, { progress: 20, message: 'Extracting vertex configurations from polygons…' });
						const newVcNames = generateVCs(polygonNames);

						const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
						if (!serviceRoleKey) {
							streamLine(controller, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' });
							controller.close();
							return;
						}

						streamLine(controller, { progress: 60, message: 'Merging with existing VCs…' });

						const supabase = createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
							auth: { persistSession: false }
						});

						let finalVcNames = newVcNames;
						const vcsPath = `${paramsFolder}/vcs.json`;
						const { data: existingVcs } = await supabase.storage.from(PIPELINE_BUCKET).download(vcsPath);
						if (existingVcs) {
							try {
								const text = await existingVcs.text();
								const existingNames: string[] = JSON.parse(text || '[]');
								const combined = new Set([...existingNames, ...newVcNames]);
								finalVcNames = [...combined].sort((a, b) => compareVertexConfigurationNames(a, b));
							} catch {
								// Use new only if parse fails
							}
						}

						streamLine(controller, { progress: 85, message: 'Uploading…' });

						const vcsBlob = new Blob([JSON.stringify(finalVcNames, null, 4)], { type: 'application/json' });
						const { error: vcsError } = await supabase.storage.from(PIPELINE_BUCKET).upload(vcsPath, vcsBlob, {
							contentType: 'application/json',
							upsert: true
						});
						if (vcsError) {
							streamLine(controller, { error: `Upload failed: ${vcsError.message}` });
							controller.close();
							return;
						}

						streamLine(controller, {
							progress: 100,
							message: `Generated ${finalVcNames.length} vertex configurations`,
							done: true,
							paramsFolder,
							vcCount: finalVcNames.length,
							newCount: newVcNames.length,
						});
					} catch (err) {
						console.error('generate-vcs error:', err);
						streamLine(controller, { error: err instanceof Error ? err.message : 'Unknown error' });
					}
					controller.close();
				},
			});
			return new Response(stream, {
				headers: { 'Content-Type': 'application/x-ndjson' },
			});
		}

		const newVcNames = generateVCs(polygonNames);

		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			return json(
				{ error: 'SUPABASE_SERVICE_ROLE_KEY not configured. Add it to .env for pipeline uploads.' },
				{ status: 503 }
			);
		}

		const supabase = createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
			auth: { persistSession: false }
		});

		// Merge with existing VCs (compatibility graph is computed when Generate Seed Configurations is clicked)
		let finalVcNames = newVcNames;
		const vcsPath = `${paramsFolder}/vcs.json`;
		const { data: existingVcs } = await supabase.storage.from(PIPELINE_BUCKET).download(vcsPath);
		if (existingVcs) {
			try {
				const text = await existingVcs.text();
				const existingNames: string[] = JSON.parse(text || '[]');
				const combined = new Set([...existingNames, ...newVcNames]);
				finalVcNames = [...combined].sort((a, b) => compareVertexConfigurationNames(a, b));
			} catch {
				// Use new only if parse fails
			}
		}

		const vcsBlob = new Blob([JSON.stringify(finalVcNames, null, 4)], { type: 'application/json' });
		const { error: vcsError } = await supabase.storage.from(PIPELINE_BUCKET).upload(vcsPath, vcsBlob, {
			contentType: 'application/json',
			upsert: true
		});
		if (vcsError) {
			console.error('VC upload error:', vcsError);
			return json({ error: `Upload failed: ${vcsError.message}` }, { status: 500 });
		}

		return json({ paramsFolder, vcCount: finalVcNames.length, newCount: newVcNames.length });
	} catch (err) {
		console.error('generate-vcs error:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
