import { categoryNames } from "~/lib/taxonomy";

/**
 * The category a receipt goes under, taken only from the app's own list — the one the
 * category picker shows.
 *
 * The reader answers with an older, shorter list ("Alimentação", "Delivery", "Pix no
 * crédito"…) and filed a Pix received as "Pix no crédito", an expense on a card. Here
 * every item is put back on the list for its kind:
 *
 * - money in by Pix or transfer: "Transferências recebidas";
 * - money out by Pix: "Transferência para terceiros - PIX" (a transfer otherwise) —
 *   never "Pix no crédito", which only a card statement, or the person, chooses;
 * - the reader's older names, to their place on the list;
 * - anything else not on the list for its kind: "Outros" ("Outras receitas" for money in).
 */

interface Read {
  type?: string;
  category?: string | null;
  description?: string;
  merchant?: string | null;
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const PIX = /\bpix\b/;
const TRANSFER = /\bpix\b|transfer|\bted\b|\bdoc\b/;

/** The reader's names, and where each sits on the app's list. */
const OLD_NAMES: Record<string, string> = {
  alimentacao: "Restaurantes, bares e lanchonetes",
  delivery: "Delivery de alimentos",
  "fast food": "Restaurantes, bares e lanchonetes",
  cafeteria: "Restaurantes, bares e lanchonetes",
  bebidas: "Alimentos e bebidas",
  "conta de luz": "Eletricidade",
  "conta de agua": "Água",
  "conta de gas": "Gás",
  "telefone e internet": "Telecomunicação",
  "conta de telefone": "Celular",
  assinaturas: "Assinaturas e streaming",
  tecnologia: "Eletrônicos",
  beleza: "Bem-estar",
  pets: "Pet Shops e veterinários",
  presentes: "Compras",
  viagem: "Viagens",
  academia: "Academia e centros de lazer",
  "tarifas e juros": "Tarifas bancárias",
};

export function fitReceiptCategories<T extends Read>(items: T[]): T[] {
  const lists = { receita: categoryNames("receita"), despesa: categoryNames("despesa") };
  const find = (list: string[], name?: string | null) => {
    if (!name) return undefined;
    const n = plain(name);
    return list.find((c) => plain(c) === n) ?? (OLD_NAMES[n] && list.includes(OLD_NAMES[n]) ? OLD_NAMES[n] : undefined);
  };

  return items.map((item) => {
    const income = item.type === "receita";
    const list = income ? lists.receita : lists.despesa;
    const words = plain(`${item.category ?? ""} ${item.description ?? ""} ${item.merchant ?? ""}`);
    const own = plain(item.category ?? "") === "pix no credito" ? undefined : find(list, item.category);

    let category: string;
    if (income) category = own && own !== "Outras receitas" ? own : TRANSFER.test(words) ? "Transferências recebidas" : (own ?? "Outras receitas");
    else if (own) category = own;
    else if (PIX.test(words)) category = "Transferência para terceiros - PIX";
    else if (TRANSFER.test(words)) category = "Transferências para terceiros";
    else category = "Outros";
    return { ...item, category };
  });
}
