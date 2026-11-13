import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { useRecorrentes, type RecurringItem } from "@/hooks/useRecorrentes";
import Room from "~/components/Room";
import PageHeader from "~/components/PageHeader";
import Surface from "~/components/Surface";
import RoundButton from "~/components/RoundButton";
import SubLogo from "~/components/SubLogo";
import CountUp from "~/components/CountUp";
import FixedSheet from "~/components/home/FixedSheet";
import SubscriptionSheet from "~/components/assinaturas/SubscriptionSheet";
import { ChevronRight, Clock, Layers, Plus, Sparkles, TrendingDown, Zap } from "~/components/icons";
import { nextCharge, subscriptionInsights, type InsightKind } from "~/lib/subscriptionInsights";
import { knownSub } from "~/lib/subscriptionLogos";
import { money } from "~/lib/money";
import { AMBER, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Assinaturas.
 *
 * What they take, at the top: the month's figure, the year's under it, and one bar split
 * in each service's own colour so the weight of each is seen before any number is read.
 * Then what the Willo makes of them — with figures, and a question ready for the
 * conversation — the charges coming up as a short timeline, and every subscription with
 * its share. A tap opens one over the page: what it has cost so far, a year of it, and
 * what cancelling would leave.
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brandHex = (name: string) => { const k = knownSub(name); return k?.accent ?? k?.hex ?? "#B48CFF"; };
const ICON: Record<InsightKind, typeof Clock> = { time: Clock, overlap: Layers, plan: TrendingDown, weight: Zap, year: Sparkles };

export default function Assinaturas() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { assinaturas, totalAssinaturas, receitasFixas, loading } = useRecorrentes();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<RecurringItem | null>(null);
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

  const income = useMemo(() => receitasFixas.reduce((t, r) => t + r.amount, 0), [receitasFixas]);
  const byWeight = useMemo(() => [...assinaturas].sort((a, b) => b.amount - a.amount), [assinaturas]);
  const coming = useMemo(
    () =>
      [...assinaturas]
        .map((s) => ({ s, at: nextCharge(s.dueDay, s.startsOn) }))
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .slice(0, 4),
    [assinaturas],
  );
  const insights = useMemo(() => subscriptionInsights(assinaturas, income), [assinaturas, income]);
  const placeOf = (s: RecurringItem) => (s.cardId && names[s.cardId]) || (s.accountId && names[s.accountId]) || null;
  const ask = (q: string) => router.push({ pathname: "/registro", params: { ask: q } } as never);
  const n = assinaturas.length;
  const total = totalAssinaturas;

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
          <View style={{ marginTop: 18, gap: 14, paddingHorizontal: 4 }}>
            <View style={{ height: 18, width: 120, borderRadius: 6, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />
            <View style={{ height: 48, width: 220, borderRadius: 10, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />
            <View style={{ marginTop: 8, height: 10, borderRadius: 5, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }} />
            <View style={{ marginTop: 8, height: 160, borderRadius: 22, backgroundColor: th("rgba(255,255,255,0.03)", "bg") }} />
          </View>
        ) : n === 0 ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 56, alignItems: "center", paddingHorizontal: 28 }}>
            <View style={{ flexDirection: "row" }}>
              {["Netflix", "Spotify", "iCloud"].map((nm, i) => (
                <View key={nm} style={{ marginLeft: i === 0 ? 0 : -12, borderRadius: 999, borderWidth: 2, borderColor: th("#121315", "line") }}>
                  <SubLogo name={nm} size={46} round />
                </View>
              ))}
            </View>
            <Text style={{ marginTop: 18, fontSize: 18, fontWeight: "700", color: th("#fff") }}>Quanto custam suas assinaturas?</Text>
            <Text style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
              Adicione streaming, música, nuvem, academia. O Willo soma por mês e por ano, avisa antes de cada cobrança e mostra onde dá para economizar.
            </Text>
            <Pressable
              onPress={() => setAdding(true)}
              style={({ pressed }) => ({ marginTop: 22, height: 50, paddingHorizontal: 24, borderRadius: 25, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
            >
              <Plus size={18} color={th("#0B0B0B")} strokeWidth={2.4} />
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>Adicionar assinatura</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* ══ What they take ══ */}
            <Animated.View entering={FadeIn.duration(320)} style={{ marginTop: 14, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 15, color: th(INK.soft) }}>Você paga por mês</Text>
              <CountUp value={total} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff"), fontVariant: ["tabular-nums"] }} />
              <Text style={{ marginTop: 2, fontSize: 14.5, color: th(INK.soft) }}>
                <Text style={{ fontWeight: "700", color: th("#fff") }}>{money(total * 12)}</Text> por ano · {n} {n === 1 ? "assinatura" : "assinaturas"}
              </Text>

              {/* One bar, each service in its own colour, as wide as its share. */}
              <View style={{ marginTop: 18, height: 10, flexDirection: "row", gap: 3 }}>
                {byWeight.map((s) => (
                  <View key={s.id} style={{ flexGrow: s.amount, flexBasis: 0, minWidth: 6, borderRadius: 999, backgroundColor: th(brandHex(s.name), "bg") }} />
                ))}
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
                {byWeight.slice(0, 4).map((s) => (
                  <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(brandHex(s.name), "bg") }} />
                    <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>
                      {knownSub(s.name)?.name ?? s.name} <Text style={{ fontWeight: "700", color: th("#fff") }}>{Math.round((s.amount / total) * 100)}%</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* ══ What the Willo makes of them ══ */}
            {insights.length > 0 && (
              <Animated.View entering={FadeInDown.duration(360).delay(80)}>
                <View style={{ marginTop: 26, marginBottom: 10, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Sparkles size={14} color={th("#7CC4FF")} strokeWidth={2.4} />
                  <Text style={[T.eyebrow, { color: th("#7CC4FF") }]}>Inteligência Willo</Text>
                </View>
                <Surface style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                  {insights.map((it, i) => {
                    const Icon = ICON[it.kind];
                    return (
                      <View key={it.kind + i} style={{ paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(124,196,255,0.10)", "bg") }}>
                            <Icon size={16} color={th("#7CC4FF")} strokeWidth={2.2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 15, color: th(INK.soft) }}>
                              <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: th("#fff") }}>{it.figure}</Text> {it.title}
                            </Text>
                            <Text style={{ marginTop: 4, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{it.body}</Text>
                            {it.ask && (
                              <Pressable
                                onPress={() => ask(it.ask!)}
                                accessibilityRole="button"
                                style={({ pressed }) => ({ marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: th("rgba(255,255,255,0.07)", "bg"), opacity: pressed ? 0.6 : 1 })}
                              >
                                <Text style={{ fontSize: 12.5, fontWeight: "600", color: th("#fff") }}>Perguntar ao Willo</Text>
                                <ChevronRight size={13} color={th(INK.soft)} />
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </Surface>
              </Animated.View>
            )}

            {/* ══ What comes next ══ */}
            <Animated.View entering={FadeInDown.duration(360).delay(140)}>
              <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>Próximas cobranças</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
                {coming.map(({ s, at }) => {
                  const days = Math.floor((at.getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
                  const soon = days <= 2;
                  return (
                    <Pressable key={s.id} onPress={() => setOpen(s)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      <Surface style={{ width: 150, padding: 14 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <SubLogo name={s.name} size={32} round />
                          <View style={{ alignItems: "center", width: 40, paddingVertical: 4, borderRadius: 10, backgroundColor: th(soon ? "rgba(249,206,78,0.14)" : "rgba(255,255,255,0.07)", "bg") }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", lineHeight: 17, color: th(soon ? AMBER : "#fff") }}>{at.getDate()}</Text>
                            <Text style={{ fontSize: 10, fontWeight: "600", color: th(INK.softer) }}>{MONTHS[at.getMonth()]}</Text>
                          </View>
                        </View>
                        <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 14, fontWeight: "700", color: th("#fff") }}>
                          {knownSub(s.name)?.name ?? s.name}
                        </Text>
                        <Text style={{ marginTop: 1, fontSize: 12, color: th(soon ? AMBER : INK.soft) }}>{days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}</Text>
                        <Text style={{ marginTop: 6, fontSize: 15, fontWeight: "800", color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(s.amount)}</Text>
                      </Surface>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* ══ Every one, with its share ══ */}
            <Animated.View entering={FadeInDown.duration(360).delay(200)}>
              <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>Todas</Text>
              <Surface style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                {byWeight.map((s, i) => {
                  const place = placeOf(s);
                  const share = s.amount / total;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setOpen(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name}, ${money(s.amount)} por mês`}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line"), opacity: pressed ? 0.6 : 1 })}
                    >
                      <SubLogo name={s.name} size={44} round />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>
                          {knownSub(s.name)?.name ?? s.name}
                        </Text>
                        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
                          dia {s.dueDay}
                          {place ? ` · ${place.card ? "Cartão" : "Conta"} ${place.name}` : ""}
                        </Text>
                        <View style={{ marginTop: 7, height: 4, borderRadius: 2, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
                          <View style={{ width: `${Math.max(4, share * 100)}%`, height: 4, borderRadius: 2, backgroundColor: th(brandHex(s.name), "bg") }} />
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(s.amount)}</Text>
                        <Text style={{ marginTop: 2, fontSize: 11.5, color: th(INK.softer), fontVariant: ["tabular-nums"] }}>{money(s.amount * 12)}/ano</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </Surface>
              <Text style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: th(INK.softer) }}>Toque numa assinatura para ver o histórico, editar ou cancelar.</Text>
            </Animated.View>
          </>
        )}
      </ScrollView>

      <SubscriptionSheet item={open} place={open ? placeOf(open) : null} income={income} onClose={() => setOpen(null)} />
      <FixedSheet kind={adding ? "assinatura" : null} onClose={() => setAdding(false)} />
    </Room>
  );
}
