import type { ComponentType } from "react";
import { router } from "expo-router";
import Paywall from "./Paywall";
import { usePro } from "~/lib/purchases";

/**
 * Without Willo PRO the app is for looking only: everything already noted stays there
 * to be seen, but the screens that note something new, read a receipt or ask Willo
 * open the plans instead. Subscribing again opens the screen itself, in place.
 */
export function withPro<P extends object>(Screen: ComponentType<P>) {
  function Gated(props: P) {
    const pro = usePro();
    if (pro === false) return <Renew />;
    return <Screen {...props} />;
  }
  Gated.displayName = `withPro(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return Gated;
}

function Renew() {
  return (
    <Paywall
      renew
      name=""
      goal={null}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      /* The subscription's arrival opens the screen by itself (usePro hears of it). */
      onStart={() => undefined}
    />
  );
}
