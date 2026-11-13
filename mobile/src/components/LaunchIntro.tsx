import { useState } from "react";
import LaunchIntroCards from "~/components/LaunchIntroCards";
import LaunchIntroEyes from "~/components/LaunchIntroEyes";

/**
 * The opening, while two are being compared: Willo's eyes becoming the l's of his name,
 * and the cards becoming its point (Uber's opening the other way round). Each time the
 * app opens it plays the other one, so both can be seen on the phone. Once one is
 * chosen, this goes back to being that one.
 */

const KEY = "willo:intro:next";

function pick(): "eyes" | "cards" {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    const now = store?.getItem(KEY) === "cards" ? "cards" : "eyes";
    store?.setItem(KEY, now === "cards" ? "eyes" : "cards");
    return now;
  } catch {
    return "eyes";
  }
}

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const [which] = useState(pick);
  return which === "cards" ? <LaunchIntroCards onDone={onDone} /> : <LaunchIntroEyes onDone={onDone} />;
}
