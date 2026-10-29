import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";

/**
 * The microphone, for Registro rápido and the sphere.
 *
 * The web records with the browser's MediaRecorder and hands the reader a base64
 * clip with its type; this does the same with the phone's recorder, so the same
 * function on the server reads both. The phone writes AAC in an MPEG-4 file — the
 * format Safari's recorder produces too, which the reader already takes from
 * iPhones on the web.
 *
 * It also reports how loud it is, a few times a second. That is what lets the
 * caller notice when someone has started talking and when they have stopped, so
 * that speaking does not need a second tap to end.
 */

export class MicrophoneDenied extends Error {}

/* Defined once: the recorder is rebuilt if the options it is given change. */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

export function useVoice() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 120);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new MicrophoneDenied();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  /** Stops, and hands back the clip ready for the reader — or null if nothing was caught. */
  const stop = async (): Promise<{ data: string; mimeType: string; seconds: number } | null> => {
    const seconds = recorder.currentTime;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const uri = recorder.uri;
    if (!uri) return null;
    const data = await new File(uri).base64();
    return { data, mimeType: "audio/mp4", seconds };
  };

  const cancel = async () => {
    if (!state.isRecording) return;
    await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  };

  return {
    recording: state.isRecording,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    /** Loudness in decibels, roughly −60 in a quiet room to 0 at the loudest. Undefined where the device does not say. */
    level: state.isRecording ? state.metering : undefined,
    start,
    stop,
    cancel,
  };
}
