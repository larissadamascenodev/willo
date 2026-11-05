import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The opening's sounds: a soft swish as the fan opens, a small tuck as each card goes
 * into the wallet, and a glassy sparkle when the icon is complete. All three were
 * made for it (see assets/sounds) and are quiet.
 *
 * Unlike the confirmation chime, these respect the ringer switch: an app that makes
 * a noise just for being opened, with the phone on silent, is rude. They mix with
 * whatever is already playing rather than stopping it.
 *
 * Players are made as the intro mounts, so each sound only has to start at its
 * moment, and let go when it ends. Each card has its own player because the tucks
 * come close together.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const SWISH = require("../../assets/sounds/intro-swish.wav") as number;
const TUCK = require("../../assets/sounds/intro-tuck.wav") as number;
const SPARKLE = require("../../assets/sounds/intro-sparkle.wav") as number;
/* eslint-enable @typescript-eslint/no-require-imports */

export interface IntroSounds {
  swish: () => void;
  tuck: (i: number) => void;
  sparkle: () => void;
  release: () => void;
}

const SILENT: IntroSounds = { swish: () => {}, tuck: () => {}, sparkle: () => {}, release: () => {} };

export function loadIntroSounds(): IntroSounds {
  try {
    void setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    const swish = createAudioPlayer(SWISH);
    const tucks = [0, 1, 2].map(() => createAudioPlayer(TUCK));
    const sparkle = createAudioPlayer(SPARKLE);
    const all: AudioPlayer[] = [swish, ...tucks, sparkle];
    const play = (p: AudioPlayer | undefined, volume: number) => {
      try {
        if (!p) return;
        p.volume = volume;
        p.play();
      } catch {
        /* No sound this time. */
      }
    };
    return {
      swish: () => play(swish, 0.7),
      tuck: (i) => play(tucks[i], 0.8),
      sparkle: () => play(sparkle, 0.75),
      release: () => {
        for (const p of all) {
          try {
            p.remove();
          } catch {
            /* Already gone. */
          }
        }
      },
    };
  } catch {
    return SILENT;
  }
}
