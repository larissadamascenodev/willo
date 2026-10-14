import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records a short spoken note and hands it back as base64 for the reader.
 *
 * The container is whatever the browser will actually produce: Safari and the iOS web
 * view only give mp4, Chrome and Android give webm/opus. Asking for the wrong one does
 * not throw — it silently records nothing — so the type is chosen from what the browser
 * admits to supporting, and sent along with the audio so the reader knows what it got.
 */

const CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

export interface RecordedAudio {
  data: string;
  mimeType: string;
  /** Seconds, rounded. Used to throw away an accidental tap. */
  seconds: number;
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const tick = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (tick.current !== null) { window.clearInterval(tick.current); tick.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const supported = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const start = useCallback(async () => {
    if (!supported || recorderRef.current) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    startedAt.current = Date.now();
    setRecording(true);
    setSeconds(0);
    tick.current = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)),
      500,
    );
    return true;
  }, [supported]);

  /** Stops and returns the recording, or null if nothing usable came out. */
  const stop = useCallback(async (): Promise<RecordedAudio | null> => {
    const rec = recorderRef.current;
    if (!rec) { cleanup(); return null; }

    const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });
    cleanup();

    if (blob.size === 0) return null;

    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      // readAsDataURL gives "data:<type>;base64,<payload>" — only the payload travels.
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.readAsDataURL(blob);
    });

    return { data, mimeType: blob.type || "audio/webm", seconds: elapsed };
  }, [cleanup]);

  /** Throws the recording away without reading it. */
  const cancel = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* already stopped */ }
    cleanup();
  }, [cleanup]);

  return { supported, recording, seconds, start, stop, cancel };
}
