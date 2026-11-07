import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { Bucket, MethodPlan } from "@/lib/plan/financialPlan";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import RoundButton from "~/components/RoundButton";
import WilloBot from "~/components/willo/WilloBot";
import { Toggle } from "~/components/registro/entryParts";
import { AlertTriangle, Banknote, ChartPie, Check, ChevronLeft, ChevronRight, CircleCheck, Info, Layers, PiggyBank, Sparkles, Target, Wallet } from "~/components/icons";
import { money } from "~/lib/money";
import { usePlan } from "~/lib/usePlan";
import { useAuth } from "~/lib/auth";
import { syncDeviceNotifications } from "~/lib/deviceNotifications";
import { planAlertsWanted, setActivePlan, setPlanAlertsWanted, useActivePlan } from "~/lib/activePlan";
import { BUCKET_GUIDE, PLAN_GUIDE, type GuideIcon } from "~/lib/planGuide";
import { HEALTH_HEX, HEALTH_LABEL, planStatus, type PlanStatus } from "~/lib/planStatus";
import { GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Meu Plano — the person's financial organisation.
 *
 * Read top to bottom it answers, in order: what is my plan and how is this month going
 * (the hero, in the plan's own colour), what is it built on (only the income that comes
 * in every month for certain), where does my money go today, how each part of the plan
 * is doing, what Willo is watching for, and — for choosing or changing — every plan
 * explained plainly, laid over the person's own numbers, with a table of how they
 * differ. A plan opens on a page of its own: how it works in three steps, what it means
 * in reais for this person, the good and the care it asks, and the button to use it.
 */

export const BUCKET_HEX: Record<Bucket | "livre" | "sobra", string> = {
  necessidades: "#7CC4FF",
  desejos: "#B9B0FF",
  dividas: "#F9A8D4",
  guardar: GREEN,
  livre: "#ECECEF",
  sobra: "rgba(255,255,255,0.16)",
};
const BUCKETS: Bucket[] = ["necessidades", "desejos", "dividas", "guardar"];

const ICONS: Record<GuideIcon, typeof Target> = { pie: ChartPie, piggy: PiggyBank, target: Target, wallet: Wallet, layers: Layers, waves: Banknote };

export default function Plano() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loading, profile, methods, current } = usePlan();
  const active = useActivePlan();
  const [open, setOpen] = useState<MethodPlan | null>(null);
  const [alertsOn, setAlertsOn] = useState(planAlertsWanted());
  const { user } = useAuth();
  /* Willo's alerts are laid out again whenever the plan or the wish for them changes. */
  const resync = () => setTimeout(() => void syncDeviceNotifications(user?.id), 50);

  const chosen = active ? (methods.find((m) => m.id === active.method) ?? null) : null;
  const best = methods[0] ?? null;
  const status = chosen && current ? planStatus(chosen, current) : null;
  const ask = (q: string) => router.push(`/registro?ask=${encodeURIComponent(q)}` as never);

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton to="/" />
        </View>
        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Meu plano</Text>
        <Text style={{ marginTop: 4, paddingHorizontal: 4, fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>Um jeito de organizar sua renda fixa, escolhido para você e acompanhado pelo Willo.</Text>

        {loading ? (
          <View style={{ marginTop: 22, gap: 14 }}>
            <View style={{ height: 220, borderRadius: 30, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }} />
            <View style={{ height: 130, borderRadius: 24, backgroundColor: th("rgba(255,255,255,0.04)", "bg") }} />
          </View>
        ) : !profile || profile.incomeAvg <= 0 ? (
          <Surface style={{ marginTop: 22 }}>
            <View style={{ padding: 22, alignItems: "center" }}>
              <WilloBot size={84} />
              <Text style={{ marginTop: 10, fontSize: 19, fontWeight: "800", color: th("#fff"), textAlign: "center" }}>Seu plano começa pela renda</Text>
              <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 21, color: th(INK.soft), textAlign: "center" }}>
                Registre o que você recebe todo mês, como salário, e marque como receita fixa. Com isso o Willo monta o plano ideal para você.
              </Text>
              <Pressable onPress={() => router.push("/novo" as never)} style={({ pressed }) => ({ marginTop: 16, height: 48, paddingHorizontal: 22, borderRadius: 24, justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: th("#0B0B0B") }}>Registrar minha renda</Text>
              </Pressable>
            </View>
          </Surface>
        ) : (
          <>
            {/* ══ The plan, and how the month is going ══ */}
            <Animated.View entering={FadeInDown.duration(420)} style={{ marginTop: 20 }}>
              {chosen && status ? (
                <ActiveHero plan={chosen} status={status} since={active!.since} onDetails={() => setOpen(chosen)} onAsk={() => ask(`Como estou indo no meu plano ${chosen.label} este mês?`)} />
              ) : best ? (
                <RecommendHero plan={best} onOpen={() => setOpen(best)} onAsk={() => ask(`Por que o plano ${best.label} é o melhor para mim?`)} />
              ) : null}
            </Animated.View>

            {/* ══ What the plan is built on ══ */}
            <Animated.View entering={FadeInDown.delay(60).duration(420)}>
              <Section title="Sua base" />
              <Surface>
                <View style={{ padding: 18 }}>
                  <Text style={{ fontSize: 13, color: th(INK.soft) }}>{profile.baseSource === "fixa" ? "Renda fixa por mês" : profile.baseSource === "menor" ? "Seu mês mais fraco" : "Sua renda média"}</Text>
                  <Text style={{ marginTop: 2, fontSize: 34, fontWeight: "800", letterSpacing: -1.2, color: th("#fff") }}>{money(profile.base)}</Text>
                  <View style={{ marginTop: 12, flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 16, backgroundColor: th(profile.baseSource === "fixa" ? "rgba(103,205,103,0.10)" : "rgba(245,184,61,0.12)", "bg") }}>
                    {profile.baseSource === "fixa" ? <CircleCheck size={17} color={th(GREEN)} strokeWidth={2.2} /> : <AlertTriangle size={17} color={th("#F5B83D")} strokeWidth={2.2} />}
                    <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: th("rgba(255,255,255,0.86)") }}>
                      {profile.baseSource === "fixa"
                        ? "O plano usa só o que entra todo mês com certeza. Rendas extras não entram na conta: quando vierem, o ideal é mandar para a reserva."
                        : "Nenhuma receita está marcada como fixa. Por segurança, o plano usa o seu mês mais fraco. Marque o salário como receita fixa para um plano mais preciso."}
                    </Text>
                  </View>
                  {profile.incomeAvg > profile.base + 1 && (
                    <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: th(INK.softer) }}>
                      Em média entraram {money(profile.incomeAvg)} por mês. A diferença de {money(profile.incomeAvg - profile.base)} é renda extra e fica fora do plano.
                    </Text>
                  )}
                </View>
              </Surface>
            </Animated.View>

            {/* ══ Where the money goes today ══ */}
            <Animated.View entering={FadeInDown.delay(100).duration(420)}>
              <Section title="Para onde vai seu dinheiro" hint="Média dos últimos meses" />
              <Surface>
                <View style={{ padding: 18 }}>
                  <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 }}>
                    {BUCKETS.map((b) => (profile.byBucket[b] > 0 ? <View key={b} style={{ flex: profile.byBucket[b], backgroundColor: th(BUCKET_HEX[b], "bg") }} /> : null))}
                    {profile.base - profile.spendingAvg > 0 && <View style={{ flex: profile.base - profile.spendingAvg, backgroundColor: th("rgba(255,255,255,0.1)", "bg") }} />}
                  </View>
                  <View style={{ marginTop: 16, gap: 14 }}>
                    {BUCKETS.map((b) => (
                      <View key={b} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: th(BUCKET_HEX[b], "bg") }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>{BUCKET_GUIDE[b].label}</Text>
                          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.softer) }}>{BUCKET_GUIDE[b].hint}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>{money(profile.byBucket[b])}</Text>
                          <Text style={{ fontSize: 12, color: th(INK.softer) }}>{profile.base > 0 ? Math.round((profile.byBucket[b] / profile.base) * 100) : 0}% da renda</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: th(INK.soft) }}>{profile.base - profile.spendingAvg >= 0 ? "Sobra por mês" : "Falta por mês"}</Text>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: th(profile.base - profile.spendingAvg >= 0 ? GREEN : "#F87171") }}>{money(Math.abs(profile.base - profile.spendingAvg))}</Text>
                  </View>
                </View>
              </Surface>
            </Animated.View>

            {/* ══ The plan, part by part, this month ══ */}
            {chosen && status && (
              <Animated.View entering={FadeInDown.delay(140).duration(420)}>
                <Section title="Este mês no plano" hint={`${status.daysLeft} ${status.daysLeft === 1 ? "dia restante" : "dias restantes"}`} />
                <Surface>
                  <View style={{ padding: 18, gap: 18 }}>
                    {status.rows.map((r) => {
                      const tone = r.saving ? GREEN : r.over ? "#F87171" : r.share >= 0.8 ? "#F5B83D" : BUCKET_HEX[r.bucket];
                      return (
                        <View key={r.label}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "700", color: th("#fff") }}>{r.label}</Text>
                            <Text style={{ fontSize: 13, color: th(INK.soft) }}>
                              <Text style={{ fontWeight: "700", color: th("#fff") }}>{money(r.spent)}</Text> de {money(r.planned)}
                            </Text>
                          </View>
                          <View style={{ marginTop: 8, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                            <View style={{ width: `${Math.min(1, r.share) * 100}%`, height: 8, borderRadius: 4, backgroundColor: th(tone, "bg") }} />
                          </View>
                          <Text style={{ marginTop: 5, fontSize: 12.5, color: th(r.saving ? (r.spent >= r.planned ? GREEN : INK.softer) : r.over ? "#F87171" : INK.softer) }}>
                            {r.saving
                              ? r.spent >= r.planned
                                ? "Meta de guardar cumprida"
                                : `Faltam ${money(r.planned - r.spent)} para guardar`
                              : r.over
                                ? `Passou ${money(-r.left)}`
                                : `Restam ${money(r.left)}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Surface>
              </Animated.View>
            )}

            {/* ══ What Willo is watching for ══ */}
            {chosen && status && (
              <Animated.View entering={FadeInDown.delay(180).duration(420)}>
                <Section title="Willo de olho" />
                <Surface>
                  <View style={{ padding: 18 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <WilloBot size={46} />
                      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>Acompanho o seu mês e aviso quando alguma parte do plano precisar de cuidado.</Text>
                    </View>
                    <View style={{ marginTop: 14, gap: 10 }}>
                      {status.alerts.map((a) => {
                        const hue = a.tone === "ok" ? GREEN : a.tone === "warn" ? "#F5B83D" : "#F87171";
                        return (
                          <View key={a.title} style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, backgroundColor: th(a.tone === "ok" ? "rgba(103,205,103,0.08)" : a.tone === "warn" ? "rgba(245,184,61,0.10)" : "rgba(248,113,113,0.10)", "bg") }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: th(hue, "bg") }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>{a.title}</Text>
                              <Text style={{ marginTop: 3, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>{a.body}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>Avisos no celular</Text>
                        <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.softer) }}>Quando algo sair do ritmo e um resumo toda segunda</Text>
                      </View>
                      <Toggle
                        value={alertsOn}
                        label="Avisos do plano no celular"
                        onChange={(on) => {
                          setAlertsOn(on);
                          setPlanAlertsWanted(on);
                          resync();
                        }}
                      />
                    </View>
                  </View>
                </Surface>
              </Animated.View>
            )}

            {/* ══ Every plan, plainly ══ */}
            <Animated.View entering={FadeInDown.delay(220).duration(420)}>
              <Section title={chosen ? "Trocar de plano" : "Escolha seu plano"} hint="Ordenados pelo que mais combina com você" />
              <View style={{ gap: 12 }}>
                {methods.map((m) => (
                  <PlanRowCard key={m.id} plan={m} active={chosen?.id === m.id} recommended={m.id === best?.id} onPress={() => setOpen(m)} />
                ))}
              </View>
            </Animated.View>

            {/* ══ How they differ ══ */}
            <Animated.View entering={FadeInDown.delay(260).duration(420)}>
              <Section title="Qual a diferença?" />
              <Surface>
                <View style={{ paddingVertical: 6 }}>
                  <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ flex: 1.5, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, color: th(INK.softer) }}>PLANO</Text>
                    <Text style={{ flex: 1, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, color: th(INK.softer) }}>FOCO</Text>
                    <Text style={{ width: 62, textAlign: "right", fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, color: th(INK.softer) }}>ESFORÇO</Text>
                  </View>
                  {methods.map((m) => {
                    const g = PLAN_GUIDE[m.id];
                    return (
                      <Pressable key={m.id} onPress={() => setOpen(m)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.06)", "line"), opacity: pressed ? 0.7 : 1 })}>
                        <View style={{ flex: 1.5, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 14 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.hue[1] }} />
                          <Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 13.5, fontWeight: "700", color: th("#fff") }}>{g.short}</Text>
                        </View>
                        <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, color: th(INK.soft) }}>{g.focus}</Text>
                        <EffortDots effort={g.effort} />
                      </Pressable>
                    );
                  })}
                </View>
              </Surface>
            </Animated.View>

            <View style={{ marginTop: 22, flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
              <Info size={14} color={th(INK.faint)} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: th(INK.faint) }}>
                As recomendações acompanham os seus números e mudam quando eles mudam. O plano ativo só muda quando você escolher outro.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <PlanSheet
        plan={open}
        active={!!open && active?.method === open.id}
        recommended={!!open && open.id === best?.id}
        onClose={() => setOpen(null)}
        onUse={(m) => {
          setActivePlan(active?.method === m.id ? null : m.id);
          setOpen(null);
          resync();
        }}
      />
    </Room>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────────── */

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ marginTop: 28, marginBottom: 10, paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <Text style={T.eyebrow}>{title}</Text>
      {hint ? <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: th(INK.softer) }}>{hint}</Text> : null}
    </View>
  );
}

export function PlanIcon({ icon, hue, size = 44 }: { icon: GuideIcon; hue: [string, string, string]; size?: number }) {
  const Icon = ICONS[icon];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, borderCurve: "continuous", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <LinearGradient colors={[hue[1], hue[2]]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ zIndex: 1 }}>
        <Icon size={size * 0.46} color="#FFFFFF" strokeWidth={2.1} />
      </View>
    </View>
  );
}

function EffortDots({ effort }: { effort: "Baixo" | "Médio" | "Alto" }) {
  const n = effort === "Baixo" ? 1 : effort === "Médio" ? 2 : 3;
  return (
    <View style={{ width: 62, alignItems: "flex-end" }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ width: 12, height: 5, borderRadius: 3, backgroundColor: th(i <= n ? "#fff" : "rgba(255,255,255,0.14)", "bg") }} />
        ))}
      </View>
      <Text style={{ marginTop: 4, fontSize: 11, color: th(INK.softer) }}>{effort}</Text>
    </View>
  );
}

/** A thin split of the plan's parts, each in its colour. */
export function SplitBar({ plan, height = 8, onDark = false }: { plan: MethodPlan; height?: number; onDark?: boolean }) {
  const total = plan.allocations.reduce((s, a) => s + a.share, 0) || 1;
  return (
    <View style={{ flexDirection: "row", height, borderRadius: height / 2, overflow: "hidden", gap: 2 }}>
      {plan.allocations.map((a) =>
        a.share > 0 ? <View key={a.label} style={{ flex: a.share / total, backgroundColor: onDark ? BUCKET_HEX[a.bucket] : th(BUCKET_HEX[a.bucket], "bg") }} /> : null,
      )}
    </View>
  );
}

/** A ring of how much of what can be spent this month is already spent. */
function UsedRing({ used, size, color }: { used: number; size: number; color: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, used));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.16)" strokeWidth={7} fill="none" />
      {v > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />}
    </Svg>
  );
}

/** The hero for a plan in use: its colour, how the month is going, what is left a day. */
function ActiveHero({ plan, status, since, onDetails, onAsk }: { plan: MethodPlan; status: PlanStatus; since: string; onDetails: () => void; onAsk: () => void }) {
  const g = PLAN_GUIDE[plan.id];
  const spendable = status.rows.filter((r) => !r.saving);
  const planned = spendable.reduce((s, r) => s + r.planned, 0);
  const spent = spendable.reduce((s, r) => s + r.spent, 0);
  const used = planned > 0 ? spent / planned : 0;
  const hue = HEALTH_HEX[status.health];
  return (
    <View style={{ borderRadius: 30, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
      <LinearGradient colors={[g.hue[2], "#0E0F14"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={[`${g.hue[1]}55`, "transparent"]} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.7 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <PlanIcon icon={g.icon} hue={g.hue} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)" }}>SEU PLANO</Text>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 21, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>{plan.label}</Text>
          </View>
          <View style={{ height: 28, paddingHorizontal: 11, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,11,13,0.45)", borderWidth: 1, borderColor: `${hue}66` }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: hue }} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{HEALTH_LABEL[status.health]}</Text>
          </View>
        </View>

        <View style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 18 }}>
          <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
            <UsedRing used={used} size={96} color={used > 1 ? "#F87171" : g.hue[0]} />
            <View style={{ position: "absolute", alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>{Math.round(Math.min(used, 9.99) * 100)}%</Text>
              <Text style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)" }}>usado</Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.66)" }}>Livre para gastar este mês</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2, fontSize: 30, fontWeight: "800", letterSpacing: -1, color: "#fff" }}>{money(status.free)}</Text>
            <Text style={{ marginTop: 2, fontSize: 13.5, color: "rgba(255,255,255,0.78)" }}>
              <Text style={{ fontWeight: "800", color: "#fff" }}>{money(status.perDay)}</Text> por dia · {status.daysLeft} {status.daysLeft === 1 ? "dia" : "dias"}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <SplitBar plan={plan} height={6} onDark />
          <Text style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Desde {new Date(`${since}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} · sobre {money(plan.base)} de renda fixa</Text>
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
          <Pressable onPress={onAsk} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", opacity: pressed ? 0.85 : 1 })}>
            <Sparkles size={16} color="#0B0B0B" strokeWidth={2.2} />
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#0B0B0B" }}>Perguntar ao Willo</Text>
          </Pressable>
          <Pressable onPress={onDetails} style={({ pressed }) => ({ height: 46, paddingHorizontal: 18, borderRadius: 23, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>Como funciona</Text>
          </Pressable>
        </View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
    </View>
  );
}

/** The hero with no plan yet: the one that fits best, and why. */
function RecommendHero({ plan, onOpen, onAsk }: { plan: MethodPlan; onOpen: () => void; onAsk: () => void }) {
  const g = PLAN_GUIDE[plan.id];
  return (
    <View style={{ borderRadius: 30, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
      <LinearGradient colors={[g.hue[2], "#0E0F14"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={[`${g.hue[1]}55`, "transparent"]} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.7 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ height: 28, paddingHorizontal: 11, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,11,13,0.45)" }}>
            <Sparkles size={13} color="#FFE29A" strokeWidth={2.2} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Recomendado para você</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "800", color: g.hue[0] }}>{plan.fit}% combina</Text>
        </View>
        <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <PlanIcon icon={g.icon} hue={g.hue} size={54} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 25, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>{plan.label}</Text>
            <Text style={{ marginTop: 3, fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.74)" }}>{g.tagline}</Text>
          </View>
        </View>
        <View style={{ marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: "rgba(255,255,255,0.55)" }}>POR QUE ESSE</Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: "#fff" }}>{plan.why}</Text>
        </View>
        <View style={{ marginTop: 14 }}>
          <SplitBar plan={plan} height={8} onDark />
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
            {plan.allocations.filter((a) => a.share > 0).map((a) => (
              <View key={a.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BUCKET_HEX[a.bucket] }} />
                <Text style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)" }}>
                  {a.label} <Text style={{ fontWeight: "800", color: "#fff" }}>{money(a.amount)}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
          <Pressable onPress={onOpen} style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0B0B0B" }}>Ver e começar</Text>
          </Pressable>
          <Pressable onPress={onAsk} accessibilityLabel="Perguntar ao Willo" style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", opacity: pressed ? 0.8 : 1 })}>
            <Sparkles size={18} color="#fff" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
    </View>
  );
}

/** One plan in the list: its colour, what it is in a line, its split, effort and fit. */
function PlanRowCard({ plan, active, recommended, onPress }: { plan: MethodPlan; active: boolean; recommended: boolean; onPress: () => void }) {
  const g = PLAN_GUIDE[plan.id];
  return (
    <Surface onPress={onPress}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <PlanIcon icon={g.icon} hue={g.hue} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 16.5, fontWeight: "800", letterSpacing: -0.3, color: th("#fff") }}>{plan.label}</Text>
              {active ? <Chip label="Em uso" hue={GREEN} /> : recommended ? <Chip label="Recomendado" hue={g.hue[1]} /> : null}
            </View>
            <Text style={{ marginTop: 3, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>{g.tagline}</Text>
          </View>
          <ChevronRight size={16} color={th(INK.faint)} />
        </View>
        <View style={{ marginTop: 14 }}>
          <SplitBar plan={plan} />
        </View>
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>
            Esforço <Text style={{ fontWeight: "700", color: th("#fff") }}>{g.effort.toLowerCase()}</Text> · {g.focus}
          </Text>
          <FitBadge fit={plan.fit} />
        </View>
      </View>
    </Surface>
  );
}

function Chip({ label, hue }: { label: string; hue: string }) {
  return (
    <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: "center", backgroundColor: th(`${hue}26`, "bg") }}>
      <Text style={{ fontSize: 11, fontWeight: "800", color: th(hue) }}>{label}</Text>
    </View>
  );
}

function FitBadge({ fit }: { fit: number }) {
  const tone = fit >= 75 ? GREEN : fit >= 50 ? "#F5B83D" : "#9AA0AA";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 44, height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
        <View style={{ width: `${fit}%`, height: 5, borderRadius: 3, backgroundColor: th(tone, "bg") }} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: "800", color: th(tone) }}>{fit}%</Text>
    </View>
  );
}

/**
 * A plan, on a page of its own: in its colour at the top with its name and what it is;
 * how it works in three steps; what it means in reais for this person, part by part,
 * against what they spend today; why it fits; the good and the care it asks; and the
 * button to use it (or to stop).
 */
function PlanSheet({ plan, active, recommended, onClose, onUse }: { plan: MethodPlan | null; active: boolean; recommended: boolean; onClose: () => void; onUse: (m: MethodPlan) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState<MethodPlan | null>(plan);
  useEffect(() => {
    if (plan) setShown(plan);
  }, [plan]);
  const m = plan ?? shown;
  if (!m) return null;
  const g = PLAN_GUIDE[m.id];
  return (
    <Modal visible={!!plan} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: th("#0D0E10", "bg") }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
          {/* Its colour, its name, what it is. */}
          <View style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 24, overflow: "hidden" }}>
            <LinearGradient colors={[g.hue[2], "#0E0F14"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <LinearGradient colors={[`${g.hue[1]}66`, "transparent"]} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.8 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <RoundButton label="Fechar" onImage onPress={onClose}>
                <ChevronLeft size={20} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
              </RoundButton>
              <Text style={{ fontSize: 13, fontWeight: "800", color: g.hue[0] }}>{m.fit}% combina com você</Text>
            </View>
            <View style={{ marginTop: 22, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <PlanIcon icon={g.icon} hue={g.hue} size={60} />
              <View style={{ flex: 1, minWidth: 0 }}>
                {recommended && <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)" }}>RECOMENDADO</Text>}
                <Text style={{ fontSize: Math.min(30, width * 0.075), fontWeight: "800", letterSpacing: -0.9, color: "#fff" }}>{m.label}</Text>
              </View>
            </View>
            <Text style={{ marginTop: 12, fontSize: 15.5, lineHeight: 22, color: "rgba(255,255,255,0.82)" }}>{g.tagline}</Text>
            <View style={{ marginTop: 14, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[`Esforço ${g.effort.toLowerCase()}`, g.focus, g.idealFor].map((t) => (
                <View key={t} style={{ height: 28, paddingHorizontal: 11, borderRadius: 14, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {/* How it works. */}
            <Section title="Como funciona" />
            <Surface>
              <View style={{ padding: 16, gap: 14 }}>
                {g.steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: g.hue[1] }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#fff" }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: th("rgba(255,255,255,0.86)") }}>{s}</Text>
                  </View>
                ))}
              </View>
            </Surface>

            {/* With this person's numbers. */}
            <Section title="Com os seus números" hint={`sobre ${money(m.base)} por mês`} />
            <Surface>
              <View style={{ padding: 16 }}>
                <SplitBar plan={m} height={10} />
                <View style={{ marginTop: 16, gap: 14 }}>
                  {m.allocations.map((a) => {
                    const above = a.bucket !== "guardar" && a.today > a.amount + 0.5;
                    return (
                      <View key={a.label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: th(BUCKET_HEX[a.bucket], "bg") }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>{a.label}</Text>
                          <Text style={{ marginTop: 1, fontSize: 12.5, color: th(above ? "#F87171" : INK.softer) }}>
                            Hoje você usa {money(a.today)}
                            {above ? ` · ${money(a.today - a.amount)} acima` : ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 15.5, fontWeight: "800", color: th("#fff") }}>{money(a.amount)}</Text>
                          <Text style={{ fontSize: 12, color: th(INK.softer) }}>{Math.round(a.share * 100)}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Surface>

            {/* Why it fits. */}
            <Section title="Por que combina com você" />
            <Surface>
              <View style={{ padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
                <WilloBot size={44} />
                <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: th("rgba(255,255,255,0.88)") }}>{m.why}</Text>
              </View>
            </Surface>

            {/* The good and the care. */}
            <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
              <Surface style={{ flex: 1 }}>
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: th(GREEN) }}>VANTAGENS</Text>
                  {m.pros.map((p) => (
                    <View key={p} style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
                      <Check size={14} color={th(GREEN)} strokeWidth={2.8} />
                      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>{p}</Text>
                    </View>
                  ))}
                </View>
              </Surface>
              <Surface style={{ flex: 1 }}>
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: th("#F5B83D") }}>CUIDADOS</Text>
                  {m.cons.map((c) => (
                    <View key={c} style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
                      <AlertTriangle size={13} color={th("#F5B83D")} strokeWidth={2.4} />
                      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>{c}</Text>
                    </View>
                  ))}
                </View>
              </Surface>
            </View>
          </View>
        </ScrollView>

        {/* The button, always in reach. */}
        <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14 }}>
          <Pressable
            onPress={() => onUse(m)}
            style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: active ? th("rgba(255,255,255,0.12)", "bg") : th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontSize: 16.5, fontWeight: "800", color: active ? th("#fff") : th("#0B0B0B") }}>{active ? "Deixar de usar este plano" : "Usar este plano"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
