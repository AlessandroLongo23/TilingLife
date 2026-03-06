<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { RefreshCw } from 'lucide-svelte';

	let loading = $state(false);

	async function handleReload() {
		loading = true;
		try {
			await invalidateAll();
		} finally {
			loading = false;
		}
	}
</script>

<button
	type="button"
	onclick={handleReload}
	disabled={loading}
	class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all
		bg-zinc-800/60 text-zinc-400 border-zinc-700/50
		hover:bg-zinc-700/60 hover:text-zinc-200 hover:border-zinc-600/60
		disabled:opacity-50 disabled:cursor-not-allowed"
	title="Reload data from JSON files"
	aria-label="Reload data"
>
	<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
	<span>{loading ? 'Reloading…' : 'Reload'}</span>
</button>
