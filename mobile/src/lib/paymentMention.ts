/**
 * How it was paid, when the sentence says so — "no débito", "no cartão de crédito",
 * "na conta Nubank", "no Nubank PF" — and the sentence without those words, so the rest
 * reads as what it was and how much.
 *
 * A debit word wins over "cartão": "no débito, no cartão do Nubank" is the account, since
 * a debit card takes from it. A bank named with no way of paying decides it when only the
 * accounts, or only the cards, carry that name.
 *
 * Instalments too: "parcelado", "em 5x", "5 vezes", "cinco parcelas", "à vista" — on a
 * card or, said with a debit word, on the account; said alone, the way it was paid is
 * still asked. "5x de 100" is a hundred each, so five hundred in all — `perPart` says the
 * amount read is one instalment.
 *
 * And when, and whether every month: "recorrente", "todo mês", "mensal", "todo dia 15"
 * (the next 15th that can still be paid: this month's if it has not passed, else next
 * month's), "dia 15 de novembro", "15/11", "amanhã" — the day it starts.
 */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const bare = (w: string) => plain(w).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

const DEBIT = new Set(["debito", "pix", "dinheiro", "especie"]);
const CREDIT = new Set(["credito", "cartao"]);
/* Small words that only lead into how it was paid: "no", "pelo", "com o meu"… */
const LINKS = new Set(["no", "na", "nos", "nas", "pelo", "pela", "com", "em", "via", "do", "da", "de", "o", "a", "meu", "minha"]);
/* "Em cinco vezes": instalments said in words. */
const COUNTS: Record<string, number> = { duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 };
const PARTS = new Set(["vezes", "vez", "parcelas", "parcela", "x"]);
const SPLIT = new Set(["parcelado", "parcelada", "parcelei", "parcelou", "parcelar"]);
const countOf = (w: string | undefined) => {
  if (!w) return null;
  const n = /^\d{1,2}$/.test(w) ? Number(w) : COUNTS[w];
  return n && n >= 2 && n <= 48 ? n : null;
};

/* Months by name, whole or short; "março" read without its accent. */
const MONTH_OF: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const RECURRING = new Set(["recorrente", "mensal", "mensalmente"]);
const pad = (n: number) => String(n).padStart(2, "0");

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
  /** Instalments said ("5x", "cinco vezes"), or null. */
  installments: number | null;
  /** "Parcelado" said, with or without how many. */
  split: boolean;
  /** "À vista" said. */
  inCash: boolean;
  /** "5x de 100": the amount in the sentence is one instalment. */
  perPart: boolean;
  /** Every month, until cancelled. */
  recurring: boolean;
  /** yyyy-mm-dd — the day said, or the next one a recurring "todo dia 15" falls on. */
  date: string | null;
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

export function paymentMention(sentence: string, accounts: Named[], cards: Named[], today: Date = new Date()): PaymentMention {
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

  /* How many instalments, and whether at all. */
  let installments: number | null = null;
  let split = false;
  let inCash = false;
  let perPart = false;
  words.forEach((w, i) => {
    const times = /^(\d{1,2})x$/.exec(w);
    let at = -1;
    if (times && countOf(times[1])) {
      installments = countOf(times[1]);
      drop.add(i);
      at = i;
    } else if (PARTS.has(w) && countOf(words[i - 1])) {
      installments = countOf(words[i - 1]);
      drop.add(i - 1);
      drop.add(i);
      at = i;
    }
    if (at >= 0 && words[at + 1] === "de" && /^(r\$)?\d/.test(words[at + 2] ?? "")) perPart = true;
    if (SPLIT.has(w)) {
      split = true;
      drop.add(i);
    }
    if (w === "vista" && words[i - 1] === "a") {
      inCash = true;
      drop.add(i - 1);
      drop.add(i);
    }
  });

  /* Every month, and from which day. */
  let recurring = false;
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;
  let tomorrow = false;
  words.forEach((w, i) => {
    if (RECURRING.has(w)) {
      recurring = true;
      drop.add(i);
    }
    if (w === "todo" && words[i + 1] === "mes") {
      recurring = true;
      drop.add(i);
      drop.add(i + 1);
    }
    if (w === "todos" && words[i + 1] === "os" && words[i + 2] === "meses") {
      recurring = true;
      [i, i + 1, i + 2].forEach((k) => drop.add(k));
    }
    if (w === "amanha") {
      tomorrow = true;
      drop.add(i);
    }
    /* "dia 15", "todo dia 15", "dia 15 de novembro (de 2026)" */
    if (w === "dia" && /^\d{1,2}$/.test(words[i + 1] ?? "") && Number(words[i + 1]) >= 1 && Number(words[i + 1]) <= 31) {
      day = Number(words[i + 1]);
      drop.add(i);
      drop.add(i + 1);
      if (words[i - 1] === "todo") {
        recurring = true;
        drop.add(i - 1);
      }
      let j = i + 2;
      if (words[j] === "de" && MONTH_OF[words[j + 1] ?? ""]) {
        month = MONTH_OF[words[j + 1]];
        drop.add(j);
        drop.add(j + 1);
        j += 2;
      } else if (MONTH_OF[words[j] ?? ""]) {
        month = MONTH_OF[words[j]];
        drop.add(j);
        j += 1;
      }
      if (month && words[j] === "de" && /^\d{4}$/.test(words[j + 1] ?? "")) {
        year = Number(words[j + 1]);
        drop.add(j);
        drop.add(j + 1);
      }
    }
    /* "15 de novembro" */
    if (day === null && /^\d{1,2}$/.test(w) && words[i + 1] === "de" && MONTH_OF[words[i + 2] ?? ""]) {
      day = Number(w);
      month = MONTH_OF[words[i + 2]];
      [i, i + 1, i + 2].forEach((k) => drop.add(k));
    }
    /* "15/11", "15/11/2026" */
    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w);
    if (slash && Number(slash[2]) >= 1 && Number(slash[2]) <= 12) {
      day = Number(slash[1]);
      month = Number(slash[2]);
      if (slash[3]) year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
      drop.add(i);
      if (words[i - 1] === "dia") drop.add(i - 1);
      if (words[i - 2] === "todo" && words[i - 1] === "dia") {
        recurring = true;
        drop.add(i - 2);
      }
    }
  });

  let date: string | null = null;
  if (day) {
    let y = year ?? today.getFullYear();
    let m = month ?? today.getMonth() + 1;
    /* Every month from "dia 15": the next 15th that can still be paid. */
    if (!month && recurring && day < today.getDate()) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    date = `${y}-${pad(m)}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`;
  } else if (tomorrow) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    date = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }

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

  return { method, accountId: account?.id ?? null, cardId: card?.id ?? null, installments, split, inCash, perPart, recurring, date, rest };
}
