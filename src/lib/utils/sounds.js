import { browser } from '$app/environment';

let audioContext;
if (browser) {
	try {
		audioContext = new (window.AudioContext || window.webkitAudioContext)();
	} catch (e) {
		console.error("Web Audio API not supported", e);
	}
}

const soundBuffers = {};
let loadingPromises = {};

const MAX_INSTANCES = 10;
let activeSounds = {
	slider: 0
};

async function loadSound(url) {
	if (!audioContext) return null;
	
	if (loadingPromises[url]) {
		return loadingPromises[url];
	}
	
	if (soundBuffers[url]) {
		return soundBuffers[url];
	}
	
	loadingPromises[url] = fetch(url)
		.then(response => response.arrayBuffer())
		.then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
		.then(audioBuffer => {
			soundBuffers[url] = audioBuffer;
			delete loadingPromises[url];
			return audioBuffer;
		})
		.catch(error => {
			console.error("Error loading sound", url, error);
			delete loadingPromises[url];
			return null;
		});
	
	return loadingPromises[url];
}

export function playSound(sound, volume = 0.5) {
	if (!browser || !audioContext) {
		return Promise.resolve();
	}
	
	const soundType = sound.split('/').pop().split('.')[0].replace(/\s+/g, '').toLowerCase();
	
	if (soundType === 'slider') {
		if (activeSounds.slider >= MAX_INSTANCES) {
			return Promise.resolve();
		}
		activeSounds.slider++;
	}
	
	return loadSound(sound).then(buffer => {
		if (!buffer) return;
		
		const source = audioContext.createBufferSource();
		source.buffer = buffer;
		
		const gainNode = audioContext.createGain();
		gainNode.gain.value = volume;
		
		source.connect(gainNode);
		gainNode.connect(audioContext.destination);
		
		source.start(0);
		
		source.onended = () => {
			if (soundType === 'slider') {
				activeSounds.slider = Math.max(0, activeSounds.slider - 1);
			}
		};
		
		return new Promise(resolve => {
			source.onended = () => {
				if (soundType === 'slider') {
					activeSounds.slider = Math.max(0, activeSounds.slider - 1);
				}
				resolve();
			};
		});
	}).catch(err => {
		console.error("Error playing sound:", err);
		if (soundType === 'slider') {
			activeSounds.slider = Math.max(0, activeSounds.slider - 1);
		}
	});
}

export const sounds = {
	toggleOn: (volume = 0.4) => playSound('/sound/Toggle On.mp3', volume),
	toggleOff: (volume = 0.4) => playSound('/sound/Toggle Off.mp3', volume),
	button: (volume = 0.4) => playSound('/sound/Button.mp3', volume),
	screenshot: (volume = 0.4) => playSound('/sound/ScreenshotExport.mp3', volume),
	slider: (volume = 0.2) => playSound('/sound/Slider.mp3', volume)
}; 