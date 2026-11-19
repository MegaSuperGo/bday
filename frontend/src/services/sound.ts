/**
 * Minimal synthesised UI sounds (no audio files). Strictly opt-in:
 * the AudioContext is only created after the guest enables sound.
 */
type Cue = 'tick' | 'open' | 'close' | 'send' | 'receive' | 'confirm' | 'alert';

let ctx: AudioContext | null = null;
let enabled = false;
const listeners = new Set<(v: boolean) => void>();

export const sound = {
  get enabled() {
    return enabled;
  },
  async setEnabled(v: boolean) {
    enabled = v;
    if (v) {
      ctx ??= new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
    } else if (ctx) {
      await ctx.suspend();
    }
    try {
      localStorage.setItem('nexus.sound', v ? '1' : '0');
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(v));
    if (v) this.play('confirm');
  },
  subscribe(fn: (v: boolean) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  play(cue: Cue) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime;
    const notes: Record<Cue, [number, number, number][]> = {
      // [frequency, start offset, duration]
      tick: [[1800, 0, 0.03]],
      open: [[520, 0, 0.12], [780, 0.07, 0.16]],
      close: [[780, 0, 0.1], [440, 0.06, 0.14]],
      send: [[1200, 0, 0.05]],
      receive: [[660, 0, 0.08], [990, 0.06, 0.1]],
      confirm: [[880, 0, 0.08], [1320, 0.09, 0.14]],
      alert: [[220, 0, 0.18], [196, 0.2, 0.22]],
    };
    for (const [f, off, dur] of notes[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cue === 'alert' ? 'sawtooth' : 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t + off);
      gain.gain.linearRampToValueAtTime(cue === 'tick' ? 0.03 : 0.06, t + off + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + off + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + off);
      osc.stop(t + off + dur + 0.02);
    }
  },
};
