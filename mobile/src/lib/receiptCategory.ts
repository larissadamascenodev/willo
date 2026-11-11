import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { getCustomCategories } from "@/services/categoryService";

/**
 * The category a receipt goes under, taken only from the person's own list.
 *
 * The reader knows the built-in names, not the ones a person added, and it filed a Pix
 * received as "Pix no crédito" — an expense, and a card one. Here every item is put back
 * on the list that exists for its kind:
 *
 * - money in, sent by Pix or transfer: "Pix Recebido" or a transfer category, when the
 *   person has one;
 * - money out by Pix: "Pix Enviado" or a transfer category, when the person has one —
 *   never "Pix no crédito", which is only chosen by hand;
 * - anything else not on the list for its kind: "Outros".
 */

interface Read {
  type?: string;
  category?: string;
  description?: string;
  merchant?: string | null;
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const PIX = /\bpix\b|transfer|\bted\b|\bdoc\b/;

export async function fitReceiptCategories<T extends Read>(items: T[]): Promise<T[]> {
  let custom: { name: string; type: string }[] = [];
  try {
    custom = ((await getCustomCategories()) as { name: string; type: string; is_hidden_default?: boolean }[]).filter((c) => !c.is_hidden_default);
  } catch {
    /* the built-in names still apply */
  }
  const lists = {
    receita: [...DEFAULT_INCOME_CATEGORIES, ...custom.filter((c) => c.type === "receita").map((c) => c.name)],
    despesa: [...DEFAULT_EXPENSE_CATEGORIES, ...custom.filter((c) => c.type === "despesa").map((c) => c.name)].filter(
      (name) => plain(name) !== "pix no credito",
    ),
  };
  const find = (list: string[], name?: string) => (name ? list.find((c) => plain(c) === plain(name)) : undefined);
  /* The person's own name for a transfer, if there is one: "Pix Recebido", "Transferências recebidas"… */
  const transferIn = lists.receita.find((c) => /pix|transfer/.test(plain(c)));
  const transferOut = lists.despesa.find((c) => /pix|transfer/.test(plain(c)));

  return items.map((item) => {
    const kind = item.type === "receita" ? "receita" : "despesa";
    const list = lists[kind];
    const text = plain(`${item.category ?? ""} ${item.description ?? ""} ${item.merchant ?? ""}`);
    const viaPix = PIX.test(text);
    const own = find(list, item.category);

    const transfer = kind === "receita" ? transferIn : transferOut;
    const category = own ?? (viaPix && transfer ? transfer : "Outros");
    return { ...item, category };
  });
}
