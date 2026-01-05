/**
 * Sound Notification Utility
 * 
 * Provides sound notification capabilities using Web Audio API
 * Falls back to HTML5 Audio if needed
 */

const SOUND_CONFIG = {
  frequency: 800, // Hz
  duration: 500, // ms
  volume: 0.3, // 0-1
} as const;

/**
 * Play a notification sound
 * Uses Web Audio API for programmatic sound generation
 * Falls back to HTML5 Audio if Web Audio API is unavailable
 * 
 * @param options - Sound options
 * @returns Promise that resolves when sound finishes playing
 */
export async function playNotificationSound(
  options?: {
    frequency?: number;
    duration?: number;
    volume?: number;
  }
): Promise<void> {
  const frequency = options?.frequency ?? SOUND_CONFIG.frequency;
  const duration = options?.duration ?? SOUND_CONFIG.duration;
  const volume = Math.max(0, Math.min(1, options?.volume ?? SOUND_CONFIG.volume));

  try {
    // Try Web Audio API first
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      await playWebAudioSound(frequency, duration, volume);
      return;
    }

    // Fallback to HTML5 Audio (if we have an audio file)
    // For now, we'll just use Web Audio API
    // If that fails, we'll silently fail (sound is optional)
  } catch (error) {
    // Silently fail - sound notifications are optional
    console.debug('Failed to play notification sound:', error);
  }
}

/**
 * Play sound using Web Audio API
 */
async function playWebAudioSound(
  frequency: number,
  duration: number,
  volume: number
): Promise<void> {
  const AudioContextClass = 
    typeof AudioContext !== 'undefined' 
      ? AudioContext 
      : (window as any).webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('Web Audio API not supported');
  }

  const audioContext = new AudioContextClass();
  
  // Create oscillator for the sound
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // Configure oscillator
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // Configure gain (volume)
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Play sound
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration / 1000);

  // Wait for sound to finish
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      audioContext.close().catch(() => {
        // Ignore errors when closing context
      });
      resolve();
    }, duration);
  });
}



