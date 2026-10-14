/**
 * The small sound an entry makes when it lands.
 *
 * Synthesised rather than loaded. A chime is two sine waves and an envelope — shipping
 * it as a file would mean a request, a decode and a cache miss on the one occasion it
 * has to be instant, and it would arrive after the animation it belongs to.
 *
 * The context is created on first use because browsers refuse one before the person
 * has touched the page, and kept afterwards because creating one per sound leaks them.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!ctx) ctx = new Ctor();
    // iOS suspends the context whenever the app goes to the background.
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One note: a sine with a soft attack and a long tail, so nothing clicks. */
function note(at: number, freq: number, gain: number, length: number) {
  const audio = ctx!;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  vol.gain.setValueAtTime(0.0001, at);
  vol.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(vol).connect(audio.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** Something was filed. A rising fifth — small, bright, over before it is noticed. */
export function chimeSaved() {
  const audio = context();
  if (!audio || document.hidden) return;
  const t = audio.currentTime;
  note(t, 880, 0.075, 0.16);
  note(t + 0.085, 1318.5, 0.06, 0.34);
}

/** Something needs an answer. One soft note, lower, asking rather than announcing. */
export function chimeAsk() {
  const audio = context();
  if (!audio || document.hidden) return;
  note(audio.currentTime, 587.33, 0.045, 0.22);
}
