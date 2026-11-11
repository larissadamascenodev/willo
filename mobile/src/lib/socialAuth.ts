import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/integrations/supabase/client";
import { setAccountStage } from "~/lib/accountStage";

/**
 * Entering with Apple or Google.
 *
 * Apple is the phone's own sheet (Face ID, no password): it hands back a token signed
 * by Apple, with a nonce we chose, and Supabase trades it for a session. Apple tells
 * the name only the first time, so it is kept on the account then.
 *
 * Google goes through the browser sheet the system draws inside the app. Supabase
 * sends the person to Google and back to willo://auth with the session in the
 * address; the session is taken from there. The address must be on the project's
 * list of allowed redirects (Supabase › Authentication › URL Configuration).
 *
 * Both end the same way as e-mail: a session appears and the auth listener moves
 * the screen. What comes back here is only whether it worked, was cancelled, or why
 * it failed, in words for the person.
 */

export type SocialResult = { ok: true; fresh?: boolean } | { ok: false; cancelled?: boolean; message?: string };

/**
 * Apple and Google make an account the first time they are used. A brand-new one is
 * kept either way; what changes is what comes next, marked on the account before the
 * app is let open on it:
 * - from "Já tenho conta" (the account came first): the questions, then the welcome;
 * - from the end of the questions (they are answered): the welcome.
 * The auth listener waits on this gate meanwhile, so the app never flashes in between.
 */
let gate: Promise<boolean> | null = null;
export const loginGate = () => gate;

/** Created moments ago and never signed in before: a new account. */
function isBrandNew(user: { created_at?: string; last_sign_in_at?: string | null; identities?: unknown[] | null } | null | undefined) {
  if (!user?.created_at) return false;
  const made = new Date(user.created_at).getTime();
  const signed = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : made;
  return Date.now() - made < 2 * 60_000 && Math.abs(signed - made) < 15_000 && (user.identities?.length ?? 1) <= 1;
}

/** Runs a sign-in; on the login screen, refuses an account that did not exist before. */
async function guarded(mode: Mode, run: () => Promise<SocialResult>): Promise<SocialResult> {
  let open!: (pass: boolean) => void;
  gate = new Promise<boolean>((r) => (open = r));
  try {
    const res = await run();
    if (!res.ok) {
      open(false);
      return res;
    }
    const { data } = await supabase.auth.getUser();
    const fresh = isBrandNew(data.user);
    if (fresh) await setAccountStage(mode === "entrar" ? "funil" : "boas-vindas").catch(() => undefined);
    open(true);
    return { ok: true, fresh };
  } catch {
    open(false);
    return { ok: false, message: "Não foi possível entrar agora. Tente de novo." };
  } finally {
    gate = null;
  }
}

export type Mode = "entrar" | "criar";

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export function signInWithApple(mode: Mode = "criar"): Promise<SocialResult> {
  return guarded(mode, appleOnce);
}

async function appleOnce(): Promise<SocialResult> {
  try {
    if (!(await appleAvailable())) return { ok: false, message: "Entrar com a Apple funciona no app do iPhone." };
    /* Apple gets the hash; Supabase gets the nonce itself and checks they match. */
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!cred.identityToken) return { ok: false, message: "A Apple não confirmou a entrada. Tente de novo." };

    const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce });
    if (error) return { ok: false, message: friendly(error.message) };

    /* Only on the first sign-in does Apple say the name. */
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ").trim();
    if (name) await supabase.auth.updateUser({ data: { display_name: name, full_name: name } }).catch(() => undefined);
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") return { ok: false, cancelled: true };
    return { ok: false, message: "Não foi possível entrar com a Apple agora. Tente de novo." };
  }
}

/** Pulls the tokens (or a code, or an error) out of the address Supabase sent back. */
function readReturn(url: string) {
  const out: Record<string, string> = {};
  const take = (part: string) => {
    for (const pair of part.split("&")) {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent((v ?? "").replace(/\+/g, " "));
    }
  };
  const hash = url.indexOf("#");
  const query = url.indexOf("?");
  if (query !== -1) take(url.slice(query + 1, hash > query ? hash : undefined));
  if (hash !== -1) take(url.slice(hash + 1));
  return out;
}

export function signInWithGoogle(mode: Mode = "criar"): Promise<SocialResult> {
  return guarded(mode, googleOnce);
}

async function googleOnce(): Promise<SocialResult> {
  try {
    /* willo://auth in the app; exp://…/--/auth in Expo Go. */
    const redirectTo = ExpoLinking.createURL("auth");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error || !data?.url) return { ok: false, message: "Não foi possível abrir o Google agora. Tente de novo." };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success") return { ok: false, cancelled: true };

    const back = readReturn(res.url);
    if (back.error || back.error_description) return { ok: false, message: friendly(back.error_description ?? back.error) };
    if (back.access_token && back.refresh_token) {
      const { error: setError } = await supabase.auth.setSession({ access_token: back.access_token, refresh_token: back.refresh_token });
      if (setError) return { ok: false, message: friendly(setError.message) };
      return { ok: true };
    }
    if (back.code) {
      const { error: exError } = await supabase.auth.exchangeCodeForSession(back.code);
      if (exError) return { ok: false, message: friendly(exError.message) };
      return { ok: true };
    }
    return { ok: false, message: "O Google não devolveu a entrada. Tente de novo." };
  } catch {
    return { ok: false, message: "Não foi possível entrar com o Google agora. Tente de novo." };
  }
}

function friendly(raw?: string) {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "Essa forma de entrar ainda não foi ligada no servidor.";
  if (m.includes("audience") || m.includes("client id")) return "O app ainda não está autorizado nessa forma de entrar.";
  return "Não foi possível entrar agora. Tente de novo.";
}
