import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import zlib from 'zlib';
import { SeedExpander, SeedConfiguration } from '$classes';
import { roundNumbersInJson } from '$utils';
import { polygonToShort } from '$lib/algorithm/pipelineStorageFormat';
import { compactSeedName } from '$lib/utils/compactSeedName';
import { BATCH_SIZE } from '$stores';
import { PIPELINE_BUCKET } from '$lib/services/pipelineStorage';

function streamLine(controller: ReadableStreamDefaultController<Uint8Array>, data: object) {
	controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'));
}

async function loadSeedConfigBatches(
	supabase: ReturnType<typeof createClient>,
	paramsFolder: string,
	k: number,
	m: number
): Promise<{ configs: unknown[]; vcLibrary: string[] }> {
	const manifestPath = `${paramsFolder}/seedConfigurations/k=${k}/m=${m}/manifest.json`;
	const vcLibraryPath = `${paramsFolder}/seedConfigurations/vcLibrary.json`;

	const { data: manifestBlob } = await supabase.storage.from(PIPELINE_BUCKET).download(manifestPath);
	const { data: vcLibraryBlob } = await supabase.storage.from(PIPELINE_BUCKET).download(vcLibraryPath);

	if (!manifestBlob) {
		return { configs: [], vcLibrary: [] };
	}

	const manifest = JSON.parse(await manifestBlob.text());
	const total = manifest.total ?? 0;
	const vcLibrary: string[] = vcLibraryBlob ? JSON.parse(await vcLibraryBlob.text()) : [];

	const configs: unknown[] = [];
	const totalBatches = Math.ceil(total / BATCH_SIZE);

	for (let i = 0; i < total; i += BATCH_SIZE) {
		const batchIndex = Math.floor(i / BATCH_SIZE);
		const baseName = `seedConfigurations_${String(batchIndex).padStart(4, '0')}`;
		const gzPath = `${paramsFolder}/seedConfigurations/k=${k}/m=${m}/${baseName}.json.gz`;

		const { data: batchBlob } = await supabase.storage.from(PIPELINE_BUCKET).download(gzPath);
		if (!batchBlob) continue;

		const buf = Buffer.from(await batchBlob.arrayBuffer());
		const jsonStr = zlib.gunzipSync(buf).toString('utf8');
		const batch = JSON.parse(jsonStr);
		configs.push(...batch);
	}

	return { configs, vcLibrary };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { paramsFolder?: string; k?: number; m?: number; stream?: boolean };
		const paramsFolder = body?.paramsFolder;
		const k = typeof body?.k === 'number' ? body.k : 1;
		const m = typeof body?.m === 'number' ? body.m : 1;
		const useStream = body?.stream === true;

		if (!paramsFolder || typeof paramsFolder !== 'string') {
			return json({ error: 'paramsFolder is required' }, { status: 400 });
		}

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

		const { configs, vcLibrary } = await loadSeedConfigBatches(supabase, paramsFolder, k, m);
		if (configs.length === 0) {
			return json(
				{ error: `No seed configurations found for k=${k}/m=${m}. Run Generate Seed Configurations first.` },
				{ status: 400 }
			);
		}

		const expander = new SeedExpander(k);
		const folderPath = `${paramsFolder}/expandedSeeds/k=${k}/m=${m}`;

		const allItems: { n: string; p: Record<string, unknown>[] }[] = [];

		if (useStream) {
			const stream = new ReadableStream({
				async start(controller) {
					try {
						for (let i = 0; i < configs.length; i++) {
							const progress = ((i + 1) / configs.length) * 85;
							const seed = SeedConfiguration.decodeCompact(configs[i] as Parameters<typeof SeedConfiguration.decodeCompact>[0], vcLibrary);
							const compactName = compactSeedName(seed.name);
							streamLine(controller, {
								progress,
								message: `Expanding seed ${compactName}`,
							});

							expander.expand(seed, (patch) => {
								const encodedPolygons = patch.map((p) => polygonToShort(p.encode() as Record<string, unknown>));
								allItems.push({
									n: seed.name,
									p: roundNumbersInJson(encodedPolygons) as Record<string, unknown>[],
								});
							}) as number;
						}

						streamLine(controller, { progress: 90, message: 'Uploading…' });

						for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
							const batchIndex = Math.floor(i / BATCH_SIZE);
							const batchData = allItems.slice(i, i + BATCH_SIZE);
							const jsonStr = JSON.stringify(batchData);
							const compressed = zlib.gzipSync(jsonStr, { level: 9 });
							const filePath = `${folderPath}/expandedSeeds_${String(batchIndex).padStart(4, '0')}.json.gz`;
							await supabase.storage.from(PIPELINE_BUCKET).upload(filePath, new Blob([compressed]), {
								contentType: 'application/gzip',
								upsert: true
							});
						}

						const totalItems = allItems.length;
						if (totalItems > 0) {
							const manifest = {
								format: 'full',
								shortKeys: true,
								compressed: true,
								total: totalItems,
								batchSize: BATCH_SIZE,
							};
							await supabase.storage.from(PIPELINE_BUCKET).upload(`${folderPath}/manifest.json`, new Blob([JSON.stringify(manifest)]), {
								contentType: 'application/json',
								upsert: true
							});
						}

						streamLine(controller, {
							progress: 100,
							message: `Expanded ${totalItems} seeds`,
							done: true,
							paramsFolder,
							k,
							m,
							expandedCount: totalItems,
						});
					} catch (err) {
						console.error('expand-seeds error:', err);
						streamLine(controller, { error: err instanceof Error ? err.message : 'Unknown error' });
					}
					controller.close();
				},
			});

			return new Response(stream, {
				headers: { 'Content-Type': 'application/x-ndjson' },
			});
		}

		// Non-streaming path
		for (let i = 0; i < configs.length; i++) {
			const seed = SeedConfiguration.decodeCompact(configs[i] as Parameters<typeof SeedConfiguration.decodeCompact>[0], vcLibrary);
			expander.expand(seed, (patch) => {
				const encodedPolygons = patch.map((p) => polygonToShort(p.encode() as Record<string, unknown>));
				allItems.push({
					n: seed.name,
					p: roundNumbersInJson(encodedPolygons) as Record<string, unknown>[],
				});
			}) as number;
		}

		for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
			const batchIndex = Math.floor(i / BATCH_SIZE);
			const batchData = allItems.slice(i, i + BATCH_SIZE);
			const jsonStr = JSON.stringify(batchData);
			const compressed = zlib.gzipSync(jsonStr, { level: 9 });
			const filePath = `${folderPath}/expandedSeeds_${String(batchIndex).padStart(4, '0')}.json.gz`;
			await supabase.storage.from(PIPELINE_BUCKET).upload(filePath, new Blob([compressed]), {
				contentType: 'application/gzip',
				upsert: true
			});
		}

		const totalItems = allItems.length;
		if (totalItems > 0) {
			const manifest = {
				format: 'full',
				shortKeys: true,
				compressed: true,
				total: totalItems,
				batchSize: BATCH_SIZE,
			};
			await supabase.storage.from(PIPELINE_BUCKET).upload(`${folderPath}/manifest.json`, new Blob([JSON.stringify(manifest)]), {
				contentType: 'application/json',
				upsert: true
			});
		}

		return json({ paramsFolder, k, m, expandedCount: totalItems });
	} catch (err) {
		console.error('expand-seeds error:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
