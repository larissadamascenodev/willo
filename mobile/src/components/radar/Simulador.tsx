import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import type { RaioXData } from "@/hooks/useRaioX";
import { Action, Card, CARD_INSET, Finding, ICE, Limitation, NUMS, RISK, Row, SKY, clean } from "~/components/radar/parts";
import type { RadarSnapshot } from "~/components/radar/Sectors";
import { useAuth } from "~/lib/auth";
import { face } from "~/lib/chatFont";
import { money } from "~/lib/money";
import { MONTH_NAMES, compare, deleteSim, loadSims, newPath, saveSim, simulate, startingPaths, type SavedSim, type SimContext, type SimPath, type SimResult } from "~/lib/purchaseSim";
import { INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * Trying a purchase before making it. The same purchase, several ways of paying it, all over
 * the same real numbers, drawn on top of one another. Nothing here touches the books: a
 * simulation only becomes a record if the person says so, and it goes through the same check
 * as any other entry, with the numbers as they are by then.
 */

const LINE_HEX = [ICE, SKY, "#FFFFFF", "#8FA6BA"];
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const readNumber = (s: string) => Number(s.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) || 0;
const dayMonth = (date: string) => `${Number(date.slice(8))}/${Number(date.slice(5, 7))}`;

function contextFrom(data: RaioXData, snapshot: RadarSnapshot, category: string | null): SimContext {
  return {
    balance: snapshot.contas?.saldo_atual ?? 0,
    months: (snapshot.previsao?.proximos_meses ?? []).flatMap((m) => {
      const found = m.mes.match(/^(\S+) de (\d{4})$/);
      const month = found ? MONTH_NAMES.indexOf(found[1]) + 1 : 0;
      return month ? [{ year: Number(found![2]), month, sobra: m.sobra }] : [];
    }),
    cards: (snapshot.cartoes ?? []).map((c) => ({ name: c.nome, limit: c.limite, used: c.usado, closingDay: c.fechamento })),
    income: data.commitment.income,
    goalsMonthly: data.goals.reduce((s, g) => s + (g.goal.monthlyContribution ?? 0), 0),
    categoryLimit: category ? (data.limits.find((l) => l.category === category)?.limit ?? null) : null,
    categorySpent: category ? (data.current.categories.find((c) => c.name === category)?.amount ?? 0) : 0,
  };
}

function Field({ label, value, onChange, placeholder, numeric }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 13, ...face(500), color: th(INK.soft) }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={th(INK.faint)}
        keyboardType={numeric ? "decimal-pad" : "default"}
        style={{ marginTop: 4, height: 44, fontSize: 17, ...face(700), ...NUMS, color: th("#fff"), borderBottomWidth: 1, borderBottomColor: th("rgba(191,227,255,0.35)", "line") }}
      />
    </View>
  );
}

function Pick({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ height: 34, paddingHorizontal: 13, borderRadius: 17, justifyContent: "center", backgroundColor: th(on ? "#fff" : "rgba(255,255,255,0.07)", "bg") }}>
      <Text style={{ fontSize: 13.5, ...face(on ? 700 : 500), color: th(on ? "#08090A" : "rgba(255,255,255,0.86)") }}>{label}</Text>
    </Pressable>
  );
}

/** Each way of paying over the months, on the same axes; the grey dashes are doing nothing. */
function Overlay({ results, chosen, base }: { results: SimResult[]; chosen: string; base: SimContext["months"] }) {
  const { width } = useWindowDimensions();
  const w = width - (CARD_INSET + 16) * 2;
  const h = 150;
  if (base.length < 2) return null;
  const values = [...base.map((m) => m.sobra), ...results.flatMap((r) => r.schedule.map((s) => s.sobraAfter)), 0];
  const top = Math.max(...values);
  const low = Math.min(...values);
  const x = (i: number) => (i / (base.length - 1)) * (w - 8) + 4;
  const y = (v: number) => 8 + ((top - v) / Math.max(top - low, 1)) * (h - 30);
  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  return (
    <View>
      <Svg width={w} height={h}>
        <Line x1={0} y1={y(0)} x2={w} y2={y(0)} stroke={th(RISK)} strokeOpacity={0.5} strokeDasharray="2 4" />
        <Path d={line(base.map((m) => m.sobra))} stroke={th("rgba(255,255,255,0.3)")} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
        {results.map((r, i) => (
          <Path key={r.path.id} d={line(r.schedule.map((s) => s.sobraAfter))} stroke={th(LINE_HEX[i % 4])} strokeWidth={r.path.id === chosen ? 3 : 1.5} strokeOpacity={r.path.id === chosen ? 1 : 0.45} fill="none" strokeLinejoin="round" />
        ))}
        {base.map((m, i) => (
          <SvgText key={`${m.year}${m.month}`} x={x(i)} y={h - 3} fill={th(INK.softer)} fontSize={11} fontFamily="PlusJakartaSans_600SemiBold" textAnchor={i === 0 ? "start" : i === base.length - 1 ? "end" : "middle"}>
            {MONTH_NAMES[m.month - 1].slice(0, 3)}
          </SvgText>
        ))}
      </Svg>
      <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, ...face(500), color: th(INK.softer) }}>O que sobra em cada mês. Tracejado é sem a compra; a linha vermelha é o zero.</Text>
    </View>
  );
}

export function Simulador({ data, snapshot, categories, onAsk }: { data: RaioXData; snapshot: RadarSnapshot; categories: string[]; onAsk: (question: string) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [simId, setSimId] = useState(uid);
  const [name, setName] = useState("");
  const [totalText, setTotalText] = useState("");
  const [dateText, setDateText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [paths, setPaths] = useState<SimPath[] | null>(null);
  const [chosen, setChosen] = useState("a");
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSim[]>(() => (user ? loadSims(user.id) : []));
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const total = readNumber(totalText);
  const firstCard = snapshot.cartoes?.[0]?.nome ?? null;
  const date = useMemo(() => {
    const m = dateText.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    const now = new Date();
    if (!m) return iso(now);
    const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getFullYear();
    return iso(new Date(year, Number(m[2]) - 1, Number(m[1])));
  }, [dateText]);

  const used = paths ?? (total > 0 ? startingPaths(total, firstCard) : []);
  const ctx = useMemo(() => contextFrom(data, snapshot, category), [data, snapshot, category]);
  const results = useMemo(() => (total > 0 ? used.map((p) => simulate(total, date, p, ctx)) : []), [total, used, date, ctx]);
  const result = results.find((r) => r.path.id === chosen) ?? results[0];
  const summary = compare(results);

  const edit = (id: string, patch: Partial<SimPath>) => setPaths(used.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = () => {
    if (used.length >= 4) return;
    const p = newPath(uid(), firstCard ? "cartao" : "conta", 3, 0, firstCard);
    setPaths([...used, p]);
    setChosen(p.id);
    setEditing(p.id);
  };
  const reset = () => {
    setSimId(uid());
    setName("");
    setTotalText("");
    setDateText("");
    setCategory(null);
    setPaths(null);
    setBuying(false);
    setNotice(null);
  };
  const keep = () => {
    if (!user || total <= 0) return;
    saveSim(user.id, { id: simId, name: name.trim() || "Compra simulada", total, date, category, paths: used, at: Date.now() });
    setSaved(loadSims(user.id));
    setNotice("Simulação salva. Ela não entrou nas suas contas.");
  };
  const reopen = (s: SavedSim) => {
    setSimId(s.id);
    setName(s.name);
    setTotalText(String(s.total).replace(".", ","));
    setDateText(dayMonth(s.date));
    setCategory(s.category);
    setPaths(s.paths);
    setChosen(s.paths[0]?.id ?? "a");
    setBuying(false);
    setNotice("Refiz as contas com os seus números de agora.");
  };
  const askWillo = () => {
    if (!result) return;
    onAsk(`Simulei ${name.trim() || "uma compra"} de ${money(total)}: ${results.map((r) => `${r.label}${r.path.parts > 1 ? ` de ${money(r.perPart)}` : ""}`).join("; ")}. Qual faz mais sentido para o meu momento?`);
  };
  const register = () => {
    if (!result) return;
    const p = result.path;
    const pay = p.kind === "cartao" ? `no crédito ${p.cardName ?? ""}` : "no débito";
    const frase = [name.trim() || "Compra", String(total).replace(".", ","), pay, p.parts > 1 ? `em ${p.parts}x` : "", dateText ? `dia ${dayMonth(date)}` : ""].filter(Boolean).join(" ");
    router.push({ pathname: "/rapido", params: { frase } } as never);
  };

  return (
    <View>
      <Finding note="Nada aqui entra nas suas contas. É só para ver o que aconteceria.">{result ? result.reading : "O que você está pensando em comprar?"}</Finding>

      <Card title="A compra">
      <View style={{ gap: 14 }}>
        <Field label="O que é" value={name} onChange={setName} placeholder="Notebook" />
        <View style={{ flexDirection: "row", gap: 18 }}>
          <Field label="Valor total" value={totalText} onChange={setTotalText} placeholder="4.800" numeric />
          <Field label="Data da compra" value={dateText} onChange={setDateText} placeholder={`Hoje, ${dayMonth(iso(new Date()))}`} />
        </View>
        {categories.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {categories
              .filter((c) => data.limits.some((l) => l.category === c) || c === category)
              .slice(0, 6)
              .map((c) => (
                <Pick key={c} label={c} on={c === category} onPress={() => setCategory(c === category ? null : c)} />
              ))}
          </View>
        )}
      </View>
      </Card>

      {results.length > 0 && result && (
        <>
          <Card title="Jeitos de pagar" note="Toque em um para ver como fica.">
          {results.map((r, i) => {
            const on = r.path.id === result.path.id;
            return (
              <View key={r.path.id}>
                <Row
                  first={i === 0}
                  title={r.label}
                  note={r.path.parts > 1 ? `${r.path.parts}x de ${money(r.perPart)}${r.interest > 0.5 ? `, ${money(r.interest)} de juros` : ""}` : "Sai tudo de uma vez"}
                  value={money(r.paid)}
                  risk={r.overLimit}
                  onPress={() => {
                    setChosen(r.path.id);
                    setBuying(false);
                  }}
                >
                  {on && <View style={{ position: "absolute", left: -10, top: i === 0 ? 0 : 11, width: 3, height: 34, borderRadius: 2, backgroundColor: th(LINE_HEX[i % 4], "bg") }} />}
                </Row>
                {on && (
                  <Pressable onPress={() => setEditing(editing === r.path.id ? null : r.path.id)} hitSlop={6} style={{ paddingBottom: 8 }}>
                    <Text style={{ fontSize: 13.5, ...face(600), color: th(ICE) }}>{editing === r.path.id ? "Pronto" : "Ajustar este jeito"}</Text>
                  </Pressable>
                )}
                {editing === r.path.id && (
                  <View style={{ paddingBottom: 12, gap: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <Pick label="Conta" on={r.path.kind === "conta"} onPress={() => edit(r.path.id, { kind: "conta", cardName: null })} />
                      {(snapshot.cartoes ?? []).map((c) => (
                        <Pick key={c.nome} label={c.nome} on={r.path.kind === "cartao" && r.path.cardName === c.nome} onPress={() => edit(r.path.id, { kind: "cartao", cardName: c.nome })} />
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 16 }}>
                      <Field label="Parcelas" numeric value={String(r.path.parts)} onChange={(v) => edit(r.path.id, { parts: Math.min(Math.max(1, Math.round(readNumber(v))), 72) })} />
                      <Field label="Entrada" numeric value={r.path.entry ? String(r.path.entry).replace(".", ",") : ""} placeholder="0" onChange={(v) => edit(r.path.id, { entry: readNumber(v) })} />
                      <Field label="Juros ao mês %" numeric value={r.path.ratePct ? String(r.path.ratePct).replace(".", ",") : ""} placeholder="0" onChange={(v) => edit(r.path.id, { ratePct: readNumber(v) })} />
                    </View>
                    {used.length > 1 && (
                      <Pressable
                        onPress={() => {
                          setPaths(used.filter((p) => p.id !== r.path.id));
                          setEditing(null);
                        }}
                      >
                        <Text style={{ fontSize: 13.5, ...face(600), color: th(INK.soft) }}>Tirar este jeito</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {used.length < 4 && (
            <Pressable onPress={add} style={{ paddingTop: 8 }}>
              <Text style={{ fontSize: 14, ...face(700), color: th(ICE) }}>Comparar outro jeito</Text>
            </Pressable>
          )}
          </Card>

          <Card title="Lado a lado">
          <Overlay results={results} chosen={result.path.id} base={ctx.months} />
          {summary ? <Limitation>{summary}</Limitation> : null}
          </Card>

          <Card title={`Pagando assim: ${result.label}`}>
          <Row first title="Hoje na conta" note={`Fica em ${money(result.balanceAfter)}`} value={result.today > 0 ? `−${money(result.today)}` : "Nada sai hoje"} risk={result.balanceAfter < 0} />
          {result.limitAfter != null && <Row title={`Limite do ${result.path.cardName ?? "cartão"}`} note={`${money(total - result.path.entry)} ficam presos no limite`} value={`${money(result.limitAfter)} livres`} risk={result.overLimit} />}
          {result.firstInvoice && <Row title="Primeira cobrança" note="Conforme o dia de fechamento do cartão" value={`fatura de ${MONTH_NAMES[result.firstInvoice.month - 1]}`} />}
          {result.incomeShare != null && <Row title="Da sua renda, por mês" note={`Enquanto durarem as ${result.path.parts} parcelas`} value={`+${Math.round(result.incomeShare * 100)}%`} />}
          {result.schedule
            .filter((s) => s.charge > 0)
            .map((s) => (
              <Row key={`${s.year}${s.month}`} title={MONTH_NAMES[s.month - 1].replace(/^./, (x) => x.toUpperCase())} note={`Sobra de ${money(s.sobraBefore)} vira ${money(s.sobraAfter)}`} value={`−${money(s.charge)}`} risk={s.sobraAfter < 0} />
            ))}
          {result.partsBeyond > 0 && <Limitation>{`E mais ${result.partsBeyond} ${result.partsBeyond === 1 ? "parcela" : "parcelas"} depois dos meses que consigo prever.`}</Limitation>}
          {result.goalsAtRisk && <Limitation>Nos meses de parcela, o que sobra não cobre mais o que você guarda nas suas metas.</Limitation>}
          {result.categoryOver != null && <Limitation>{`Passa ${money(result.categoryOver)} do limite de ${category}.`}</Limitation>}
          {result.path.ratePct <= 0 && result.path.parts > 1 && <Limitation>Sem juros porque nenhum foi informado. Se a loja cobrar, coloque em “Ajustar este jeito”.</Limitation>}
          </Card>

          <View style={{ marginTop: 16, paddingHorizontal: CARD_INSET, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Action label="Perguntar ao Willo" onPress={askWillo} />
            <Action label="Salvar simulação" onPress={keep} />
            <Action label="Vou comprar" onPress={() => setBuying(true)} />
            <Action label="Limpar" onPress={reset} />
          </View>
          {notice ? <Limitation>{notice}</Limitation> : null}

          {buying && (
            <View style={{ marginTop: 16, marginHorizontal: CARD_INSET, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: th("rgba(191,227,255,0.3)", "line") }}>
              <Text style={{ fontSize: 16, lineHeight: 22, ...face(700), color: th("#fff") }}>Com os números de agora:</Text>
              <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 20, ...face(500), color: th(INK.soft) }}>{clean(result.reading)}</Text>
              {result.path.entry > 0 || result.path.ratePct > 0 ? (
                <Text style={{ marginTop: 10, fontSize: 14, lineHeight: 19, ...face(500), color: th(INK.soft) }}>Com entrada ou juros, registre pelo Adicionar manualmente: lance a entrada e as parcelas separadas, nos valores reais.</Text>
              ) : (
                <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
                  <Action strong label="Revisar e registrar" onPress={register} />
                </View>
              )}
            </View>
          )}
        </>
      )}

      {saved.length > 0 && (
      <Card title="Simulações salvas">
      {saved.map((s, i) => (
        <Row key={s.id} first={i === 0} title={s.name} note={`${s.paths.length} ${s.paths.length === 1 ? "jeito" : "jeitos"} de pagar`} value={money(s.total)} onPress={() => reopen(s)}>
          <Pressable
            onPress={() => {
              if (!user) return;
              deleteSim(user.id, s.id);
              setSaved(loadSims(user.id));
            }}
            hitSlop={6}
            style={{ marginTop: 6, alignSelf: "flex-start" }}
          >
            <Text style={{ fontSize: 13, ...face(600), color: th(INK.softer) }}>Excluir</Text>
          </Pressable>
        </Row>
      ))}
      </Card>
      )}
    </View>
  );
}
