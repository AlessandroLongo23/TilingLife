<script>
	import { Volume2, VolumeX } from 'lucide-svelte';

	let audio;
	let isPlaying = $state(false);

	function togglePlay() {
		if (isPlaying) {
			audio.pause();
			isPlaying = false;
		} else {
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				playPromise
					.then(() => {
						isPlaying = true;
					})
					.catch(error => {
						console.log("Playback failed:", error);
						isPlaying = false;
					});
			}
		}
	}

	$effect(() => {
		if (audio) {
			audio.loop = true;
			audio.volume = 0.5; // Set to 50% volume by default
		}
	});
</script>

<div class="fixed bottom-5 right-5 z-[1000]">
	<button 
		onclick={togglePlay}
		class="flex items-center justify-center w-10 h-10 bg-zinc-800/70 hover:bg-zinc-700/80 text-white/80 hover:text-white rounded-full transition-all duration-200 border border-zinc-700/40 hover:border-zinc-600/60 focus:outline-none focus:ring-1 focus:ring-green-500/40 shadow-md backdrop-blur-sm"
		aria-label={isPlaying ? "Pause audio" : "Play audio"}
	>
		<svelte:component this={isPlaying ? Volume2 : VolumeX } class="w-5 h-5" />
	</button>
</div>

<audio 
	bind:this={audio} 
	src="/audio.mp3"
	preload="auto"
>
	<track kind="captions" />
</audio> 