import { supabase } from "@/integrations/supabase/client";

/**
 * Challenges and achievements.
 *
 * A challenge is a stretch of days with one aim. Most are checked by Willo from the
 * person's own entries, with nothing to tick: a month without delivery is broken by
 * the first delivery written down, a week of writing everything down by the first
 * day with nothing written. A few are habits only the person knows (coffee made at
 * home), and those are ticked once a day.
 *
 * The catalogue lives here. The six the database already holds keep their rows; the
 * others become a row of the person's own the first time they start one (marked
 * "tpl:<key>" in its icon field), so the tables need nothing new.
 *
 * Achievements are medals worked out from the data — how much was written down, how
 * many days in a row, bills and invoices paid, goals reached, challenges finished,
 * months that closed with money left — each in bronze, silver and gold.
 */

export type ChallengeKind = "abstain" | "record" | "bills" | "manual";
export type IconKey = "delivery" | "online" | "car" | "pen" | "calendar" | "bag" | "coffee" | "lunch" | "tv" | "bus" | "flag";

export interface Template {
  key: string;
  name: string;
  line: string;
  days: number;
  kind: ChallengeKind;
  icon: IconKey;
  difficulty: "facil" | "medio" | "dificil";
  /** A rough idea of what it saves, when it saves anything. */
  saves?: number;
  /** For "abstain": what breaks it. */
  match?: { categories: string[]; words: string[]; unless?: string[] };
  /** The database row this is, when it is one of the six already there. */
  system?: string;
}

const DELIVERY = { categories: ["Delivery"], words: ["ifood", "i food", "rappi", "uber eats", "ubereats", "aiqfome", "ze delivery", "zé delivery", "james delivery", "99food", "delivery"] };
const ONLINE = {
  categories: ["Compras online"],
  words: ["amazon", "mercado livre", "mercadolivre", "shopee", "shein", "aliexpress", "magalu", "magazine luiza", "americanas", "temu", "netshoes", "kabum"],
};
const RIDES = { categories: ["Transporte por app"], words: ["uber", "99 ", "99app", "99pop", "cabify", "indrive", "in drive"], unless: ["eats", "food"] };

export const TEMPLATES: Template[] = [
  { key: "delivery-7", name: "Semana sem delivery", line: "Sete dias cozinhando ou comendo fora sem pedir pelo app.", days: 7, kind: "abstain", icon: "delivery", difficulty: "facil", saves: 150, match: DELIVERY, system: "Semana Sem Delivery" },
  { key: "delivery-30", name: "30 dias sem delivery", line: "Um mês inteiro sem pedir comida por aplicativo.", days: 30, kind: "abstain", icon: "delivery", difficulty: "dificil", saves: 500, match: DELIVERY },
  { key: "online-30", name: "30 dias sem compras online", line: "Nada de Shopee, Amazon ou Mercado Livre por um mês.", days: 30, kind: "abstain", icon: "online", difficulty: "medio", saves: 350, match: ONLINE },
  { key: "rides-15", name: "15 dias sem corrida de app", line: "Ônibus, metrô, bicicleta ou a pé: sem Uber nem 99.", days: 15, kind: "abstain", icon: "car", difficulty: "medio", saves: 200, match: RIDES },
  { key: "record-7", name: "7 dias anotando tudo", line: "Pelo menos um registro por dia, sete dias seguidos.", days: 7, kind: "record", icon: "pen", difficulty: "facil" },
  { key: "record-30", name: "30 dias anotando tudo", line: "Um mês inteiro sem deixar um dia em branco.", days: 30, kind: "record", icon: "pen", difficulty: "medio" },
  { key: "bills-30", name: "30 dias com as contas em dia", line: "Nenhuma conta passando do vencimento sem pagar.", days: 30, kind: "bills", icon: "calendar", difficulty: "medio" },
  { key: "impulse-30", name: "30 dias sem compras por impulso", line: "Antes de comprar, espere um dia. Marque cada dia que conseguiu.", days: 30, kind: "manual", icon: "bag", difficulty: "medio", saves: 300, system: "30 Dias Sem Compras por Impulso" },
  { key: "coffee-15", name: "Café de casa por 15 dias", line: "Troque a cafeteria pelo café feito em casa.", days: 15, kind: "manual", icon: "coffee", difficulty: "facil", saves: 120, system: "Café de Casa por 15 Dias" },
  { key: "lunch-30", name: "30 dias de almoço de casa", line: "Marmita em vez de restaurante.", days: 30, kind: "manual", icon: "lunch", difficulty: "dificil", saves: 450, system: "30 Dias de Almoço em Casa" },
  { key: "streaming-7", name: "Semana sem streaming extra", line: "Sem alugar filme ou assinar mais um serviço.", days: 7, kind: "manual", icon: "tv", difficulty: "facil", saves: 80, system: "Semana Sem Streaming Extra" },
  { key: "transport-15", name: "Transporte consciente por 15 dias", line: "Escolha o caminho mais barato todo dia.", days: 15, kind: "manual", icon: "bus", difficulty: "medio", saves: 180, system: "Transporte Consciente por 15 Dias" },
];

export const DIFFICULTY_LABEL = { facil: "Fácil", medio: "Médio", dificil: "Difícil" } as const;

/* ── Dates, in the phone's own day ──────────────────────────────────────────── */

const DAY = 86_400_000;
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOf = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const daysBetween = (a: Date, b: Date) => Math.round((startOf(isoDay(b)).getTime() - startOf(isoDay(a)).getTime()) / DAY);
export const shortDate = (iso: string) => startOf(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

/* ── What the page reads ─────────────────────────────────────────────────────── */

export interface Tx {
  id: string;
  name: string;
  category: string | null;
  type: string;
  status: string;
  payment_method: string | null;
  credit_card_id: string | null;
  created_at: string;
  date: string;
  amount: number;
  recurrence_type?: string | null;
}

export interface Running {
  id: string;
  template: Template;
  /** The picture on its card, when one has been made for it. */
  cover: string | null;
  /** Days in a row with a check-in, up to today (or yesterday, if today is still open). */
  streak: number;
  best: number;
  startedAt: string;
  status: "active" | "completed" | "abandoned";
  completedAt: string | null;
  checkins: string[];
  /** Days counted so far, of template.days. */
  done: number;
  state: "going" | "broken" | "finished";
  /** One line on where it stands. */
  note: string;
  /** For manual ones: whether today is already ticked. */
  tickedToday: boolean;
}

export function templateFor(row: { name: string; icon: string | null; duration_days: number; description: string | null }): Template {
  if (row.icon?.startsWith("tpl:")) {
    const t = TEMPLATES.find((x) => x.key === row.icon!.slice(4));
    if (t) return t;
  }
  if (row.icon?.startsWith("cat:")) {
    const category = row.icon.slice(4);
    return customTemplate(category, row.duration_days || 30, row.name);
  }
  if (row.icon === "habit") {
    return { key: `habit:${row.name}`, name: row.name, line: row.description ?? "Marque cada dia que conseguir.", days: row.duration_days || 30, kind: "manual", icon: "flag", difficulty: "medio" };
  }
  const sys = TEMPLATES.find((x) => x.system === row.name);
  if (sys) return sys;
  return { key: `row:${row.name}`, name: row.name, line: row.description ?? "", days: row.duration_days || 30, kind: "manual", icon: "flag", difficulty: "medio" };
}

const matches = (t: Tx, m: NonNullable<Template["match"]>) => {
  if (t.type !== "despesa") return false;
  const text = `${t.name ?? ""}`.toLowerCase();
  if (m.unless?.some((w) => text.includes(w))) return false;
  return (t.category != null && m.categories.includes(t.category)) || m.words.some((w) => text.includes(w));
};

/** Days in a row checked in, ending today or yesterday, and the longest run. */
export function streakOf(checkins: string[], now = new Date()): { streak: number; best: number } {
  const days = [...new Set(checkins)].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = startOf(d);
    run = prev && daysBetween(prev, cur) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  const today = isoDay(now);
  const yesterday = isoDay(addDays(startOf(today), -1));
  const last = days[days.length - 1];
  return { streak: last === today || last === yesterday ? run : 0, best };
}

/** Where a challenge stands today, from the entries and the ticks. */
export function evaluate(template: Template, startedAt: string, checkins: string[], txs: Tx[], now = new Date()): Pick<Running, "done" | "state" | "note" | "tickedToday"> {
  const start = startOf(startedAt);
  const today = startOf(isoDay(now));
  const elapsed = Math.max(0, daysBetween(start, today)) + 1; // today counts
  const end = addDays(start, template.days - 1);
  const over = today.getTime() > end.getTime();
  const lastDay = over ? end : today;
  const todayIso = isoDay(now);

  if (template.kind === "manual") {
    const days = [...new Set(checkins)].filter((d) => d >= startedAt.slice(0, 10)).length;
    const finished = days >= template.days;
    return {
      done: Math.min(days, template.days),
      state: finished ? "finished" : "going",
      note: finished ? "Desafio cumprido" : days === 0 ? "Marque o primeiro dia quando cumprir" : `${days} de ${template.days} dias marcados`,
      tickedToday: checkins.includes(todayIso),
    };
  }

  if (template.kind === "abstain" && template.match) {
    const first = txs
      .filter((t) => matches(t, template.match!) && t.date >= isoDay(start) && t.date <= isoDay(lastDay))
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (first) {
      return { done: Math.max(0, daysBetween(start, startOf(first.date))), state: "broken", note: `${first.name} em ${shortDate(first.date)} quebrou o desafio`, tickedToday: checkins.includes(todayIso) };
    }
    const done = Math.min(elapsed, template.days);
    const finished = over || (elapsed >= template.days && today.getTime() >= end.getTime() && now.getHours() >= 23);
    return { done: over ? template.days : done, state: over ? "finished" : finished ? "finished" : "going", note: over ? "Desafio cumprido" : `Dia ${done} de ${template.days}, tudo limpo até aqui`, tickedToday: checkins.includes(todayIso) };
  }

  if (template.kind === "record") {
    const written = new Set(txs.map((t) => isoDay(new Date(t.created_at))));
    let streak = 0;
    for (let i = 0; i < template.days; i++) {
      const day = addDays(start, i);
      if (day.getTime() > lastDay.getTime()) break;
      const iso = isoDay(day);
      if (written.has(iso)) streak++;
      else if (iso !== todayIso) return { done: streak, state: "broken", note: `Nada anotado em ${shortDate(iso)}`, tickedToday: checkins.includes(todayIso) };
    }
    const finished = streak >= template.days;
    return { done: streak, state: finished ? "finished" : "going", note: finished ? "Desafio cumprido" : written.has(todayIso) ? `${streak} de ${template.days} dias, hoje já anotado` : `${streak} de ${template.days} dias. Falta anotar hoje`, tickedToday: checkins.includes(todayIso) };
  }

  if (template.kind === "bills") {
    const late = txs
      .filter((t) => t.type === "despesa" && t.status !== "pago" && t.payment_method !== "cartao" && !t.credit_card_id && t.date >= isoDay(start) && t.date < todayIso && t.date <= isoDay(end))
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (late) return { done: Math.max(0, daysBetween(start, startOf(late.date))), state: "broken", note: `${late.name} venceu em ${shortDate(late.date)} sem pagar`, tickedToday: checkins.includes(todayIso) };
    const done = Math.min(elapsed, template.days);
    return { done: over ? template.days : done, state: over ? "finished" : "going", note: over ? "Desafio cumprido" : `Dia ${done} de ${template.days}, nada atrasado`, tickedToday: checkins.includes(todayIso) };
  }

  return { done: 0, state: "going", note: "", tickedToday: false };
}

/* ── Suggestions: where the money is going ─────────────────────────────────── */

/* What cannot be cut for a fortnight: never suggested as a challenge. */
export const ESSENTIAL = /aluguel|condom|moradia|casa|energia|luz|água|agua|gás|gas|internet|telefone|contas|serviços|servicos|saúde|saude|farm|médic|medic|educa|escola|faculdade|curso|imposto|seguro|financiamento|empréstimo|emprestimo|supermercado|mercado|feira|açougue|acougue|padaria|alimentação|alimentacao|combust|transporte|pets|filhos|fatura/i;

/** A challenge built from one of the person's own categories: no spending in it. */
export function customTemplate(category: string, days: number, name?: string): Template {
  return {
    key: `cat:${category}:${days}`,
    name: name ?? `${days} dias sem ${category.toLowerCase()}`,
    line: `Nenhum gasto em ${category} por ${days} dias. O Willo confere sozinho.`,
    days,
    kind: "abstain",
    icon: "flag",
    difficulty: days >= 30 ? "dificil" : days >= 15 ? "medio" : "facil",
    match: { categories: [category], words: [] },
  };
}

/** What went out in the last 30 days, by category, largest first. */
export function spendingByCategory(txs: Tx[], now = new Date()) {
  const from = isoDay(addDays(startOf(isoDay(now)), -30));
  const to = isoDay(now);
  const by = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "despesa" || !t.category || t.date < from || t.date > to) continue;
    by.set(t.category, (by.get(t.category) ?? 0) + (Number(t.amount) || 0));
  }
  return [...by.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

/** What a challenge would keep in the pocket, from the last 30 days of the person's own spending. */
export function estimateSavings(t: Template, txs: Tx[], now = new Date()): { spent30: number; saves: number } | null {
  if (t.kind !== "abstain" || !t.match) return null;
  const from = isoDay(addDays(startOf(isoDay(now)), -30));
  const to = isoDay(now);
  const spent30 = txs.filter((x) => matches(x, t.match!) && x.date >= from && x.date <= to).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  return { spent30, saves: Math.round((spent30 * t.days) / 30) };
}

/** How this month is set to close: what comes in less what goes out, entered so far. */
export function monthLeftover(txs: Tx[], now = new Date()) {
  const month = isoDay(now).slice(0, 7);
  let left = 0;
  for (const t of txs) {
    if (t.date.slice(0, 7) !== month) continue;
    const v = Number(t.amount) || 0;
    if (t.type === "receita") left += v;
    else if (t.type === "despesa") left -= v;
  }
  return left;
}

export interface Suggestion {
  template: Template;
  spent30: number;
  saves: number;
  /** Why it is suggested, in a line. */
  reason: string;
}

/**
 * The challenges worth suggesting first: those aimed at where the money went in
 * the last 30 days, the biggest drain first. A big category no ready challenge
 * covers gets one made for it.
 */
export function suggestFor(txs: Tx[], available: Template[], now = new Date(), taken: Set<string> = new Set()): Suggestion[] {
  const out: Suggestion[] = [];
  for (const t of available) {
    /* Spending already being cut by a running challenge is not suggested again. */
    if (t.match?.categories.some((c) => taken.has(c))) continue;
    const e = estimateSavings(t, txs, now);
    if (e && e.spent30 >= 30) out.push({ template: t, spent30: e.spent30, saves: e.saves, reason: "" });
  }
  const covered = new Set(out.flatMap((s) => s.template.match?.categories ?? []));
  for (const { category, total } of spendingByCategory(txs, now).slice(0, 6)) {
    if (covered.has(category) || taken.has(category) || total < 80) continue;
    /* Bills that cannot be skipped are no challenge. */
    if (ESSENTIAL.test(category)) continue;
    const t = customTemplate(category, 15);
    const e = estimateSavings(t, txs, now)!;
    out.push({ template: t, spent30: e.spent30, saves: e.saves, reason: "" });
    if (out.length >= 6) break;
  }
  /* One per kind of spending: the week and the month without delivery are not both shown. */
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.saves - a.saves)
    .filter((x) => {
      const k = x.template.match?.categories[0] ?? x.template.key;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 4)
    .map((s) => ({ ...s, reason: `${s.template.match?.categories[0] ?? "Esse gasto"}: ${money0(s.spent30)} nos últimos 30 dias` }));
}

const money0 = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

/* ── Achievements ───────────────────────────────────────────────────────────── */

export type Tier = 0 | 1 | 2 | 3; // none, bronze, silver, gold
export const TIER_NAME = ["Bloqueada", "Bronze", "Prata", "Ouro"] as const;

export interface Achievement {
  key: string;
  name: string;
  what: string;
  icon: "pen" | "flame" | "check" | "card" | "piggy" | "flag" | "sun" | "calendar" | "vault";
  steps: [number, number, number];
  unit: [string, string];
  value: number;
  tier: Tier;
  /** The next step's target, or null at gold. */
  next: number | null;
}

function tierOf(value: number, steps: [number, number, number]): Tier {
  return value >= steps[2] ? 3 : value >= steps[1] ? 2 : value >= steps[0] ? 1 : 0;
}

export function achievements(input: { txs: Tx[]; paidInvoices: number; goalsReached: number; challengesDone: number; saved?: number }): Achievement[] {
  const { txs } = input;
  const days = [...new Set(txs.map((t) => isoDay(new Date(t.created_at))))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = startOf(d);
    run = prev && daysBetween(prev, cur) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  /* A bill is a fixed expense, or one written down before its due day and paid since. */
  const billsPaid = txs.filter(
    (t) => t.type === "despesa" && t.status === "pago" && t.payment_method !== "cartao" && !t.credit_card_id && (t.recurrence_type === "fixa" || isoDay(new Date(t.created_at)) < t.date),
  ).length;

  /* Months already over that closed with more in than out. */
  const byMonth = new Map<string, number>();
  const thisMonth = isoDay(new Date()).slice(0, 7);
  for (const t of txs) {
    const m = t.date.slice(0, 7);
    if (m >= thisMonth) continue;
    const v = Number(t.amount) || 0;
    if (t.type === "receita") byMonth.set(m, (byMonth.get(m) ?? 0) + v);
    else if (t.type === "despesa") byMonth.set(m, (byMonth.get(m) ?? 0) - v);
  }
  const blueMonths = [...byMonth.values()].filter((v) => v > 0).length;

  const fixed = new Set(txs.filter((t) => t.recurrence_type === "fixa").map((t) => t.name.trim().toLowerCase())).size;

  const make = (a: Omit<Achievement, "tier" | "next">): Achievement => {
    const tier = tierOf(a.value, a.steps);
    return { ...a, tier, next: tier === 3 ? null : a.steps[tier] };
  };

  return [
    make({ key: "writer", name: "Anotador", what: "Lançamentos registrados no Willo", icon: "pen", steps: [10, 100, 500], unit: ["registro", "registros"], value: txs.length }),
    make({ key: "streak", name: "Constância", what: "Maior sequência de dias seguidos anotando", icon: "flame", steps: [7, 30, 90], unit: ["dia seguido", "dias seguidos"], value: best }),
    make({ key: "bills", name: "Contas em dia", what: "Contas e boletos marcados como pagos", icon: "check", steps: [10, 50, 200], unit: ["conta paga", "contas pagas"], value: billsPaid }),
    make({ key: "invoices", name: "Fatura zerada", what: "Faturas de cartão pagas", icon: "card", steps: [1, 6, 12], unit: ["fatura paga", "faturas pagas"], value: input.paidInvoices }),
    make({ key: "goals", name: "Poupador", what: "Metas que chegaram ao valor", icon: "piggy", steps: [1, 3, 10], unit: ["meta concluída", "metas concluídas"], value: input.goalsReached }),
    make({ key: "challenges", name: "Desafiante", what: "Desafios cumpridos até o fim", icon: "flag", steps: [1, 5, 15], unit: ["desafio cumprido", "desafios cumpridos"], value: input.challengesDone }),
    make({ key: "blue", name: "Mês no azul", what: "Meses que fecharam com mais entrada que saída", icon: "sun", steps: [1, 3, 12], unit: ["mês no azul", "meses no azul"], value: blueMonths }),
    make({ key: "planned", name: "Planejado", what: "Contas fixas cadastradas, para o mês nunca pegar de surpresa", icon: "calendar", steps: [3, 10, 20], unit: ["conta fixa", "contas fixas"], value: fixed }),
    make({ key: "vault", name: "Guardião", what: "Reais guardados nas caixinhas", icon: "vault", steps: [500, 5000, 20000], unit: ["real guardado", "reais guardados"], value: Math.round(input.saved ?? 0) }),
  ];
}

export const plural = (n: number, unit: [string, string]) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

/* ── Loading and changing ───────────────────────────────────────────────────── */

export interface ChallengeData {
  running: Running[];
  finished: Running[];
  medals: Achievement[];
  /** Templates not already running. */
  available: Template[];
  /** Pictures already made, by template key. */
  covers: Record<string, string>;
  /** Aimed at where the money is going, biggest saving first. */
  suggested: Suggestion[];
  /** How the month is set to close, before any challenge. */
  leftover: number;
  /** The last 30 days by category, for making one's own. */
  spending: { category: string; total: number }[];
  txs: Tx[];
}

export async function loadChallenges(userId: string): Promise<ChallengeData> {
  const [ucRes, chRes, txRes, invRes, goalRes] = await Promise.all([
    supabase.from("user_challenges").select("id, challenge_id, status, started_at, completed_at, progress").eq("user_id", userId).order("started_at", { ascending: false }),
    supabase.from("challenges").select("id, name, icon, duration_days, description, cover_image"),
    supabase.from("transactions").select("id, name, category, type, status, payment_method, credit_card_id, created_at, date, amount, recurrence_type").eq("user_id", userId).order("date", { ascending: false }).limit(5000),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_paid", true),
    supabase.from("goals").select("current_amount, target_amount").eq("user_id", userId),
  ]);
  const ucs = (ucRes.data ?? []) as { id: string; challenge_id: string; status: string; started_at: string; completed_at: string | null; progress: number }[];
  const rows = new Map(((chRes.data ?? []) as { id: string; name: string; icon: string | null; duration_days: number; description: string | null; cover_image: string | null }[]).map((r) => [r.id, r]));
  const txs = (txRes.data ?? []) as Tx[];

  const ids = ucs.map((u) => u.id);
  const { data: ck } = ids.length ? await supabase.from("challenge_checkins").select("user_challenge_id, checkin_date").in("user_challenge_id", ids) : { data: [] };
  const ticks = new Map<string, string[]>();
  for (const c of (ck ?? []) as { user_challenge_id: string; checkin_date: string }[]) ticks.set(c.user_challenge_id, [...(ticks.get(c.user_challenge_id) ?? []), c.checkin_date.slice(0, 10)]);

  const all: Running[] = [];
  for (const u of ucs) {
    const row = rows.get(u.challenge_id);
    if (!row) continue;
    const template = templateFor(row);
    const checkins = ticks.get(u.id) ?? [];
    const status = (u.status === "completed" || u.status === "abandoned" ? u.status : "active") as Running["status"];
    const view = status === "completed" ? { done: template.days, state: "finished" as const, note: "Desafio cumprido", tickedToday: true } : evaluate(template, u.started_at, checkins, txs);
    /* Finished just now: kept as done. */
    if (status === "active" && view.state === "finished") {
      void supabase.from("user_challenges").update({ status: "completed", completed_at: new Date().toISOString(), progress: 100 } as never).eq("id", u.id);
    }
    all.push({ id: u.id, template, cover: row.cover_image ?? null, ...streakOf(checkins), startedAt: u.started_at, status: view.state === "finished" ? "completed" : status, completedAt: u.completed_at, checkins, ...view });
  }

  const running = all.filter((r) => r.status === "active");
  const finished = all.filter((r) => r.status === "completed");
  const busy = new Set(running.map((r) => r.template.key));
  for (const r of running) if (r.template.key.startsWith("cat:")) busy.add(`cat:${r.template.match?.categories[0]}:15`);
  const goals = (goalRes.data ?? []) as { current_amount: number; target_amount: number }[];

  return {
    running,
    finished,
    medals: achievements({
      txs,
      paidInvoices: invRes.count ?? 0,
      goalsReached: goals.filter((g) => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount)).length,
      challengesDone: finished.length,
      saved: goals.reduce((sum, g) => sum + (Number(g.current_amount) || 0), 0),
    }),
    available: TEMPLATES.filter((t) => !busy.has(t.key)),
    suggested: suggestFor(txs, TEMPLATES.filter((t) => !busy.has(t.key)), new Date(), new Set(running.flatMap((r) => r.template.match?.categories ?? []))),
    leftover: monthLeftover(txs),
    covers: Object.fromEntries(
      [...rows.values()].filter((r) => r.cover_image).map((r) => [templateFor(r).key, r.cover_image as string]),
    ),
    spending: spendingByCategory(txs),
    txs,
  };
}

/** Starts a challenge today. */
export async function startChallenge(userId: string, t: Template) {
  let challengeId: string | null = null;
  if (t.system) {
    const { data } = await supabase.from("challenges").select("id").eq("name", t.system).eq("is_system", true).maybeSingle();
    challengeId = (data as { id: string } | null)?.id ?? null;
  }
  /* One's own: a category to stay away from, or a habit to tick. */
  const ownIcon = t.key.startsWith("cat:") ? `cat:${t.match?.categories[0]}` : t.key.startsWith("habit:") ? "habit" : `tpl:${t.key}`;
  if (!challengeId && ownIcon !== `tpl:${t.key}`) {
    const { data: made, error } = await supabase
      .from("challenges")
      .insert({ user_id: userId, name: t.name, description: t.line, duration_days: t.days, icon: ownIcon, difficulty: t.difficulty, potential_savings: t.saves ?? 0, is_system: false } as never)
      .select("id")
      .single();
    if (error) throw error;
    challengeId = (made as { id: string }).id;
  }
  if (!challengeId) {
    const { data: own } = await supabase.from("challenges").select("id").eq("user_id", userId).eq("icon", `tpl:${t.key}`).maybeSingle();
    challengeId = (own as { id: string } | null)?.id ?? null;
  }
  if (!challengeId) {
    const { data: made, error } = await supabase
      .from("challenges")
      .insert({ user_id: userId, name: t.name, description: t.line, duration_days: t.days, icon: `tpl:${t.key}`, difficulty: t.difficulty, potential_savings: t.saves ?? 0, is_system: false } as never)
      .select("id")
      .single();
    if (error) throw error;
    challengeId = (made as { id: string }).id;
  }
  const { error } = await supabase.from("user_challenges").insert({ user_id: userId, challenge_id: challengeId, status: "active", progress: 0, started_at: new Date().toISOString() } as never);
  if (error) throw error;
}

/** Ticks today on a challenge only the person can tell. */
export async function tickToday(userId: string, runningId: string) {
  const { error } = await supabase.from("challenge_checkins").insert({ user_id: userId, user_challenge_id: runningId, checkin_date: isoDay(new Date()) } as never);
  if (error && !String(error.message).includes("duplicate")) throw error;
}

/** Starts it over from today, ticks cleared. */
export async function restartChallenge(runningId: string) {
  await supabase.from("challenge_checkins").delete().eq("user_challenge_id", runningId);
  await supabase.from("user_challenges").update({ started_at: new Date().toISOString(), status: "active", progress: 0, completed_at: null } as never).eq("id", runningId);
}

/** Leaves it. */
export async function abandonChallenge(runningId: string) {
  await supabase.from("user_challenges").update({ status: "abandoned" } as never).eq("id", runningId);
}

/** One running challenge, for its own page. */
export async function loadOne(userId: string, id: string): Promise<{ running: Running; txs: Tx[] } | null> {
  const data = await loadChallenges(userId);
  const r = [...data.running, ...data.finished].find((x) => x.id === id);
  return r ? { running: r, txs: data.txs } : null;
}

/** Every day of a challenge, for its calendar. */
export function calendarOf(r: Running, txs: Tx[], now = new Date()) {
  const start = startOf(r.startedAt);
  const today = isoDay(now);
  const checked = new Set(r.checkins);
  const brokenOn = r.state === "broken" ? isoDay(addDays(start, r.done)) : null;
  return Array.from({ length: r.template.days }, (_, i) => {
    const d = addDays(start, i);
    const iso = isoDay(d);
    const state: "checked" | "clean" | "broken" | "today" | "future" | "missed" =
      checked.has(iso) ? "checked" : iso === brokenOn ? "broken" : iso === today ? "today" : iso > today ? "future" : r.template.kind === "manual" ? "missed" : r.state === "broken" && brokenOn && iso > brokenOn ? "future" : "clean";
    return { iso, day: d.getDate(), weekday: d.getDay(), state };
  });
}

/** What it has kept in the pocket so far, by the share of days done. */
export function savedSoFar(r: Running, txs: Tx[]) {
  const e = estimateSavings(r.template, txs);
  const total = e?.saves ?? r.template.saves ?? 0;
  return Math.round((total * r.done) / r.template.days);
}

export interface PendingCheckin {
  id: string;
  template: Template;
  cover: string | null;
  streak: number;
  tickedToday: boolean;
}

/**
 * The running challenges, with whether today is checked in, for the home. Light on
 * purpose: only the challenges and their check-ins, not the person's entries.
 */
export async function pendingCheckins(userId: string): Promise<PendingCheckin[]> {
  const { data: ucs } = await supabase.from("user_challenges").select("id, challenge_id").eq("user_id", userId).eq("status", "active");
  const list = (ucs ?? []) as { id: string; challenge_id: string }[];
  if (!list.length) return [];
  const [{ data: rows }, { data: ck }] = await Promise.all([
    supabase.from("challenges").select("id, name, icon, duration_days, description, cover_image").in("id", list.map((u) => u.challenge_id)),
    supabase.from("challenge_checkins").select("user_challenge_id, checkin_date").in("user_challenge_id", list.map((u) => u.id)),
  ]);
  const byId = new Map(((rows ?? []) as { id: string; name: string; icon: string | null; duration_days: number; description: string | null; cover_image: string | null }[]).map((r) => [r.id, r]));
  const ticks = new Map<string, string[]>();
  for (const c of (ck ?? []) as { user_challenge_id: string; checkin_date: string }[]) ticks.set(c.user_challenge_id, [...(ticks.get(c.user_challenge_id) ?? []), c.checkin_date.slice(0, 10)]);
  const today = isoDay(new Date());
  return list
    .map((u) => {
      const row = byId.get(u.challenge_id);
      if (!row) return null;
      const own = ticks.get(u.id) ?? [];
      return { id: u.id, template: templateFor(row), cover: row.cover_image, streak: streakOf(own).streak, tickedToday: own.includes(today) };
    })
    .filter((x): x is PendingCheckin => x !== null);
}
