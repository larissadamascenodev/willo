/**
 * How it was paid, when the sentence says so — "no débito", "no cartão de crédito",
 * "na conta Nubank", "no Nubank PF" — and the sentence without those words, so the rest
 * reads as what it was and how much.
 *
 * A debit word wins over "cartão": "no débito, no cartão do Nubank" is the account, since
 * a debit card takes from it. A bank named with no way of paying decides it when only the
 * accounts, or only the cards, carry that name.
 */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const bare = (w: string) => plain(w).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

const DEBIT = new Set(["debito", "pix", "dinheiro", "especie"]);
const CREDIT = new Set(["credito", "cartao"]);
/* Small words that only lead into how it was paid: "no", "pelo", "com o meu"… */
const LINKS = new Set(["no", "na", "nos", "nas", "pelo", "pela", "com", "em", "via", "do", "da", "de", "o", "a", "meu", "minha"]);
/* First words too common to name a bank by themselves. */
const VAGUE = new Set(["conta", "cartao", "banco", "credito", "debito"]);

interface Named {
  id: string;
  name: string;
}

export interface PaymentMention {
  method: "conta" | "cartao" | null;
  accountId: string | null;
  cardId: string | null;
  /** The sentence without the way it was paid. */
  rest: string;
}

/** Where a name's words run in the sentence's words — the longest name, then a first word only one of them has. */
function find(words: string[], list: Named[]) {
  let best: { id: string; at: number; len: number } | null = null;
  const names = list.map((o) => ({ id: o.id, parts: plain(o.name).split(/\s+/).filter(Boolean) })).filter((n) => n.parts.length > 0);
  for (const n of names)
    for (let i = 0; i + n.parts.length <= words.length; i++)
      if (n.parts.every((p, j) => words[i + j] === p) && (!best || n.parts.length > best.len)) best = { id: n.id, at: i, len: n.parts.length };
  if (best) return best;

  for (const n of names) {
    const first = n.parts[0];
    if (n.parts.length < 2 || VAGUE.has(first) || names.filter((o) => o.parts[0] === first).length > 1) continue;
    const at = words.indexOf(first);
    if (at >= 0) return { id: n.id, at, len: 1 };
  }
  return null;
}

export function paymentMention(sentence: string, accounts: Named[], cards: Named[]): PaymentMention {
  const tokens = sentence.trim().split(/\s+/).filter(Boolean);
  const words = tokens.map(bare);
  const drop = new Set<number>();

  words.forEach((w, i) => {
    if (DEBIT.has(w) || CREDIT.has(w)) drop.add(i);
  });
  const debit = words.some((w) => DEBIT.has(w));
  const credit = words.some((w) => CREDIT.has(w));

  let account = find(words, accounts);
  let card = find(words, cards);
  /* "Nubank PF" said: the card of that name, not the account called "Nubank" inside it. */
  if (account && card && account.at < card.at + card.len && card.at < account.at + account.len) {
    if (card.len > account.len) account = null;
    else if (account.len > card.len) card = null;
  }
  for (const m of [account, card]) if (m) for (let j = 0; j < m.len; j++) drop.add(m.at + j);

  /* "na conta Nubank", or "na conta" closing a part of the sentence — not "conta de luz". */
  let byAccount = false;
  words.forEach((w, i) => {
    if (w !== "conta") return;
    const closes = i === words.length - 1 || /[,;]$/.test(tokens[i]);
    if (drop.has(i + 1) || (closes && ["na", "pela"].includes(words[i - 1] ?? ""))) {
      drop.add(i);
      byAccount = true;
    }
  });

  /* The little words leading into what was dropped go with it. */
  for (let i = words.length - 1; i > 0; i--) if (drop.has(i) && !drop.has(i - 1) && LINKS.has(words[i - 1])) drop.add(i - 1);
  for (let i = words.length - 1; i > 0; i--) if (drop.has(i) && !drop.has(i - 1) && LINKS.has(words[i - 1])) drop.add(i - 1);

  const method: PaymentMention["method"] = debit
    ? "conta"
    : credit
      ? "cartao"
      : byAccount
        ? "conta"
        : account && !card
          ? "conta"
          : card && !account
            ? "cartao"
            : null;

  const rest = tokens
    .filter((_, i) => !drop.has(i))
    .join(" ")
    .replace(/\s+([,;])/g, "$1")
    .replace(/([,;])(?:\s*[,;])+/g, "$1")
    .replace(/^[\s,;]+|[\s,;]+$/g, "")
    .trim();

  return { method, accountId: account?.id ?? null, cardId: card?.id ?? null, rest };
}
