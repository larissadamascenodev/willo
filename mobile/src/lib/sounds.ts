import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The sound when an expense lands: two small coins, bright and quick.
 *
 * Loaded ahead (`preloadCash`, when the sheet that will need it opens) and the speaker
 * session set then too, so at the moment it is asked for it only has to start: nothing
 * is awaited between the receipt's tick and the sound. After the microphone has been
 * used the phone is left in a recording session, which sends sound to the earpiece —
 * quiet enough to seem missing — so the session is set back to playback on the way in.
 * It mixes with whatever else is playing and plays with the ringer off, since it is the
 * confirmation the person is waiting for.
 */

/* Two small coins landing: money written down. The opening keeps its own chime. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHIME = require("../../assets/sounds/coin.wav") as number;

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
    p.volume = 0.6;
    if (p.currentTime > 0.02) void p.seekTo(0).then(() => p.play());
    else p.play();
  } catch {
    /* No sound this time. */
  }
}

/* ── The confirmation of the Willo Pass: the coin, at the moment the receipt appears. ── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CONFIRM = require("../../assets/sounds/willo-confirm.mp3") as number;
let confirmPlayer: AudioPlayer | null = null;
/* The coin's speed: 1 is as recorded, which sounded hurried. */
const COIN_RATE = 0.82;

/** Have the Pass's coin ready before the confirmation, so it starts the moment it is asked. */
export function preloadConfirm() {
  try {
    if (!confirmPlayer) {
      const made = createAudioPlayer(CONFIRM);
      made.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) void made.seekTo(0);
      });
      confirmPlayer = made;
    }
    void playback();
  } catch {
    /* No sound this time. */
  }
}

/**
 * The coin, once, at the Pass's 120 ms. Played on the speaker even after the microphone was used
 * (the session is set back to playback first), and if the file has not finished loading yet it
 * starts the moment it has — instead of the play being lost, which left the Pass silent.
 */
export function playConfirm() {
  void (async () => {
    try {
      preloadConfirm();
      void playback();
      const p = confirmPlayer!;
      p.volume = 0.45;
      const go = () => {
        /* A touch slower than recorded but in its own tone (pitch kept): the same coin, less
           hurried. Set once the file is loaded, when the player has its item. */
        try {
          p.shouldCorrectPitch = true;
          p.setPlaybackRate(COIN_RATE, "high");
        } catch {
          /* At its own speed, then. */
        }
        if (p.currentTime > 0.02) void p.seekTo(0).then(() => p.play());
        else p.play();
      };
      if (p.isLoaded) return go();
      const sub = p.addListener("playbackStatusUpdate", (status) => {
        if (!status.isLoaded) return;
        sub.remove();
        go();
      });
      /* Never waits long: past half a second the moment has gone. */
      setTimeout(() => sub.remove(), 500);
    } catch {
      /* No sound this time. */
    }
  })();
}
