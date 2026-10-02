import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CalendarCheck, ChevronRight, CreditCard, Gauge, PiggyBank, ShieldCheck, Sparkles, Target, Wallet, type LucideIcon } from "lucide-react-native";
import { SCORE_MAX, scoreLevel, type PillarKey } from "@/services/raioXService";
import type { RaioXData } from "@/hooks/useRaioX";
import { BottomSheet, Text, white } from "~/ui";
import { tint } from "~/lib/color";
import { Bar, Card, LIGHT_HEX, MONTHS_SHORT, Section, TONE_HEX, brl } from "./primitives";

const PILLAR_ICON: Record<PillarKey, LucideIcon> = {
  contas: CalendarCheck, sobra: PiggyBank, saldo: Wallet, gastos: Gauge, credito: CreditCard, reserva: ShieldCheck,
};

/** O semáforo do dia: verde, amarelo ou vermelho, e quanto ainda dá para gastar hoje. */
export function DailyLightCard({ data }: { data: RaioXData }) {
  const { light } = data;
  const hex = LIGHT_HEX[light.light];
  const label = light.light === "verde" ? "Dia verde" : light.light === "amarelo" ? "Dia amarelo" : "Dia vermelho";
  return (
    <View style={{ marginTop: 16, borderRadius: 24, borderWidth: 1, borderColor: tint(hex, 0.2), padding: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 14 }}>
      <LinearGradient colors={[tint(hex, 0.08), "rgba(20,20,20,0.9)"]} locations={[0, 0.6]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ gap: 6, borderRadius: 999, padding: 6, backgroundColor: "rgba(0,0,0,0.4)" }}>
        {(["vermelho", "amarelo", "verde"] as const).map((l) => (
          <View key={l} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: l === light.light ? LIGHT_HEX[l] : white(0.08), ...(l === light.light ? { shadowColor: LIGHT_HEX[l], shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : {}) }} />
        ))}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={11} weight="bold" color={hex} style={{ letterSpacing: 1.3, textTransform: "uppercase" }}>{label}</Text>
        <Text size={14} color={white(0.85)} style={{ marginTop: 2, lineHeight: 19 }}>{light.message}</Text>
      </View>
      {light.allowance > 0 && (
        <View style={{ alignItems: "flex-end" }}>
          <Text size={10} color={white(0.56)}>Hoje</Text>
          <Text weight="extrabold" size={17} tabular>{brl(Math.max(light.leftToday, 0))}</Text>
        </View>
      )}
    </View>
  );
}

const TICKS = 40;
const W = 280, H = 158, CX = W / 2, CY = 148, R1 = 104, R2 = 128;

/** Saúde financeira: o velocímetro do score, a evolução mês a mês e o que forma a nota. */
export function ScoreCard({ data }: { data: RaioXData }) {
  const { report, trend } = data;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    // o número sobe até o score, como o ponteiro do velocímetro
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / 1300, 1);
      setShown(Math.round(report.score * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [report.score]);

  let streak = 0;
  for (let i = trend.length - 1; i > 0 && trend[i].score > trend[i - 1].score; i--) streak++;
  const delta = trend.length >= 2 ? trend[trend.length - 1].score - trend[trend.length - 2].score : null;
  const trendText = streak >= 2 ? `Subindo há ${streak} meses seguidos 🔥`
    : delta !== null && delta > 0 ? `+${delta} pontos desde o mês passado 📈`
      : delta !== null && delta < 0 ? `${delta} pontos desde o mês passado. Dá pra recuperar 💪`
        : "Seu primeiro mês de score. Agora é subir 🚀";

  const lit = Math.round((report.score / SCORE_MAX) * TICKS);
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = Math.PI - (i / (TICKS - 1)) * Math.PI;
    return { x1: CX + R1 * Math.cos(a), y1: CY - R1 * Math.sin(a), x2: CX + R2 * Math.cos(a), y2: CY - R2 * Math.sin(a) };
  });
  const max = Math.max(...trend.map((t) => t.score), 1);
  const hex = report.level.hex;

  return (
    <Section icon={Sparkles} title="Saúde financeira">
      <View style={{ borderRadius: 28, borderWidth: 1, borderColor: white(0.12), paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, overflow: "hidden", backgroundColor: "#0E0E0E" }}>
        <LinearGradient colors={[tint(hex, 0.12), "rgba(20,20,20,0.95)", "#0E0E0E"]} locations={[0, 0.55, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ alignSelf: "center", width: W, maxWidth: "100%", aspectRatio: W / H }}>
          <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
            {ticks.map((t, i) => <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={4.5} strokeLinecap="round" stroke={i < lit ? hex : "rgba(255,255,255,0.08)"} />)}
          </Svg>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }}>
            <Text weight="extrabold" size={54} tabular style={{ letterSpacing: -2, lineHeight: 56 }}>{shown}</Text>
            <Text size={11} color={white(0.56)} style={{ marginTop: 4 }}>de {SCORE_MAX} pontos</Text>
          </View>
        </View>

        <View style={{ marginTop: 12, alignItems: "center", gap: 6 }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: hex }}><Text weight="bold" size={13} color="#0B0B0B">{report.level.label}</Text></View>
          <Text size={12} color={white(0.7)} align="center">{trendText}</Text>
        </View>

        <View style={{ marginTop: 14, flexDirection: "row", gap: 6 }}>
          {[300, 500, 700, 900].map((sc) => {
            const l = scoreLevel(sc);
            const active = l.key === report.level.key;
            return (
              <View key={l.key} style={{ flex: 1, alignItems: "center" }}>
                <View style={{ alignSelf: "stretch", height: 4, borderRadius: 2, backgroundColor: active ? l.hex : tint(l.hex, 0.2) }} />
                <Text size={9} weight={active ? "semibold" : "regular"} color={active ? "#fff" : white(0.5)} style={{ marginTop: 4 }}>{l.label}</Text>
              </View>
            );
          })}
        </View>

        {trend.length >= 2 && (
          <View style={{ marginTop: 16, flexDirection: "row", alignItems: "flex-end", gap: 6, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
            {trend.map((t, i) => {
              const level = scoreLevel(t.score);
              const last = i === trend.length - 1;
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Text size={9} tabular weight={last ? "bold" : "regular"} color={last ? "#fff" : white(0.56)} style={{ marginBottom: 4 }}>{t.score}</Text>
                  <View style={{ width: "100%", maxWidth: 30, borderRadius: 6, height: Math.max((t.score / max) * 40, 5), backgroundColor: last ? level.hex : tint(level.hex, 0.33) }} />
                  <Text size={9} color={last ? "#fff" : white(0.56)} style={{ marginTop: 4 }}>{MONTHS_SHORT[t.month]}</Text>
                </View>
              );
            })}
          </View>
        )}

        <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ marginTop: 14, height: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: white(0.07), opacity: pressed ? 0.8 : 1 })}>
          <Text weight="semibold" size={14}>Ver o que forma seu score</Text><ChevronRight size={16} color="#fff" />
        </Pressable>
      </View>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text display weight="bold" size={22}>O que forma seu score</Text>
          <Text size={14} color={white(0.62)}>Cada pilar soma pontos até {SCORE_MAX}.</Text>
          <View style={{ marginTop: 16 }}>
            {report.pillars.map((p, i) => {
              const Icon = PILLAR_ICON[p.key];
              const h = TONE_HEX[p.tone];
              return (
                <View key={p.key} style={{ paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(h, 0.1) }}><Icon size={18} color={h} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text weight="medium" size={15}>{p.label}</Text>
                      <Text size={12} color={white(0.62)}>{p.detail}</Text>
                    </View>
                    <Text tabular><Text weight="bold" size={17}>{p.points}</Text><Text size={12} color={white(0.5)}>/{p.max}</Text></Text>
                  </View>
                  <Bar value={p.points / p.max} hex={h} style={{ marginLeft: 52, marginTop: 8 }} delay={0.05 * i} />
                </View>
              );
            })}
          </View>
        </View>
      </BottomSheet>
    </Section>
  );
}

/** Contagem regressiva das metas, no ritmo atual. */
export function GoalsCountdown({ data }: { data: RaioXData }) {
  const router = useRouter();
  if (data.goals.length === 0) return null;
  return (
    <Section icon={Target} title="Suas metas" hint="Contagem regressiva no seu ritmo atual">
      <View style={{ gap: 8 }}>
        {data.goals.slice(0, 4).map((g) => {
          const hex = g.onTrack === false ? "#FCD34D" : "#C8F36D";
          const C = 2 * Math.PI * 20;
          return (
            <Pressable key={g.goal.id} onPress={() => router.push({ pathname: "/metas/[id]", params: { id: g.goal.id } })}>
              <Card style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
                    <Svg viewBox="0 0 48 48" width={48} height={48} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
                      <Circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
                      <Circle cx={24} cy={24} r={20} fill="none" stroke={hex} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${g.progress * C} ${C}`} />
                    </Svg>
                    <Text size={11} weight="bold" tabular>{Math.round(g.progress * 100)}%</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold" size={15} numberOfLines={1}>{g.goal.name}</Text>
                    <Text size={12} color={white(0.62)} tabular>{brl(g.goal.current)} de {brl(g.goal.target)}</Text>
                  </View>
                  {g.monthsLeft !== null && (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text weight="extrabold" size={20} tabular>{g.monthsLeft}</Text>
                      <Text size={10} color={white(0.56)}>{g.monthsLeft === 1 ? "mês" : "meses"}</Text>
                    </View>
                  )}
                </View>
                <Text size={13} color={g.onTrack === false ? "#FDE68A" : white(0.65)} style={{ marginTop: 12, lineHeight: 18 }}>{g.message}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}
