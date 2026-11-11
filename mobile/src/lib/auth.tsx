import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "~/supabase/client";
import { cachedAccounts, warmHome, warmHomeWithin } from "~/lib/warmHome";
import { loginGate } from "~/lib/socialAuth";

/**
 * Who is signed in.
 *
 * The web app's provider does more than this — it warms the dashboard's caches and
 * watches the tab for visibility — but both of those are written against a browser.
 * This keeps the part that matters: the session, restored from the phone's storage
 * on launch and kept fresh while the app is in front.
 */

interface AuthValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/* Supabase refreshes tokens on a timer, which iOS suspends in the background. It is
   told to stop while the app is away and catch up when it comes back. */
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      /* Just signed in: the home's numbers are fetched first, so it opens filled in
         rather than with empty cards. The login keeps its spinner meanwhile. */
      /* Signing in from "Já tenho conta" with Apple or Google: wait until the account is
         known to have existed; a brand-new one is undone there and never opens the app. */
      const pending = event === "SIGNED_IN" ? loginGate() : null;
      if (pending) {
        void pending.then(async (pass) => {
          if (!alive || !pass || !next?.user) return;
          /* The stage may have been written on the account meanwhile: read it fresh. */
          const { data } = await supabase.auth.getSession();
          await warmHomeWithin(next.user.id);
          if (!alive) return;
          setSession(data.session ?? next);
          setLoading(false);
        });
        return;
      }
      if (event === "SIGNED_IN" && next?.user && !cachedAccounts(next.user.id)) {
        void warmHomeWithin(next.user.id).then(() => {
          if (!alive) return;
          setSession(next);
          setLoading(false);
        });
        return;
      }
      if (next?.user) void warmHome(next.user.id);
      setSession(next);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
