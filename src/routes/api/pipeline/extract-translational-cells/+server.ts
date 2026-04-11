import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import zlib from 'zlib';
import { TranslationalCellExtractor } from '$classes';
import { roundNumbersInJson } from '$utils';
import { polygonToShort, polygonFromShort } from '$lib/algorithm/pipelineStorageFormat';
import { compactSeedName } from '$lib/utils/compactSeedName';
import { BATCH_SIZE } from '$stores';
import { PIPELINE_BUCKET } from '$lib/services/pipelineStorage';

function streamLine(controller: ReadableStreamDefaultController<Uint8Array>, data: object) {
	controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'));
}

async function loadExpandedSeedsBatches(
	supabase: ReturnType<typeof createClient>,
	paramsFolder: string,
	k: number,
	m: number
): Promise<{ n: string; p: Record<string, unknown>[] }[]> {
	const manifestPath = `${paramsFolder}/expandedSeeds/k=${k}/m=${m}/manifest.json`;

	const { data: manifestBlob } = await supabase.storage.from(PIPELINE_BUCKET).download(manifestPath);
	if (!manifestBlob) return [];

	const manifest = JSON.parse(await manifestBlob.text());
	const total = manifest.total ?? 0;
	const totalBatches = Math.ceil(total / BATCH_SIZE);
	const items: { n: string; p: Record<string, unknown>[] }[] = [];

	for (let i = 0; i < total; i += BATCH_SIZE) {
		const batchIndex = Math.floor(i / BATCH_SIZE);
		const baseName = `expandedSeeds_${String(batchIndex).padStart(4, '0')}`;
		const gzPath = `${paramsFolder}/expandedSeeds/k=${k}/m=${m}/${baseName}.json.gz`;

		const { data: batchBlob } = await supabase.storage.from(PIPELINE_BUCKET).download(gzPath);
		if (!batchBlob) continue;

		const buf = Buffer.from(await batchBlob.arrayBuffer());
		const jsonStr = zlib.gunzipSync(buf).toString('utf8');
		const batch = JSON.parse(jsonStr);
		items.push(...batch);
	}

	return items;
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

		const items = await loadExpandedSeedsBatches(supabase, paramsFolder, k, m);
		if (items.length === 0) {
			return json(
				{ error: `No expanded seeds found for k=${k}/m=${m}. Run Expand Seeds first.` },
				{ status: 400 }
			);
		}

		const extractor = new TranslationalCellExtractor();
		const folderPath = `${paramsFolder}/translationalCells/k=${k}/m=${m}`;

		const cells: {
			n: string;
			p: Record<string, unknown>[];
			b: [[number, number], [number, number]];
			o: [number, number];
		}[] = [];
		let skipped = 0;

		if (useStream) {
			const stream = new ReadableStream({
				async start(controller) {
					try {
						for (let i = 0; i < items.length; i++) {
							const item = items[i];
							const seedName = item.n ?? '?';
							const progress = ((i + 1) / items.length) * 90;
							const compactName = compactSeedName(seedName.startsWith('[') ? seedName : `[${seedName}]`);
							streamLine(controller, {
								progress,
								message: `Extracting translational cell from seed ${compactName}`,
							});

							const polygons = (item.p ?? []).map((p: Record<string, unknown>) => polygonFromShort(p));
							if (polygons.length === 0) {
								skipped++;
								continue;
							}

							const result = extractor.extract(polygons);
							if (!result) {
								skipped++;
								continue;
							}

							const encodedCell = result.cellPolygons.map((p) => polygonToShort(p.encode() as Record<string, unknown>));
							const [v1, v2] = result.basis;
							cells.push({
								n: item.n ?? '',
								p: roundNumbersInJson(encodedCell) as Record<string, unknown>[],
								b: [[v1.x, v1.y], [v2.x, v2.y]],
								o: [result.origin.x, result.origin.y],
							});
						}

						streamLine(controller, { progress: 92, message: 'Uploading…' });

						for (let i = 0; i < cells.length; i += BATCH_SIZE) {
							const batchIndex = Math.floor(i / BATCH_SIZE);
							const batchData = cells.slice(i, i + BATCH_SIZE);
							const jsonStr = JSON.stringify(batchData);
							const compressed = zlib.gzipSync(jsonStr, { level: 9 });
							const filePath = `${folderPath}/translationalCells_${String(batchIndex).padStart(4, '0')}.json.gz`;
							await supabase.storage.from(PIPELINE_BUCKET).upload(filePath, new Blob([compressed]), {
								contentType: 'application/gzip',
								upsert: true
							});
						}

						if (cells.length > 0) {
							const manifest = {
								format: 'full',
								shortKeys: true,
								compressed: true,
								total: cells.length,
								batchSize: BATCH_SIZE,
							};
							await supabase.storage.from(PIPELINE_BUCKET).upload(`${folderPath}/manifest.json`, new Blob([JSON.stringify(manifest)]), {
								contentType: 'application/json',
								upsert: true
							});
						}

						streamLine(controller, {
							progress: 100,
							message: `Extracted ${cells.length} translational cells`,
							done: true,
							paramsFolder,
							k,
							m,
							extractedCount: cells.length,
							skipped,
						});
					} catch (err) {
						console.error('extract-translational-cells error:', err);
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
		for (const item of items) {
			const polygons = (item.p ?? []).map((p: Record<string, unknown>) => polygonFromShort(p));
			if (polygons.length === 0) {
				skipped++;
				continue;
			}

			const result = extractor.extract(polygons);
			if (!result) {
				skipped++;
				continue;
			}

			const encodedCell = result.cellPolygons.map((p) => polygonToShort(p.encode() as Record<string, unknown>));
			const [v1, v2] = result.basis;
			cells.push({
				n: item.n ?? '',
				p: roundNumbersInJson(encodedCell) as Record<string, unknown>[],
				b: [
					[v1.x, v1.y],
					[v2.x, v2.y],
				],
				o: [result.origin.x, result.origin.y],
			});
		}

		for (let i = 0; i < cells.length; i += BATCH_SIZE) {
			const batchIndex = Math.floor(i / BATCH_SIZE);
			const batchData = cells.slice(i, i + BATCH_SIZE);
			const jsonStr = JSON.stringify(batchData);
			const compressed = zlib.gzipSync(jsonStr, { level: 9 });
			const filePath = `${folderPath}/translationalCells_${String(batchIndex).padStart(4, '0')}.json.gz`;
			await supabase.storage.from(PIPELINE_BUCKET).upload(filePath, new Blob([compressed]), {
				contentType: 'application/gzip',
				upsert: true
			});
		}

		if (cells.length > 0) {
			const manifest = {
				format: 'full',
				shortKeys: true,
				compressed: true,
				total: cells.length,
				batchSize: BATCH_SIZE,
			};
			await supabase.storage.from(PIPELINE_BUCKET).upload(`${folderPath}/manifest.json`, new Blob([JSON.stringify(manifest)]), {
				contentType: 'application/json',
				upsert: true
			});
		}

		return json({ paramsFolder, k, m, extractedCount: cells.length, skipped });
	} catch (err) {
		console.error('extract-translational-cells error:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
