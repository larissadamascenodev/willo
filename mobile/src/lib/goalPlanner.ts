import { money } from "~/lib/money";

/**
 * Planning something big with Willo, step by step and with no AI: what it is, how much, by
 * when. He does the sum against what is really left over each month, says whether it fits,
 * and offers to create the caixinha. Every figure comes from here, never from a model.
 */

export interface GoalPlan {
  stage: "name" | "amount" | "time" | "confirm";
  name: string;
  amount: number;
  months: number;
  perMonth: number;
  deadline: string;
}

export interface PlanTurn {
  /** Where the plan stands now; null when it is over. */
  plan: GoalPlan | null;
  reply: string;
  /** He was told yes: create the caixinha. */
  create?: boolean;
}

/** Lowercase and without accents, keeping each letter's place so the original can be cut. */
const plain = (s: string) => [...s.normalize("NFC")].map((c) => c.normalize("NFD")[0].toLowerCase()).join("");

const BIG = /\b(viagem|ferias|intercambio|mochilao|carro|moto|casa|apartamento|ape|imovel|casamento|festa|faculdade|curso|reforma|mudanca|reserva|aposentadoria|investir|investimentos?)\b/;
const PLANNING = /\b(planejar|planejamento|juntar|guardar (dinheiro )?(para|pra)|economizar (para|pra)|poupar (para|pra)|meu sonho|sonho de|criar (uma )?(meta|caixinha)|nova (meta|caixinha)|quero (fazer|montar|ter|investir))\b/;
const BUYING = /\b(quero|vou|pretendo|preciso) (comprar|trocar( de)?|fazer|dar entrada)\b/;
const ONLY_ASKING = /^(posso|da pra|da para|cabe|vale|consigo|qual|quanto|quando|como|onde|por que|porque)\b/;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What is being planned, in the person's own words, without the value or the time. */
function nameIn(said: string): string | null {
  const text = said.normalize("NFC").trim();
  const q = plain(text);
  const at = q.search(BIG);
  let start = at;
  if (start < 0) {
    const after = q.match(/\b(?:juntar|guardar|economizar|poupar)(?: dinheiro)? (?:para|pra) (?:(?:um|uma|o|a|meu|minha) )?/) ?? q.match(/\b(?:planejar|caixinha|meta)(?: de| para| pra)? (?:(?:um|uma|o|a|meu|minha) )?/);
    if (!after || after.index === undefined) return null;
    start = after.index + after[0].length;
  }
  const rest = text.slice(start);
  const end = plain(rest).search(/\s(em|ate|daqui|de r\$|por|que custa|custando|no valor|com)\b|\s*r\$|\s+\d|[,.!?]/);
  const name = (end >= 0 ? rest.slice(0, end) : rest).trim();
  return name ? capital(/^investir$/i.test(name) ? "Investimentos" : name) : null;
}

export function amountIn(said: string): number | null {
  const q = plain(said).replace(/r\$\s*/g, "");
  const m = q.match(/(\d[\d.]*(?:,\d{1,2})?)\s*(mil\b|k\b)?/);
  if (m) {
    const v = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) * (m[2] ? 1000 : 1);
    return v > 0 ? v : null;
  }
  if (/\bmil\b/.test(q)) return 1000;
  return null;
}

const NUMBERS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 };
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** How many months away: "2 anos", "ano e meio", "seis meses", "dezembro", "junho de 2028". */
export function monthsIn(said: string, today = new Date()): number | null {
  const q = plain(said);
  const count = (w: string) => Number(w) || NUMBERS[w] || 0;
  const unit = "(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)";
  if (/\bano e meio\b/.test(q)) return 18;
  const years = q.match(new RegExp(`${unit} anos?`));
  const months = q.match(new RegExp(`${unit} mes(es)?`));
  if (years || months) {
    const total = (years ? count(years[1]) * 12 : 0) + (months ? count(months[1]) : 0) + (years && /\be meio\b/.test(q) ? 6 : 0);
    return total > 0 ? total : null;
  }
  if (/\bum ano\b|\bano que vem\b/.test(q)) return 12;
  const named = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(q));
  if (named >= 0) {
    const year = Number(q.match(/\b(20\d{2})\b/)?.[1]) || (named > today.getMonth() ? today.getFullYear() : today.getFullYear() + 1);
    const total = (year - today.getFullYear()) * 12 + named - today.getMonth();
    return total > 0 ? total : null;
  }
  const bare = q.match(/^\s*(\d{1,3})\s*$/);
  return bare ? Number(bare[1]) : null;
}

const askAmount = (name: string) => `Boa, vamos planejar: ${name}. Quanto você precisa? Pode ser um valor aproximado.`;
const askTime = () => "E em quanto tempo você quer chegar lá? Pode falar “2 anos” ou “até dezembro”.";

function theSum(name: string, amount: number, months: number, room: number | null, today: Date): PlanTurn {
  const perMonth = amount / months;
  const when = new Date(today.getFullYear(), today.getMonth() + months, 1);
  const deadline = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-01`;
  const label = when.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const lines = [`Guardando ${money(perMonth)} por mês, uns ${money(perMonth / 30)} por dia, você chega em ${money(amount)} em ${label}.`];
  if (room != null) {
    if (room >= perMonth) lines.push(`Cabe: hoje sobram uns ${money(room)} por mês.`);
    else if (room > 0) lines.push(`Hoje sobram uns ${money(room)} por mês. Nesse ritmo, levaria ${Math.ceil(amount / room)} meses, ou dá para cortar ${money(perMonth - room)} por mês em outros gastos.`);
    else lines.push(`Hoje o seu mês não está sobrando, então vai precisar liberar esse valor cortando outros gastos.`);
  }
  lines.push(`Quer que eu crie a caixinha “${name}” para você?`);
  return { plan: { stage: "confirm", name, amount, months, perMonth, deadline }, reply: lines.join("\n\n") };
}

/** Starts a plan, when the words are about one. */
export function startPlan(said: string, room: number | null, today = new Date()): PlanTurn | null {
  const q = plain(said).trim();
  if (ONLY_ASKING.test(q)) return null;
  const about = PLANNING.test(q) || (BIG.test(q) && BUYING.test(q));
  if (!about) return null;
  const name = nameIn(said);
  if (!name) return { plan: { stage: "name", name: "", amount: 0, months: 0, perMonth: 0, deadline: "" }, reply: "Claro! O que você quer planejar?" };
  const amount = amountIn(said.replace(/\b\d+\s*(anos?|mes(es)?)\b/gi, ""));
  const months = monthsIn(said, today);
  if (amount && months) return theSum(name, amount, months, room, today);
  if (amount) return { plan: { stage: "time", name, amount, months: 0, perMonth: 0, deadline: "" }, reply: askTime() };
  return { plan: { stage: "amount", name, amount: 0, months: 0, perMonth: 0, deadline: "" }, reply: askAmount(name) };
}

/** The next step of a plan under way. Null when what was said is not about it: the plan ends. */
export function continuePlan(plan: GoalPlan, said: string, room: number | null, today = new Date()): PlanTurn | null {
  const q = plain(said).trim();
  if (plan.stage === "confirm") {
    if (/^(sim|quero|pode|cria|crie|bora|ok|claro|isso|manda|vamos)\b/.test(q)) return { plan: null, reply: "", create: true };
    if (/^(nao|agora nao|deixa|depois|nem)\b/.test(q)) return { plan: null, reply: "Tudo bem. Quando quiser, é só me chamar que a gente retoma." };
    return null;
  }
  if (plan.stage === "name") {
    const name = capital(said.trim().replace(/[.!?]+$/, "").replace(/^(uma?|o|a|meu|minha)\s+/i, ""));
    return name ? { plan: { ...plan, stage: "amount", name }, reply: askAmount(name) } : null;
  }
  if (plan.stage === "amount") {
    const amount = amountIn(said);
    if (amount) return { plan: { ...plan, stage: "time", amount }, reply: askTime() };
    return ONLY_ASKING.test(q) ? null : { plan, reply: "Me diz um valor, mesmo que seja um chute. Tipo “15 mil”." };
  }
  const months = monthsIn(said, today);
  if (months) return theSum(plan.name, plan.amount, months, room, today);
  return ONLY_ASKING.test(q) ? null : { plan, reply: "Em quanto tempo? Pode ser “18 meses”, “2 anos” ou “até dezembro”." };
}
