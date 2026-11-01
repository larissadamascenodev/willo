/**
 * What a purchase would do, before it is made. Pure sums over the person's real numbers:
 * nothing here writes anything, and a simulation never becomes a record by itself.
 *
 * On a card, the first instalment falls on the invoice the purchase date belongs to, by the
 * same rule the database uses: from the closing day on, it is next month's. A card's limit is
 * taken for the whole amount financed, whatever the number of instalments. Interest is only
 * what was typed: nothing is assumed either way.
 */

export interface SimCard {
  name: string;
  limit: number;
  used: number;
  closingDay: number;
}

export interface SimMonth {
  year: number;
  /** 1 to 12 */
  month: number;
  /** What is left in that month with what is already recorded. */
  sobra: number;
}

export interface SimContext {
  balance: number;
  months: SimMonth[];
  cards: SimCard[];
  income: number;
  goalsMonthly: number;
  categoryLimit: number | null;
  categorySpent: number;
}

export interface SimPath {
  id: string;
  kind: "conta" | "cartao";
  cardName: string | null;
  parts: number;
  entry: number;
  /** Monthly interest, in percent. */
  ratePct: number;
}

export interface SimCharge {
  year: number;
  month: number;
  charge: number;
  sobraBefore: number;
  sobraAfter: number;
}

export interface SimResult {
  path: SimPath;
  label: string;
  perPart: number;
  paid: number;
  interest: number;
  /** What leaves the account on the day of the purchase. */
  today: number;
  balanceAfter: number;
  limitAfter: number | null;
  overLimit: boolean;
  firstInvoice: { year: number; month: number } | null;
  schedule: SimCharge[];
  /** Instalments that fall past the months known. */
  partsBeyond: number;
  negative: SimCharge[];
  worst: SimCharge | null;
  incomeShare: number | null;
  goalsAtRisk: boolean;
  categoryOver: number | null;
  reading: string;
}

export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function pathLabel(p: SimPath): string {
  const where = p.kind === "cartao" ? "no cartão" : "na conta";
  if (p.parts <= 1 && p.entry <= 0) return `À vista ${where}`;
  const parts = `${p.parts}x ${where}`;
  return p.entry > 0 ? `Entrada + ${parts}` : parts;
}

/** Month and year a purchase on this date is first charged in, on a card with this closing day. */
export function invoiceOf(date: string, closingDay: number) {
  const [y, m, d] = date.split("-").map(Number);
  if (d < closingDay) return { year: y, month: m };
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
}

export function simulate(total: number, date: string, path: SimPath, ctx: SimContext): SimResult {
  const entry = Math.min(Math.max(path.entry, 0), total);
  const parts = Math.max(1, Math.round(path.parts));
  const financed = total - entry;
  const rate = path.ratePct > 0 ? path.ratePct / 100 : 0;
  const perPart = financed <= 0 ? 0 : rate > 0 ? (financed * rate) / (1 - (1 + rate) ** -parts) : financed / parts;
  const paid = entry + perPart * parts;
  const card = path.kind === "cartao" ? (ctx.cards.find((c) => c.name === path.cardName) ?? ctx.cards[0] ?? null) : null;

  const [y, m] = date.split("-").map(Number);
  const first = card ? invoiceOf(date, card.closingDay) : { year: y, month: m };
  const today = entry + (path.kind === "conta" ? perPart : 0);
  const limitAfter = card ? card.limit - card.used - financed : null;

  /* What falls in each known month. */
  const charges = new Map<string, number>();
  const add = (year: number, month: number, v: number) => charges.set(`${year}-${month}`, (charges.get(`${year}-${month}`) ?? 0) + v);
  if (entry > 0) add(y, m, entry);
  let lastKey = 0;
  for (let i = 0; i < parts; i++) {
    const at = first.year * 12 + (first.month - 1) + i;
    lastKey = at;
    add(Math.floor(at / 12), (at % 12) + 1, perPart);
  }
  const schedule: SimCharge[] = ctx.months.map((k) => {
    const charge = charges.get(`${k.year}-${k.month}`) ?? 0;
    return { year: k.year, month: k.month, charge, sobraBefore: k.sobra, sobraAfter: k.sobra - charge };
  });
  const lastKnown = ctx.months.length ? ctx.months[ctx.months.length - 1] : null;
  const partsBeyond = lastKnown ? Math.max(0, lastKey - (lastKnown.year * 12 + lastKnown.month - 1)) : 0;

  const touched = schedule.filter((s) => s.charge > 0);
  const negative = touched.filter((s) => s.sobraAfter < 0);
  const worst = touched.length ? touched.reduce((a, b) => (b.sobraAfter < a.sobraAfter ? b : a)) : null;
  const incomeShare = ctx.income > 0 && parts > 1 ? perPart / ctx.income : null;
  const goalsAtRisk = ctx.goalsMonthly > 0 && touched.some((s) => s.sobraBefore >= ctx.goalsMonthly && s.sobraAfter < ctx.goalsMonthly);
  /* Against this month's limit for the category: only what falls in this month. */
  const inThisMonth = charges.get(`${y}-${m}`) ?? 0;
  const categoryOver = ctx.categoryLimit != null && ctx.categorySpent + inThisMonth > ctx.categoryLimit ? ctx.categorySpent + inThisMonth - ctx.categoryLimit : null;
  const balanceAfter = ctx.balance - today;
  const overLimit = limitAfter != null && limitAfter < 0;

  /* The one thing to know first, in plain words. It describes; it does not approve. */
  const name = (s: { month: number }) => MONTH_NAMES[s.month - 1];
  const reading = overLimit
    ? `Não cabe no limite do ${card?.name}: faltam ${brl(-limitAfter!)}. O limite fica preso pelo valor inteiro, mesmo parcelando.`
    : today > 0 && balanceAfter < 0
      ? `Hoje a conta não cobre: ela ficaria em ${brl(balanceAfter)}.`
      : worst && worst.sobraBefore >= 0 && worst.sobraAfter < 0
        ? `Em ${name(worst)}, sairia mais do que entra: a sobra de ${brl(worst.sobraBefore)} vira ${brl(worst.sobraAfter)}.`
        : negative.length > 0
          ? `${name(negative[0])[0].toUpperCase()}${name(negative[0]).slice(1)} já está no negativo, com outros vencimentos. Isso soma ${brl(negative[0].charge)} a esse aperto.`
          : goalsAtRisk
            ? "Cabe nos meses, mas o que sobra deixa de cobrir o que você guarda nas suas metas."
            : parts > 1
              ? `Cabe no que está previsto hoje, mas prende ${brl(perPart)} por mês durante ${parts} meses.`
              : "Cabe no que está previsto hoje.";

  return { path, label: pathLabel(path), perPart, paid, interest: paid - total, today, balanceAfter, limitAfter, overLimit, firstInvoice: card ? first : null, schedule, partsBeyond, negative, worst, incomeShare, goalsAtRisk, categoryOver, reading };
}

/** How the ways of paying differ, from the same assumptions. */
export function compare(results: SimResult[]): string | null {
  if (results.length < 2) return null;
  const least = (pick: (r: SimResult) => number) => results.reduce((a, b) => (pick(b) < pick(a) ? b : a));
  const lightToday = least((r) => r.today);
  const cheapest = least((r) => r.paid);
  const lightestMonth = least((r) => (r.worst ? -r.worst.sobraAfter : 0));
  const parts = [`Menos saída hoje: ${lightToday.label}.`];
  if (cheapest.paid + 0.5 < Math.max(...results.map((r) => r.paid))) parts.push(`Menor custo total: ${cheapest.label}.`);
  parts.push(`Mês menos apertado: ${lightestMonth.label}.`);
  return parts.join(" ");
}

export const newPath = (id: string, kind: SimPath["kind"], parts: number, entry: number, cardName: string | null): SimPath => ({ id, kind, cardName, parts, entry, ratePct: 0 });

/** Ways worth comparing for this value, to start from. */
export function startingPaths(total: number, cardName: string | null): SimPath[] {
  const paths = [newPath("a", "conta", 1, 0, null)];
  if (cardName) {
    paths.push(newPath("b", "cartao", 6, 0, cardName), newPath("c", "cartao", 12, 0, cardName), newPath("d", "cartao", 10, Math.round(total * 0.2), cardName));
  } else {
    paths.push(newPath("b", "conta", 6, 0, null));
  }
  return paths;
}

export interface SavedSim {
  id: string;
  name: string;
  total: number;
  date: string;
  category: string | null;
  paths: SimPath[];
  at: number;
}

const keyOf = (userId: string) => `willo-sims:${userId}`;

/* Kept on the phone and apart from everything else: a simulation is never a movement. */
export function loadSims(userId: string): SavedSim[] {
  try {
    return JSON.parse(localStorage.getItem(keyOf(userId)) ?? "[]") as SavedSim[];
  } catch {
    return [];
  }
}

export function saveSim(userId: string, sim: SavedSim) {
  const rest = loadSims(userId).filter((s) => s.id !== sim.id);
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify([sim, ...rest].slice(0, 30)));
  } catch {
    /* Kept for this session only. */
  }
}

export function deleteSim(userId: string, id: string) {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(loadSims(userId).filter((s) => s.id !== id)));
  } catch {
    /* Nothing to do. */
  }
}
