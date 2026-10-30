/**
 * What the home screen is made of, and in what order.
 *
 * The feed used to be written out by hand in one file, which meant the order was a
 * decision taken once, for everybody. A home screen is personal — the card that
 * matters to one person is noise to the next — so the order, the width and whether a
 * card is there at all live here, as data, and the page just draws what it is told.
 *
 * Three of them cannot be resized: the balance, the spending breakdown and the recent
 * transactions are each a list or a chart, and half a column is not enough to read
 * one. Everything else is a figure and a word, which fits either way.
 */

export type WidgetSize = "half" | "full";

export interface WidgetDef {
  id: string;
  /** What the add screen calls it. */
  label: string;
  description: string;
  /** Whether it can be squeezed into half a row. */
  resizable: boolean;
  defaultSize: WidgetSize;
}

export const WIDGETS: WidgetDef[] = [
  { id: "saldo", label: "Saldo em contas", description: "Onde o dinheiro está agora", resizable: false, defaultSize: "full" },
  { id: "plano", label: "Meu plano financeiro", description: "O mês dentro do seu plano, montado pelo Willo", resizable: false, defaultSize: "full" },
  { id: "fluxo", label: "Receitas e despesas", description: "O que entrou e o que saiu no mês", resizable: true, defaultSize: "full" },
  { id: "eventos", label: "Próximos eventos", description: "O que vence e o que cai nos próximos dias", resizable: true, defaultSize: "full" },
  { id: "cartoes", label: "Cartões de crédito", description: "Faturas e limite de cada cartão", resizable: true, defaultSize: "full" },
  { id: "parcelamentos", label: "Parcelamentos", description: "O que ainda falta pagar em parcelas", resizable: true, defaultSize: "half" },
  { id: "assinaturas", label: "Assinaturas", description: "O que se repete todo mês", resizable: true, defaultSize: "half" },
  { id: "metas", label: "Metas", description: "Quanto já foi guardado", resizable: true, defaultSize: "half" },
  { id: "fixos", label: "Gastos e receitas fixas", description: "O que é certo todo mês", resizable: true, defaultSize: "full" },
  { id: "raiox", label: "Saúde do mês", description: "Quanto dá para gastar por dia até o fim do mês", resizable: true, defaultSize: "full" },
  { id: "categorias", label: "Gastos por categoria", description: "O mês repartido por categoria", resizable: false, defaultSize: "full" },
  { id: "recentes", label: "Transações recentes", description: "As últimas movimentações", resizable: false, defaultSize: "full" },
];

export const widgetById = (id: string) => WIDGETS.find((w) => w.id === id);

export interface WidgetSlot {
  id: string;
  size: WidgetSize;
}

export const defaultLayout = (): WidgetSlot[] =>
  WIDGETS.map((w) => ({ id: w.id, size: w.defaultSize }));

const key = (userId?: string) => `willo.home.widgets.${userId ?? "anon"}`;

/**
 * Reads a saved layout, dropping anything that no longer exists and appending
 * anything new. A widget added in a release should show up for people who already
 * have a layout saved, rather than being invisible to exactly the people using the
 * app the longest.
 */
export function loadLayout(userId?: string): WidgetSlot[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return defaultLayout();
    const saved = JSON.parse(raw) as WidgetSlot[];
    if (!Array.isArray(saved)) return defaultLayout();

    const known = saved.filter((s) => widgetById(s.id));
    const seen = new Set(known.map((s) => s.id));
    const fresh = WIDGETS.filter((w) => !seen.has(w.id) && !isDismissed(userId, w.id))
      .map((w) => ({ id: w.id, size: w.defaultSize }));
    return [...known, ...fresh];
  } catch {
    return defaultLayout();
  }
}

export function saveLayout(userId: string | undefined, slots: WidgetSlot[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(slots));
  } catch {
    /* a home screen that cannot remember its order still works */
  }
}

/* A widget taken off the screen stays off, even after an update adds new ones — the
   removal was a decision, and re-adding it would read as the app ignoring it. */
const dismissedKey = (userId?: string) => `willo.home.widgets.dismissed.${userId ?? "anon"}`;

export function dismissedIds(userId?: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(dismissedKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}

function isDismissed(userId: string | undefined, id: string) {
  return dismissedIds(userId).includes(id);
}

export function setDismissed(userId: string | undefined, id: string, dismissed: boolean) {
  try {
    const current = new Set(dismissedIds(userId));
    if (dismissed) current.add(id);
    else current.delete(id);
    localStorage.setItem(dismissedKey(userId), JSON.stringify([...current]));
  } catch {
    /* ignored */
  }
}
