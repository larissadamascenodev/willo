import type { User } from "@supabase/supabase-js";
import { LEGAL } from "@/lib/legal";
import { supabase } from "~/supabase/client";

/**
 * The person's "yes" to the Terms, the Privacy Policy and the AI providers, kept as
 * proof: which versions, and when.
 *
 * Given in the onboarding (before there is an account) it waits on the phone, and is
 * written onto the account (user metadata `willo_legal`) as soon as there is one, so it
 * follows the person and is not lost with the phone. Someone signed in with no record
 * (an account from before this existed) is asked once, inside the app.
 */

export interface LegalRecord {
  terms: string;
  privacy: string;
  /** Agreed to sending data to the AI providers (Anthropic, Google), in the US. */
  ai: boolean;
  /** Understood that Willo organises, it does not advise. */
  notAdvice: boolean;
  at: string;
}

const KEY = "willo.legal.consent";

const store = () => (globalThis as { localStorage?: Storage }).localStorage;

export function localLegal(): LegalRecord | null {
  try {
    const raw = store()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as LegalRecord) : null;
  } catch {
    return null;
  }
}

export function accountLegal(user: User | null | undefined): LegalRecord | null {
  const r = (user?.user_metadata as { willo_legal?: LegalRecord } | undefined)?.willo_legal;
  return r && r.terms && r.at ? r : null;
}

/** Kept on the phone at once; onto the account too when there is one. */
export async function acceptLegal(): Promise<void> {
  const rec: LegalRecord = { terms: LEGAL.terms.version, privacy: LEGAL.privacy.version, ai: true, notAdvice: true, at: new Date().toISOString() };
  try {
    store()?.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* The account copy below is the one that counts. */
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.updateUser({ data: { willo_legal: rec } }).catch(() => undefined);
}

/** A "yes" given before the account existed, written onto it now. */
export async function syncLegal(user: User | null | undefined): Promise<void> {
  if (!user || accountLegal(user)) return;
  const rec = localLegal();
  if (rec) await supabase.auth.updateUser({ data: { willo_legal: rec } }).catch(() => undefined);
}
