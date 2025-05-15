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

export function playSound(sound, volume = 0.5, options = {}) {
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
		
		// Apply pitch variation if specified
		if (options.pitchVariation) {
			const variation = 1.0 + (Math.random() * 2 - 1) * options.pitchVariation;
			source.playbackRate.value = variation;
		}
		
		const gainNode = audioContext.createGain();
		gainNode.gain.value = volume;
		
		// Create filter if specified
		if (options.filter) {
			const filter = audioContext.createBiquadFilter();
			filter.type = options.filter.type || 'lowpass';
			filter.frequency.value = options.filter.frequency || 1000;
			if (options.filter.q !== undefined) {
				filter.Q.value = options.filter.q;
			}
			if (options.filter.gain !== undefined) {
				filter.gain.value = options.filter.gain;
			}
			
			// Connect through the filter
			source.connect(filter);
			filter.connect(gainNode);
		} else {
			// Direct connection
			source.connect(gainNode);
		}
		
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
	toggleOn: (volume = 0.2) => {
		// Create variations for toggle ON sound
		const options = {
			// Subtle pitch variation (±5%)
			pitchVariation: 0.05,
			
			// High-end emphasis for "on" state
			filter: {
				type: 'highshelf',
				frequency: 2000 + Math.random() * 500,
				gain: 2 + Math.random()
			}
		};
		
		return playSound('/sound/Toggle On.mp3', volume, options);
	},
	toggleOff: (volume = 0.2) => {
		// Create variations for toggle OFF sound
		const options = {
			// Subtle pitch variation (±5%)
			pitchVariation: 0.05,
			
			// Low-end emphasis for "off" state
			filter: {
				type: 'lowshelf',
				frequency: 1000 + Math.random() * 400,
				gain: 1.5 + Math.random()
			}
		};
		
		return playSound('/sound/Toggle Off.mp3', volume, options);
	},
	button: (volume = 0.15) => {
		// Create variations for button sound
		const options = {
			// Moderate pitch variation (±7%)
			pitchVariation: 0.07,
			
			// Subtle peaking filter for clarity
			filter: {
				type: 'peaking',
				frequency: 1200 + Math.random() * 800,
				q: 1 + Math.random() * 2,
				gain: 2 + Math.random()
			}
		};
		
		return playSound('/sound/Button.mp3', volume, options);
	},
	screenshot: (volume = 0.25) => {
		// Create variations for screenshot sound
		const options = {
			// Very subtle pitch variation (±3%)
			pitchVariation: 0.03,
			
			// Slight high boost for "click" emphasis
			filter: {
				type: Math.random() > 0.5 ? 'highshelf' : 'peaking',
				frequency: 3000 + Math.random() * 1000,
				q: Math.random() * 1.5,
				gain: 1 + Math.random() * 2
			}
		};
		
		return playSound('/sound/ScreenshotExport.mp3', volume, options);
	},
	slider: (volume = 0.2) => {
		// Create random variations for slider sound
		const options = {
			// Add subtle pitch variation (±10%)
			pitchVariation: 0.1,
			
			// Add random filter effects
			filter: {
				// Choose a random filter type
				type: ['lowpass', 'highpass', 'bandpass'][Math.floor(Math.random() * 3)],
				
				// Random frequency between 800-2000Hz
				frequency: 800 + Math.random() * 1200,
				
				// Random Q value between 0.5-2.5 (subtle resonance)
				q: 0.5 + Math.random() * 2
			}
		};
		
		return playSound('/sound/Slider.mp3', volume, options);
	},
	stateChange: (volume = 0.3, simulationParams = {}) => {
		// Create variations based on simulation parameters
		const options = {
			pitchVariation: 0.15
		};
		
		// If we have additional simulation data, use it to influence the sound
		if (simulationParams.bornRatio !== undefined) {
			// More births = slightly higher pitch (more energetic sound)
			const birthInfluence = simulationParams.bornRatio * 0.1;
			options.pitchVariation = 0.15 + birthInfluence;
		}
		
		// If the simulation is very active, increase variation range
		if (simulationParams.activityLevel !== undefined) {
			options.pitchVariation = Math.min(0.3, 0.1 + simulationParams.activityLevel * 0.2);
		}
		
		// Add filter variations based on the simulation state
		// This creates tonal variations in the sound
		if (simulationParams.iteration !== undefined) {
			// Slightly vary the filter type based on iteration count for long-term variation
			const filterTypes = ['lowpass', 'highpass', 'bandpass'];
			const filterType = filterTypes[simulationParams.iteration % filterTypes.length];
			
			// Calculate a filter frequency that varies organically
			// More born cells = higher frequencies (brighter sound)
			// More activity = more resonance
			const baseFreq = 800 + Math.random() * 800;
			const freqModulation = simulationParams.bornRatio ? 1 + simulationParams.bornRatio * 4 : 1;
			
			options.filter = {
				type: filterType,
				frequency: baseFreq * freqModulation,
				q: 1 + (simulationParams.activityLevel || 0) * 5
			};
		}
		
		return playSound('/sound/State change.mp3', volume, options);
	}
}; 