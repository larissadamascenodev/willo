import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import type { RaioXData } from "@/hooks/useRaioX";
import { isSpend, type RawTx } from "@/services/raioXAnalytics";
import { Action, Bars, Card, CARD_INSET, Donut, Finding, ICE, Key, Limitation, Meter, NUMS, RISK, Row, SHADES, SKY, Tabs, Tile, Tiles, clean, type SectorKey } from "~/components/radar/parts";
import { face } from "~/lib/chatFont";
import { money } from "~/lib/money";
import { MONTH_NAMES } from "~/lib/purchaseSim";
import { INK } from "~/theme/tokens";

/**
 * The first five sectors of the Radar. Each opens with one sentence saying what the numbers
 * mean, then its findings in separate cards, one subject to a card: a chart or a few figures
 * first, and the words only where they add something. Details open on a touch instead of
 * sitting on the page. All of it comes from the same readings the web's Radar and the assistant
 * use. The balance and the month's in and out are not here: those belong to the home.
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
const abbreviated = (key: string) => MONTH_NAMES[Number(key.slice(5, 7)) - 1].slice(0, 3).replace(/^./, (x) => x.toUpperCase());
const monthTitle = (mes: string) => mes.replace(/ de \d{4}$/, "").replace(/^./, (x) => x.toUpperCase());
const monthShort = (mes: string) => mes.slice(0, 3).replace(/^./, (x) => x.toUpperCase());
const noteStyle = { fontSize: 13.5, lineHeight: 19, ...face(500), color: INK.soft };

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
  const [all, setAll] = useState(false);
  /* Paying an invoice is not spending: its purchases are already counted, each in its own category. */
  /* What has happened: a bill still waiting, or a date still ahead, has not left yet. */
  const spend = useMemo(() => {
    const d = data.today;
    const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return data.txs.filter((t) => isSpend(t) && !/^(faturas?|pagamento de fatura)$/i.test(t.category.trim()) && t.date <= todayKey && (t.payment_method === "cartao" || t.status === "pago"));
  }, [data.txs, data.today]);
  const today = data.today;
  const thisMonth = shift(today, 0);
  const threeMonths = [shift(today, -2), shift(today, -1), thisMonth];
  const keys = period === "mes" ? [thisMonth] : threeMonths;
  const shown = byCategory(spend, keys);
  const before = byCategory(spend, [shift(today, -3), shift(today, -2), shift(today, -1)]);
  const lastMonth = byCategory(spend, [shift(today, -1)]);
  const total = [...shown.values()].reduce((s, c) => s + c.total, 0);
  const rows = [...shown.entries()].map(([name, c]) => ({ name, ...c, usual: (before.get(name)?.total ?? 0) / 3, prev: lastMonth.get(name)?.total ?? 0 })).sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.map((r) => Math.max(r.total, r.usual)), 1);
  const top = rows[0];

  /* The ring: the largest five, and everything else as one. */
  const rest = rows.slice(5).reduce((s, r) => s + r.total, 0);
  const slices = [...rows.slice(0, 5).map((r, i) => ({ label: r.name, value: r.total, hex: SHADES[i] })), ...(rest > 0 ? [{ label: "Outros", value: rest, hex: SHADES[5] }] : [])];

  const inPeriod = spend.filter((t) => keys.includes(monthKey(t.date)));
  const planned = inPeriod.filter((t) => t.recurrence_type === "fixa" || (t.installments ?? 0) > 1).reduce((s, t) => s + t.amount, 0);
  const biggest = [...inPeriod].sort((a, b) => b.amount - a.amount).slice(0, 3);

  const rising = period === "mes" ? rows.filter((r) => r.usual > 0 && r.total > r.usual * 1.15).sort((a, b) => b.total - b.usual - (a.total - a.usual)).slice(0, 3) : [];
  /* A month just begun has spent little of everything: nothing has fallen yet. It is compared with
     what the normal would be by this day, and only once enough of the month has gone by. */
  const elapsed = today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const falling = period === "mes" && today.getDate() >= 10 ? [...before.entries()].map(([name, b]) => ({ name, usual: b.total / 3, now: shown.get(name)?.total ?? 0 })).filter((r) => r.usual > 0 && r.now < r.usual * elapsed * 0.85).sort((a, b) => b.usual - b.now - (a.usual - a.now)).slice(0, 3) : [];
  const perMonth = threeMonths.map((key) => ({ key, label: abbreviated(key), value: spend.filter((t) => monthKey(t.date) === key).reduce((s, t) => s + t.amount, 0), on: key === thisMonth }));

  return (
    <View>
      <Tabs
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setOpen(null);
          setAll(false);
        }}
        options={[
          { key: "mes", label: "Este mês" },
          { key: "tres", label: "Últimos 3 meses" },
        ]}
      />
      <Finding>{top ? `${top.name} levou ${Math.round((top.total / total) * 100)}% do seu dinheiro.` : "Ainda não há gastos neste período."}</Finding>

      {rows.length > 0 && (
        <Card title="Para onde foi">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Donut slices={slices} size={124} centre={short(total)} caption="já gastos" />
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              {slices.map((s) => (
                <Key key={s.label} hex={s.hex} label={s.label} value={`${Math.round((s.value / total) * 100)}%`} />
              ))}
            </View>
          </View>
        </Card>
      )}

      {period === "tres" && rows.length > 0 && (
        <Card title="Mês a mês">
          <Bars items={perMonth.map((m) => ({ key: m.key, label: m.label, value: m.value, top: short(m.value), on: m.on }))} />
        </Card>
      )}

      {rows.length > 0 && (
        <Card title="Por categoria" note={period === "mes" ? "O traço branco é o seu normal. Toque para ver mais." : "Toque para ver mais."}>
          {(all ? rows : rows.slice(0, 5)).map((r, i) => {
            const limit = data.limits.find((l) => l.category === r.name)?.limit ?? null;
            const isOpen = open === r.name;
            const over = period === "mes" && r.usual > 0 && r.total > r.usual * 1.15;
            const names = new Map<string, number>();
            for (const t of r.txs) names.set(t.name, (names.get(t.name) ?? 0) + t.amount);
            const months = [-3, -2, -1, 0].map((n) => ({ key: shift(today, n), value: spend.filter((t) => t.category === r.name && monthKey(t.date) === shift(today, n)).reduce((s, t) => s + t.amount, 0) }));
            return (
              <Row key={r.name} first={i === 0} title={r.name} value={money(r.total)} risk={over} onPress={() => setOpen(isOpen ? null : r.name)}>
                <Meter share={r.total / max} tick={period === "mes" && r.usual > 0 ? r.usual / max : undefined} risk={over} />
                {isOpen && (
                  <View style={{ marginTop: 14 }}>
                    <Bars height={64} items={months.map((m) => ({ key: m.key, label: abbreviated(m.key), value: m.value, on: m.key === thisMonth }))} />
                    <Tiles>
                      <Tile label="Compras" value={String(r.count)} />
                      <Tile label="Seu normal" value={r.usual > 0 ? money(r.usual) : "Sem dados"} />
                    </Tiles>
                    <Text style={[noteStyle, { marginTop: 10 }]}>
                      Mais em{" "}
                      {[...names.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([n]) => n)
                        .join(", ")}
                      .
                    </Text>
                    {limit ? <Text style={{ marginTop: 4, fontSize: 13.5, ...face(600), color: r.total > limit ? RISK : "#fff" }}>{Math.round((r.total / limit) * 100)}% do limite de {money(limit)}</Text> : null}
                    <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Action label="Por que gastei isso?" onPress={() => onAsk(`Quanto gastei com ${r.name} nos últimos meses e por quê?`)} />
                      <Action label="Como gastar menos?" onPress={() => onAsk(`Como gastar menos com ${r.name}?`)} />
                    </View>
                  </View>
                )}
              </Row>
            );
          })}
          {rows.length > 5 && (
            <Pressable onPress={() => setAll(!all)} hitSlop={6} style={{ paddingTop: 10 }}>
              <Text style={{ fontSize: 14, ...face(700), color: ICE }}>{all ? "Ver menos" : `Ver todas as ${rows.length}`}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {total > 0 && (
        <Card title="O que você escolhe">
          <View style={{ height: 10, flexDirection: "row", gap: 2 }}>
            <View style={{ flex: Math.max(planned, 1), borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" }} />
            <View style={{ flex: Math.max(total - planned, 1), borderRadius: 3, backgroundColor: SKY }} />
          </View>
          <Tiles>
            <Tile dot="rgba(255,255,255,0.3)" label="Fixos e parcelas" value={money(planned)} />
            <Tile dot={SKY} label="Dia a dia" value={money(total - planned)} />
          </Tiles>
        </Card>
      )}

      {(rising.length > 0 || falling.length > 0) && (
        <Card title="Comparado ao seu normal">
          {rising.map((r, i) => (
            <Row key={r.name} first={i === 0} title={r.name} note={`Normal: ${money(r.usual)}`} value={`+${money(r.total - r.usual)}`} risk />
          ))}
          {falling.map((r, i) => (
            <Row key={r.name} first={i === 0 && rising.length === 0} title={r.name} note={`Normal: ${money(r.usual)}`} value={money(r.now)} />
          ))}
        </Card>
      )}

      {biggest.length > 0 && (
        <Card title="Maiores compras">
          {biggest.map((t, i) => (
            <Row key={t.id} first={i === 0} title={t.name} note={`${t.category}, ${Number(t.date.slice(8))}/${Number(t.date.slice(5, 7))}`} value={money(t.amount)} />
          ))}
        </Card>
      )}
      <Limitation>Compras no cartão contam no dia da compra. O pagamento da fatura não entra de novo.</Limitation>
    </View>
  );
}

/* ---- Hábitos ---- */

export function Habitos({ data, onAsk }: { data: RaioXData; onAsk: Ask }) {
  const [open, setOpen] = useState<string | null>(null);
  const signal = data.anomalies[0];
  const week = data.weekday;
  const heads = data.leaks.leaks;
  const opportunities = data.report.opportunities.filter((o) => o.aboveAverage >= 1).slice(0, 3);
  /* A refund is not a second charge. */
  const duplicates = data.duplicates.filter((d) => d.amount > 0);
  const impulse = data.impulse;
  const nothing = !signal && heads.length === 0 && duplicates.length === 0 && !impulse?.count;
  const hasWeek = week.days.some((d) => d.avg > 0);

  return (
    <View>
      <Finding risk={!!signal?.recurring}>{signal ? signal.title : nothing ? "Ainda não vi nenhum padrão fora do normal." : clean(week.message)}</Finding>

      {!nothing && (
        <View style={{ marginHorizontal: CARD_INSET }}>
          <Tiles>
            <Tile label="Fora do normal" value={String(data.anomalies.length)} risk={data.anomalies.length > 0} />
            <Tile label="Se repete" value={data.leaks.yearly > 0 ? `${money(heads.reduce((s, l) => s + l.monthly, 0))}/mês` : "Nada"} />
          </Tiles>
        </View>
      )}

      {data.anomalies.length > 0 && (
        <Card title="Fora do seu normal">
          {data.anomalies.slice(0, 5).map((a, i) => (
            <Row key={a.id} first={i === 0} title={a.title} value={a.impact > 0 ? money(a.impact) : null} onPress={() => setOpen(open === a.id ? null : a.id)}>
              {open === a.id && (
                <View style={{ marginTop: 8 }}>
                  <Text style={noteStyle}>{clean(a.what)}</Text>
                  {a.action ? <Text style={[noteStyle, { marginTop: 6, color: "#fff" }]}>{clean(a.action)}</Text> : null}
                  <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Action label="Por que isso?" onPress={() => onAsk(`Me explica por que isso está fora do meu normal: ${clean(a.title)}`)} />
                    <Action label="Como evitar?" onPress={() => onAsk(`Como evito isso nos próximos meses: ${clean(a.title)}?`)} />
                  </View>
                </View>
              )}
            </Row>
          ))}
        </Card>
      )}

      {hasWeek && (
        <Card title="Seus dias de gastar">
          <Bars items={week.days.map((d, i) => ({ key: d.label, label: d.label, value: d.avg, on: i === week.peak }))} />
          <Text style={[noteStyle, { marginTop: 12 }]}>{clean(week.message)}</Text>
        </Card>
      )}

      {heads.length > 0 && (
        <Card title="O que se repete" right={data.leaks.yearly > 0 ? `${money(data.leaks.yearly)}/ano` : undefined}>
          {heads.slice(0, 5).map((l, i) => (
            <Row key={l.id} first={i === 0} title={l.title} note={l.detail} value={`${money(l.monthly)}/mês`} />
          ))}
        </Card>
      )}

      {duplicates.length > 0 && (
        <Card title="Cobranças parecidas" note="Vale conferir se não é a mesma compra duas vezes.">
          {duplicates.slice(0, 3).map((d, i) => (
            <Row key={`${d.name}${i}`} first={i === 0} title={d.name} note={d.dates.map((x) => `${Number(x.slice(8))}/${Number(x.slice(5, 7))}`).join(" e ")} value={money(d.amount)} />
          ))}
        </Card>
      )}

      {impulse && impulse.count > 0 && (
        <Card title="Compras por impulso" right={money(impulse.total)}>
          <Text style={noteStyle}>{clean(impulse.message)}</Text>
        </Card>
      )}

      {opportunities.length > 0 && (
        <Card title="Onde dá para economizar" note="Toque para o Willo sugerir como.">
          {opportunities.map((o, i) => (
            <Row key={o.category} first={i === 0} title={o.category} note="Acima do seu normal" value={money(o.aboveAverage)} onPress={() => onAsk(`Como economizar em ${o.category}?`)} />
          ))}
        </Card>
      )}

      {nothing && <Limitation>Com mais meses registrados, consigo comparar melhor. Por enquanto não vou tirar conclusões do que ainda não tenho.</Limitation>}
    </View>
  );
}

/* ---- Compromissos ---- */

export function Compromissos({ data, snapshot }: { data: RaioXData; snapshot: RadarSnapshot }) {
  const c = data.commitment;
  const months = (snapshot.previsao?.proximos_meses ?? []).slice(0, 6);
  const heavy = months.length ? months.reduce((a, b) => (b.despesa > a.despesa ? b : a)) : null;
  const pct = Math.round(c.committedPct * 100);
  const free = c.income - c.fixed - c.installments - c.card - c.variable;
  const parts = [
    { label: "Contas fixas", value: c.fixed, hex: SHADES[0] },
    { label: "Parcelas", value: c.installments, hex: SHADES[1] },
    { label: "Cartão no mês", value: c.card, hex: SHADES[2] },
    { label: "Outras contas", value: c.variable, hex: SHADES[3] },
    ...(free > 0 ? [{ label: "Livre", value: free, hex: "rgba(255,255,255,0.1)" }] : []),
  ].filter((p) => p.value > 0);

  return (
    <View>
      <Finding risk={pct >= 60}>
        {c.income > 0 ? (pct > 100 ? `Contas fixas e parcelas já passam da sua renda: ${pct}%.` : `${pct}% da sua renda já tem destino.`) : "Registre suas receitas para eu medir quanto da renda está comprometida."}
      </Finding>

      {c.income > 0 && (
        <Card title="Sua renda este mês" right={money(c.income)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Donut slices={parts} size={124} centre={`${pct}%`} caption="comprometida" risk={pct >= 60} />
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              {parts.map((p) => (
                <Key key={p.label} hex={p.hex} label={p.label} value={short(p.value)} />
              ))}
            </View>
          </View>
          {free < 0 && <Text style={{ marginTop: 12, fontSize: 14, ...face(600), color: RISK }}>Sai {money(-free)} a mais do que entra neste mês.</Text>}
        </Card>
      )}

      {months.length > 0 && (
        <Card title="Os próximos meses" note="A barra é o que sai. O traço branco, o que entra.">
          <Bars
            height={118}
            items={months.map((m) => ({ key: m.mes, label: monthShort(m.mes), value: m.despesa, top: short(m.despesa), on: m === heavy, risk: m.despesa > m.receita, tick: m.receita }))}
          />
          {heavy && <Text style={[noteStyle, { marginTop: 12 }]}>{`O mais pesado é ${monthTitle(heavy.mes)}: ${money(heavy.despesa)}.`}</Text>}
        </Card>
      )}

      {data.installments.purchases.length > 0 && (
        <Card title="Parcelas" right={`${money(data.installments.monthly)}/mês`}>
          <Tiles>
            <Tile label="Ainda faltam" value={money(data.installments.remainingTotal)} />
            <Tile label="Livre em" value={data.installments.freeFrom ?? "Sem previsão"} />
          </Tiles>
          <View style={{ marginTop: 6 }}>
            {data.installments.purchases.slice(0, 5).map((p, i) => (
              <Row key={`${p.name}${i}`} first={i === 0} title={p.name} value={money(p.amount)}>
                <Meter share={(p.total - p.remaining) / Math.max(p.total, 1)} />
                <Text style={{ marginTop: 5, fontSize: 12.5, ...face(500), ...NUMS, color: INK.softer }}>{`Faltam ${p.remaining} de ${p.total}`}</Text>
              </Row>
            ))}
          </View>
        </Card>
      )}
      <Limitation>O limite do cartão não entra como dinheiro disponível, e a fatura não conta como gasto novo.</Limitation>
    </View>
  );
}

/* ---- Futuro ---- */

/* The forecast only knows the days from today on; the ones gone by have no balance to draw. */
function BalanceLine({ data }: { data: RaioXData }) {
  const { width } = useWindowDimensions();
  const w = width - (CARD_INSET + 16) * 2;
  const h = 160;
  const days = data.forecast.days.filter((d) => Number.isFinite(d.balance));
  if (days.length === 0) return null;
  const values = days.map((d) => d.balance);
  const top = Math.max(...values, 0, data.forecast.optimistic);
  const low = Math.min(...values, 0, data.forecast.conservative);
  const y = (v: number) => 12 + ((top - v) / Math.max(top - low, 1)) * (h - 34);
  const x = (i: number) => (i / Math.max(days.length - 1, 1)) * (w - 10) + 5;
  const end = days.length - 1;
  const line = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(d.balance).toFixed(1)}`).join("");
  const lineHex = data.forecast.endBalance < 0 ? RISK : SKY;
  return (
    <View>
      <Svg width={w} height={h}>
        <Line x1={0} y1={y(0)} x2={w} y2={y(0)} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 4" />
        {/* The range it could end in: wider, the less is known. */}
        <Path d={`M${x(0)} ${y(days[0].balance)}L${x(end)} ${y(data.forecast.optimistic)}L${x(end)} ${y(data.forecast.conservative)}Z`} fill={SKY} fillOpacity={0.12} />
        <Path d={line} stroke={lineHex} strokeWidth={2} strokeDasharray="5 4" fill="none" />
        <Circle cx={x(0)} cy={y(days[0].balance)} r={4} fill="#fff" />
        <SvgText x={2} y={h - 2} fill={INK.softer} fontSize={11} fontFamily={CHART_FONT}>
          {`hoje, dia ${days[0].day}`}
        </SvgText>
        <SvgText x={w - 2} y={h - 2} fill={INK.softer} fontSize={11} fontFamily={CHART_FONT} textAnchor="end">
          {`dia ${days[end].day}`}
        </SvgText>
      </Svg>
      <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
        <Key hex="#fff" label="Hoje" />
        <Key hex={lineHex} label="Estimativa" />
        <Key hex="rgba(124,196,255,0.3)" label="Pode variar" />
      </View>
    </View>
  );
}

function MonthsBars({ months }: { months: { mes: string; sobra: number }[] }) {
  const peak = Math.max(...months.map((m) => Math.abs(m.sobra)), 1);
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {months.map((m) => (
        <View key={m.mes} style={{ flex: 1, alignItems: "center" }}>
          <View style={{ height: 56, justifyContent: "flex-end", width: "100%" }}>{m.sobra >= 0 && <View style={{ height: Math.max(3, (m.sobra / peak) * 52), borderRadius: 4, backgroundColor: SKY }} />}</View>
          <View style={{ height: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.3)" }} />
          <View style={{ height: 56, width: "100%" }}>{m.sobra < 0 && <View style={{ height: Math.max(3, (-m.sobra / peak) * 52), borderRadius: 4, backgroundColor: RISK }} />}</View>
          <Text style={{ fontSize: 12, ...face(500), color: INK.softer }}>{monthShort(m.mes)}</Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11.5, ...face(700), ...NUMS, color: m.sobra < 0 ? RISK : "#fff" }}>{short(m.sobra)}</Text>
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
        ? `${monthTitle(firstBad.mes)} é o primeiro mês em que falta dinheiro.`
        : "Com o que está lançado hoje, os próximos meses fecham no azul.";
  return (
    <View>
      <Tabs
        value={period}
        onChange={setPeriod}
        options={[
          { key: "mes", label: "Este mês" },
          { key: "tres", label: "3 meses" },
          { key: "seis", label: "6 meses" },
        ]}
      />
      <Finding risk={period === "mes" ? f.endBalance < 0 : !!firstBad}>{lead}</Finding>

      {period === "mes" ? (
        <>
          <View style={{ marginHorizontal: CARD_INSET }}>
            <Tiles>
              <Tile label="Dá para gastar" value={money(Math.max(f.safeToSpend, 0))} />
              <Tile label="Ponto mais baixo" value={f.lowest ? money(f.lowest.balance) : "Sem dados"} note={f.lowest ? `Dia ${f.lowest.day}` : undefined} risk={!!f.lowest && f.lowest.balance < 0} />
            </Tiles>
          </View>
          <Card title="Até o fim do mês" note={`Pode fechar entre ${money(f.conservative)} e ${money(f.optimistic)}.`}>
            <BalanceLine data={data} />
          </Card>
          <Card title="Como cheguei nessa conta">
            <Row first title="Saldo de hoje" note="O que está nas contas" value={money(snapshot.contas?.saldo_atual ?? 0)} />
            <Row title="Vai entrar" note="Receitas que ainda não caíram" value={`+${money(f.incomeRest)}`} />
            <Row title="Já agendado" note="Contas, parcelas e faturas" value={`−${money(f.committedRest)}`} />
            <Row title="No seu ritmo" note={`Cerca de ${money(f.estimatedRest / Math.max(data.forecast.days.filter((d) => d.estimated > 0).length, 1))} por dia`} value={`−${money(f.estimatedRest)}`} />
            <Row title="Fecha o mês em" value={money(f.endBalance)} risk={f.endBalance < 0} />
          </Card>
        </>
      ) : (
        <>
          <Card title="O que sobra a cada mês" note="Só o que já está lançado: receitas, fixos, parcelas e faturas.">
            <MonthsBars months={months} />
          </Card>
          <Card title="Mês a mês">
            {months.map((m, i) => (
              <Row key={m.mes} first={i === 0} title={monthTitle(m.mes)} note={`Entra ${short(m.receita)}, sai ${short(m.despesa)}`} value={money(m.sobra)} risk={m.sobra < 0} />
            ))}
          </Card>
        </>
      )}
      <Limitation>{`É uma previsão, não uma garantia. ${Math.round(f.confidence.pct * 100)}% dela vem do que já está lançado.`}</Limitation>
    </View>
  );
}

/* ---- Saúde ---- */

const AXIS: Record<string, string> = { contas: "Contas", sobra: "Sobra", saldo: "Saldo", gastos: "Gastos", credito: "Crédito", reserva: "Reserva" };

function Spider({ data }: { data: RaioXData }) {
  const { width } = useWindowDimensions();
  const pillars = data.report.pillars;
  const size = Math.min(width - (CARD_INSET + 16) * 2, 300);
  const c = size / 2;
  const r = c - 42;
  const at = (i: number, k: number) => {
    const a = ((i * 360) / pillars.length - 90) * (Math.PI / 180);
    return { x: c + r * k * Math.cos(a), y: c + r * k * Math.sin(a) };
  };
  const shape = pillars.map((p, i) => at(i, Math.max(0.06, p.points / p.max))).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  return (
    <View style={{ alignItems: "center" }}>
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
      <Card title="Como está cada parte" note="Quanto mais longe do centro, melhor.">
        <Spider data={data} />
      </Card>

      {watch.length > 0 && (
        <Card title="Merece atenção">
          {watch.map((p, i) => (
            <Row key={p.key} first={i === 0} title={p.label} note={p.detail} risk={p.tone === "critico"} />
          ))}
        </Card>
      )}
      {good.length > 0 && (
        <Card title="Está indo bem">
          {good.map((p, i) => (
            <Row key={p.key} first={i === 0} title={p.label} note={p.detail} />
          ))}
        </Card>
      )}
      {missing.length > 0 && (
        <Card title="Sem dados ainda">
          {missing.map((p, i) => (
            <Row key={p.key} first={i === 0} title={p.label} note="Você ainda não cadastrou uma reserva. Aparece vazio no gráfico, mas não é um erro seu." />
          ))}
        </Card>
      )}

      {data.plan.actions.length > 0 && (
        <Card title="O que mais ajudaria agora" note="Toque para o Willo explicar como.">
          {data.plan.actions.slice(0, 3).map((a, i) => (
            <Row key={a.id} first={i === 0} title={a.title} note={a.detail} value={a.saving > 0 ? `+${money(a.saving)}` : null} onPress={() => onAsk(`Como faço isso: ${clean(a.title)}?`)} />
          ))}
        </Card>
      )}
    </View>
  );
}

/* ---- Perguntas ---- */

/**
 * What to ask depends on what is on the screen: the sector, and what it found in these numbers.
 * One row to understand it, one to do something about it.
 */
export function asksFor(sector: SectorKey, data: RaioXData, snapshot: RadarSnapshot): { understand: string[]; improve: string[] } {
  const top = data.categories[0]?.name;
  const risingCat = data.categories.find((c) => c.average > 0 && c.spent > c.average * 1.15)?.name;
  const signal = data.anomalies[0];
  const peakDay = data.weekday.days[data.weekday.peak]?.label;
  const watch = data.report.pillars.filter((p) => p.tone === "atencao" || p.tone === "critico");
  const months = snapshot.previsao?.proximos_meses ?? [];
  const list = (items: (string | null | undefined | false)[]) => items.filter(Boolean) as string[];

  switch (sector) {
    case "consumo":
      return {
        understand: list([top && `Por que ${top} pesou tanto?`, risingCat && `O que mudou em ${risingCat}?`, "Quais despesas aumentaram?", "Onde estou gastando mais este mês?"]),
        improve: list([top && `Como gastar menos com ${top}?`, top && `Qual limite faz sentido para ${top}?`, "Onde consigo cortar sem sofrer?"]),
      };
    case "habitos":
      return {
        understand: list(["Quais compras ficaram fora do meu normal?", signal && `Me explica: ${clean(signal.title)}`, peakDay && `Por que gasto mais ${peakDay.toLowerCase()}?`, data.leaks.leaks.length > 0 && "O que mais se repete nos meus gastos?"]),
        improve: list(["Como evitar compras fora do normal?", data.impulse?.count ? "Como segurar as compras por impulso?" : null, data.leaks.leaks.length > 0 && "O que posso cancelar do que se repete?", data.duplicates.length > 0 && "Tem cobrança repetida para contestar?"]),
      };
    case "compromissos":
      return {
        understand: list(["Quanto da minha renda está comprometida?", data.installments.purchases.length > 0 && "Quais parcelas ainda tenho pela frente?", months.length > 0 && "Qual é o meu mês mais pesado?"]),
        improve: list(["Como liberar parte da minha renda?", "Posso assumir uma nova despesa?", data.installments.purchases.length > 0 && "Vale a pena antecipar parcelas?"]),
      };
    case "futuro":
      return {
        understand: list(["Como meu mês vai fechar?", "O que mais pesa no fim do mês?", months.length > 0 && "Como estarão os próximos três meses?"]),
        improve: list([data.forecast.endBalance < 0 ? "Como evitar ficar no negativo?" : "Quanto dá para guardar este mês?", "Quanto posso gastar até o fim do mês?", months.some((m) => m.sobra < 0) && "Como me preparar para os meses apertados?"]),
      };
    case "saude":
      return {
        understand: list([...watch.slice(0, 2).map((p) => `Por que ${p.label} merece atenção?`), "O que está indo bem?"]),
        improve: list(["O que faço primeiro para melhorar?", ...watch.slice(0, 2).map((p) => `Como melhorar ${p.label}?`)]),
      };
    default:
      return { understand: [], improve: [] };
  }
}

function AskRow({ label, items, onAsk }: { label: string; items: string[]; onAsk: Ask }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ marginBottom: 8, paddingHorizontal: CARD_INSET + 4, fontSize: 13, ...face(600), color: INK.soft }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: CARD_INSET, gap: 8 }}>
        {items.map((q) => (
          <Pressable key={q} onPress={() => onAsk(q)} style={({ pressed }) => ({ height: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13.5, ...face(600), color: "#fff" }}>{q}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function QuickAsks({ sector, data, snapshot, onAsk }: { sector: SectorKey; data: RaioXData; snapshot: RadarSnapshot; onAsk: Ask }) {
  const { understand, improve } = asksFor(sector, data, snapshot);
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={{ paddingHorizontal: CARD_INSET + 4, fontSize: 16, ...face(700), color: "#fff" }}>Perguntar ao Willo</Text>
      <AskRow label="Entender" items={understand} onAsk={onAsk} />
      <AskRow label="Melhorar" items={improve} onAsk={onAsk} />
    </View>
  );
}
