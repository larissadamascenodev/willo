import type { QuickDraft, QuickQuestion, QuickSetup } from "./types";

/**
 * What still has to be asked before an entry can be saved — and, just as important,
 * what does not.
 *
 * The model reads the sentence. It does not decide what to ask about, because that
 * depends on the person's own setup and there is a right answer: someone with one
 * account should never be asked which account, and someone with no credit card should
 * never be asked whether it was debit or credit. Leaving that to a prompt would mean
 * the app interrogating people about things it already knows.
 *
 * The one thing it will ask about regardless is a category it could not work out.
 * "Gastei 20" filed under "Outros" is a row that teaches nobody anything, and the
 * question costs one tap.
 */

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Fills in everything that follows from the person's setup, so the only things left
 * are things genuinely worth a question.
 */
/**
 * Has the money already moved?
 *
 * The sentence decides when it says so — "recebi" and "paguei" are past tense, "vou
 * receber" and "a receber" are not — and that reading is the model's job. When the
 * sentence says nothing either way, the date decides: something dated ahead has not
 * happened yet. That half is arithmetic, so it lives here.
 *
 * Both directions land on "pago". The app has no settled-income status; a receita
 * filed as anything else never reaches the balance.
 */
export function statusFor(
  settled: boolean | null | undefined,
  date: string,
  today: string,
): "pago" | "pendente" {
  if (settled === true) return "pago";
  if (settled === false) return "pendente";
  return date > today ? "pendente" : "pago";
}

export function applyDefaults(draft: QuickDraft, setup: QuickSetup): QuickDraft {
  const next = { ...draft };

  // Money coming in does not arrive on a credit card.
  if (next.type === "receita") next.paymentMethod = "conta";

  // Nothing to choose between.
  if (setup.cards.length === 0) next.paymentMethod = "conta";

  if (next.paymentMethod === "conta") {
    next.creditCardId = null;
    if (!next.accountId && setup.accounts.length === 1) next.accountId = setup.accounts[0].id;
  }

  if (next.paymentMethod === "cartao") {
    next.accountId = null;
    if (!next.creditCardId && setup.cards.length === 1) next.creditCardId = setup.cards[0].id;
  }

  return next;
}

/** The next thing missing from this one entry, or null when it is ready to save. */
export function missingFrom(draft: QuickDraft, setup: QuickSetup): QuickQuestion | null {
  const what = draft.name ? `${draft.name.toLowerCase()}` : "isso";

  if (!draft.category) {
    return {
      kind: "category",
      draftId: draft.id,
      prompt: draft.type === "receita"
        ? `De onde vieram os ${fmt(draft.amount)}?`
        : `Em que você gastou os ${fmt(draft.amount)}?`,
    };
  }

  if (!draft.paymentMethod && setup.cards.length > 0) {
    return {
      kind: "paymentMethod",
      draftId: draft.id,
      prompt: `${cap(what)}: foi no débito ou no crédito?`,
      options: [
        { id: "conta", label: "Débito" },
        { id: "cartao", label: "Crédito" },
      ],
    };
  }

  if (draft.paymentMethod === "conta" && !draft.accountId && setup.accounts.length > 1) {
    return {
      kind: "account",
      draftId: draft.id,
      prompt: `Qual conta você usou?`,
      options: setup.accounts.map((a) => ({ id: a.id, label: a.name })),
    };
  }

  if (draft.paymentMethod === "cartao" && !draft.creditCardId && setup.cards.length > 1) {
    return {
      kind: "card",
      draftId: draft.id,
      prompt: `Qual cartão?`,
      options: setup.cards.map((c) => ({ id: c.id, label: c.name })),
    };
  }

  return null;
}

/**
 * The next question across every entry in the batch. Entries are finished in the order
 * they were said, so the person is never bounced between two of them.
 */
export function nextQuestion(drafts: QuickDraft[], setup: QuickSetup): QuickQuestion | null {
  for (const draft of drafts) {
    const q = missingFrom(draft, setup);
    if (q) return q;
  }
  return null;
}

/** True when every entry can be written as it stands. */
export function isReady(drafts: QuickDraft[], setup: QuickSetup): boolean {
  return drafts.length > 0 && nextQuestion(drafts, setup) === null;
}

/**
 * Names the reader falls back to when the sentence gave it no merchant to work with.
 * "Gastei 20" produces one of these, and a row called "Gasto" tells the person nothing
 * later, so once they say what it was for, that becomes its name.
 */
const PLACEHOLDER_NAMES = new Set([
  "gasto", "gastos", "despesa", "receita", "lançamento", "lancamento",
  "compra", "pagamento", "entrada", "saída", "saida",
]);

export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_NAMES.has(name.trim().toLowerCase());
}

/** Applies an answer to the entry it was asked about. */
export function answer(draft: QuickDraft, question: QuickQuestion, value: string): QuickDraft {
  switch (question.kind) {
    case "category":
      return {
        ...draft,
        category: value,
        name: isPlaceholderName(draft.name) ? value : draft.name,
      };
    case "paymentMethod":
      return { ...draft, paymentMethod: value === "cartao" ? "cartao" : "conta" };
    case "account":
      return { ...draft, accountId: value };
    case "card":
      return { ...draft, creditCardId: value };
  }
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
