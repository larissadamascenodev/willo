import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { planVsActual, type Bucket, type MethodPlan } from "@/lib/plan/financialPlan";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import CenterModal from "~/components/CenterModal";
import CountUp from "~/components/CountUp";
import { FlexBar } from "~/components/Bar";
import AgentMark from "~/components/willo/AgentMark";
import { Check, ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { usePlan } from "~/lib/usePlan";
import { setActivePlan, useActivePlan } from "~/lib/activePlan";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Meu Plano Financeiro.
 *
 * Alura's page. It starts from the person's own last months — what comes in and where
 * it goes, sorted into what keeps life running, what is a choice, what pays debts and
 * what is put aside — then lays every budgeting method over those real numbers and says
 * which fits and why. Choosing one makes it the active plan, and from then on the page
 * shows the month against it. Recommendations move with the numbers; the active plan
 * moves only when the person chooses.
 */

export const BUCKET_HEX: Record<Bucket | "livre" | "sobra", string> = {
  necessidades: "#7CC4FF",
  desejos: "#B9B0FF",
  dividas: "#F9A8D4",
  guardar: GREEN,
  livre: "#ECECEF",
  sobra: "rgba(255,255,255,0.16)",
};
const BUCKET_LABEL: Record<Bucket, string> = { necessidades: "Essencial", desejos: "Escolhas", dividas: "Dívidas", guardar: "Guardado" };

export default function Plano() {
  const insets = useSafeAreaInsets();
  const { loading, profile, methods, current } = usePlan();
  const active = useActivePlan();
  const [open, setOpen] = useState<MethodPlan | null>(null);

  const chosen = active ? methods.find((m) => m.id === active.method) ?? null : null;
  const best = methods[0];
  const others = methods.filter((m) => m.id !== (chosen ?? best)?.id);

  return (
    <Room lit sky>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton to="/" />
        </View>
        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Meu Plano Financeiro</Text>
        <View style={{ marginTop: 6, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AgentMark hex="#5EEAD4" size={16} />
          <Text style={{ fontSize: 13, color: INK.soft }}>Feito pela Alura, do Willo, com seus números dos últimos meses</Text>
        </View>

        {loading ? (
          <View style={{ marginTop: 24, gap: 14 }}>
            <View style={{ height: 120, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 220, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.03)" }} />
          </View>
        ) : !profile || profile.incomeAvg <= 0 ? (
          <Text style={{ marginTop: 40, textAlign: "center", fontSize: 15, lineHeight: 21, color: INK.soft, paddingHorizontal: 24 }}>
            Ainda não há receitas registradas nos últimos meses. Registre o que você recebe e o Willo monta o seu plano.
          </Text>
        ) : (
          <>
            {/* ══ Your reality ══ */}
            <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 26, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 13, color: INK.soft }}>Renda média por mês</Text>
              <CountUp value={profile.incomeAvg} style={{ marginTop: 4, fontSize: 40, fontWeight: "800", letterSpacing: -1.5, color: "#fff" }} />
              <Text style={{ marginTop: 2, fontSize: 13, color: profile.leftoverAvg < 0 ? RED : INK.softer }}>
                {profile.leftoverAvg >= 0 ? `sobram ${money(profile.leftoverAvg)} em média` : `faltam ${money(-profile.leftoverAvg)} em média`}
                {profile.incomeSwing > 0.25 ? " · renda variável" : ""}
              </Text>

              <View style={{ marginTop: 16, flexDirection: "row", height: 10, gap: 3 }}>
                {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) =>
                  profile.byBucket[b] > 0 ? <FlexBar key={b} share={profile.byBucket[b] / Math.max(profile.incomeAvg, profile.spendingAvg)} color={BUCKET_HEX[b]} minWidth={6} /> : null,
                )}
                {profile.leftoverAvg > 0 && <FlexBar share={profile.leftoverAvg / profile.incomeAvg} color={BUCKET_HEX.sobra} />}
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", rowGap: 10, columnGap: 16 }}>
                {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => (
                  <View key={b} style={{ minWidth: "44%" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BUCKET_HEX[b] }} />
                      <Text style={{ fontSize: 12, color: INK.softer }}>{BUCKET_LABEL[b]}</Text>
                    </View>
                    <Text style={{ marginTop: 2, fontSize: 15, fontWeight: "700", color: "#fff" }}>
                      {money(profile.byBucket[b])} <Text style={{ fontSize: 12, fontWeight: "500", color: INK.softer }}>{Math.round((profile.byBucket[b] / profile.incomeAvg) * 100)}%</Text>
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18, color: INK.soft }}>
                Reserva guardada: <Text style={{ fontWeight: "700", color: "#fff" }}>{money(profile.saved)}</Text>
                {profile.byBucket.necessidades > 0 ? `, cobre ${profile.reserveMonths.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mês(es) do essencial` : ""}.
              </Text>
            </Animated.View>

            {/* ══ The plan: the active one against this month, or the recommendation ══ */}
            {chosen && current ? (
              <Animated.View entering={FadeInDown.delay(80).duration(380)} style={{ marginTop: 30 }}>
                <View style={{ paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={T.eyebrow}>Plano ativo · {chosen.label}</Text>
                  <Text style={{ fontSize: 11.5, color: INK.faint }}>desde {new Date(`${active!.since}T12:00:00`).toLocaleDateString("pt-BR")}</Text>
                </View>
                <Text style={{ marginTop: 6, paddingHorizontal: 4, fontSize: 13.5, color: INK.soft }}>Este mês até agora</Text>
                <View style={{ marginTop: 10, gap: 14, paddingHorizontal: 4 }}>
                  {planVsActual(chosen, current).map((r, i) => {
                    const share = r.planned > 0 ? Math.min(r.spent / r.planned, 1) : 0;
                    return (
                      <View key={r.label}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                          <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>{r.label}</Text>
                          <Text style={{ fontSize: 13, color: r.over ? RED : INK.soft }}>
                            {money(r.spent)} de {money(r.planned)}
                          </Text>
                        </View>
                        <View style={{ marginTop: 6, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
                          <View style={{ width: `${share * 100}%`, height: 6, borderRadius: 3, backgroundColor: r.over ? RED : BUCKET_HEX[chosen.allocations[i]?.bucket ?? "livre"] }} />
                        </View>
                        <Text style={{ marginTop: 4, fontSize: 11.5, color: r.over ? RED : INK.softer }}>
                          {r.over ? `passou ${money(-r.left)}` : `restam ${money(r.left)}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : best ? (
              <Animated.View entering={FadeInDown.delay(80).duration(380)} style={{ marginTop: 30 }}>
                <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Plano recomendado</Text>
                <MethodCard method={best} highlight onPress={() => setOpen(best)} />
              </Animated.View>
            ) : null}

            {/* ══ Every other method, over the same numbers ══ */}
            <Text style={[T.eyebrow, { marginTop: 30, paddingHorizontal: 4 }]}>{chosen ? "Outros métodos" : "Outros jeitos de organizar"}</Text>
            <View style={{ marginTop: 6 }}>
              {others.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setOpen(m)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "rgba(255,255,255,0.06)", opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{m.label}</Text>
                    <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>{m.why}</Text>
                  </View>
                  <FitBadge fit={m.fit} />
                  <ChevronRight size={16} color={INK.softer} />
                </Pressable>
              ))}
            </View>

            <Text style={{ marginTop: 22, paddingHorizontal: 4, fontSize: 12, lineHeight: 17, color: INK.faint }}>
              As recomendações mudam conforme seus números mudam. O plano ativo só muda quando você escolher outro.
            </Text>
          </>
        )}
      </ScrollView>

      <CenterModal open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ""} subtitle={open ? `Encaixe com você: ${open.fit}%` : undefined}>
        {open && (
          <View>
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: "rgba(255,255,255,0.88)" }}>{open.how}</Text>
            <View style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "rgba(94,234,212,0.08)" }}>
              <Text style={{ fontSize: 13.5, lineHeight: 19, color: "#fff" }}>{open.why}</Text>
            </View>
            <Allocations method={open} />
            <Text style={[T.eyebrow, { marginTop: 18, fontSize: 11 }]}>Vantagens</Text>
            {open.pros.map((p) => (
              <Text key={p} style={{ marginTop: 6, fontSize: 13.5, color: INK.soft }}>+ {p}</Text>
            ))}
            <Text style={[T.eyebrow, { marginTop: 14, fontSize: 11 }]}>Cuidados</Text>
            {open.cons.map((c) => (
              <Text key={c} style={{ marginTop: 6, fontSize: 13.5, color: INK.soft }}>− {c}</Text>
            ))}
            <Text style={{ marginTop: 14, fontSize: 12.5, color: INK.softer }}>Indicado para: {open.forWho}</Text>
            <Pressable
              onPress={() => {
                setActivePlan(active?.method === open.id ? null : open.id);
                setOpen(null);
              }}
              style={({ pressed }) => ({ marginTop: 18, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: active?.method === open.id ? "rgba(255,255,255,0.10)" : "#fff", opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: active?.method === open.id ? "#fff" : "#0B0B0B" }}>
                {active?.method === open.id ? "Deixar de usar este plano" : "Usar este plano"}
              </Text>
            </Pressable>
          </View>
        )}
      </CenterModal>
    </Room>
  );
}

function FitBadge({ fit }: { fit: number }) {
  const tone = fit >= 75 ? GREEN : fit >= 50 ? "#F9CE4E" : INK.softer;
  return (
    <View style={{ paddingHorizontal: 8, height: 24, borderRadius: 12, justifyContent: "center", backgroundColor: `${typeof tone === "string" && tone.startsWith("#") ? tone : "#FFFFFF"}1F` }}>
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: tone }}>{fit}%</Text>
    </View>
  );
}

function Allocations({ method }: { method: MethodPlan }) {
  return (
    <View style={{ marginTop: 14, gap: 12 }}>
      {method.allocations.map((a) => (
        <View key={a.label}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BUCKET_HEX[a.bucket] }} />
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{a.label}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{money(a.amount)}</Text>
          </View>
          <Text style={{ marginTop: 2, fontSize: 11.5, color: a.today > a.amount + 0.5 && a.bucket !== "guardar" ? RED : INK.softer }}>
            {Math.round(a.share * 100)}% · hoje você usa {money(a.today)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MethodCard({ method, highlight, onPress }: { method: MethodPlan; highlight?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ marginTop: 10, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <View style={{ padding: 16, borderRadius: 24, borderCurve: "continuous", borderWidth: 1, borderColor: highlight ? "rgba(94,234,212,0.35)" : "rgba(255,255,255,0.08)", backgroundColor: highlight ? "rgba(94,234,212,0.06)" : "rgba(255,255,255,0.04)" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>{method.label}</Text>
          <FitBadge fit={method.fit} />
        </View>
        <Text style={{ marginTop: 6, fontSize: 13.5, lineHeight: 19, color: INK.soft }}>{method.why}</Text>
        <Allocations method={method} />
        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Check size={14} color={GREEN} strokeWidth={3} />
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>Ver detalhes e usar este plano</Text>
        </View>
      </View>
    </Pressable>
  );
}
