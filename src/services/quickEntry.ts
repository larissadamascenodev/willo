import { supabase } from "@/integrations/supabase/client";
/* From categoryData rather than categoryIcons, which re-exports the same lists but
   also pulls in the browser's icon set — this module is read by the phone app too. */
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { getCustomCategories } from "@/services/categoryService";

/**
 * Sends what the person typed or said to the reader, and gets back the entries in it.
 */

export interface ParsedEntry {
  name: string;
  type: "despesa" | "receita";
  amount: number;
  category: string | null;
  date: string;
  paymentMethod: "conta" | "cartao" | null;
  /** Did the sentence say the money already moved? null when it did not say. */
  settled: boolean | null;
}

export interface ParseResult {
  entries: ParsedEntry[];
  /** What the audio was heard as, so the person can see it in their own words. */
  transcript: string | null;
}

/**
 * The categories the reader is allowed to choose from.
 *
 * "Outros" is deliberately left out. It is a real category the person can pick by hand,
 * but offering it to the reader would undo the whole point: faced with "gastei 20" the
 * model would file it under Outros and look right, instead of saying it does not know
 * and letting the app ask.
 */
export async function allowedCategories(): Promise<string[]> {
  let custom: string[] = [];
  try {
    custom = (await getCustomCategories()).filter((c) => !c.is_hidden_default).map((c) => c.name);
  } catch {
    // A category list that failed to load is not a reason to refuse the entry; the
    // built-in names cover almost everything anyone types.
  }
  const names = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...custom];
  return [...new Set(names)].filter((n) => n.toLowerCase() !== "outros");
}

/** Today where the person is, not where the server is. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function readEntry(input: {
  text?: string;
  audio?: { data: string; mimeType: string };
  categories?: string[];
}): Promise<ParseResult> {
  const categories = input.categories ?? (await allowedCategories());

  const { data, error } = await supabase.functions.invoke("quick-entry", {
    body: {
      text: input.text ?? "",
      audio: input.audio,
      today: todayISO(),
      categories,
    },
  });

  if (error) throw new Error(error.message || "Não consegui ler agora.");
  if (data?.error) throw new Error(data.error);

  return { entries: data?.entries ?? [], transcript: data?.transcript ?? null };
}

/**
 * Turns a one-word answer to "em que você gastou?" into a category.
 *
 * It goes back through the same reader rather than matching strings, because people
 * answer with "no mercado", "foi um lanche" or "farmácia" and only one of those is a
 * category name. The amount is handed back so the sentence reads like the original.
 */
export async function categoriseAnswer(
  answerText: string,
  amount: number,
  type: "despesa" | "receita",
  categories: string[],
): Promise<string | null> {
  const verb = type === "receita" ? "recebi" : "gastei";
  const { entries } = await readEntry({
    text: `${verb} ${amount} ${answerText}`,
    categories,
  });
  return entries[0]?.category ?? null;
}
