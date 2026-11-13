import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { daysUntil, useRecorrentes, type RecurringItem } from "@/hooks/useRecorrentes";
import Room from "~/components/Room";
import PageHeader from "~/components/PageHeader";
import Surface from "~/components/Surface";
import RoundButton from "~/components/RoundButton";
import SubLogo from "~/components/SubLogo";
import FixedSheet from "~/components/home/FixedSheet";
import { Check, ChevronRight, CreditCard, Landmark, Plus, Sparkles } from "~/components/icons";
import { overviewTips } from "~/lib/subscriptionInsights";
import { money } from "~/lib/money";
import { AMBER, INK } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Assinaturas: what they cost a month and a year, each one with its logo, its day and
 * where it is paid — a tap opens it, with what it has cost so far — and at the foot what
 * the Willo notices: the dearest, the services that overlap, the year's total.
 */

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

function whenCharged(s: RecurringItem) {
  if (s.startsOn) return `Começa em ${s.dueDay} ${MONTHS[Number(s.startsOn.slice(5, 7)) - 1]}`;
  if (s.isPaidThisMonth) return `Cobrada este mês · dia ${s.dueDay}`;
  const n = daysUntil(s.dueDay);
  return `${n === 0 ? "Cobra hoje" : n === 1 ? "Cobra amanhã" : `Cobra em ${n} dias`} · dia ${s.dueDay}`;
}

export default function Assinaturas() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { assinaturas, totalAssinaturas, loading } = useRecorrentes();
  const [adding, setAdding] = useState(false);
  const [names, setNames] = useState<Record<string, { name: string; card: boolean }>>({});

  useEffect(() => {
    let alive = true;
    void Promise.all([getAccounts(), getCreditCards()])
      .then(([accs, cards]) => {
        if (!alive) return;
        const out: Record<string, { name: string; card: boolean }> = {};
        for (const a of accs as unknown as { id: string; name: string }[]) out[a.id] = { name: a.name, card: false };
        for (const c of cards as unknown as { id: string; name: string }[]) out[c.id] = { name: c.name, card: true };
        setNames(out);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const ordered = useMemo(
    () => [...assinaturas].sort((a, b) => Number(a.isPaidThisMonth) - Number(b.isPaidThisMonth) || daysUntil(a.dueDay) - daysUntil(b.dueDay)),
    [assinaturas],
  );
  const tips = useMemo(() => overviewTips(assinaturas), [assinaturas]);
  const n = assinaturas.length;

  return (
    <Room lit sky>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="Assinaturas"
          back="/"
          right={
            <RoundButton label="Nova assinatura" onPress={() => setAdding(true)}>
              <Plus size={20} color={th("#fff")} strokeWidth={2.2} />
            </RoundButton>
          }
        />

        {loading && n === 0 ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 96, borderRadius: 22, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }} />
            <View style={{ height: 220, borderRadius: 22, backgroundColor: th("rgba(255,255,255,0.03)", "bg") }} />
          </View>
        ) : n === 0 ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 48, alignItems: "center", paddingHorizontal: 28 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: th("#fff") }}>Nenhuma assinatura ainda</Text>
            <Text style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
              Streaming, música, nuvem, academia: adicione as suas e veja quanto custam por mês e por ano.
            </Text>
            <Pressable
              onPress={() => setAdding(true)}
              style={({ pressed }) => ({ marginTop: 20, height: 50, paddingHorizontal: 24, borderRadius: 25, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
            >
              <Plus size={18} color={th("#0B0B0B")} strokeWidth={2.4} />
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>Nova assinatura</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(260)}>
            {/* What they cost. */}
            <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
              <Figure label="Por mês" value={money(totalAssinaturas)} note={`${n} ${n === 1 ? "ativa" : "ativas"}`} />
              <Figure label="Por ano" value={money(totalAssinaturas * 12)} note="se nada mudar" />
            </View>

            {/* Each one. */}
            <Surface style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 4 }}>
              {ordered.map((s, i) => {
                const place = (s.cardId && names[s.cardId]) || (s.accountId && names[s.accountId]) || null;
                const soon = !s.isPaidThisMonth && !s.startsOn && daysUntil(s.dueDay) <= 2;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: "/assinaturas/[id]", params: { id: s.sourceId } } as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.name}, ${money(s.amount)} por mês`}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line"), opacity: pressed ? 0.6 : 1 })}
                  >
                    <SubLogo name={s.name} size={44} round />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>
                        {s.name}
                      </Text>
                      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, fontWeight: soon ? "600" : "400", color: th(soon ? AMBER : INK.soft) }}>
                        {whenCharged(s)}
                      </Text>
                      {place && (
                        <View style={{ marginTop: 3, flexDirection: "row", alignItems: "center", gap: 5 }}>
                          {place.card ? <CreditCard size={12} color={th(INK.softer)} strokeWidth={2} /> : <Landmark size={12} color={th(INK.softer)} strokeWidth={2} />}
                          <Text numberOfLines={1} style={{ fontSize: 12, color: th(INK.softer) }}>
                            {place.card ? `Cartão ${place.name}` : `Conta ${place.name}`}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 3 }}>
                      <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(s.amount)}</Text>
                      {s.isPaidThisMonth ? (
                        <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}>
                          <Check size={10} color={th("#0B0B0B")} strokeWidth={3} />
                        </View>
                      ) : (
                        <Text style={{ fontSize: 11.5, color: th(INK.softer), fontVariant: ["tabular-nums"] }}>{money(s.amount * 12)}/ano</Text>
                      )}
                    </View>
                    <ChevronRight size={16} color={th(INK.faint)} />
                  </Pressable>
                );
              })}
            </Surface>

            {/* What the Willo notices. */}
            {tips.length > 0 && (
              <Surface style={{ marginTop: 12, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Sparkles size={15} color={th("#fff")} strokeWidth={2.2} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: th("#fff") }}>O Willo notou</Text>
                </View>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {tips.map((t) => (
                    <View key={t} style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ marginTop: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: th(INK.softer, "bg") }} />
                      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </Surface>
            )}
          </Animated.View>
        )}
      </ScrollView>

      <FixedSheet kind={adding ? "assinatura" : null} onClose={() => setAdding(false)} />
    </Room>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Surface style={{ flex: 1, padding: 14 }}>
      <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginTop: 4, fontSize: 22, fontWeight: "800", letterSpacing: -0.7, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text style={{ marginTop: 2, fontSize: 12, color: th(INK.softer) }}>{note}</Text>
    </Surface>
  );
}
