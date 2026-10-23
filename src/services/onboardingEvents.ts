import { supabase } from "@/integrations/supabase/client";

/**
 * Where people stop.
 *
 * The funnel's whole question is about the ones who leave, and those never sign in, so
 * every row is written anonymously against a session id made up in the browser. It
 * carries no name, no e-mail and no answer — only which screen, what happened there,
 * and where the person arrived from.
 *
 * Nothing here is allowed to matter: a failed write is swallowed, because an analytics
 * row is never worth stopping someone's signup for.
 */

export type OnboardingEvent =
  | "view"
  | "answer"
  | "skip"
  | "finish"
  | "paywall_view"
  | "paywall_cta"
  | "paywall_close";

const SESSION_KEY = "willo.onboarding.session";
const SRC_KEY = "willo.onboarding.src";

const makeId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = makeId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return makeId();
  }
}

/**
 * The campaign that sent the person here. Read once from the URL and kept, because the
 * parameter is gone from the address by the time they reach the paywall.
 */
function src(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("src");
    if (fromUrl) {
      sessionStorage.setItem(SRC_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(SRC_KEY);
  } catch {
    return null;
  }
}

export function trackOnboarding(screenId: string, event: OnboardingEvent): void {
  try {
    void supabase
      .from("onboarding_events" as never)
      .insert({ session_id: sessionId(), screen_id: screenId, event, src: src() } as never)
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* offline, blocked, table not migrated yet — none of it is the person's problem */
  }
}
