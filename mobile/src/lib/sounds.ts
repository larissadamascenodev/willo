import { createAudioPlayer, type AudioPlayer } from "expo-audio";

/**
 * The little "tilim" when something lands, like a payment app's.
 *
 * One player, made the first time it is needed and rewound for every play. If the
 * sound cannot play — a silent phone, an audio session in use — nothing else waits on
 * it: it is a flourish, not a confirmation.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CASH = require("../../assets/sounds/cash.wav") as number;

let player: AudioPlayer | null = null;

export function playCash() {
  try {
    player ??= createAudioPlayer(CASH);
    player.volume = 0.7;
    void player.seekTo(0);
    player.play();
  } catch {
    /* No sound this time. */
  }
}
