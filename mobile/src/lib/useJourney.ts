import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "~/lib/auth";
import { cachedJourney, loadJourney, rememberJourney, type Journey } from "~/lib/journey";

/**
 * The journey for whoever is signed in: the last one kept on the phone at once, then
 * worked out again from the records on focus and whenever anything financial changes.
 */
export function useJourney() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [journey, setJourney] = useState<Journey | null>(() => cachedJourney(uid));

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const j = await loadJourney(uid);
      setJourney(j);
      rememberJourney(uid, j);
    } catch {
      /* The kept one stays. */
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const on = () => void load();
    window.addEventListener("finance-data-changed", on);
    window.addEventListener("transaction-created", on);
    return () => {
      window.removeEventListener("finance-data-changed", on);
      window.removeEventListener("transaction-created", on);
    };
  }, [load]);

  return { journey, reload: load };
}
