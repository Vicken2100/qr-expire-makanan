import { ExpiryStatus } from '../types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays distinct audio feedback depending on expiration status:
 * - Green (Fresh/Safe): High crisp double chime (880Hz -> 1320Hz)
 * - Yellow (Halfway/Warning): Caution double pulse (587Hz -> 587Hz)
 * - Red (Expired/Today EXP): Urgent low buzz/alarm (220Hz -> 160Hz)
 */
export function playStatusAudio(status: ExpiryStatus): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (status === 'green') {
      // Pleasant bright ding
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15); // E6

      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } else if (status === 'yellow') {
      // Attention warning double beep
      const createBeep = (timeOffset: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now + timeOffset); // D5

        gain.gain.setValueAtTime(0.25, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + timeOffset + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.12);
      };
      createBeep(0);
      createBeep(0.16);
    } else {
      // Urgent red alert buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.4);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch {
    // Audio autoplay might be blocked before first interaction
  }
}

/**
 * Plays tactile click/tone when stock is decremented (-1)
 */
export function playStockDecrementSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch {
    // Ignore audio error
  }
}

/**
 * Haptic vibration feedback for mobile devices
 */
export function triggerHaptic(status: ExpiryStatus): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (status === 'green') {
        navigator.vibrate([80]);
      } else if (status === 'yellow') {
        navigator.vibrate([100, 50, 100]);
      } else {
        navigator.vibrate([250, 100, 250]);
      }
    } catch {
      // Ignore vibration error
    }
  }
}
