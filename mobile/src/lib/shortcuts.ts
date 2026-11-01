/**
 * Which shortcuts to offer in the conversation: first something that carries on from what
 * was just asked, then what this person asks most, then the usual ones. The counts stay on
 * the phone, one list per person.
 */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[?!.]+$/, "").trim();

/** What follows naturally from each subject. */
const NEXT_ON: { match: RegExp; asks: string[] }[] = [
  { match: /fatura|cartao/, asks: ["Por que minha fatura aumentou?", "Quanto tenho de limite no cartão?", "O que mais pesou na fatura?"] },
  { match: /limite/, asks: ["Quanto está minha fatura?", "O que mais pesou na fatura?"] },
  { match: /parcel/, asks: ["Quanto pago de parcelas por mês?", "Quando terminam meus parcelamentos?", "Posso parcelar mais alguma coisa?"] },
  { match: /gast|categoria|padrao|pesa/, asks: ["Onde consigo economizar este mês?", "Tenho algum gasto fora do padrão?", "Onde estou gastando mais este mês?"] },
  { match: /assinatura|fixo/, asks: ["Quanto pago de fixos por mês?", "Qual assinatura vale cortar?"] },
  { match: /comprar|compra/, asks: ["Qual o melhor mês para comprar?", "E se eu parcelar em 10x?"] },
  { match: /sobra|fim do mes|gastar|saldo|fechar/, asks: ["Como evito fechar o mês no negativo?", "Quanto posso gastar hoje?", "Como fica o mês que vem?"] },
  { match: /plano|renda|orcamento|organizar/, asks: ["Como dividir melhor minha renda?", "Quanto consigo guardar por mês?"] },
  { match: /meta|guardar|economizar|reserva|caixinha/, asks: ["Quanto consigo guardar por mês?", "Em quanto tempo chego na minha meta?"] },
];

/** What carries on from this question, leaving out the question itself. */
export function followUps(said: string): string[] {
  const q = plain(said);
  const found = NEXT_ON.find((n) => n.match.test(q));
  return (found?.asks ?? []).filter((a) => plain(a) !== q).slice(0, 2);
}

const keyOf = (userId: string) => `willo-asked:${userId}`;

type Counts = Record<string, { text: string; count: number }>;

const read = (userId: string): Counts => {
  try {
    return JSON.parse(localStorage.getItem(keyOf(userId)) ?? "{}") as Counts;
  } catch {
    return {};
  }
};

export function noteAsked(userId: string, said: string) {
  const counts = read(userId);
  const key = plain(said);
  if (!key) return;
  counts[key] = { text: said.trim(), count: (counts[key]?.count ?? 0) + 1 };
  /* Only what could come up again is worth keeping. */
  const kept = Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 40);
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* Kept for this session only. */
  }
}

/** What this person keeps asking: said at least twice, most often first. */
export function frequentAsks(userId: string): string[] {
  return Object.values(read(userId))
    .filter((a) => a.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((a) => a.text);
}

/** Each shortcut once, in order. */
export function mergeAsks(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ask of lists.flat()) {
    const key = plain(ask);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ask);
  }
  return out;
}
