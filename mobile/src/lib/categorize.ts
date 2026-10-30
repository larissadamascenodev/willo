import { supabase } from "~/supabase/client";

/**
 * Asks Willo which category a transaction belongs to.
 *
 * The server holds the list and the model (see the categorize-transaction function); this
 * only sends what the person wrote. One entry while it is being typed, or many at once to
 * file older ones under the new list. Resolves to null when there is no answer — the person
 * simply chooses, as before.
 */

export interface ToCategorize {
  name: string;
  amount: number;
  type: "despesa" | "receita";
}

export async function categorize(items: ToCategorize[]): Promise<(string | null)[]> {
  if (items.length === 0) return [];
  try {
    const { data, error } = await supabase.functions.invoke("categorize-transaction", { body: { items } });
    if (error || !Array.isArray(data?.results)) return items.map(() => null);
    const byIndex = new Map<number, string>((data.results as { i: number; category: string }[]).map((r) => [r.i, r.category]));
    return items.map((_, i) => byIndex.get(i) ?? null);
  } catch {
    return items.map(() => null);
  }
}

/** One entry, while it is being typed. */
export async function suggestCategory(item: ToCategorize): Promise<string | null> {
  const [one] = await categorize([item]);
  return one ?? null;
}
