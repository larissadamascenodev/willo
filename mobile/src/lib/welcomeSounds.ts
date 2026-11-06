import { useEffect, useRef } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * The welcome's one sound: the app's own "plim", played softly when a demonstration
 * writes something down. It respects the ringer switch — the welcome is a page being
 * looked at, not a confirmation someone is waiting for — and mixes with whatever is
 * playing. The player is made when the page opens and let go when it closes.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHIME = require("../../assets/sounds/chime.wav") as number;

export function useSoftChime(volume = 0.28) {
  const player = useRef<AudioPlayer | null>(null);
  useEffect(() => {
    try {
      void setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
      player.current = createAudioPlayer(CHIME);
    } catch {
      player.current = null;
    }
    return () => {
      try {
        player.current?.remove();
      } catch {
        /* Already gone. */
      }
      player.current = null;
    };
  }, []);
  return () => {
    const p = player.current;
    if (!p) return;
    try {
      p.volume = volume;
      if (p.currentTime > 0.02) void p.seekTo(0).then(() => p.play());
      else p.play();
    } catch {
      /* No sound this time. */
    }
  };
}
