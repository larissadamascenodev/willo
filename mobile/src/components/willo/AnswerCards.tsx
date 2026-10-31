import { useEffect, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { Goal } from "@/services/goalService";
import { categoryHex } from "@/lib/categoryData";
import Bar from "~/components/Bar";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

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

const CARD = {
  marginTop: 8,
  padding: 14,
  borderRadius: 20,
  borderCurve: "continuous",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.05)",
} as const;

function Eyebrow({ children }: { children: string }) {
  return <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase", color: INK.softer }}>{children}</Text>;
}

export default function AnswerCardView({ card }: { card: AnswerCard }) {
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={{ maxWidth: "92%" }}>
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
      <Eyebrow>{`${card.month} · seus registros`}</Eyebrow>
      {[
        { label: "Entrou", v: card.receitas, hex: GREEN },
        { label: "Saiu", v: card.despesas, hex: RED },
      ].map((r, i) => (
        <View key={r.label} style={{ marginTop: i === 0 ? 12 : 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{r.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{money(r.v)}</Text>
          </View>
          <View style={{ marginTop: 6, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <Bar share={r.v / scale} color={r.hex} delay={0.1 + i * 0.1} />
          </View>
        </View>
      ))}
      {card.sobra != null && (
        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, color: INK.soft }}>Previsto até o fim do mês</Text>
          <Text style={{ fontSize: 14, fontWeight: "800", color: card.sobra < 0 ? RED : "#fff" }}>{money(card.sobra)}</Text>
        </View>
      )}
      {card.perDay != null && card.perDay > 0 && (
        <Text style={{ marginTop: 4, fontSize: 12, color: INK.softer }}>Cerca de {money(card.perDay)} por dia</Text>
      )}
    </View>
  );
}

function CategoriasCard({ card }: { card: Extract<AnswerCard, { type: "categorias" }> }) {
  const items = card.items.slice(0, 6);
  const max = Math.max(...items.map((i) => i.amount), 1);
  const H = 110;
  return (
    <View style={CARD}>
      <Eyebrow>{`Gastos de ${card.month} · por categoria`}</Eyebrow>
      <View style={{ marginTop: 14, height: H + 34, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {items.map((it, i) => (
          <View key={it.name} style={{ flex: 1, alignItems: "center" }}>
            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "700", color: i === 0 ? "#fff" : INK.softer }}>
              {it.amount >= 1000 ? `${(it.amount / 1000).toFixed(1).replace(".", ",")}k` : Math.round(it.amount)}
            </Text>
            <Grow height={Math.max(6, (it.amount / max) * H)} color={categoryHex(it.name)} delay={i * 60} />
            <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 9.5, color: INK.soft }}>{it.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A column that grows up from the floor. */
function Grow({ height, color, delay }: { height: number; color: string; delay: number }) {
  const [h, setH] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setH(height), 80 + delay);
    return () => clearTimeout(t);
  }, [height, delay]);
  return <View style={{ marginTop: 4, width: "100%", height: h, borderRadius: 7, backgroundColor: color, opacity: 0.9 }} />;
}

function FaturasCard({ card }: { card: Extract<AnswerCard, { type: "faturas" }> }) {
  return (
    <View style={CARD}>
      <Eyebrow>Faturas em aberto</Eyebrow>
      {card.items.map((f, i) => (
        <View key={f.nome} style={{ marginTop: i === 0 ? 10 : 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{f.nome}</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{money(f.falta)}</Text>
          </View>
          <Text style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>vence em {f.vence}</Text>
          <View style={{ marginTop: 8, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Bar share={f.limite > 0 ? Math.min(f.usado / f.limite, 1) : 0} color="#B9B0FF" delay={0.15} />
          </View>
          <Text style={{ marginTop: 4, fontSize: 11.5, color: INK.softer }}>
            {money(Math.max(f.limite - f.usado, 0))} de limite disponível
          </Text>
        </View>
      ))}
    </View>
  );
}

function MesesCard({ card }: { card: Extract<AnswerCard, { type: "meses" }> }) {
  const max = Math.max(...card.items.map((i) => Math.abs(i.valor)), 1);
  return (
    <View style={CARD}>
      <Eyebrow>{card.title}</Eyebrow>
      <View style={{ marginTop: 10, gap: 9 }}>
        {card.items.map((m, i) => (
          <View key={m.mes} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ width: 62, fontSize: 12.5, fontWeight: m.destaque ? "700" : "500", color: m.destaque ? "#fff" : INK.soft, textTransform: "capitalize" }}>{m.mes}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" }}>
              <Bar share={Math.abs(m.valor) / max} color={card.tone === "sobra" ? (m.valor < 0 ? RED : GREEN) : m.destaque ? "#5AA9FF" : "#ECECEF"} delay={0.05 * i} />
            </View>
            <Text style={{ width: 86, textAlign: "right", fontSize: 12.5, fontWeight: "700", color: m.valor < 0 ? RED : "#fff" }}>{money(m.valor)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SimulacaoCard({ s }: { s: Simulation }) {
  const tone = s.veredito === "verde" ? GREEN : s.veredito === "amarelo" ? "#F9CE4E" : RED;
  const label = s.veredito === "verde" ? "Cabe no orçamento" : s.veredito === "amarelo" ? "Cabe, mas aperta" : "Deixa um mês negativo";
  const touched = s.meses.filter((m) => m.parcela > 0).slice(0, 6);
  return (
    <View style={CARD}>
      <Eyebrow>Simulação da compra</Eyebrow>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{money(s.valor_total)}</Text>
        <Text style={{ fontSize: 13, color: INK.soft }}>{s.parcelas > 1 ? `${s.parcelas}x de ${money(s.valor_parcela)}` : "à vista"}</Text>
      </View>
      <View style={{ marginTop: 8, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: `${tone}22` }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: tone }}>{label}</Text>
      </View>
      <View style={{ marginTop: 12, gap: 8 }}>
        {touched.map((m) => (
          <View key={m.mes} style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, fontSize: 12.5, color: INK.soft, textTransform: "capitalize" }}>{m.mes.replace(/ de \d{4}$/, "")}</Text>
            <Text style={{ fontSize: 12.5, color: INK.softer }}>{money(m.sobra_antes)} → </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: m.sobra_depois < 0 ? RED : "#fff" }}>{money(m.sobra_depois)}</Text>
          </View>
        ))}
      </View>
      {s.melhor_mes_para_comecar && (
        <View style={{ marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: "rgba(90,169,255,0.10)" }}>
          <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.2, color: "#5AA9FF" }}>MELHOR MOMENTO</Text>
          <Text style={{ marginTop: 2, fontSize: 13.5, fontWeight: "600", color: "#fff", textTransform: "capitalize" }}>{s.melhor_mes_para_comecar}</Text>
        </View>
      )}
      {s.cartao && (
        <Text style={{ marginTop: 10, fontSize: 12, color: s.cartao.cabe_no_limite ? INK.softer : RED }}>
          {s.cartao.nome}: {money(s.cartao.limite_disponivel)} de limite disponível{s.cartao.cabe_no_limite ? "" : ", não cabe"}
        </Text>
      )}
      <Text style={{ marginTop: 10, fontSize: 11, color: INK.faint }}>Nada muda sem a sua aprovação.</Text>
    </View>
  );
}

function PlanoCard({ card }: { card: Extract<AnswerCard, { type: "plano" }> }) {
  return (
    <View style={[CARD, { borderColor: "rgba(94,234,212,0.30)", backgroundColor: "rgba(94,234,212,0.06)" }]}>
      <Eyebrow>Plano recomendado</Eyebrow>
      <Text style={{ marginTop: 6, fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>{card.label}</Text>
      <Text style={{ marginTop: 4, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>{card.why}</Text>
      <View style={{ marginTop: 10, gap: 7 }}>
        {card.items.map((a) => (
          <View key={a.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: a.hex }} />
            <Text style={{ flex: 1, fontSize: 13, color: "#fff" }}>{a.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{money(a.amount)}</Text>
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
          <Animated.View key={g.id} entering={FadeIn.duration(360)} style={{ width: w, height: 150, borderRadius: 20, overflow: "hidden", backgroundColor: "#0D0E10" }}>
            <CaixinhaCover goal={g} width={w} height={150} />
            <LinearGradient colors={["rgba(8,9,10,0.1)", "rgba(8,9,10,0.92)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{g.name}</Text>
              <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{money(saved)}{target > 0 ? ` de ${money(target)}` : ""}</Text>
                {share >= 1 ? <Check size={14} color={GREEN} strokeWidth={3} /> : target > 0 ? <Text style={{ fontSize: 12, fontWeight: "700", color: GREEN }}>{Math.round(share * 100)}%</Text> : null}
              </View>
              {target > 0 && (
                <View style={{ marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)" }}>
                  <View style={{ width: `${share * 100}%`, height: 4, backgroundColor: GREEN }} />
                </View>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
