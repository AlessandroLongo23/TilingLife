<script>
	import '../app.css';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	let { children } = $props();
</script>

<AudioPlayer />
{@render children()}