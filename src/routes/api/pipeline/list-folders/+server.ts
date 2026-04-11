import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { PIPELINE_BUCKET } from '$lib/services/pipelineStorage';

export const GET: RequestHandler = async () => {
	try {
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			return json({ folders: [] });
		}

		const supabase = createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
			auth: { persistSession: false }
		});

		const { data, error } = await supabase.storage.from(PIPELINE_BUCKET).list('', { limit: 500 });
		if (error) return json({ folders: [] });

		const folders = (data ?? [])
			.filter((f) => f.name && !f.name.startsWith('.'))
			.map((f) => f.name as string);

		return json({ folders });
	} catch {
		return json({ folders: [] });
	}
};
