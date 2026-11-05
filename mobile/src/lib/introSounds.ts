import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The opening's sound: one even, soft swell under the whole build (made for it, see
 * assets/sounds/intro-swell.wav). No notes struck and nothing sharp — a warm low chord
 * breathing in with the deck, a little air while the cards move, a faint glow as the
 * icon completes, and a slow fade. It is timed to start with the deck.
 *
 * Unlike the confirmation chime, it respects the ringer switch: an app that makes a
 * noise just for being opened, with the phone on silent, is rude. It mixes with
 * whatever is already playing rather than stopping it.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SWELL = require("../../assets/sounds/intro-swell.wav") as number;

export interface IntroSound {
  play: () => void;
  release: () => void;
}

const SILENT: IntroSound = { play: () => {}, release: () => {} };

export function loadIntroSound(): IntroSound {
  try {
    void setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    const player: AudioPlayer = createAudioPlayer(SWELL);
    return {
      play: () => {
        try {
          player.volume = 0.7;
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
