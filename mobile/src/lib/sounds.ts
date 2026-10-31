import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The little "plim" when something lands: a glassy tick and two rising notes.
 *
 * Loaded ahead (`preloadCash`, when the sheet that will need it opens) and the speaker
 * session set then too, so at the moment it is asked for it only has to start: nothing
 * is awaited between the receipt's tick and the sound. After the microphone has been
 * used the phone is left in a recording session, which sends sound to the earpiece —
 * quiet enough to seem missing — so the session is set back to playback on the way in.
 * It mixes with whatever else is playing and plays with the ringer off, since it is the
 * confirmation the person is waiting for.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHIME = require("../../assets/sounds/chime.wav") as number;

let player: AudioPlayer | null = null;

const playback = () =>
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);

/** Have it ready, and the speaker set, before the moment it is needed. */
export function preloadCash() {
  try {
    if (!player) {
      const made = createAudioPlayer(CHIME);
      /* Back to the start as soon as it ends, so the next one starts at once. */
      made.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) void made.seekTo(0);
      });
      player = made;
    }
    void playback();
  } catch {
    /* No sound this time. */
  }
}

export function playCash() {
  try {
    preloadCash();
    const p = player!;
    p.volume = 0.85;
    if (p.currentTime > 0.02) void p.seekTo(0).then(() => p.play());
    else p.play();
  } catch {
    /* No sound this time. */
  }
}
