<script lang="ts">
	import Modal from '$components/ui/Modal.svelte';
	import Checkbox from '$components/ui/Checkbox.svelte';
	import { PolygonType } from '$classes';

	let {
		isOpen = $bindable(false),
		onSuccess,
		onError
	}: {
		isOpen?: boolean;
		onSuccess?: (paramsFolder: string, polygonCount: number) => void;
		onError?: (message: string) => void;
	} = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);

	const types = [
		{ id: PolygonType.REGULAR, label: 'Regular', hasAngle: false },
		{ id: PolygonType.STAR_REGULAR, label: 'Star Regular', hasAngle: true },
		{ id: PolygonType.STAR_PARAMETRIC, label: 'Star Parametric', hasAngle: false },
		{ id: PolygonType.EQUILATERAL, label: 'Equilateral', hasAngle: true }
	] as const;

	let config = $state<Record<string, { enabled: boolean; n_max: number; angle: number }>>({
		[PolygonType.REGULAR]: { enabled: true, n_max: 12, angle: 30 },
		[PolygonType.STAR_REGULAR]: { enabled: true, n_max: 12, angle: 30 },
		[PolygonType.STAR_PARAMETRIC]: { enabled: false, n_max: 12, angle: 30 },
		[PolygonType.EQUILATERAL]: { enabled: false, n_max: 5, angle: 30 }
	});

	async function handleSubmit() {
		error = null;
		const body: Record<string, unknown> = {};
		for (const t of types) {
			if (config[t.id].enabled) {
				const c = config[t.id];
				body[t.id] = { enabled: true, n_max: c.n_max, angle: t.hasAngle ? c.angle : undefined };
			}
		}
		if (Object.keys(body).length === 0) {
			error = 'Enable at least one polygon type';
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/pipeline/generate-polygons', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error ?? 'Request failed');
			}
			isOpen = false;
			onSuccess?.(data.paramsFolder, data.polygonCount);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			error = msg;
			onError?.(msg);
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:isOpen title="Generate Polygons" maxWidth="max-w-lg">
	{#snippet children()}
		<div class="p-4 flex flex-col gap-5">
			<p class="text-sm text-zinc-400">
				Choose polygon types and parameters. Results will be saved to Supabase and added to the polygon collection.
			</p>

			<div class="flex flex-col gap-4">
				{#each types as t}
					{@const cfg = config[t.id]}
					<div class="flex flex-wrap items-center gap-4 p-3 rounded-lg border border-zinc-700/40 bg-zinc-800/30">
						<Checkbox
							id="gen-{t.id}"
							label={t.label}
							bind:checked={config[t.id].enabled}
						/>
						{#if cfg.enabled}
							<label class="flex items-center gap-2 text-sm text-zinc-400">
								<span>Max sides</span>
								<input
									type="number"
									min="3"
									max="24"
									class="w-16 px-2 py-1 rounded border border-zinc-600/60 bg-zinc-800 text-zinc-200 text-sm"
									bind:value={config[t.id].n_max}
								/>
							</label>
							{#if t.hasAngle}
								<label class="flex items-center gap-2 text-sm text-zinc-400">
									<span>Angle increment (°)</span>
									<input
										type="number"
										min="1"
										max="180"
										class="w-16 px-2 py-1 rounded border border-zinc-600/60 bg-zinc-800 text-zinc-200 text-sm"
										bind:value={config[t.id].angle}
									/>
								</label>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			<div class="flex justify-end gap-2 pt-2">
				<button
					class="km-btn"
					onclick={() => (isOpen = false)}
					disabled={loading}
				>
					Cancel
				</button>
				<button
					class="px-4 py-2 rounded-md font-medium text-sm bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30 transition-colors disabled:opacity-50"
					onclick={handleSubmit}
					disabled={loading}
				>
					{loading ? 'Generating…' : 'Generate'}
				</button>
			</div>
		</div>
	{/snippet}
</Modal>
