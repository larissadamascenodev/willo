/**
 * Turns whatever the browser recorded into 16 kHz mono WAV.
 *
 * Every browser hands back a different container — Chrome gives WebM/Opus, Safari and
 * the iOS web view give MP4/AAC — and the reader accepts WAV, MP3, AAC, OGG and FLAC
 * but not WebM. Sending the recording as it came would work on a phone and come back
 * empty on a laptop, with nothing to show why.
 *
 * So the recording is decoded and re-encoded here. Decoding is the browser's own job
 * and it can read what it just wrote; 16 kHz mono is what speech needs and nothing
 * more, which also keeps the upload small enough to post as base64.
 */

const TARGET_RATE = 16_000;

function audioContext(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** One channel of samples at `rate`, as 16-bit PCM in a WAV container. */
function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);          // PCM header length
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);    // bytes per second
  view.setUint16(32, 2, true);           // bytes per frame
  view.setUint16(34, 16, true);          // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Averages the channels down to one, at whatever rate the buffer already has. */
function downmix(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const out = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) out[i] += data[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= buffer.numberOfChannels;
  return out;
}

export async function toWav(recording: Blob): Promise<Blob> {
  const Ctor = audioContext();
  if (!Ctor) throw new Error("Áudio não suportado neste navegador");

  const ctx = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await recording.arrayBuffer());
  } finally {
    // Decoding is all this one was for; leaving it open costs a hardware context.
    void ctx.close();
  }

  // Resampling is the offline context's job. Older Safari refuses low rates, in which
  // case the recording still goes as WAV at its own rate — larger, but readable.
  const Offline = typeof OfflineAudioContext !== "undefined"
    ? OfflineAudioContext
    : (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  if (Offline && decoded.sampleRate > TARGET_RATE) {
    try {
      const frames = Math.ceil((decoded.duration * TARGET_RATE) || 1);
      const offline = new Offline(1, frames, TARGET_RATE);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      return encodeWav(rendered.getChannelData(0).slice(), TARGET_RATE);
    } catch {
      // fall through to the original rate
    }
  }

  return encodeWav(downmix(decoded), decoded.sampleRate);
}
