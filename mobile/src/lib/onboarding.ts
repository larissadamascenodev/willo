import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BANKS } from "@/lib/banks";
import { createAccount, getAccounts } from "@/services/transactionService";
import { supabase } from "~/supabase/client";
import { useAuth } from "~/lib/auth";

/**
 * What a new person said about themselves before they had an account.
 *
 * The questions come first and the account last, so the answers cannot be written
 * anywhere yet: a row needs a person it belongs to, and that person has no session
 * until the account exists — and, if the project still asks for e-mail
 * confirmation, not until they have opened the link. So the answers wait on the
 * phone, with the e-mail they were given for, and are written the first time that
 * same person is signed in.
 */

const KEY = "willo:pending-onboarding";

export interface PendingOnboarding {
  email: string;
  name: string;
  goal: string | null;
  /** The account they named, if they did. */
  bank: string | null;
  /** What it holds today, in reais. */
  balance: number;
}

export async function savePendingOnboarding(p: PendingOnboarding) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...p, email: p.email.trim().toLowerCase() }));
  } catch {
    /* Worst case they are asked again in the app. */
  }
}

async function readPending(): Promise<PendingOnboarding | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingOnboarding) : null;
  } catch {
    return null;
  }
}

/**
 * Writes what was said, once, for the person it was said by.
 *
 * Their name goes on the profile and their first account is opened — without one a
 * first entry has nowhere to land. Someone who already has accounts is never given
 * another: that is an existing person signing in on a new phone, not a new one.
 */
export function useApplyOnboarding() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.email) return;
    let alive = true;

    void (async () => {
      const pending = await readPending();
      if (!pending || pending.email !== user.email!.toLowerCase()) return;
      try {
        const existing = (await getAccounts()) as unknown[];
        if (existing.length === 0 && pending.bank) {
          const bank = BANKS.find((b) => b.name === pending.bank);
          await createAccount(user.id, {
            name: pending.bank,
            type: "checking",
            initial_balance: pending.balance,
            color: bank?.accent ?? null,
          });
        }
        if (pending.name) {
          await supabase
            .from("profiles" as never)
            .update({ display_name: pending.name, has_completed_profile: true } as never)
            .eq("id", user.id);
        }
        if (alive) {
          await AsyncStorage.removeItem(KEY);
          window.dispatchEvent(new CustomEvent("finance-data-changed"));
        }
      } catch {
        /* Left in place: it is tried again the next time they open the app. */
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);
}
