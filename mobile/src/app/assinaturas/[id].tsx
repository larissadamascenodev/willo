import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { supabase } from "@/integrations/supabase/client";
import { getAccounts, getCreditCards, getTransactionById } from "@/services/transactionService";
import { deleteInSeries } from "@/services/seriesActions";
import Room from "~/components/Room";
import PageHeader from "~/components/PageHeader";
import Surface from "~/components/Surface";
import SubLogo from "~/components/SubLogo";
import CenterModal from "~/components/CenterModal";
import { CreditCard, Landmark, Pencil, Sparkles } from "~/components/icons";
import { chargesLeftThisYear, chargesSoFar } from "~/lib/subscriptionInsights";
import { knownSub } from "~/lib/subscriptionLogos";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * One subscription: since when, how many times it has been charged and what that came to,
 * what it costs in a year and what is still to come in this one — and what cancelling it
 * would leave. Editing opens the usual sheet; cancelling stops it from next month on,
 * leaving what was already charged where it is.
 */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

interface Row {
  id: string;
  name: string;
  amount: number;
  date: string;
  account_id: string | null;
  credit_card_id: string | null;
}

export default function Assinatura() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const [skipped, setSkipped] = useState<{ month: number; year: number }[]>([]);
  const [place, setPlace] = useState<{ name: string; card: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    let alive = true;
    void Promise.all([
      getTransactionById(id),
      supabase.from("recurring_exclusions").select("month, year").eq("transaction_id", id),
      getAccounts(),
      getCreditCards(),
    ])
      .then(([tx, ex, accs, cards]) => {
        if (!alive) return;
        const r = tx as unknown as Row;
        setRow({ ...r, amount: Number(r.amount) });
        setSkipped(((ex.data ?? []) as { month: number; year: number }[]).map((e) => ({ month: Number(e.month), year: Number(e.year) })));
        const card = (cards as unknown as { id: string; name: string }[]).find((c) => c.id === r.credit_card_id);
        const acc = (accs as unknown as { id: string; name: string }[]).find((a) => a.id === r.account_id);
        setPlace(card ? { name: card.name, card: true } : acc ? { name: acc.name, card: false } : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, user]);

  const facts = useMemo(() => {
    if (!row) return null;
    const today = new Date();
    const start = new Date(`${row.date.slice(0, 10)}T12:00:00`);
    const charged = chargesSoFar(row.date, skipped, today);
    const left = chargesLeftThisYear(row.date, today);
    const day = start.getDate();
    /* The next charge: this month's day if still ahead, otherwise next month's — never before the first. */
    let next = new Date(today.getFullYear(), today.getMonth(), Math.min(day, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()), 12);
    if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(day, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()), 12);
    if (next < start) next = start;
    return { start, charged, spent: charged * row.amount, year: row.amount * 12, left, leftValue: left * row.amount, next, day };
  }, [row, skipped]);

  const known = row ? knownSub(row.name) : null;
  const name = known?.name ?? row?.name ?? "";

  const cancel = async () => {
    if (!row || !user) return;
    setBusy(true);
    try {
      /* From next month on: what was already charged stays in its months. */
      const now = new Date();
      const nextMonth = now.getMonth() === 11 ? { month: 0, year: now.getFullYear() + 1 } : { month: now.getMonth() + 1, year: now.getFullYear() };
      await deleteInSeries(row.id, "all", { ...nextMonth, userId: user.id });
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      showToast(`${name} cancelada`);
      setAsking(false);
      router.replace("/assinaturas" as never);
    } catch {
      showToast("Não consegui cancelar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const edit = () => {
    if (!row) return;
    const d = new Date(`${row.date.slice(0, 10)}T12:00:00`);
    const now = new Date();
    const later = d > now;
    router.push({ pathname: "/manual", params: { editar: row.id, mes: String(later ? d.getMonth() : now.getMonth()), ano: String(later ? d.getFullYear() : now.getFullYear()) } } as never);
  };

  return (
    <Room lit sky>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <PageHeader title={name || "Assinatura"} back="/assinaturas" />

        {!row || !facts ? (
          <View style={{ marginTop: 24, alignItems: "center", gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />
            <View style={{ width: 140, height: 28, borderRadius: 8, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(260)}>
            {/* What it is and what it costs. */}
            <View style={{ marginTop: 18, alignItems: "center" }}>
              <SubLogo name={row.name} size={72} round />
              <Text style={{ marginTop: 14, fontSize: 34, fontWeight: "800", letterSpacing: -1.2, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
                {money(row.amount)}
                <Text style={{ fontSize: 15, fontWeight: "500", letterSpacing: 0, color: th(INK.soft) }}> /mês</Text>
              </Text>
              <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                {place?.card ? <CreditCard size={13} color={th(INK.softer)} strokeWidth={2} /> : <Landmark size={13} color={th(INK.softer)} strokeWidth={2} />}
                <Text style={{ fontSize: 13, color: th(INK.soft) }}>
                  {place ? `${place.card ? "Cartão" : "Conta"} ${place.name} · ` : ""}todo dia {facts.day}
                </Text>
              </View>
            </View>

            {/* The figures. */}
            <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
              <Fact label="Já pagas" value={String(facts.charged)} note={facts.charged === 1 ? "cobrança" : "cobranças"} />
              <Fact label="Já gasto" value={money(facts.spent)} note={`${facts.charged === 0 ? "começa em" : "desde"} ${MONTHS[facts.start.getMonth()].slice(0, 3)}. ${facts.start.getFullYear()}`} />
            </View>
            <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
              <Fact label="Em um ano" value={money(facts.year)} note="12 cobranças" />
              <Fact label="Até dezembro" value={money(facts.leftValue)} note={facts.left === 0 ? "nada mais este ano" : `${facts.left} ${facts.left === 1 ? "cobrança" : "cobranças"}`} />
            </View>

            <Surface style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, color: th(INK.soft) }}>{facts.charged === 0 ? "Primeira cobrança" : "Próxima cobrança"}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>
                {facts.next.getDate()} de {MONTHS[facts.next.getMonth()]}
              </Text>
            </Surface>

            {/* What the Willo has to say about it. */}
            <Surface style={{ marginTop: 12, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={15} color={th("#fff")} strokeWidth={2.2} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: th("#fff") }}>O Willo notou</Text>
              </View>
              <Text style={{ marginTop: 10, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
                Se você cancelar {name} agora, economiza <Text style={{ fontWeight: "700", color: th("#fff") }}>{money(facts.year)}</Text> em um ano
                {facts.left > 0 ? `, ${money(facts.leftValue)} só até dezembro` : ""}.
              </Text>
              {facts.charged >= 6 && (
                <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
                  Já foram {facts.charged} cobranças, {money(facts.spent)} no total. Ainda faz sentido para você?
                </Text>
              )}
            </Surface>

            {/* Change it, or end it. */}
            <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={edit}
                accessibilityRole="button"
                style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.10)", "bg"), opacity: pressed ? 0.7 : 1 })}
              >
                <Pencil size={16} color={th("#fff")} strokeWidth={2.2} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Editar</Text>
              </Pressable>
              <Pressable
                onPress={() => setAsking(true)}
                accessibilityRole="button"
                style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,107,107,0.12)", "bg"), opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: th(RED) }}>Cancelar assinatura</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <CenterModal open={asking} onClose={() => !busy && setAsking(false)} title={`Cancelar ${name}?`}>
        <Text style={{ fontSize: 15, lineHeight: 21, color: th(INK.soft) }}>
          Ela deixa de contar a partir do mês que vem. O que já foi cobrado continua no seu histórico.
        </Text>
        <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setAsking(false)}
            disabled={busy}
            style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.10)", "bg"), opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Manter</Text>
          </Pressable>
          <Pressable
            onPress={() => void cancel()}
            disabled={busy}
            style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th(RED, "bg"), opacity: busy ? 0.5 : pressed ? 0.8 : 1 })}
          >
            <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{busy ? "Cancelando…" : "Cancelar"}</Text>
          </Pressable>
        </View>
      </CenterModal>
    </Room>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Surface style={{ flex: 1, padding: 14 }}>
      <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginTop: 4, fontSize: 21, fontWeight: "800", letterSpacing: -0.6, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: th(INK.softer) }}>
        {note}
      </Text>
    </Surface>
  );
}
