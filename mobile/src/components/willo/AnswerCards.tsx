import { useEffect, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { Goal } from "@/services/goalService";
import Bar from "~/components/Bar";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { face } from "~/lib/chatFont";
import { GREEN, INK, RED } from "~/theme/tokens";

import { live, th } from "~/theme/theme";
/**
 * What Willo shows alongside what he says.
 *
 * An answer about money reads better with the money drawn: the month's in and out as
 * two bars, where it went as columns, the invoice with its due date, the months ahead,
 * a purchase laid over them, a goal with its picture. Each card is drawn from the app's
 * own figures — never from the model's words — and sits under the reply in the thread.
 */

export type AnswerCard =
  | { type: "fluxo"; month: string; receitas: number; despesas: number; sobra?: number | null; perDay?: number | null }
  | { type: "categorias"; month: string; items: { name: string; amount: number }[] }
  | { type: "faturas"; items: { nome: string; falta: number; vence: string; limite: number; usado: number }[] }
  | { type: "meses"; title: string; items: { mes: string; valor: number; destaque?: boolean }[]; tone?: "sobra" | "gasto" }
  | { type: "simulacao"; data: Simulation }
  | { type: "plano"; label: string; why: string; items: { label: string; amount: number; hex: string }[] }
  | { type: "metas"; items: Goal[] };

export interface Simulation {
  valor_total: number;
  parcelas: number;
  valor_parcela: number;
  veredito: "verde" | "amarelo" | "vermelho";
  meses: { mes: string; sobra_antes: number; parcela: number; sobra_depois: number }[];
  melhor_mes_para_comecar: string | null;
  cartao?: { nome: string; limite_disponivel: number; cabe_no_limite: boolean } | null;
}

const CARD = live({
  marginTop: 8,
  padding: 18,
  borderRadius: 24,
  borderCurve: "continuous",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.045)",
} as const);

/* One family of colour across every chart: light on dark, red only when it is bad news. */
const LIGHT = "#F2F4F7";
const SKY = "#7CC4FF";
const TRACK = "rgba(255,255,255,0.07)";
const LINE = "rgba(255,255,255,0.07)";
const NUMS = { fontVariant: ["tabular-nums"] } as const;

function Eyebrow({ children }: { children: string }) {
  return <Text style={{ fontSize: 13, letterSpacing: -0.1, ...face(600), color: th(INK.soft) }}>{children}</Text>;
}

/** The one figure the picture is about. */
function Lead({ children, color = "#fff" }: { children: string; color?: string }) {
  return <Text style={{ marginTop: 6, fontSize: 28, letterSpacing: -0.9, ...face(800), ...NUMS, color: th(color) }}>{children}</Text>;
}

function Rule({ share, color, delay = 0 }: { share: number; color: string; delay?: number }) {
  return (
    <View style={{ height: 7, borderRadius: 3.5, overflow: "hidden", backgroundColor: th(TRACK, "bg") }}>
      <Bar share={share} color={color} delay={delay} />
    </View>
  );
}

export default function AnswerCardView({ card }: { card: AnswerCard }) {
  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      {card.type === "fluxo" && <FluxoCard card={card} />}
      {card.type === "categorias" && <CategoriasCard card={card} />}
      {card.type === "faturas" && <FaturasCard card={card} />}
      {card.type === "meses" && <MesesCard card={card} />}
      {card.type === "simulacao" && <SimulacaoCard s={card.data} />}
      {card.type === "plano" && <PlanoCard card={card} />}
      {card.type === "metas" && <MetasCard items={card.items} />}
    </Animated.View>
  );
}

function FluxoCard({ card }: { card: Extract<AnswerCard, { type: "fluxo" }> }) {
  const scale = Math.max(card.receitas, card.despesas, 1);
  return (
    <View style={CARD}>
      <Eyebrow>{card.sobra != null ? "Previsto para o fim do mês" : card.month}</Eyebrow>
      {card.sobra != null && <Lead color={card.sobra < 0 ? RED : "#fff"}>{money(card.sobra)}</Lead>}
      {card.perDay != null && card.perDay > 0 && (
        <Text style={{ marginTop: 3, fontSize: 13, ...face(500), color: th(INK.soft) }}>Cerca de {money(card.perDay)} por dia</Text>
      )}
      <View style={{ marginTop: 16, gap: 13 }}>
        {[
          { label: "Entrou", v: card.receitas, hex: SKY },
          { label: "Saiu", v: card.despesas, hex: LIGHT },
        ].map((r, i) => (
          <View key={r.label} style={{ gap: 7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, ...face(500), color: th(INK.soft) }}>{r.label}</Text>
              <Text style={{ fontSize: 14, ...face(700), ...NUMS, color: th("#fff") }}>{money(r.v)}</Text>
            </View>
            <Rule share={r.v / scale} color={r.hex} delay={0.1 + i * 0.1} />
          </View>
        ))}
      </View>
    </View>
  );
}

/* Ranked rows rather than columns: the names and figures can be read at a size people read. */
function CategoriasCard({ card }: { card: Extract<AnswerCard, { type: "categorias" }> }) {
  const items = card.items.slice(0, 5);
  const total = card.items.reduce((s, i) => s + i.amount, 0);
  const max = Math.max(...items.map((i) => i.amount), 1);
  return (
    <View style={CARD}>
      <Eyebrow>{`Gastos de ${card.month}`}</Eyebrow>
      <Lead>{money(total)}</Lead>
      <View style={{ marginTop: 16, gap: 13 }}>
        {items.map((it, i) => (
          <View key={it.name} style={{ gap: 7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, ...face(i === 0 ? 700 : 500), color: th(i === 0 ? "#fff" : "rgba(255,255,255,0.78)") }}>
                {it.name}
              </Text>
              <Text style={{ fontSize: 14, ...face(700), ...NUMS, color: th("#fff") }}>{money(it.amount)}</Text>
            </View>
            <Rule share={it.amount / max} color={i === 0 ? SKY : "rgba(255,255,255,0.34)"} delay={i * 0.06} />
          </View>
        ))}
      </View>
    </View>
  );
}

function FaturasCard({ card }: { card: Extract<AnswerCard, { type: "faturas" }> }) {
  const total = card.items.reduce((s, f) => s + f.falta, 0);
  return (
    <View style={CARD}>
      <Eyebrow>{card.items.length > 1 ? "Faturas em aberto" : "Fatura em aberto"}</Eyebrow>
      <Lead>{money(total)}</Lead>
      <View style={{ marginTop: 6 }}>
        {card.items.map((f, i) => {
          const used = f.limite > 0 ? Math.min(f.usado / f.limite, 1) : 0;
          return (
            <View key={f.nome} style={{ paddingTop: 14, marginTop: 8, gap: 7, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th(LINE, "line") }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, ...face(700), color: th("#fff") }}>
                  {f.nome}
                </Text>
                <Text style={{ fontSize: 15, ...face(700), ...NUMS, color: th("#fff") }}>{money(f.falta)}</Text>
              </View>
              <Text style={{ fontSize: 13, ...face(500), color: th(INK.soft) }}>Vence em {f.vence}</Text>
              <Rule share={used} color={used >= 0.9 ? RED : SKY} delay={0.15} />
              <Text style={{ fontSize: 12.5, ...face(500), ...NUMS, color: th(INK.softer) }}>{money(Math.max(f.limite - f.usado, 0))} livres no limite</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MesesCard({ card }: { card: Extract<AnswerCard, { type: "meses" }> }) {
  const max = Math.max(...card.items.map((i) => Math.abs(i.valor)), 1);
  return (
    <View style={CARD}>
      <Eyebrow>{card.title}</Eyebrow>
      <View style={{ marginTop: 14, gap: 12 }}>
        {card.items.map((m, i) => (
          <View key={m.mes} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ width: 40, fontSize: 13.5, ...face(m.destaque ? 700 : 500), color: th(m.destaque ? "#fff" : INK.soft), textTransform: "capitalize" }}>{m.mes}</Text>
            <View style={{ flex: 1 }}>
              <Rule share={Math.abs(m.valor) / max} color={m.valor < 0 ? RED : m.destaque ? SKY : "rgba(255,255,255,0.34)"} delay={0.05 * i} />
            </View>
            <Text style={{ minWidth: 92, textAlign: "right", fontSize: 13.5, ...face(700), ...NUMS, color: th(m.valor < 0 ? RED : "#fff") }}>{money(m.valor)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SimulacaoCard({ s }: { s: Simulation }) {
  const tone = s.veredito === "verde" ? SKY : s.veredito === "amarelo" ? "#FFFFFF" : RED;
  const label = s.veredito === "verde" ? "Cabe no orçamento" : s.veredito === "amarelo" ? "Cabe, mas aperta" : "Deixa um mês negativo";
  const touched = s.meses.filter((m) => m.parcela > 0).slice(0, 6);
  return (
    <View style={CARD}>
      <Eyebrow>{s.parcelas > 1 ? `Compra em ${s.parcelas}x de ${money(s.valor_parcela)}` : "Compra à vista"}</Eyebrow>
      <Lead>{money(s.valor_total)}</Lead>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th(tone, "bg") }} />
        <Text style={{ fontSize: 13.5, ...face(700), color: th(tone) }}>{label}</Text>
      </View>
      <View style={{ marginTop: 14, paddingTop: 14, gap: 10, borderTopWidth: 1, borderTopColor: th(LINE, "line") }}>
        {touched.map((m) => (
          <View key={m.mes} style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, fontSize: 13.5, ...face(500), color: th(INK.soft), textTransform: "capitalize" }}>{m.mes.replace(/ de \d{4}$/, "")}</Text>
            <Text style={{ fontSize: 13, ...face(500), ...NUMS, color: th(INK.softer) }}>{money(m.sobra_antes)} → </Text>
            <Text style={{ fontSize: 13.5, ...face(700), ...NUMS, color: th(m.sobra_depois < 0 ? RED : "#fff") }}>{money(m.sobra_depois)}</Text>
          </View>
        ))}
      </View>
      {s.melhor_mes_para_comecar && (
        <Text style={{ marginTop: 14, fontSize: 13.5, ...face(500), color: th(INK.soft) }}>
          Melhor momento: <Text style={{ ...face(700), color: th("#fff") }}>{s.melhor_mes_para_comecar.replace(/^./, (c) => c.toUpperCase())}</Text>
        </Text>
      )}
      {s.cartao && (
        <Text style={{ marginTop: 8, fontSize: 12.5, ...face(500), color: th(s.cartao.cabe_no_limite ? INK.softer : RED) }}>
          {s.cartao.nome}: {money(s.cartao.limite_disponivel)} livres no limite{s.cartao.cabe_no_limite ? "" : ", não cabe"}
        </Text>
      )}
    </View>
  );
}

function PlanoCard({ card }: { card: Extract<AnswerCard, { type: "plano" }> }) {
  const total = Math.max(card.items.reduce((s, a) => s + a.amount, 0), 1);
  return (
    <View style={CARD}>
      <Eyebrow>Plano recomendado</Eyebrow>
      <Text style={{ marginTop: 6, fontSize: 21, letterSpacing: -0.5, ...face(800), color: th("#fff") }}>{card.label}</Text>
      <Text style={{ marginTop: 5, fontSize: 13.5, lineHeight: 19, ...face(500), color: th(INK.soft) }}>{card.why}</Text>
      <View style={{ marginTop: 16, gap: 13 }}>
        {card.items.map((a, i) => (
          <View key={a.label} style={{ gap: 7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ flex: 1, fontSize: 14, ...face(500), color: th("rgba(255,255,255,0.86)") }}>{a.label}</Text>
              <Text style={{ fontSize: 14, ...face(700), ...NUMS, color: th("#fff") }}>{money(a.amount)}</Text>
            </View>
            <Rule share={a.amount / total} color={i === 0 ? SKY : "rgba(255,255,255,0.34)"} delay={i * 0.06} />
          </View>
        ))}
      </View>
    </View>
  );
}

function MetasCard({ items }: { items: Goal[] }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width * 0.8, 320);
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {items.slice(0, 3).map((g) => {
        const target = Number(g.target_amount) || 0;
        const saved = Number(g.current_amount) || 0;
        const share = target > 0 ? Math.min(saved / target, 1) : 0;
        return (
          <Animated.View key={g.id} entering={FadeIn.duration(360)} style={{ width: w, height: 150, borderRadius: 20, overflow: "hidden", backgroundColor: th("#0D0E10", "bg") }}>
            <CaixinhaCover goal={g} width={w} height={150} />
            <LinearGradient colors={th(["rgba(8,9,10,0.1)", "rgba(8,9,10,0.92)"], "grad")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
              <Text numberOfLines={1} style={{ fontSize: 17, ...face(800), color: th("#fff") }}>{g.name}</Text>
              <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: th("rgba(255,255,255,0.75)") }}>{money(saved)}{target > 0 ? ` de ${money(target)}` : ""}</Text>
                {share >= 1 ? <Check size={14} color={th(GREEN)} strokeWidth={3} /> : target > 0 ? <Text style={{ fontSize: 12, fontWeight: "700", color: th(GREEN) }}>{Math.round(share * 100)}%</Text> : null}
              </View>
              {target > 0 && (
                <View style={{ marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.18)", "bg") }}>
                  <View style={{ width: `${share * 100}%`, height: 4, backgroundColor: th(GREEN, "bg") }} />
                </View>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
