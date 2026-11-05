import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The opening's sounds, soft wooden notes in C major made for it (see assets/sounds):
 * three quick rising notes as the fan opens, a muted note as each card goes into the
 * wallet — G, then C, then E, rising — and a warm strummed chord when the icon is
 * complete. Together they are a small phrase that resolves as the icon does.
 *
 * Unlike the confirmation chime, these respect the ringer switch: an app that makes
 * a noise just for being opened, with the phone on silent, is rude. They mix with
 * whatever is already playing rather than stopping it.
 *
 * Players are made as the intro mounts, so each sound only has to start at its
 * moment, and let go when it ends.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const FAN = require("../../assets/sounds/intro-fan.wav") as number;
const TUCKS = [
  require("../../assets/sounds/intro-tuck-1.wav") as number,
  require("../../assets/sounds/intro-tuck-2.wav") as number,
  require("../../assets/sounds/intro-tuck-3.wav") as number,
];
const CHORD = require("../../assets/sounds/intro-chord.wav") as number;
/* eslint-enable @typescript-eslint/no-require-imports */

export interface IntroSounds {
  fan: () => void;
  tuck: (i: number) => void;
  chord: () => void;
  release: () => void;
}

const SILENT: IntroSounds = { fan: () => {}, tuck: () => {}, chord: () => {}, release: () => {} };

export function loadIntroSounds(): IntroSounds {
  try {
    void setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    const fan = createAudioPlayer(FAN);
    const tucks = TUCKS.map((s) => createAudioPlayer(s));
    const chord = createAudioPlayer(CHORD);
    const all: AudioPlayer[] = [fan, ...tucks, chord];
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
      fan: () => play(fan, 0.7),
      tuck: (i) => play(tucks[i], 0.8),
      chord: () => play(chord, 0.8),
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
