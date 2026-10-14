/** One thing the person said they spent or received, as far as it has been pinned down. */
export interface QuickDraft {
  id: string;
  /** What it was: "Mercado", "Uber", "Salário". */
  name: string;
  type: "despesa" | "receita";
  amount: number;
  /** null when the text did not say enough to tell — never silently "Outros". */
  category: string | null;
  /** yyyy-mm-dd. Today unless the person said otherwise. */
  date: string;
  paymentMethod: "conta" | "cartao" | null;
  accountId: string | null;
  creditCardId: string | null;
}

/** What this person actually has, which decides what is worth asking them. */
export interface QuickSetup {
  accounts: { id: string; name: string; is_default?: boolean | null }[];
  cards: { id: string; name: string }[];
}

export interface QuickOption {
  id: string;
  label: string;
}

/** The one thing still missing, and how to put it to the person. */
export type QuickQuestion =
  | { kind: "category"; draftId: string; prompt: string }
  | { kind: "paymentMethod"; draftId: string; prompt: string; options: QuickOption[] }
  | { kind: "account"; draftId: string; prompt: string; options: QuickOption[] }
  | { kind: "card"; draftId: string; prompt: string; options: QuickOption[] };
