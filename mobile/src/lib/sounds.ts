import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The little "tilim" when something lands, like a payment app's.
 *
 * Loaded ahead (`preloadCash`) so it starts the instant it is asked for, and played on the
 * speaker in a playback session: after the microphone has been used the phone is left in
 * a recording session, which sends sound to the earpiece — quiet enough to seem missing.
 * It mixes with whatever else is playing and plays with the ringer off, since it is the
 * confirmation the person is waiting for.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CASH = require("../../assets/sounds/cash.wav") as number;

let player: AudioPlayer | null = null;

const playback = () =>
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);

/** Have it ready before the moment it is needed. */
export function preloadCash() {
  try {
    player ??= createAudioPlayer(CASH);
    void playback();
  } catch {
    /* No sound this time. */
  }
}

export function playCash() {
  try {
    preloadCash();
    const p = player!;
    p.volume = 0.8;
    void playback().then(() => {
      void p.seekTo(0);
      p.play();
    });
  } catch {
    /* No sound this time. */
  }
}
