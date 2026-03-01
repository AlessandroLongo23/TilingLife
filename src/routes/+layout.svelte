<script>
	import '../app.css';
	import '../lib/prototypes.js';

	import AudioPlayer from '$components/AudioPlayer.svelte';
	import { tilingStore } from '$stores';

	if (typeof window !== 'undefined') {
		tilingStore.initialize();
	}

	let { children } = $props();
</script>

<AudioPlayer />
{@render children()}