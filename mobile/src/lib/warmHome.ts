import { supabase } from "@/integrations/supabase/client";
import { getAccounts } from "@/services/transactionService";

/**
 * The home, ready before it is shown.
 *
 * What the top of the home needs — the accounts behind "Saldo em contas" and the name
 * Willo greets — is kept on the phone (the shimmed localStorage, read synchronously),
 * so every launch after the first opens on the last numbers and refreshes under them.
 * Right after signing in, when nothing is kept yet, it is fetched before the door
 * opens (with a ceiling, so a slow network never holds the person at the login).
 */

type Account = { id: string; name: string; type: string; current_balance: number; color: string | null };

const key = (what: string, userId: string) => `willo:home:${what}:${userId}`;

function read<T>(what: string, userId: string | null | undefined): T | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(what, userId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(what: string, userId: string, value: unknown) {
  try {
    localStorage.setItem(key(what, userId), JSON.stringify(value));
  } catch {
    /* Kept for this session only. */
  }
}

export const cachedAccounts = (userId: string | null | undefined) => read<Account[]>("accounts", userId);
export const rememberAccounts = (userId: string, accounts: Account[]) => write("accounts", userId, accounts);

export const cachedName = (userId: string | null | undefined) => read<string>("name", userId);
export const rememberName = (userId: string, name: string | null | undefined) => {
  if (name && name.trim()) write("name", userId, name.trim());
};

/** Fetches what the home opens on and keeps it. Never rejects. */
export async function warmHome(userId: string): Promise<void> {
  await Promise.all([
    getAccounts()
      .then((a) => rememberAccounts(userId, a as unknown as Account[]))
      .catch(() => undefined),
    Promise.resolve(
      supabase
        .from("profiles" as never)
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
    )
      .then(({ data }) => rememberName(userId, (data as { display_name?: string } | null)?.display_name))
      .catch(() => undefined),
  ]);
}

/** The same, but given at most `ms` before the caller moves on. */
export function warmHomeWithin(userId: string, ms = 2500): Promise<void> {
  return Promise.race([warmHome(userId), new Promise<void>((r) => setTimeout(r, ms))]);
}
