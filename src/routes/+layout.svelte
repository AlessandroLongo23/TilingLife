<script>
	import '../app.css';
	import '../lib/prototypes.js';

	import AudioPlayer from '$components/AudioPlayer.svelte';

	let { children } = $props();
</script>

<AudioPlayer />
{@render children()}