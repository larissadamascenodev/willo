import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "~/supabase/client";
import { loadActiveInstallments, type InstallmentStats } from "@/services/activeInstallments";
import { useRecorrentes, daysUntil } from "@/hooks/useRecorrentes";
import StatTile from "~/components/StatTile";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";

/**
 * The half-width summaries.
 *
 * Each is a figure and a word, which is why they sit two to a row rather than
 * taking a card apiece: a column of nothing but full-width cards has no shape to it.
 * They keep the tile's own rule, so four of them are still told apart by colour.
 */

/** What is still being paid off. */
export function ParcelamentosTile() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<InstallmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { stats: s } = await loadActiveInstallments(user.id);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  if (loading) return <Skeleton />;

  if (!stats) {
    return (
      <StatTile
        label="Parcelamentos"
        value="Nenhum"
        caption="Nada parcelado agora"
        accent="#F59E0B"
        empty
        onPress={() => router.push("/parcelamentos")}
      />
    );
  }

  return (
    <StatTile
      label="Parcelamentos"
      value={money(stats.totalRestante)}
      caption={`${money(stats.totalMensal)} por mês`}
      accent="#F59E0B"
      onPress={() => router.push("/parcelamentos")}
    />
  );
}

/**
 * What repeats every month and carries a brand: the streaming, the gym, the phone.
 *
 * It is a slice of the recurring charges rather than a list of its own, because
 * nothing in the data marks a row as a subscription.
 */
export function AssinaturasTile() {
  const { user } = useAuth();
  const { assinaturas, totalAssinaturas, loading } = useRecorrentes();

  /* The shared hook never settles without a session; that is not loading, it is
     nothing to show. */
  if (loading && user) return <Skeleton />;

  const n = assinaturas.length;
  if (n === 0) {
    return (
      <StatTile
        label="Assinaturas"
        value={money(0)}
        caption="Nenhuma assinatura ativa"
        accent="#7DD3FC"
        empty
      />
    );
  }

  /* The one falling due soonest is the only thing here you might still act on. */
  const proxima = assinaturas
    .filter((a) => !a.isPaidThisMonth)
    .sort((a, b) => daysUntil(a.dueDay) - daysUntil(b.dueDay))[0];

  return (
    <StatTile
      label="Assinaturas"
      value={money(totalAssinaturas)}
      caption={
        proxima
          ? `${n} ${n === 1 ? "ativa" : "ativas"} · ${proxima.name} dia ${proxima.dueDay}`
          : `${n} ${n === 1 ? "ativa" : "ativas"} · tudo pago no mês`
      }
      accent="#7DD3FC"
    />
  );
}

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
}

/** How much has been put aside, against how much was meant to be. */
export function MetasTile() {
  const router = useRouter();
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setGoals([]);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, name, target_amount, current_amount")
        .eq("user_id", user.id);
      if (alive) setGoals((data as GoalRow[]) ?? []);
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", onChange);
    };
  }, [user]);

  if (goals === null) return <Skeleton />;

  if (goals.length === 0) {
    return (
      <StatTile
        label="Metas"
        value="Nenhuma"
        caption="Toque para criar"
        accent="#C8F36D"
        empty
        onPress={() => router.push("/metas")}
      />
    );
  }

  const guardado = goals.reduce((s, g) => s + g.current_amount, 0);
  const objetivo = goals.reduce((s, g) => s + g.target_amount, 0);
  const overall = objetivo > 0 ? Math.min(guardado / objetivo, 1) : 0;

  return (
    <StatTile
      label="Metas"
      value={money(guardado)}
      caption={`${Math.round(overall * 100)}% de ${money(objetivo)}`}
      accent="#C8F36D"
      progress={overall}
      onPress={() => router.push("/metas")}
    />
  );
}

/** A tile that has not answered yet. A hole in the row is worse than a quiet tile. */
function Skeleton() {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 150,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.046)",
      }}
    />
  );
}
