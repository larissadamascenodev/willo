import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The opening's one sound: the same "plim" as the receipt (assets/sounds/chime.wav),
 * played softer, as Willo blinks.
 *
 * Unlike the receipt, it respects the ringer switch: an app that makes a noise just
 * for being opened, with the phone on silent, is rude. It mixes with whatever is
 * already playing rather than stopping it.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHIME = require("../../assets/sounds/chime.wav") as number;

export interface IntroSound {
  play: () => void;
  release: () => void;
}

const SILENT: IntroSound = { play: () => {}, release: () => {} };

export function loadIntroSound(): IntroSound {
  try {
    void setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    const player: AudioPlayer = createAudioPlayer(CHIME);
    return {
      play: () => {
        try {
          player.volume = 0.3;
          player.play();
        } catch {
          /* No sound this time. */
        }
      },
      release: () => {
        try {
          player.remove();
        } catch {
          /* Already gone. */
        }
      },
    };
  } catch {
    return SILENT;
  }
}
