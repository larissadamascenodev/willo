import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceData } from "@/hooks/useFinanceData";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import PageHeader from "~/components/PageHeader";
import Surface from "~/components/Surface";
import CountUp from "~/components/CountUp";
import { ChevronRight, Clock, CreditCard, Plus, Sparkles, Target, Zap } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { useSpendable } from "~/lib/spendable";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Resumo do mês: the whole month in one place.
 *
 * What can be spent today, and what a spend today does to tomorrow; the month from what
 * came in to what will be left, every line of it; what an hour of work is worth against
 * it; the limits by category, with ones suggested from the month itself and made in a
 * tap; and the shortcuts that make noting things down take no time.
 */

const PAYMENT = /^(faturas?|pagamento de fatura|cart[aã]o de cr[eé]dito|saldo inicial|meta|investimento)$/i;
const TRIES = [50, 100, 200];
/* Spent a little every day — its limit follows the month's pace. Anything else (rent, bills)
   is paid at once, and its limit is what was paid with a little room. */
const DAILY = /aliment|supermerc|mercado|delivery|restaurant|cafeter|padaria|transporte|combust|uber|lazer|compras|vestu|beleza|farm|pets?/i;

interface Limit {
  category: string;
  limit_amount: number;
}

export default function Resumo() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const s = useSpendable();
  const now = useMemo(() => new Date(), []);
  const { data } = useFinanceData(now.getMonth(), now.getFullYear());
  const [tryAmount, setTryAmount] = useState<number | null>(null);
  const [limits, setLimits] = useState<Limit[]>([]);

  const loadLimits = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase.from("category_limits").select("category, limit_amount").eq("user_id", user.id);
    setLimits(((rows ?? []) as Limit[]).map((r) => ({ category: r.category, limit_amount: Number(r.limit_amount) })));
  }, [user]);
  useEffect(() => {
    void loadLimits();
  }, [loadLimits]);

  /* The month by category, and where it is heading at this pace. */
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.max(1, now.getDate());
  const categories = useMemo(() => (data.categories ?? []).filter((c) => c.amount > 0 && !PAYMENT.test(c.name.trim())).sort((a, b) => b.amount - a.amount), [data.categories]);
  const withLimit = categories.filter((c) => limits.some((l) => l.category === c.name));
  const limitedOnly = limits.filter((l) => !categories.some((c) => c.name === l.category));
  /* A suggestion: where the category is heading this month, rounded up to the next R$ 50. */
  const suggestions = categories
    .filter((c) => !limits.some((l) => l.category === c.name))
    .slice(0, 3)
    .map((c) => ({ name: c.name, spent: c.amount, suggest: Math.max(50, Math.ceil((DAILY.test(c.name) ? (c.amount / elapsed) * daysIn : c.amount * 1.1) / 50) * 50) }));

  const createLimit = async (category: string, amount: number) => {
    if (!user) return;
    void Haptics.selectionAsync().catch(() => undefined);
    const { error } = await supabase.from("category_limits").insert({ user_id: user.id, category, limit_amount: amount } as never);
    if (error) return showToast("Não consegui criar o limite agora.");
    window.dispatchEvent(new CustomEvent("finance-data-changed"));
    showToast(`Limite de ${money(amount)} para ${category}`);
    void loadLimits();
  };

  const tight = s.free <= 0;
  const leftToday = tight ? 0 : Math.max(0, s.leftToday);
  const afterTry = tryAmount !== null && s.daysLeft > 1 ? Math.max(0, s.free - tryAmount) / (s.daysLeft - 1) : null;
  const hoursToday = s.hour > 0 ? leftToday / s.hour : 0;

  return (
    <Room lit sky>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <PageHeader title="Resumo do mês" back="/" />

        {/* ══ Today ══ */}
        <Animated.View entering={FadeIn.duration(320)} style={{ marginTop: 14, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 15, color: th(INK.soft) }}>Hoje dá para gastar</Text>
          <CountUp value={leftToday} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th(tight || s.leftToday < 0 ? AMBER : "#fff"), fontVariant: ["tabular-nums"] }} />
          <Text style={{ marginTop: 2, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
            {tight
              ? "Seu mês já está no limite: o que entrar daqui para frente decide a sobra."
              : `${money(s.today)} por dia até o fim do mês · faltam ${s.daysLeft} ${s.daysLeft === 1 ? "dia" : "dias"}`}
          </Text>
          <View style={{ marginTop: 14, height: 6, borderRadius: 3, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
            <View style={{ width: `${Math.round((s.today > 0 ? Math.min(1, s.spentToday / s.today) : tight ? 1 : 0) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: th(s.leftToday < 0 || tight ? AMBER : GREEN, "bg") }} />
          </View>
          <Text style={{ marginTop: 7, fontSize: 12.5, color: th(INK.softer) }}>
            {s.spentToday > 0 ? `Gasto hoje: ${money(s.spentToday)}` : "Nada gasto hoje ainda"}
            {s.daysLeft > 1 ? ` · amanhã ${money(s.tomorrow)}/dia` : ""}
          </Text>
        </Animated.View>

        {/* ══ What a spend today does to tomorrow ══ */}
        {s.daysLeft > 1 && !tight && (
          <Animated.View entering={FadeInDown.duration(340).delay(60)}>
            <Surface style={{ marginTop: 18, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={14} color={th("#7CC4FF")} strokeWidth={2.4} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: th("#fff") }}>E se eu gastar hoje…</Text>
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                {TRIES.map((v) => {
                  const on = tryAmount === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setTryAmount(on ? null : v)}
                      style={({ pressed }) => ({ flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th(on ? "#fff" : "rgba(255,255,255,0.12)", "line"), backgroundColor: th(on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", "bg"), opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: th("#fff") }}>{money(v).replace(",00", "")}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
                {afterTry === null ? (
                  "Toque num valor para ver como fica o resto do mês."
                ) : (
                  <>
                    Gastando <Text style={{ fontWeight: "700", color: th("#fff") }}>{money(tryAmount!)}</Text> hoje, de amanhã até o fim do mês ficam{" "}
                    <Text style={{ fontWeight: "700", color: th(afterTry < s.today * 0.8 ? AMBER : "#fff") }}>{money(afterTry)} por dia</Text>
                    {afterTry < s.today ? ` — ${money(s.today - afterTry)} a menos que hoje.` : "."}
                  </>
                )}
              </Text>
            </Surface>
          </Animated.View>
        )}

        {/* ══ The month, line by line ══ */}
        <Animated.View entering={FadeInDown.duration(340).delay(100)}>
          <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>O mês até aqui</Text>
          <Surface style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
            <Line label="Entrou" value={s.received} tone={GREEN} sign="+" />
            <Line label="Ainda vai entrar" value={s.toReceive} sign="+" soft />
            <Line label="Já pago" value={s.paid} sign="−" />
            <Line label="Ainda a pagar" value={s.toPay} sign="−" soft />
            <Line label="Deve sobrar nas contas" value={s.saldoPrevisto} strong />
            {s.cardNext > 0 && <Line label="Na fatura (vence mês que vem)" value={s.cardNext} sign="−" soft />}
            {s.savings > 0 && <Line label="Guardado na poupança" value={s.savings} sign="−" soft />}
            <Line label="Livre até o fim do mês" value={s.free} strong last tone={s.free < 0 ? RED : undefined} />
          </Surface>
          <Text style={{ marginTop: 8, paddingHorizontal: 4, fontSize: 12, lineHeight: 17, color: th(INK.softer) }}>
            O que está na poupança e o que já foi para o cartão não entram no que dá para gastar.
          </Text>
        </Animated.View>

        {/* ══ What an hour of work is worth ══ */}
        <Animated.View entering={FadeInDown.duration(340).delay(140)}>
          <Surface style={{ marginTop: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(124,196,255,0.10)", "bg") }}>
              <Clock size={18} color={th("#7CC4FF")} strokeWidth={2.2} />
            </View>
            {s.hour > 0 ? (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: th(INK.soft) }}>Sua hora de trabalho vale</Text>
                <Text style={{ marginTop: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>{money(s.hour)}</Text>
                {hoursToday >= 0.5 && (
                  <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.softer) }}>
                    O que dá para gastar hoje são {hoursToday >= 1.5 ? `${Math.round(hoursToday)} horas` : "cerca de 1 hora"} do seu trabalho.
                  </Text>
                )}
              </View>
            ) : (
              <Pressable onPress={() => router.push({ pathname: "/manual", params: { tipo: "receita", fixa: "1" } } as never)} style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: th("#fff") }}>Quanto vale sua hora?</Text>
                <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>Adicione sua renda fixa e o Willo mostra cada gasto em horas de trabalho.</Text>
              </Pressable>
            )}
          </Surface>
        </Animated.View>

        {/* ══ Limits by category ══ */}
        <Animated.View entering={FadeInDown.duration(340).delay(180)}>
          <View style={{ marginTop: 26, marginBottom: 10, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={T.eyebrow}>Limites por categoria</Text>
            <Pressable onPress={() => router.push("/analytics/categorias" as never)} hitSlop={8}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>Ver todos</Text>
            </Pressable>
          </View>
          <Surface style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
            {[...withLimit.map((c) => ({ name: c.name, spent: c.amount, limit: limits.find((l) => l.category === c.name)!.limit_amount })), ...limitedOnly.map((l) => ({ name: l.category, spent: 0, limit: l.limit_amount }))].map((r, i) => {
              const share = r.limit > 0 ? r.spent / r.limit : 0;
              const Icon = categoryIcon(r.name);
              const hex = categoryHex(r.name);
              return (
                <View key={r.name} style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
                      <Icon size={14} color={th(chipInk(hex))} strokeWidth={2.2} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>{r.name}</Text>
                    <Text style={{ fontSize: 13, color: th(INK.soft), fontVariant: ["tabular-nums"] }}>
                      <Text style={{ fontWeight: "700", color: th(share > 1 ? RED : "#fff") }}>{money(r.spent)}</Text> de {money(r.limit)}
                    </Text>
                  </View>
                  <View style={{ marginTop: 8, marginLeft: 40, height: 4, borderRadius: 2, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                    <View style={{ width: `${Math.min(100, Math.round(share * 100))}%`, height: 4, borderRadius: 2, backgroundColor: th(share > 1 ? RED : share > 0.8 ? AMBER : GREEN, "bg") }} />
                  </View>
                </View>
              );
            })}
            {suggestions.map((sg, i) => {
              const Icon = categoryIcon(sg.name);
              const hex = categoryHex(sg.name);
              return (
                <View key={sg.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i === 0 && withLimit.length + limitedOnly.length === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
                    <Icon size={14} color={th(chipInk(hex))} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>{sg.name}</Text>
                    <Text style={{ marginTop: 1, fontSize: 12, color: th(INK.softer) }}>
                      {money(sg.spent)} até agora · sugestão do Willo
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void createLimit(sg.name, sg.suggest)}
                    accessibilityRole="button"
                    accessibilityLabel={`Criar limite de ${money(sg.suggest)} para ${sg.name}`}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: pressed ? 0.6 : 1 })}
                  >
                    <Plus size={13} color={th("#fff")} strokeWidth={2.4} />
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: th("#fff") }}>{money(sg.suggest).replace(",00", "")}</Text>
                  </Pressable>
                </View>
              );
            })}
            {withLimit.length + limitedOnly.length + suggestions.length === 0 && (
              <Text style={{ paddingVertical: 14, fontSize: 13.5, color: th(INK.soft) }}>Quando houver gastos no mês, o Willo sugere limites por categoria aqui.</Text>
            )}
          </Surface>
        </Animated.View>

        {/* ══ Shortcuts ready to use ══ */}
        <Animated.View entering={FadeInDown.duration(340).delay(220)}>
          <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>Atalhos prontos</Text>
          <Surface style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            <Shortcut icon={Zap} title="Registro rápido" body="Anote um gasto em 2 segundos, com toque duplo atrás do iPhone." onPress={() => router.push("/atalhos" as never)} />
            <Shortcut icon={CreditCard} title="Willo Copilot" body="Cada compra no cartão da Carteira chega sozinha para você confirmar." onPress={() => router.push("/atalhos" as never)} />
            <Shortcut icon={Target} title="Limites" body="Defina quanto quer gastar em cada categoria." onPress={() => router.push("/analytics/categorias" as never)} last />
          </Surface>
        </Animated.View>
      </ScrollView>
    </Room>
  );
}

function Line({ label, value, sign, tone, soft = false, strong = false, last = false }: { label: string; value: number; sign?: "+" | "−"; tone?: string; soft?: boolean; strong?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: strong ? 13 : 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: th(strong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)", "line") }}>
      <Text style={{ fontSize: strong ? 14.5 : 14, fontWeight: strong ? "700" : "400", color: th(strong ? "#fff" : soft ? INK.softer : INK.soft) }}>{label}</Text>
      <Text style={{ fontSize: strong ? 16 : 14, fontWeight: strong ? "800" : "600", color: th(tone ?? (soft ? INK.soft : "#fff")), fontVariant: ["tabular-nums"] }}>
        {sign ?? ""}
        {money(Math.abs(value))}
      </Text>
    </View>
  );
}

function Shortcut({ icon: Icon, title, body, onPress, last = false }: { icon: typeof Zap; title: string; body: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: th("rgba(255,255,255,0.06)", "line"), opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
        <Icon size={17} color={th("#fff")} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>{title}</Text>
        <Text style={{ marginTop: 1, fontSize: 12.5, lineHeight: 17, color: th(INK.soft) }}>{body}</Text>
      </View>
      <ChevronRight size={16} color={th(INK.faint)} />
    </Pressable>
  );
}
