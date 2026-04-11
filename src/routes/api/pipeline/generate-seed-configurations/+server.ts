import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import zlib from 'zlib';
import {
	CompatibilityGraph,
	VertexConfiguration,
	SeedSetExtractor,
	SeedBuilder,
} from '$classes';
import { compareVertexConfigurationNames } from '$utils';
import { roundNumbersInJson, getEffectiveUniqueCount } from '$utils';
import { BATCH_SIZE } from '$stores';
import { PIPELINE_BUCKET } from '$lib/services/pipelineStorage';

const MAX_K = 2;

function streamLine(controller: ReadableStreamDefaultController<Uint8Array>, data: object) {
	controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'));
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { paramsFolder?: string; vcNames?: string[]; stream?: boolean };
		const paramsFolder = body?.paramsFolder;
		const selectedVcNames = Array.isArray(body?.vcNames) ? body.vcNames : [];
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

		// Determine which VCs to use: selected if provided, otherwise all from vcs.json
		let vcNames: string[];
		const vcsRes = await supabase.storage.from(PIPELINE_BUCKET).download(`${paramsFolder}/vcs.json`);
		if (!vcsRes.data) {
			return json(
				{ error: 'Missing vcs.json. Run Generate Vertex Configurations first.' },
				{ status: 400 }
			);
		}
		const allVcNames: string[] = JSON.parse(await vcsRes.data.text());

		if (selectedVcNames.length > 0) {
			vcNames = selectedVcNames
				.filter((n) => allVcNames.includes(n))
				.sort((a, b) => compareVertexConfigurationNames(a, b));
			if (vcNames.length === 0) {
				return json({ error: 'No valid selected VCs found in vcs.json.' }, { status: 400 });
			}
		} else {
			vcNames = [...allVcNames].sort((a, b) => compareVertexConfigurationNames(a, b));
		}

		// Compute compatibility graph from selected/all VCs
		const vcInstances = vcNames.map((name) => VertexConfiguration.fromName(name));
		const adjacencyList: Record<string, string[]> = {};
		for (const vc of vcInstances) adjacencyList[vc.name] = [];
		const n = vcInstances.length;
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				if (vcInstances[i].isCompatible(vcInstances[j])) {
					adjacencyList[vcInstances[i].name].push(vcInstances[j].name);
					adjacencyList[vcInstances[j].name].push(vcInstances[i].name);
				}
			}
		}

		// Save compatibilityGraph.json
		const compatPath = `${paramsFolder}/compatibilityGraph.json`;
		const compatBlob = new Blob([JSON.stringify(adjacencyList, null, 4)], { type: 'application/json' });
		await supabase.storage.from(PIPELINE_BUCKET).upload(compatPath, compatBlob, {
			contentType: 'application/json',
			upsert: true
		});

		const compatibilityGraph = CompatibilityGraph.fromAdjacencyList(adjacencyList, vcInstances);
		const extractor = new SeedSetExtractor(compatibilityGraph);

		// Extract seed sets for each k
		const seedSetsByK = new Map<number, Map<number, string[][]>>();
		for (let k = 1; k <= MAX_K; k++) {
			const seedSets = extractor.findSeedSets(k);
			const byM = new Map<number, string[][]>();
			for (const seedSet of seedSets) {
				const m = new Set(seedSet).size;
				if (!byM.has(m)) byM.set(m, []);
				byM.get(m)!.push(seedSet);
			}
			seedSetsByK.set(k, byM);
		}

		// Upload seed sets
		for (const [k, byM] of seedSetsByK) {
			for (const [m, sets] of byM) {
				const path = `${paramsFolder}/seedSets/k=${k}/m=${m}.json`;
				const blob = new Blob([JSON.stringify(sets, null, 4)], { type: 'application/json' });
				await supabase.storage.from(PIPELINE_BUCKET).upload(path, blob, {
					contentType: 'application/json',
					upsert: true
				});
			}
		}

		// Ensure vcLibrary.json
		const vcLibraryPath = `${paramsFolder}/seedConfigurations/vcLibrary.json`;
		const vcLibraryBlob = new Blob([JSON.stringify(vcNames)], { type: 'application/json' });
		await supabase.storage.from(PIPELINE_BUCKET).upload(vcLibraryPath, vcLibraryBlob, {
			contentType: 'application/json',
			upsert: true
		});

		// Build seed configurations for each k
		let totalSeeds = 0;
		for (let k = 1; k <= MAX_K; k++) {
			const byM = seedSetsByK.get(k)!;
			const allSeedSets = [...byM.values()].flat();
			if (allSeedSets.length === 0) continue;

			const seedSetLoader = (_k: number, _m: number) => allSeedSets;
			const seedBuilder = new SeedBuilder();
			const seedConfigurations = seedBuilder.buildSeeds(k, 1, { seedSetLoader });

			const byEffectiveM = new Map<number, typeof seedConfigurations>();
			for (const sc of seedConfigurations) {
				const vcNamesInSeed = sc.vertexConfigurations.map((vc) => vc.name);
				const effectiveM = getEffectiveUniqueCount(vcNamesInSeed);
				if (!byEffectiveM.has(effectiveM)) byEffectiveM.set(effectiveM, []);
				byEffectiveM.get(effectiveM)!.push(sc);
			}

			for (const [effectiveM, seeds] of byEffectiveM) {
				const compactData = seeds.map((sc) => sc.encodeCompact(vcNames, true));
				const total = compactData.length;
				const folderPath = `${paramsFolder}/seedConfigurations/k=${k}/m=${effectiveM}`;

				for (let i = 0; i < total; i += BATCH_SIZE) {
					const batchIndex = Math.floor(i / BATCH_SIZE);
					const batch = compactData.slice(i, i + BATCH_SIZE);
					const rounded = roundNumbersInJson(batch) as typeof batch;
					const jsonStr = JSON.stringify(rounded);
					const compressed = zlib.gzipSync(jsonStr, { level: 9 });
					const filePath = `${folderPath}/seedConfigurations_${String(batchIndex).padStart(4, '0')}.json.gz`;
					const blob = new Blob([compressed], { type: 'application/gzip' });
					await supabase.storage.from(PIPELINE_BUCKET).upload(filePath, blob, {
						contentType: 'application/gzip',
						upsert: true
					});
				}

				const manifest = {
					format: 'compact',
					vcLibrary: true,
					shortKeys: true,
					compressed: true,
					total,
					batchSize: BATCH_SIZE
				};
				const manifestPath = `${folderPath}/manifest.json`;
				await supabase.storage.from(PIPELINE_BUCKET).upload(manifestPath, new Blob([JSON.stringify(manifest)]), {
					contentType: 'application/json',
					upsert: true
				});
				totalSeeds += total;
			}
		}

		if (useStream) {
			const stream = new ReadableStream({
				async start(controller) {
					try {
						streamLine(controller, { progress: 10, message: 'Computing compatibility graph…' });
						streamLine(controller, { progress: 25, message: 'Extracting vertex configurations set for k=1' });
						streamLine(controller, { progress: 40, message: 'Extracting vertex configurations set for k=2' });
						streamLine(controller, { progress: 60, message: 'Building seed configurations…' });
						streamLine(controller, { progress: 90, message: 'Uploading…' });
						streamLine(controller, {
							progress: 100,
							message: `Generated ${totalSeeds} seed configurations`,
							done: true,
							paramsFolder,
							seedConfigCount: totalSeeds,
						});
					} catch (err) {
						console.error('generate-seed-configurations error:', err);
						streamLine(controller, { error: err instanceof Error ? err.message : 'Unknown error' });
					}
					controller.close();
				},
			});
			return new Response(stream, {
				headers: { 'Content-Type': 'application/x-ndjson' },
			});
		}

		return json({ paramsFolder, seedConfigCount: totalSeeds });
	} catch (err) {
		console.error('generate-seed-configurations error:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
