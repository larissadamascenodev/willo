import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLoginStreak() {
  const { user, loading: authLoading } = useAuth();
  const [streak, setStreak] = useState(0);
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setStreak(0);
      setStreakDates([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("login_days" as any)
        .upsert({ user_id: user.id, login_date: today } as any, {
          onConflict: "user_id,login_date",
          ignoreDuplicates: true,
        });

      const { data } = await supabase
        .from("login_days" as any)
        .select("login_date")
        .eq("user_id", user.id)
        .order("login_date", { ascending: false })
        .limit(60);

      if (!data || data.length === 0) {
        setStreak(0);
        setStreakDates([]);
        setLoading(false);
        return;
      }

      const dates = new Set((data as any[]).map((d: any) => d.login_date));

      let count = 0;
      const consecutiveDates: string[] = [];
      const d = new Date();
      d.setHours(0, 0, 0, 0);

      while (true) {
        const dateStr = d.toISOString().split("T")[0];
        if (dates.has(dateStr)) {
          count++;
          consecutiveDates.push(dateStr);
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }

      setStreak(count);
      setStreakDates(consecutiveDates);
      setLoading(false);
    };

    run();
  }, [authLoading, user]);

  return { streak, streakDates, loading };
}
