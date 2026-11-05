import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The opening's sound, made for it (see assets/sounds/intro-blink.wav): a soft tone
 * that rises gently for a second and resolves on a warm chord just as Willo blinks.
 * Nothing else in the opening makes a sound; this is the one moment it marks.
 *
 * Unlike the confirmation chime, it respects the ringer switch: an app that makes a
 * noise just for being opened, with the phone on silent, is rude. It mixes with
 * whatever is already playing rather than stopping it.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BLINK_SOUND = require("../../assets/sounds/intro-blink.wav") as number;
/** How far into the sound its chord arrives. */
export const INTRO_SOUND_LEAD_MS = 1200;

export interface IntroSound {
  play: () => void;
  release: () => void;
}

const SILENT: IntroSound = { play: () => {}, release: () => {} };

export function loadIntroSound(): IntroSound {
  try {
    void setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    const player: AudioPlayer = createAudioPlayer(BLINK_SOUND);
    return {
      play: () => {
        try {
          player.volume = 0.5;
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
