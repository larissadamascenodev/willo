import type { ParsedEntry } from "@/services/quickEntry";

/**
 * Reading a simple sentence without asking any AI.
 *
 * Most of what people type is short and regular — "uber 18", "mercado 90 no crédito",
 * "recebi 200 de freela", "almoço 35 ontem", "café 12 e pão 8". Those are read here, on
 * the phone, at once. Anything this cannot read with certainty returns null and goes to
 * the AI reader as before: a sentence half understood here is worse than one sent on.
 *
 * The category comes from what the person filed before under the same name, then from a
 * short list of words that leave no doubt. Nothing matched means null, and the app asks —
 * the same rule the AI reader follows.
 */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Words that leave no doubt about the category, by the category's name. */
const KEYWORDS: Record<string, string[]> = {
  Transporte: ["uber", "99", "taxi", "onibus", "metro", "passagem de onibus", "bilhete unico", "cabify"],
  Combustível: ["gasolina", "combustivel", "etanol", "posto", "abastecer", "diesel"],
  Supermercado: ["mercado", "supermercado", "atacadao", "assai", "carrefour", "feira", "hortifruti"],
  Restaurante: ["restaurante", "almoco", "jantar", "rodizio"],
  Delivery: ["ifood", "delivery", "rappi", "ze delivery"],
  Cafeteria: ["cafe", "cafeteria", "starbucks", "padaria", "pao"],
  Farmácia: ["farmacia", "remedio", "drogaria", "droga raia", "drogasil"],
  Streaming: ["netflix", "spotify", "disney", "prime video", "hbo", "max", "youtube premium", "globoplay", "deezer"],
  Academia: ["academia", "smartfit", "smart fit", "crossfit", "pilates"],
  Estacionamento: ["estacionamento", "zona azul", "valet"],
  Pets: ["petshop", "pet shop", "racao", "veterinario"],
  Energia: ["luz", "energia", "conta de luz", "enel", "cemig", "light"],
  Água: ["agua", "conta de agua", "sabesp"],
  Internet: ["internet", "wifi", "vivo fibra", "claro net"],
  Telefonia: ["celular", "recarga", "plano de celular"],
  Moradia: ["aluguel", "condominio", "iptu"],
  Salário: ["salario"],
  Freelance: ["freela", "freelance", "job", "trabalho extra", "bico"],
  Reembolso: ["reembolso"],
  Cashback: ["cashback"],
};

/** Where a word's category goes when the person does not keep that one: "farmácia" is then Saúde. */
const BROADER: Record<string, string> = {
  Farmácia: "Saúde",
  Academia: "Saúde",
  Restaurante: "Alimentação",
  Cafeteria: "Alimentação",
  Delivery: "Alimentação",
  Combustível: "Transporte",
  Estacionamento: "Transporte",
  Streaming: "Assinaturas",
  Energia: "Conta de Luz",
  Água: "Conta de Água",
  Internet: "Telefone e Internet",
  Telefonia: "Telefone e Internet",
};

const INCOME_WORDS = /^(recebi|ganhei|caiu|entrou|vendi|me pagaram|pagaram)\b/;
const CREDIT = /\b(no |pelo |com o |com )?(credito|cartao)\b/;
const DEBIT = /\b(no |pelo |com o |com |em |via )?(debito|pix|dinheiro|especie|conta)\b/;
const NUMBER = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(k|mil|reais|real|r\$)?/;

function amountOf(raw: string, unit?: string): number | null {
  let v: number;
  if (/\.\d{3}/.test(raw)) v = Number(raw.replace(/\./g, "").replace(",", "."));
  else v = Number(raw.replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return null;
  if (unit === "k" || unit === "mil") v *= 1000;
  return Math.round(v * 100) / 100;
}

const titleCase = (s: string) => s.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());

function categoryFor(name: string, type: "despesa" | "receita", allowed: Set<string>, history: Record<string, string>): string | null {
  const key = plain(name);
  if (history[key] && allowed.has(history[key])) return history[key];
  for (const [category, words] of Object.entries(KEYWORDS)) {
    const kept = allowed.has(category) ? category : BROADER[category] && allowed.has(BROADER[category]) ? BROADER[category] : null;
    if (!kept) continue;
    const income = ["Salário", "Freelance", "Reembolso", "Cashback"].includes(category);
    if (income !== (type === "receita")) continue;
    if (words.some((w) => key === w || key.startsWith(`${w} `) || key.endsWith(` ${w}`) || key.includes(` ${w} `))) return kept;
  }
  return null;
}

/** One piece of the sentence, "uber 18" or "recebi 200 de freela", or null if unclear. */
function readPiece(
  piece: string,
  today: string,
  allowed: Set<string>,
  history: Record<string, string>,
  shared: { paymentMethod: "conta" | "cartao" | null; date: string; typed: Map<string, string> },
): ParsedEntry | null {
  let text = plain(piece).replace(/r\$\s*/g, "");
  if (!text) return null;

  const type: "despesa" | "receita" = INCOME_WORDS.test(text) ? "receita" : "despesa";
  text = text.replace(INCOME_WORDS, "").trim();
  text = text.replace(/^(gastei|paguei|comprei)\s+/, "");

  const m = text.match(NUMBER);
  if (!m) return null;
  const amount = amountOf(m[1], m[2]);
  if (amount === null) return null;
  /* Only one number: "2 pizzas 80" is not something to guess at. */
  if ((text.replace(m[0], "").match(/\d/g) ?? []).length > 0) return null;

  let name = text.replace(m[0], " ");
  name = name
    .replace(CREDIT, " ")
    .replace(DEBIT, " ")
    .replace(/\b(ontem|hoje|anteontem)\b/, " ")
    .replace(/^\s*(de|do|da|no|na|em|com|pro|pra|para o|para a)\s+/, "")
    .replace(/\s+(de|do|da|no|na|em|com)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length > 40 || /\d/.test(name)) return null;

  /* Read without accents, written with them: each word goes back to how it was typed. */
  const typed = name.split(" ").map((w) => shared.typed.get(w) ?? w).join(" ");

  return {
    name: titleCase(typed),
    type,
    amount,
    category: categoryFor(name, type, allowed, history),
    date: shared.date || today,
    paymentMethod: type === "receita" ? null : shared.paymentMethod,
    settled: null,
  } as ParsedEntry;
}

export function parseLocal(
  sentence: string,
  options: { today: string; categories: string[]; history?: Record<string, string> },
): ParsedEntry[] | null {
  const whole = plain(sentence);
  if (!whole || whole.length > 140) return null;
  /* A question is not an entry. */
  if (/\?|^(quanto|como|quando|onde|por que|porque|posso|qual|quais|o que)\b/.test(whole)) return null;
  /* Instalments, "todo mês" and the like are left to the AI reader, which knows them. */
  if (/\b(\d+\s*x|vezes|parcel|todo mes|mensal|semanal|amanha|dia \d)\b/.test(whole)) return null;

  const today = options.today;
  const d = new Date(`${today}T12:00:00`);
  const shift = (n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() - n);
    return x.toISOString().slice(0, 10);
  };
  const date = /\banteontem\b/.test(whole) ? shift(2) : /\bontem\b/.test(whole) ? shift(1) : today;
  const paymentMethod = CREDIT.test(whole) ? "cartao" : DEBIT.test(whole) ? "conta" : null;

  const pieces = whole.split(/\s*(?:,(?!\d)|;|\s+e\s+|\s+mais\s+)\s*/).filter(Boolean);
  if (pieces.length === 0 || pieces.length > 6) return null;

  const typed = new Map(
    sentence
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((w) => [plain(w), w] as const),
  );
  const allowed = new Set(options.categories);
  const history = Object.fromEntries(Object.entries(options.history ?? {}).map(([k, v]) => [plain(k), v]));
  const out: ParsedEntry[] = [];
  for (const piece of pieces) {
    const entry = readPiece(piece, today, allowed, history, { paymentMethod, date, typed });
    if (!entry) return null;
    out.push(entry);
  }
  return out;
}
