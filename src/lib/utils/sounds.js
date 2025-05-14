import { browser } from '$app/environment';

// Cache audio elements for better performance
const soundCache = new Map();

/**
 * Play a sound effect
 * @param {string} sound - The sound file to play
 * @param {number} volume - Volume level between 0 and 1
 * @returns {Promise<void>}
 */
export function playSound(sound, volume = 0.5) {
  if (!browser) return Promise.resolve();
  
  // Check if sound is already in cache
  let audio = soundCache.get(sound);
  
  if (!audio) {
    // Create new audio element if not in cache
    audio = new Audio(sound);
    soundCache.set(sound, audio);
  }
  
  // Reset audio to beginning if already playing
  audio.currentTime = 0;
  audio.volume = volume;
  
  return audio.play().catch(err => {
    console.log('Error playing sound:', err);
  });
}

// Predefined sound functions
export const sounds = {
  toggleOn: () => playSound('/sound/Toggle On.mp3', 0.8),
  toggleOff: () => playSound('/sound/Toggle Off.mp3', 0.8),
  button: () => playSound('/sound/Button.mp3', 0.8),
  screenshot: () => playSound('/sound/ScreenshotExport.mp3', 0.8)
}; 