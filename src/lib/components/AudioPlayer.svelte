<script>
	import { Volume2, VolumeX, Volume1, Volume } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	let audio;
	let isPlaying = $state(false);
	let volume = $state(0.5);
	let previousVolume = $state(0.5);
	let isMuted = $state(false);
	let showVolumeSlider = $state(false);
	let sliderStyle = $state('');

	function toggleMute() {
		if (isMuted) {
			// Unmute - restore previous volume
			volume = previousVolume > 0 ? previousVolume : 0.5;
			isMuted = false;
		} else {
			// Mute - store current volume first
			previousVolume = volume;
			volume = 0;
			isMuted = true;
		}
		
		if (audio) {
			audio.volume = volume;
		}
		updateSliderStyle();
	}

	function updateVolume(e) {
		volume = e.target.value / 100;
		
		// Handle mute state based on volume
		if (volume === 0) {
			isMuted = true;
		} else if (isMuted) {
			isMuted = false;
		}
		
		if (audio) {
			audio.volume = volume;
		}
		updateSliderStyle();
	}

	function updateSliderStyle() {
		const percentage = volume * 100;
		sliderStyle = `background: linear-gradient(to right, #4ade80 0%, #4ade80 ${percentage}%, #4b5563 ${percentage}%, #4b5563 100%);`;
	}

	function getVolumeIcon() {
		if (isMuted || volume === 0) {
			return VolumeX;
		} else if (volume < 0.33) {
			return Volume;
		} else if (volume < 0.66) {
			return Volume1;
		} else {
			return Volume2;
		}
	}

	$effect(() => {
		if (audio) {
			audio.loop = true;
			audio.volume = volume;
			updateSliderStyle();
			
			// Auto-play when component mounts
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				playPromise
					.then(() => {
						isPlaying = true;
					})
					.catch(error => {
						console.log("Autoplay prevented:", error);
						isPlaying = false;
					});
			}
		}
	});
</script>

<div 
	class="fixed top-5 right-5 z-[1000] flex items-center gap-2"
	onmouseenter={() => showVolumeSlider = true}
	onmouseleave={() => showVolumeSlider = false}
>
	{#if showVolumeSlider}
		<div 
			class="h-10 bg-zinc-800/70 border border-zinc-700/40 rounded-full px-3 flex items-center transition-all duration-200 backdrop-blur-sm"
			transition:fly={{ x: 20, duration: 150 }}
		>
			<input
				type="range"
				min="0"
				max="100"
				value={volume * 100}
				oninput={updateVolume}
				style={sliderStyle}
				class="w-24 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green-500 [&::-moz-range-thumb]:border-0"
			/>
		</div>
	{/if}
	
	<button 
		onclick={toggleMute}
		class="flex items-center justify-center w-10 h-10 bg-zinc-800/70 hover:bg-zinc-700/80 text-white/80 hover:text-white rounded-full transition-all duration-200 border border-zinc-700/40 hover:border-zinc-600/60 focus:outline-none focus:ring-1 focus:ring-green-500/40 shadow-md backdrop-blur-sm"
		aria-label={isMuted ? "Unmute audio" : "Mute audio"}
	>
		<svelte:component this={getVolumeIcon()} class="w-5 h-5" />
	</button>
</div>

<audio 
	bind:this={audio} 
	src="/sound/soundtrack.mp3"
	preload="auto"
>
	<track kind="captions" />
</audio> 