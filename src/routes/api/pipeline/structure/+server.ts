import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { PIPELINE_BUCKET } from '$lib/services/pipelineStorage';

type KmEntry = { k: number; m: number; total: number };

export const GET: RequestHandler = async ({ url }) => {
	try {
		const folder = url.searchParams.get('folder');
		if (!folder) {
			return json({ error: 'folder query param required' }, { status: 400 });
		}

		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			return json({ seedConfigurations: [], expandedSeeds: [], translationalCells: [] });
		}

		const supabase = createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
			auth: { persistSession: false }
		});

		const result = {
			seedConfigurations: [] as KmEntry[],
			expandedSeeds: [] as KmEntry[],
			translationalCells: [] as KmEntry[]
		};

		async function discoverKm(
			prefix: string,
			out: KmEntry[]
		): Promise<void> {
			const { data: kDirs } = await supabase.storage.from(PIPELINE_BUCKET).list(`${folder}/${prefix}`);
			if (!kDirs?.length) return;

			for (const kDir of kDirs) {
				if (!kDir.name?.startsWith('k=')) continue;
				const k = parseInt(kDir.name.replace('k=', ''), 10);
				if (isNaN(k)) continue;

				const { data: mDirs } = await supabase.storage
					.from(PIPELINE_BUCKET)
					.list(`${folder}/${prefix}/${kDir.name}`);
				if (!mDirs?.length) continue;

				for (const mDir of mDirs) {
					if (!mDir.name?.startsWith('m=')) continue;
					const m = parseInt(mDir.name.replace('m=', ''), 10);
					if (isNaN(m)) continue;

					const manifestPath = `${folder}/${prefix}/${kDir.name}/${mDir.name}/manifest.json`;
					const { data: manifestBlob } = await supabase.storage
						.from(PIPELINE_BUCKET)
						.download(manifestPath);
					if (!manifestBlob) continue;

					try {
						const text = await manifestBlob.text();
						const manifest = JSON.parse(text);
						const total = manifest.total ?? 0;
						out.push({ k, m, total });
					} catch {
						// Skip invalid manifests
					}
				}
			}
		}

		await Promise.all([
			discoverKm('seedConfigurations', result.seedConfigurations),
			discoverKm('expandedSeeds', result.expandedSeeds),
			discoverKm('translationalCells', result.translationalCells)
		]);

		return json(result);
	} catch (err) {
		console.error('pipeline structure error:', err);
		return json({ seedConfigurations: [], expandedSeeds: [], translationalCells: [] });
	}
};
