/**
 * The Fluxo do mês's numbers, worked out once and the same everywhere on the page: the money that
 * moved each day (never added up), the same stretch of the month before, and what Willo notices.
 *
 * Only money that has already moved counts (the page's `data.transactions`: what was paid and
 * received, card invoices on the day they were paid). Transfers between the person's own accounts
 * are neither: only "receita" and "despesa" are read. All sums in cents, to the cent.
 */

export type Filter = "geral" | "entradas" | "saidas";

export interface Moved {
  rawDate?: string | null;
  type: string;
  amount: number | string;
  name?: string;
  id?: string;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthName = (m: number) => MONTHS[((m % 12) + 12) % 12];
export const monthShort = (m: number) => SHORT[((m % 12) + 12) % 12];

const cents = (v: number | string) => Math.round((Number(v) || 0) * 100);

/** Each day's money in and out, in cents, days 1..last (index 0 unused). */
export function daily(list: Moved[], last: number) {
  const inn = new Array<number>(last + 1).fill(0);
  const out = new Array<number>(last + 1).fill(0);
  for (const t of list) {
    const d = Number((t.rawDate ?? "").slice(8, 10));
    if (!d || d > last) continue;
    if (t.type === "receita") inn[d] += cents(t.amount);
    else if (t.type === "despesa") out[d] += cents(t.amount);
  }
  return { inn, out };
}

const sumTo = (per: number[], upto: number) => per.slice(1, upto + 1).reduce((a, b) => a + b, 0);

export interface Comparison {
  /** The same stretch of the month before: "mesmo período de out." or the whole month. */
  label: string;
  short: string;
  /** In cents, by filter: the change and whether it is good news. */
  diff: number;
  good: boolean | null;
  cur: { inn: number; out: number };
  prev: { inn: number; out: number };
  /** Up to which day both are counted. */
  day: number;
  prevMonth: number;
}

/**
 * This month against the month before over the same days: up to today in a month under way (the
 * first 27 days of each, on the 27th, or all of a shorter month before), the whole of both once
 * this one is over. Null for a month still to come, or with nothing at all the month before.
 */
export function compare(cur: Moved[], prev: Moved[], month: number, year: number, today: Date, filter: Filter): Comparison | null {
  const last = new Date(year, month + 1, 0).getDate();
  const prevLast = new Date(year, month, 0).getDate();
  const when = year * 12 + month - (today.getFullYear() * 12 + today.getMonth());
  if (when > 0) return null;
  const running = when === 0;
  const day = running ? today.getDate() : last;
  const prevDay = running ? Math.min(day, prevLast) : prevLast;
  const c = daily(cur, last);
  const p = daily(prev, prevLast);
  const prevAll = sumTo(p.inn, prevLast) + sumTo(p.out, prevLast);
  if (prevAll === 0) return null;
  const curIn = sumTo(c.inn, day);
  const curOut = sumTo(c.out, day);
  const prevIn = sumTo(p.inn, prevDay);
  const prevOut = sumTo(p.out, prevDay);
  const pm = month - 1;
  const diff = filter === "entradas" ? curIn - prevIn : filter === "saidas" ? curOut - prevOut : curIn - curOut - (prevIn - prevOut);
  /* Less going out is good news, though the number falls. */
  const good = diff === 0 ? null : filter === "saidas" ? diff < 0 : diff > 0;
  return {
    label: running ? `mesmo período de ${monthShort(pm)}.` : monthName(pm),
    short: running ? `${monthShort(pm)}.` : `${monthShort(pm)}.`,
    diff,
    good,
    cur: { inn: curIn, out: curOut },
    prev: { inn: prevIn, out: prevOut },
    day,
    prevMonth: pm,
  };
}

const brl = (c: number) => `R$ ${(Math.abs(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface Insight {
  /** The title: a plain part, then the finding in bold, coloured by what it means. */
  lead: string;
  strong: string;
  tail?: string;
  tone: "good" | "bad" | "neutral";
  body: string;
  /** What Willo says first when the conversation opens from here. */
  context: string;
}

/**
 * The one thing most worth saying, from the numbers alone: how the month moved against the same
 * stretch before (when it moved enough to matter), or a single day that held most of it. Nothing
 * when there is nothing worth saying — the Insight is then not shown.
 */
export function findInsight(cur: Moved[], cmp: Comparison | null, month: number, year: number, today: Date, filter: Filter): Insight | null {
  const last = new Date(year, month + 1, 0).getDate();
  const when = year * 12 + month - (today.getFullYear() * 12 + today.getMonth());
  if (when > 0) return null;
  const upto = when === 0 ? today.getDate() : last;
  const { inn, out } = daily(cur, last);
  const totIn = sumTo(inn, upto);
  const totOut = sumTo(out, upto);
  const m = monthName(month);
  const facts = `Fluxo de ${m} de ${year} (${filter === "geral" ? "geral" : filter}): entraram ${brl(totIn)} e saíram ${brl(totOut)}, resultado ${totIn - totOut < 0 ? "−" : ""}${brl(totIn - totOut)}`;

  /* 1. Against the same stretch before, when it moved at least a tenth (and R$ 20). */
  if (cmp && cmp.good !== null) {
    const base = filter === "entradas" ? cmp.prev.inn : filter === "saidas" ? cmp.prev.out : Math.abs(cmp.prev.inn - cmp.prev.out);
    const big = Math.abs(cmp.diff) >= 2000 && (base === 0 || Math.abs(cmp.diff) / base >= 0.1);
    if (big) {
      const period = cmp.label.startsWith("mesmo") ? `o mesmo período de ${monthName(cmp.prevMonth)}` : `${monthName(cmp.prevMonth)} inteiro`;
      const inUp = cmp.cur.inn > cmp.prev.inn;
      const outUp = cmp.cur.out > cmp.prev.out;
      const parts = [cmp.cur.inn === cmp.prev.inn ? null : `suas entradas ${inUp ? "aumentaram" : "diminuíram"}`, cmp.cur.out === cmp.prev.out ? null : `suas saídas ${outUp ? "aumentaram" : "diminuíram"}`].filter(Boolean) as string[];
      const how = parts.length === 2 ? `${parts[0][0].toUpperCase()}${parts[0].slice(1)} e ${parts[1]}.` : parts.length === 1 ? `${parts[0][0].toUpperCase()}${parts[0].slice(1)}.` : "";
      const lead = filter === "entradas" ? (cmp.diff > 0 ? "Você recebeu" : "Você recebeu") : filter === "saidas" ? (cmp.diff < 0 ? "Você gastou" : "Você gastou") : cmp.diff > 0 ? "Seu fluxo ganhou" : "Seu fluxo perdeu";
      const strong = brl(cmp.diff);
      const tail = filter === "entradas" ? (cmp.diff > 0 ? " a mais." : " a menos.") : filter === "saidas" ? (cmp.diff < 0 ? " a menos." : " a mais.") : ".";
      return {
        lead,
        strong,
        tail,
        tone: cmp.good ? "good" : "bad",
        body: `Comparando com ${period}. ${how}`.trim(),
        context: `${facts}. Comparado com ${period}: ${filter === "geral" ? "o resultado" : filter === "entradas" ? "as entradas" : "as saídas"} ${cmp.diff > 0 ? "subiu" : "caiu"} ${brl(cmp.diff)} (entradas ${brl(cmp.prev.inn)} → ${brl(cmp.cur.inn)}, saídas ${brl(cmp.prev.out)} → ${brl(cmp.cur.out)}).`,
      };
    }
  }

  /* 2. One day that held most of what moved (at least 3 days with movement, and 45% or more). */
  const per = filter === "entradas" ? inn : out;
  const total = filter === "entradas" ? totIn : totOut;
  const active = per.slice(1, upto + 1).filter((v) => v > 0).length;
  if (total > 0 && active >= 3) {
    let top = 1;
    for (let d = 2; d <= upto; d++) if (per[d] > per[top]) top = d;
    const share = per[top] / total;
    if (share >= 0.45) {
      const pct = Math.round(share * 100);
      const word = filter === "entradas" ? "entradas" : "saídas";
      return {
        lead: `O dia ${String(top).padStart(2, "0")} concentrou`,
        strong: `${pct}%`,
        tail: ` das suas ${word}.`,
        tone: "neutral",
        body: `Foram ${brl(per[top])} nesse dia, de ${brl(total)} ${when === 0 ? "no mês até agora" : "no mês todo"}. O resto se espalhou pelos outros dias.`,
        context: `${facts}. O dia ${top} de ${m} concentrou ${pct}% das ${word} (${brl(per[top])} de ${brl(total)}).`,
      };
    }
  }
  return null;
}
