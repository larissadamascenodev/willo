import { loadLayout, saveLayout, type WidgetSlot } from "@/lib/homeWidgets";

/**
 * The home layout as the phone opens it.
 *
 * The list of widgets and their default widths is shared with the browser. On the
 * phone, three of them — instalments, subscriptions and goals — were redrawn as
 * full cards with something to read in them, where half a row only ever held a
 * figure and a word. So they open full width here, once: a layout someone has
 * already arranged is moved over a single time, and after that a card they shrink
 * stays shrunk.
 */

const WIDE_ON_PHONE = new Set(["parcelamentos", "assinaturas", "metas"]);

const moved = (userId?: string) => `willo.home.widgets.phone-wide-v1.${userId ?? "anon"}`;

const placed = (userId?: string) => `willo.home.widgets.phone-categories-v1.${userId ?? "anon"}`;

/**
 * Gastos por categoria reads with Receitas e despesas, so it sits right under it, full
 * width — moved there once; after that it stays wherever it is put.
 */
function categoriesUnderFlows(userId: string | undefined, slots: WidgetSlot[]): WidgetSlot[] {
  try {
    if (localStorage.getItem(placed(userId))) return slots;
    localStorage.setItem(placed(userId), "1");
    const at = slots.findIndex((s) => s.id === "fluxo");
    if (at < 0) return slots;
    const rest = slots.filter((s) => s.id !== "categorias");
    const where = rest.findIndex((s) => s.id === "fluxo") + 1;
    const next = [...rest.slice(0, where), { id: "categorias", size: "full" as const }, ...rest.slice(where)];
    saveLayout(userId, next);
    return next;
  } catch {
    return slots;
  }
}

export function loadPhoneLayout(userId?: string): WidgetSlot[] {
  return categoriesUnderFlows(userId, widened(userId));
}

function widened(userId?: string): WidgetSlot[] {
  const slots = loadLayout(userId);
  try {
    if (localStorage.getItem(moved(userId))) return slots;
    const next = slots.map((s) => (WIDE_ON_PHONE.has(s.id) ? { ...s, size: "full" as const } : s));
    saveLayout(userId, next);
    localStorage.setItem(moved(userId), "1");
    return next;
  } catch {
    return slots;
  }
}
