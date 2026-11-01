import type { RaioXData } from "@/hooks/useRaioX";
import { money } from "~/lib/money";
import type { Mood } from "~/lib/voiceTone";

/**
 * What the Radar tab shows, each line with its question and its answer already worked
 * out from the same Radar the web reads: so tapping one, or asking the same thing, has
 * Willo reply at once with no AI in between.
 */

export type BoardGroup = "hoje" | "cartoes" | "gastos" | "futuro";
export type BoardLevel = "alerta" | "atencao" | "dica" | "conquista" | "numero";

export interface BoardLine {
  id: string;
  group: BoardGroup;
  level: BoardLevel;
  title: string;
  note?: string;
  value?: string;
  /** The question it stands for, as it lands in the conversation. */
  ask: string;
  answer: string;
  mood: Mood;
}

export const BOARD_FILTERS: { key: "tudo" | BoardGroup; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "cartoes", label: "Cartões" },
  { key: "gastos", label: "Gastos" },
  { key: "futuro", label: "Futuro" },
];

interface Snapshot {
  contas?: { saldo_atual: number };
  cartoes?: { nome: string; fatura_aberta: number; vence_em: string; limite: number; usado: number }[];
  previsao?: { proximos_meses: { mes: string; sobra: number }[] };
  proximos_eventos?: { data: string; nome: string; valor: number; tipo: string }[];
}

const clean = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").trim();
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[?!.]/g, "").trim();

const GROUP_OF_ICON: Record<string, BoardGroup> = { card: "cartoes", calendar: "futuro", wallet: "hoje", income: "hoje" };

export function buildBoard(data: RaioXData, snapshot: Snapshot): BoardLine[] {
  const lines: BoardLine[] = [];

  /* The Radar's own readings come first: they are what changed, and what to do. */
  for (const i of data.report.insights) {
    const answer = clean([i.message, i.tip].filter(Boolean).join(" "));
    lines.push({
      id: i.id,
      group: GROUP_OF_ICON[i.icon] ?? "gastos",
      level: i.kind,
      title: clean(i.title),
      note: clean(i.message),
      value: i.value != null ? money(i.value) : undefined,
      ask: clean(i.title),
      answer,
      mood: i.kind === "alerta" ? "bad" : i.kind === "conquista" ? "good" : "plain",
    });
  }

  /* ---- today ---- */
  const { light } = data;
  lines.push({
    id: "hoje",
    group: "hoje",
    level: light.light === "vermelho" ? "alerta" : light.light === "amarelo" ? "atencao" : "numero",
    title: "Para gastar hoje",
    value: money(Math.max(light.leftToday, 0)),
    note: light.spentToday > 0 ? `Já foram ${money(light.spentToday)} hoje` : undefined,
    ask: "Quanto posso gastar hoje?",
    answer: light.leftToday > 0 ? `Hoje dá para gastar ${money(light.leftToday)}.${light.spentToday > 0 ? ` Já foram ${money(light.spentToday)}.` : ""}` : clean(light.message),
    mood: light.light === "vermelho" ? "bad" : light.light === "verde" ? "good" : "plain",
  });
  if (snapshot.contas) {
    lines.push({
      id: "saldo",
      group: "hoje",
      level: "numero",
      title: "Nas contas agora",
      value: money(snapshot.contas.saldo_atual),
      ask: "Quanto tenho nas contas agora?",
      answer: `Você tem ${money(snapshot.contas.saldo_atual)} nas contas.`,
      mood: snapshot.contas.saldo_atual < 0 ? "bad" : "plain",
    });
  }

  /* ---- what is ahead ---- */
  const { forecast } = data;
  lines.push({
    id: "fecha",
    group: "futuro",
    level: forecast.endBalance < 0 ? "alerta" : "numero",
    title: "No ritmo de agora, fecha em",
    value: money(forecast.endBalance),
    note: forecast.negativeDay ? `Fica negativo no dia ${forecast.negativeDay}` : undefined,
    ask: "Como meu mês vai fechar?",
    answer: `No ritmo de agora, o mês fecha em ${money(forecast.endBalance)}.${forecast.negativeDay ? ` O saldo fica negativo no dia ${forecast.negativeDay}.` : ""}`,
    mood: forecast.endBalance < 0 ? "bad" : "good",
  });
  lines.push({
    id: "seguro",
    group: "futuro",
    level: "numero",
    title: "Dá para gastar até o fim do mês",
    value: money(Math.max(forecast.safeToSpend, 0)),
    ask: "Quanto dá para gastar até o fim do mês?",
    answer: forecast.safeToSpend > 0 ? `Com segurança, dá para gastar ${money(forecast.safeToSpend)} até o fim do mês.` : "Até o fim do mês não sobra nada para gastar com folga.",
    mood: forecast.safeToSpend > 0 ? "good" : "bad",
  });

  const week = Date.now() + 7 * 86_400_000;
  const soon = (snapshot.proximos_eventos ?? []).filter((e) => e.tipo !== "receita" && new Date(`${e.data}T12:00:00`).getTime() <= week);
  if (soon.length > 0) {
    const total = soon.reduce((s, e) => s + e.valor, 0);
    const what = soon.slice(0, 4).map((e) => `${e.nome}, ${money(e.valor)}`).join("; ");
    lines.push({
      id: "semana",
      group: "futuro",
      level: "atencao",
      title: soon.length === 1 ? "Vence em até 7 dias" : `${soon.length} contas vencem em até 7 dias`,
      value: money(total),
      note: soon.length === 1 ? soon[0].nome : undefined,
      ask: "O que vence nos próximos 7 dias?",
      answer: `Nos próximos 7 dias saem ${money(total)}: ${what}.`,
      mood: "plain",
    });
  }

  const next = snapshot.previsao?.proximos_meses?.[1];
  if (next) {
    const name = next.mes.replace(/ de \d{4}$/, "");
    lines.push({
      id: "proximo",
      group: "futuro",
      level: next.sobra < 0 ? "alerta" : "numero",
      title: `Sobra em ${name}`,
      value: money(next.sobra),
      ask: `Quanto sobra em ${name}?`,
      answer: next.sobra < 0 ? `Em ${name}, com o que já está lançado, falta ${money(-next.sobra)}.` : `Em ${name}, com o que já está lançado, sobram ${money(next.sobra)}.`,
      mood: next.sobra < 0 ? "bad" : "good",
    });
  }

  /* The Radar may already have spoken about these two: one line each, not two figures. */
  const said = new Set(lines.map((l) => l.id));
  if (data.installments.monthly > 0 && !said.has("parcelas")) {
    lines.push({
      id: "parcelas",
      group: "futuro",
      level: "numero",
      title: "Parcelas por mês",
      value: money(data.installments.monthly),
      note: data.installments.freeFrom ? `Livre em ${data.installments.freeFrom}` : undefined,
      ask: "Quanto pago de parcelas por mês?",
      answer: `São ${money(data.installments.monthly)} de parcelas por mês, e ainda faltam ${money(data.installments.remainingTotal)}.${data.installments.freeFrom ? ` Fica livre em ${data.installments.freeFrom}.` : ""}`,
      mood: "plain",
    });
  }

  /* ---- cards ---- */
  for (const c of snapshot.cartoes ?? []) {
    if (c.fatura_aberta <= 0) continue;
    const used = c.limite > 0 ? c.usado / c.limite : 0;
    lines.push({
      id: `fatura-${c.nome}`,
      group: "cartoes",
      level: used >= 0.9 ? "alerta" : used >= 0.7 ? "atencao" : "numero",
      title: `Fatura ${c.nome}`,
      value: money(c.fatura_aberta),
      note: `Vence em ${c.vence_em}`,
      ask: `Quanto está a fatura do ${c.nome}?`,
      answer: `A fatura do ${c.nome} está em ${money(c.fatura_aberta)} e vence em ${c.vence_em}.${used >= 0.7 ? ` Você já usou ${Math.round(used * 100)}% do limite.` : ""}`,
      mood: used >= 0.9 ? "bad" : "plain",
    });
  }

  /* ---- where it goes ---- */
  if (data.villain && data.villain.spent > 0) {
    const v = data.villain;
    const over = v.average > 0 && v.spent > v.average;
    lines.push({
      id: "vilao",
      group: "gastos",
      level: over ? "atencao" : "numero",
      title: `Quem mais pesa: ${v.name}`,
      value: money(v.spent),
      note: over ? `Sua média é ${money(v.average)}` : undefined,
      ask: "O que mais pesa nos meus gastos este mês?",
      answer: `${v.name} é o que mais pesa: ${money(v.spent)} este mês.${over ? ` Sua média é ${money(v.average)}.` : ""}`,
      mood: over ? "bad" : "plain",
    });
  }
  if (data.weekly.spent > 0) {
    lines.push({
      id: "semana-gasto",
      group: "gastos",
      level: "numero",
      title: "Gasto nos últimos 7 dias",
      value: money(data.weekly.spent),
      note: data.weekly.topCategory ? `Mais em ${data.weekly.topCategory.name}` : undefined,
      ask: "Quanto gastei nos últimos 7 dias?",
      answer: `Nos últimos 7 dias foram ${money(data.weekly.spent)}.${data.weekly.topCategory ? ` O maior foi ${data.weekly.topCategory.name}, ${money(data.weekly.topCategory.amount)}.` : ""}`,
      mood: "plain",
    });
  }
  if (data.fixedMonthly > 0 && !said.has("recorrentes")) {
    lines.push({
      id: "fixos",
      group: "gastos",
      level: "numero",
      title: "Fixos por mês",
      value: money(data.fixedMonthly),
      ask: "Quanto pago de fixos por mês?",
      answer: `Seus fixos somam ${money(data.fixedMonthly)} por mês.`,
      mood: "plain",
    });
  }
  if (data.duplicates.length > 0) {
    const d = data.duplicates[0];
    lines.push({
      id: "duplicados",
      group: "gastos",
      level: "atencao",
      title: data.duplicates.length === 1 ? "Cobrança parecida duas vezes" : `${data.duplicates.length} cobranças parecidas`,
      note: `${d.name}, ${money(d.amount)}`,
      ask: "Tem alguma cobrança repetida?",
      answer: `${d.name}, de ${money(d.amount)}, aparece mais de uma vez. Vale conferir.`,
      mood: "plain",
    });
  }

  const order: Record<BoardLevel, number> = { alerta: 0, atencao: 1, conquista: 2, dica: 3, numero: 4 };
  return lines.sort((a, b) => order[a.level] - order[b.level]);
}

/** The same question asked in words gets the same answer at once. */
export function boardAnswer(said: string, board: BoardLine[]): BoardLine | null {
  const q = plain(said);
  return board.find((l) => plain(l.ask) === q) ?? null;
}

/** What the assistant is told the Radar already knows, so it need not look it up. */
export function radarForAssistant(data: RaioXData) {
  return {
    nota: data.report.score,
    nivel: data.report.level.label,
    seguro_gastar: data.forecast.safeToSpend,
    fecha_em: data.forecast.endBalance,
    avisos: [
      ...data.report.insights.slice(0, 8).map((i) => clean(`${i.title}: ${i.message}`)),
      `Renda comprometida com fixos e parcelas: ${Math.round(data.commitment.committedPct * 100)}%. Parcelas por mês: ${money(data.installments.monthly)}.`,
      `Categorias do mês e o normal de cada uma: ${data.categories.slice(0, 6).map((c) => `${c.name} ${money(c.spent)}${c.average > 0 ? ` (normal ${money(c.average)})` : ""}`).join("; ")}.`,
      ...data.anomalies.slice(0, 3).map((a) => clean(`Fora do normal: ${a.title}. ${a.what}`)),
    ],
  };
}
