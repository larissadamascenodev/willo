import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import type { RaioXData } from "@/hooks/useRaioX";
import { isSpend, type RawTx } from "@/services/raioXAnalytics";
import { Action, Finding, Heading, ICE, Limitation, NUMS, RISK, Row, SKY, Tabs, clean } from "~/components/radar/parts";
import { face } from "~/lib/chatFont";
import { money } from "~/lib/money";
import { MONTH_NAMES } from "~/lib/purchaseSim";
import { INK } from "~/theme/tokens";

/**
 * The first five sectors of the Radar. Each opens with what the numbers mean, then one
 * instrument of its own, drawn from the same readings the web's Radar and the assistant use.
 * The balance and the month's in and out are not here: those belong to the home.
 */

export interface RadarSnapshot {
  contas?: { saldo_atual: number };
  cartoes?: { nome: string; limite: number; usado: number; fechamento: number; fatura_aberta: number; vence_em: string; disponivel: number }[];
  previsao?: { proximos_meses: { mes: string; receita: number; despesa: number; sobra: number }[] };
}

type Ask = (question: string) => void;

const CHART_FONT = "PlusJakartaSans_600SemiBold";

const short = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? "−" : ""}${(Math.abs(v) / 1000).toFixed(1).replace(".", ",")} mil` : `${v < 0 ? "−" : ""}${Math.round(Math.abs(v))}`);
const monthKey = (d: string) => d.slice(0, 7);
const shift = (ref: Date, n: number) => {
  const d = new Date(ref.getFullYear(), ref.getMonth() + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const abbreviated = (key: string) => MONTH_NAMES[Number(key.slice(5, 7)) - 1].slice(0, 3);

/* ---- Consumo ---- */

function byCategory(txs: RawTx[], keys: string[]) {
  const map = new Map<string, { total: number; count: number; txs: RawTx[] }>();
  for (const t of txs) {
    if (!keys.includes(monthKey(t.date))) continue;
    const seen = map.get(t.category) ?? { total: 0, count: 0, txs: [] };
    seen.total += t.amount;
    seen.count += 1;
    seen.txs.push(t);
    map.set(t.category, seen);
  }
  return map;
}

export function Consumo({ data, onAsk }: { data: RaioXData; onAsk: Ask }) {
  const [period, setPeriod] = useState<"mes" | "tres">("mes");
  const [open, setOpen] = useState<string | null>(null);
  /* Paying an invoice is not spending: its purchases are already counted, each in its own category. */
  const spend = useMemo(() => data.txs.filter((t) => isSpend(t) && !/^(faturas?|pagamento de fatura)$/i.test(t.category.trim())), [data.txs]);
  const today = data.today;
  const thisMonth = shift(today, 0);
  const keys = period === "mes" ? [thisMonth] : [shift(today, -2), shift(today, -1), thisMonth];
  const past = [shift(today, -3), shift(today, -2), shift(today, -1)];
  const shown = byCategory(spend, keys);
  const lastMonth = byCategory(spend, [shift(today, -1)]);
  const before = byCategory(spend, past);
  const total = [...shown.values()].reduce((s, c) => s + c.total, 0);
  const rows = [...shown.entries()].map(([name, c]) => ({ name, ...c, usual: (before.get(name)?.total ?? 0) / 3, prev: lastMonth.get(name)?.total ?? 0 })).sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.map((r) => Math.max(r.total, r.usual)), 1);
  const top = rows[0];

  const inPeriod = spend.filter((t) => keys.includes(monthKey(t.date)));
  const planned = inPeriod.filter((t) => t.recurrence_type === "fixa" || (t.installments ?? 0) > 1).reduce((s, t) => s + t.amount, 0);
  const biggest = [...inPeriod].sort((a, b) => b.amount - a.amount).slice(0, 3);

  const rising = period === "mes" ? rows.filter((r) => r.usual > 0 && r.total > r.usual * 1.15).sort((a, b) => b.total - b.usual - (a.total - a.usual)).slice(0, 3) : [];
  const falling = period === "mes" ? [...before.entries()].map(([name, b]) => ({ name, usual: b.total / 3, now: shown.get(name)?.total ?? 0 })).filter((r) => r.now < r.usual * 0.85 && r.usual > 0).sort((a, b) => b.usual - b.now - (a.usual - a.now)).slice(0, 3) : [];

  return (
    <View>
      <Finding note={top ? `De ${money(total)} que saíram ${period === "mes" ? "neste mês" : "nos últimos 3 meses"}.` : null}>
        {top ? `${top.name} levou ${Math.round((top.total / total) * 100)}% do seu dinheiro.` : "Ainda não há gastos neste período."}
      </Finding>
      <Tabs
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setOpen(null);
        }}
        options={[
          { key: "mes", label: "Este mês" },
          { key: "tres", label: "Últimos 3 meses" },
        ]}
      />

      {rows.length > 0 && (
        <View style={{ marginTop: 16, marginHorizontal: 20, height: 12, flexDirection: "row", gap: 2 }}>
          {rows.slice(0, 7).map((r, i) => (
            <View key={r.name} style={{ flex: r.total, minWidth: 3, borderRadius: 2, backgroundColor: SKY, opacity: 1 - i * 0.12 }} />
          ))}
        </View>
      )}

      <View style={{ marginTop: 10 }}>
        {rows.slice(0, 8).map((r, i) => {
          const limit = data.limits.find((l) => l.category === r.name)?.limit ?? null;
          const isOpen = open === r.name;
          const names = new Map<string, number>();
          for (const t of r.txs) names.set(t.name, (names.get(t.name) ?? 0) + t.amount);
          const months = [-3, -2, -1, 0].map((n) => ({ key: shift(today, n), v: spend.filter((t) => t.category === r.name && monthKey(t.date) === shift(today, n)).reduce((s, t) => s + t.amount, 0) }));
          const peak = Math.max(...months.map((m) => m.v), 1);
          return (
            <Row key={r.name} first={i === 0} title={r.name} value={money(r.total)} onPress={() => setOpen(isOpen ? null : r.name)}>
              {/* The bar is this period; the tick is what is usual. */}
              <View style={{ marginTop: 8, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)" }}>
                <View style={{ width: `${(r.total / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: r.usual > 0 && r.total > r.usual * 1.15 && period === "mes" ? RISK : SKY }} />
                {period === "mes" && r.usual > 0 && <View style={{ position: "absolute", left: `${(r.usual / max) * 100}%`, top: -3, width: 2, height: 12, borderRadius: 1, backgroundColor: "#fff" }} />}
              </View>
              <Text style={{ marginTop: 6, fontSize: 12.5, ...face(500), ...NUMS, color: INK.softer }}>
                {Math.round((r.total / total) * 100)}% do total{period === "mes" && r.usual > 0 ? `, seu normal é ${money(r.usual)}` : ""}
              </Text>
              {isOpen && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height: 62 }}>
                    {months.map((m) => (
                      <View key={m.key} style={{ flex: 1, alignItems: "center" }}>
                        <View style={{ width: "100%", height: Math.max(3, (m.v / peak) * 42), borderRadius: 3, backgroundColor: m.key === thisMonth ? SKY : "rgba(255,255,255,0.18)" }} />
                        <Text style={{ marginTop: 4, fontSize: 11.5, ...face(500), color: INK.softer }}>{abbreviated(m.key)}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 19, ...face(500), color: INK.soft }}>
                    {r.count} {r.count === 1 ? "compra" : "compras"}. Mais em{" "}
                    {[...names.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([n]) => n)
                      .join(", ")}
                    .{period === "mes" && r.prev > 0 ? ` No mês passado inteiro foram ${money(r.prev)}.` : ""}
                  </Text>
                  {limit ? <Text style={{ marginTop: 4, fontSize: 13.5, ...face(600), color: r.total > limit ? RISK : "#fff" }}>{Math.round((r.total / limit) * 100)}% do limite de {money(limit)}</Text> : null}
                  <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
                    <Action label="Perguntar ao Willo" onPress={() => onAsk(`Quanto gastei com ${r.name} nos últimos meses e por quê?`)} />
                  </View>
                </View>
              )}
            </Row>
          );
        })}
      </View>

      {total > 0 && (
        <>
          <Heading>Quanto você escolhe, de verdade</Heading>
          <View style={{ marginHorizontal: 20, height: 10, flexDirection: "row", gap: 2 }}>
            <View style={{ flex: Math.max(planned, 1), borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" }} />
            <View style={{ flex: Math.max(total - planned, 1), borderRadius: 2, backgroundColor: SKY }} />
          </View>
          <Text style={{ marginTop: 8, paddingHorizontal: 20, fontSize: 14, lineHeight: 20, ...face(500), color: INK.soft }}>
            {money(planned)} já vinham de fixos e parcelas. {money(total - planned)} foram gastos do dia a dia.
          </Text>
        </>
      )}

      {rising.length > 0 && <Heading>O que subiu</Heading>}
      {rising.map((r, i) => (
        <Row key={r.name} first={i === 0} title={r.name} note={`Seu normal é ${money(r.usual)}`} value={`+${Math.round((r.total / r.usual - 1) * 100)}%`} risk />
      ))}
      {falling.length > 0 && <Heading>O que caiu</Heading>}
      {falling.map((r, i) => (
        <Row key={r.name} first={i === 0} title={r.name} note={`Seu normal é ${money(r.usual)}`} value={money(r.now)} />
      ))}
      {biggest.length > 0 && <Heading>As maiores despesas</Heading>}
      {biggest.map((t, i) => (
        <Row key={t.id} first={i === 0} title={t.name} note={`${t.category}, dia ${Number(t.date.slice(8))}/${Number(t.date.slice(5, 7))}`} value={money(t.amount)} />
      ))}
      <Limitation>Compras no cartão contam no dia da compra. O pagamento da fatura não entra de novo.</Limitation>
    </View>
  );
}

/* ---- Hábitos ---- */

export function Habitos({ data, onAsk }: { data: RaioXData; onAsk: Ask }) {
  const signal = data.anomalies[0];
  const week = data.weekday;
  const peak = Math.max(...week.days.map((d) => d.avg), 1);
  const heads = data.leaks.leaks;
  const opportunities = data.report.opportunities.slice(0, 3);
  const impulse = data.impulse;
  const nothing = !signal && heads.length === 0 && data.duplicates.length === 0 && !impulse?.count;

  return (
    <View>
      <Finding note={signal ? signal.what : null} risk={!!signal?.recurring}>
        {signal ? signal.title : nothing ? "Ainda não vi nenhum padrão fora do normal." : clean(week.message)}
      </Finding>

      {week.days.some((d) => d.avg > 0) && (
        <>
          <Heading>Seus dias de gastar</Heading>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 92, paddingHorizontal: 20 }}>
            {week.days.map((d, i) => (
              <View key={d.label} style={{ flex: 1, alignItems: "center" }}>
                <View style={{ width: "100%", height: Math.max(3, (d.avg / peak) * 66), borderRadius: 4, backgroundColor: i === week.peak ? SKY : "rgba(255,255,255,0.16)" }} />
                <Text style={{ marginTop: 6, fontSize: 12, ...face(i === week.peak ? 700 : 500), color: i === week.peak ? "#fff" : INK.softer }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 10, paddingHorizontal: 20, fontSize: 14, lineHeight: 20, ...face(500), color: INK.soft }}>{clean(week.message)}</Text>
        </>
      )}

      {data.anomalies.length > 1 && <Heading>Fora do seu normal</Heading>}
      {data.anomalies.slice(1, 5).map((a, i) => (
        <Row key={a.id} first={i === 0} title={a.title} note={`${a.what} ${a.action}`} value={a.impact > 0 ? money(a.impact) : null} />
      ))}

      {heads.length > 0 && <Heading>O que se repete</Heading>}
      {heads.slice(0, 5).map((l, i) => (
        <Row key={l.id} first={i === 0} title={l.title} note={l.detail} value={`${money(l.monthly)}/mês`} />
      ))}
      {data.leaks.yearly > 0 && <Limitation>{`Somando, isso dá ${money(data.leaks.yearly)} por ano.`}</Limitation>}

      {data.duplicates.length > 0 && <Heading>Cobranças parecidas</Heading>}
      {data.duplicates.slice(0, 3).map((d, i) => (
        <Row key={`${d.name}${i}`} first={i === 0} title={d.name} note={`Apareceu em ${d.dates.map((x) => `${Number(x.slice(8))}/${Number(x.slice(5, 7))}`).join(" e ")}. Vale conferir.`} value={money(d.amount)} />
      ))}

      {impulse && impulse.count > 0 && <Heading>Compras por impulso</Heading>}
      {impulse && impulse.count > 0 && <Row first title={clean(impulse.message)} value={money(impulse.total)} />}

      {opportunities.length > 0 && <Heading>Onde dá para economizar</Heading>}
      {opportunities.map((o, i) => (
        <Row key={o.category} first={i === 0} title={o.category} note={`${money(o.aboveAverage)} acima do seu normal`} onPress={() => onAsk(`Como economizar em ${o.category}?`)} />
      ))}

      {nothing && <Limitation>Com mais meses registrados, consigo comparar melhor. Por enquanto não vou tirar conclusões do que ainda não tenho.</Limitation>}
    </View>
  );
}

/* ---- Compromissos ---- */

export function Compromissos({ data, snapshot }: { data: RaioXData; snapshot: RadarSnapshot }) {
  const c = data.commitment;
  const months = (snapshot.previsao?.proximos_meses ?? []).slice(0, 6);
  const peak = Math.max(...months.map((m) => Math.max(m.despesa, m.receita)), 1);
  const heavy = months.length ? months.reduce((a, b) => (b.despesa > a.despesa ? b : a)) : null;
  const pct = Math.round(c.committedPct * 100);
  const total = Math.max(c.income, c.fixed + c.installments + c.card + c.variable, 1);
  const parts = [
    { label: "Contas fixas", v: c.fixed, hex: "#FFFFFF" },
    { label: "Parcelas", v: c.installments, hex: ICE },
    { label: "Cartão no mês", v: c.card, hex: SKY },
    { label: "Dia a dia", v: c.variable, hex: "rgba(124,196,255,0.45)" },
  ].filter((p) => p.v > 0);
  const free = c.income - c.fixed - c.installments - c.card - c.variable;

  return (
    <View>
      <Finding risk={pct >= 60} note={c.income > 0 ? `Sobre ${money(c.income)} de renda neste mês, entre o que já recebeu e o que está previsto.` : null}>
        {c.income > 0 ? (pct > 100 ? `Contas fixas e parcelas já passam da sua renda: ${pct}%.` : `${pct}% da sua renda já tem destino antes de você escolher qualquer coisa.`) : "Registre suas receitas para eu medir quanto da renda está comprometida."}
      </Finding>

      {c.income > 0 && (
        <>
          <View style={{ marginTop: 18, marginHorizontal: 20, height: 26, flexDirection: "row", gap: 2, borderRadius: 7, overflow: "hidden" }}>
            {parts.map((p) => (
              <View key={p.label} style={{ flex: p.v, backgroundColor: p.hex }} />
            ))}
            {free > 0 && <View style={{ flex: free, backgroundColor: "rgba(255,255,255,0.06)" }} />}
          </View>
          <View style={{ marginTop: 8 }}>
            {parts.map((p, i) => (
              <Row key={p.label} first={i === 0} title={p.label} note={`${Math.round((p.v / total) * 100)}% da renda`} value={money(p.v)} />
            ))}
            <Row title="Livre depois disso" value={money(free)} risk={free < 0} note={free < 0 ? "Sai mais do que entra neste mês." : null} />
          </View>
        </>
      )}

      {months.length > 0 && (
        <>
          <Heading>Os próximos meses</Heading>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120, paddingHorizontal: 20 }}>
            {months.map((m) => {
              const over = m.despesa > m.receita;
              return (
                <View key={m.mes} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ marginBottom: 4, fontSize: 11, ...face(600), ...NUMS, color: over ? RISK : INK.soft }}>{short(m.despesa)}</Text>
                  <View style={{ width: "100%", height: 82 * (m.despesa / peak), borderRadius: 4, backgroundColor: over ? RISK : m === heavy ? SKY : "rgba(255,255,255,0.18)" }}>
                    {/* The tick is what comes in. */}
                    <View style={{ position: "absolute", left: -2, right: -2, bottom: 82 * (m.receita / peak) - 1, height: 2, backgroundColor: "#fff" }} />
                  </View>
                  <Text style={{ marginTop: 5, fontSize: 12, ...face(500), color: INK.softer }}>{m.mes.slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ marginTop: 12, paddingHorizontal: 20, fontSize: 14, lineHeight: 20, ...face(500), color: INK.soft }}>
            {heavy ? `${heavy.mes.replace(/ de \d{4}$/, "").replace(/^./, (x) => x.toUpperCase())} é o mês mais pesado: ${money(heavy.despesa)}. ` : ""}A linha branca é o que está previsto para entrar.
          </Text>
        </>
      )}

      {data.installments.purchases.length > 0 && <Heading>{`Parcelas: ${money(data.installments.monthly)} por mês`}</Heading>}
      {data.installments.purchases.slice(0, 5).map((p, i) => (
        <Row key={`${p.name}${i}`} first={i === 0} title={p.name} note={`Faltam ${p.remaining} de ${p.total}`} value={money(p.amount)} />
      ))}
      {data.installments.freeFrom ? <Limitation>{`Sem nada novo, você fica livre das parcelas em ${data.installments.freeFrom}.`}</Limitation> : null}
      <Limitation>O limite do cartão não entra como dinheiro disponível, e a fatura não conta como gasto novo.</Limitation>
    </View>
  );
}

/* ---- Futuro ---- */

function BalanceLine({ data }: { data: RaioXData }) {
  const { width } = useWindowDimensions();
  const w = width - 40;
  const h = 170;
  const days = data.forecast.days;
  const values = days.map((d) => d.balance);
  const top = Math.max(...values, 0, data.forecast.optimistic);
  const low = Math.min(...values, 0, data.forecast.conservative);
  const y = (v: number) => 12 + ((top - v) / Math.max(top - low, 1)) * (h - 30);
  const x = (i: number) => (i / Math.max(days.length - 1, 1)) * (w - 2) + 1;
  const point = (i: number) => `${x(i).toFixed(1)} ${y(days[i].balance).toFixed(1)}`;
  const todayAt = Math.max(0, days.findIndex((d) => d.isToday));
  const path = (from: number, to: number) => (to <= from ? "" : Array.from({ length: to - from + 1 }, (_, n) => `${n === 0 ? "M" : "L"}${point(from + n)}`).join(""));
  const end = days.length - 1;
  const lowest = data.forecast.lowest;
  return (
    <View style={{ marginTop: 16, marginHorizontal: 20 }}>
      <Svg width={w} height={h}>
        <Line x1={0} y1={y(0)} x2={w} y2={y(0)} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 4" />
        {/* The range it could end in: wider, the less is known. */}
        <Path d={`M${point(todayAt)}L${x(end)} ${y(data.forecast.optimistic)}L${x(end)} ${y(data.forecast.conservative)}Z`} fill={SKY} fillOpacity={0.12} />
        <Path d={path(0, todayAt)} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d={path(todayAt, end)} stroke={data.forecast.endBalance < 0 ? RISK : SKY} strokeWidth={2} strokeDasharray="5 4" fill="none" />
        <Circle cx={x(todayAt)} cy={y(days[todayAt]?.balance ?? 0)} r={4} fill="#fff" />
        <SvgText x={2} y={h - 2} fill={INK.softer} fontSize={11} fontFamily={CHART_FONT}>
          dia 1
        </SvgText>
        <SvgText x={w - 2} y={h - 2} fill={INK.softer} fontSize={11} fontFamily={CHART_FONT} textAnchor="end">
          {`dia ${days[end]?.day ?? ""}`}
        </SvgText>
      </Svg>
      <Text style={{ marginTop: 6, fontSize: 13.5, lineHeight: 19, ...face(500), color: INK.soft }}>
        A linha cheia já aconteceu; a tracejada é a estimativa, e a faixa mostra até onde ela pode variar{lowest ? `. O ponto mais baixo é o dia ${lowest.day}: ${money(lowest.balance)}.` : "."}
      </Text>
    </View>
  );
}

function MonthsBars({ months }: { months: { mes: string; sobra: number }[] }) {
  const peak = Math.max(...months.map((m) => Math.abs(m.sobra)), 1);
  return (
    <View style={{ marginTop: 18, paddingHorizontal: 20, flexDirection: "row", gap: 10 }}>
      {months.map((m) => (
        <View key={m.mes} style={{ flex: 1, alignItems: "center" }}>
          <View style={{ height: 66, justifyContent: "flex-end", width: "100%" }}>{m.sobra >= 0 && <View style={{ height: Math.max(3, (m.sobra / peak) * 62), borderRadius: 4, backgroundColor: SKY }} />}</View>
          <View style={{ height: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.3)" }} />
          <View style={{ height: 66, width: "100%" }}>{m.sobra < 0 && <View style={{ height: Math.max(3, (-m.sobra / peak) * 62), borderRadius: 4, backgroundColor: RISK }} />}</View>
          <Text style={{ fontSize: 12, ...face(500), color: INK.softer }}>{m.mes.slice(0, 3)}</Text>
          <Text style={{ marginTop: 2, fontSize: 11.5, ...face(700), ...NUMS, color: m.sobra < 0 ? RISK : "#fff" }}>{short(m.sobra)}</Text>
        </View>
      ))}
    </View>
  );
}

export function Futuro({ data, snapshot }: { data: RaioXData; snapshot: RadarSnapshot }) {
  const [period, setPeriod] = useState<"mes" | "tres" | "seis">("mes");
  const f = data.forecast;
  const all = snapshot.previsao?.proximos_meses ?? [];
  const months = all.slice(0, period === "tres" ? 3 : 6);
  const firstBad = months.find((m) => m.sobra < 0);
  const lead =
    period === "mes"
      ? f.negativeDay
        ? `No ritmo de agora, o saldo fica negativo no dia ${f.negativeDay}.`
        : `No ritmo de agora, o mês fecha em ${money(f.endBalance)}.`
      : firstBad
        ? `${firstBad.mes.replace(/ de \d{4}$/, "").replace(/^./, (x) => x.toUpperCase())} é o primeiro mês em que falta dinheiro.`
        : "Com o que está lançado hoje, os próximos meses fecham no azul.";
  return (
    <View>
      <Finding risk={period === "mes" ? f.endBalance < 0 : !!firstBad} note={period === "mes" ? `Pode variar de ${money(f.conservative)} a ${money(f.optimistic)}.` : "Considera só o que já está lançado: receitas, fixos, parcelas e faturas."}>
        {lead}
      </Finding>
      <Tabs
        value={period}
        onChange={setPeriod}
        options={[
          { key: "mes", label: "Este mês" },
          { key: "tres", label: "3 meses" },
          { key: "seis", label: "6 meses" },
        ]}
      />
      {period === "mes" ? <BalanceLine data={data} /> : <MonthsBars months={months} />}
      {period === "mes" && (
        <>
          <Heading>De onde vem essa conta</Heading>
          <Row first title="Previsto para entrar" note="Receitas lançadas que ainda não caíram" value={money(f.incomeRest)} />
          <Row title="Já agendado para sair" note="Contas, parcelas e faturas lançadas" value={money(f.committedRest)} />
          <Row title="Estimado no seu ritmo" note="O que você costuma gastar por dia, até o fim do mês" value={money(f.estimatedRest)} />
          {f.reasons.length > 0 && <Heading>O que mais pesa</Heading>}
          {f.reasons.slice(0, 4).map((r, i) => (
            <Row key={r.label} first={i === 0} title={r.label} value={money(r.amount)} />
          ))}
        </>
      )}
      <Limitation>{`Isto é uma previsão, não uma garantia. ${f.confidence.pct}% dela vem do que já está lançado, e o resto é estimativa do seu ritmo.`}</Limitation>
    </View>
  );
}

/* ---- Saúde ---- */

const AXIS: Record<string, string> = { contas: "Contas", sobra: "Sobra", saldo: "Saldo", gastos: "Gastos", credito: "Crédito", reserva: "Reserva" };

function Spider({ data }: { data: RaioXData }) {
  const { width } = useWindowDimensions();
  const pillars = data.report.pillars;
  const size = Math.min(width - 40, 300);
  const c = size / 2;
  const r = c - 42;
  const at = (i: number, k: number) => {
    const a = ((i * 360) / pillars.length - 90) * (Math.PI / 180);
    return { x: c + r * k * Math.cos(a), y: c + r * k * Math.sin(a) };
  };
  const shape = pillars.map((p, i) => at(i, Math.max(0.06, p.points / p.max))).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  return (
    <View style={{ marginTop: 14, alignItems: "center" }}>
      <Svg width={size} height={size}>
        {[1, 0.66, 0.33].map((k) => (
          <Polygon key={k} points={pillars.map((_, i) => at(i, k)).map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke="rgba(255,255,255,0.1)" />
        ))}
        {pillars.map((p, i) => {
          const q = at(i, 1);
          return <Line key={p.key} x1={c} y1={c} x2={q.x} y2={q.y} stroke="rgba(255,255,255,0.1)" />;
        })}
        <Polygon points={shape} fill={SKY} fillOpacity={0.22} stroke={ICE} strokeWidth={1.5} />
        {pillars.map((p, i) => {
          const q = at(i, Math.max(0.06, p.points / p.max));
          return <Rect key={p.key} x={q.x - 2.5} y={q.y - 2.5} width={5} height={5} rx={2.5} fill={p.tone === "critico" ? RISK : "#fff"} />;
        })}
        {pillars.map((p, i) => {
          const q = at(i, 1.14);
          return (
            <SvgText key={p.key} x={q.x} y={q.y + 4} fill="rgba(255,255,255,0.72)" fontSize={11.5} fontFamily={CHART_FONT} textAnchor={Math.abs(q.x - c) < 8 ? "middle" : q.x > c ? "start" : "end"}>
              {AXIS[p.key]}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

export function Saude({ data, onAsk }: { data: RaioXData; onAsk: Ask }) {
  const pillars = data.report.pillars;
  /* Nothing registered is not a fault: it is left out of the judgement and said as such. */
  const unknown = (p: (typeof pillars)[number]) => p.key === "reserva" && data.reserve <= 0;
  const good = pillars.filter((p) => !unknown(p) && (p.tone === "otimo" || p.tone === "ok"));
  const watch = pillars.filter((p) => !unknown(p) && (p.tone === "atencao" || p.tone === "critico"));
  const missing = pillars.filter(unknown);
  const { previousScore, report } = data;
  const trend = previousScore == null ? null : report.score > previousScore + 10 ? "Melhorou em relação ao mês passado." : report.score < previousScore - 10 ? "Piorou em relação ao mês passado." : "Parecido com o mês passado.";

  return (
    <View>
      <Finding risk={watch.some((p) => p.tone === "critico")} note={trend}>
        {report.headline}
      </Finding>
      <Spider data={data} />
      <Limitation>Cada ponta é um critério: quanto mais longe do centro, melhor. Os motivos estão aqui embaixo.</Limitation>

      {watch.length > 0 && <Heading>Merece atenção</Heading>}
      {watch.map((p, i) => (
        <Row key={p.key} first={i === 0} title={p.label} note={p.detail} risk={p.tone === "critico"} />
      ))}
      {good.length > 0 && <Heading>Está indo bem</Heading>}
      {good.map((p, i) => (
        <Row key={p.key} first={i === 0} title={p.label} note={p.detail} />
      ))}
      {missing.length > 0 && <Heading>Sem dados ainda</Heading>}
      {missing.map((p, i) => (
        <Row key={p.key} first={i === 0} title={p.label} note="Você ainda não cadastrou uma reserva. Isso aparece no gráfico como vazio, mas não é um erro seu." />
      ))}

      {data.plan.actions.length > 0 && <Heading>O que mais ajudaria agora</Heading>}
      {data.plan.actions.slice(0, 3).map((a, i) => (
        <Row key={a.id} first={i === 0} title={a.title} note={a.detail} value={a.saving > 0 ? `+${money(a.saving)}` : null} onPress={() => onAsk(`Como faço isso: ${clean(a.title)}?`)} />
      ))}
    </View>
  );
}

/* ---- Perguntas ---- */

const QUICK = [
  "Onde estou gastando mais este mês?",
  "Quais despesas aumentaram?",
  "Quanto da minha renda está comprometida?",
  "Como estarão minhas finanças nos próximos três meses?",
  "Quais parcelas ainda tenho pela frente?",
  "Quais são meus maiores compromissos futuros?",
  "Como estão minhas metas?",
  "Posso assumir uma nova despesa?",
];

export function QuickAsks({ onAsk }: { onAsk: Ask }) {
  return (
    <View>
      <Heading>Perguntar ao Willo</Heading>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {QUICK.map((q) => (
          <Pressable key={q} onPress={() => onAsk(q)} style={({ pressed }) => ({ height: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: "rgba(191,227,255,0.22)", opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13.5, ...face(600), color: "#fff" }}>{q}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
