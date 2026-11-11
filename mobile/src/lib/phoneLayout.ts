import { loadLayout, saveLayout, type WidgetSlot } from "@/lib/homeWidgets";
import { PHONE_WIDGETS } from "~/lib/phoneWidgets";

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

const paired = (userId?: string) => `willo.home.widgets.phone-radar-pair-v1.${userId ?? "anon"}`;

/**
 * The Radar and Conquistas used to be a fixed row under the flows; they are cards now.
 * Once, they are seated where that row was — side by side under Gastos por categoria
 * (or under Receitas e despesas) — and after that they move like any other.
 */
function radarPairInPlace(userId: string | undefined, slots: WidgetSlot[]): WidgetSlot[] {
  try {
    if (localStorage.getItem(paired(userId))) return slots;
    localStorage.setItem(paired(userId), "1");
    const pair = slots.filter((s) => s.id === "radar" || s.id === "conquistas");
    if (pair.length === 0) return slots;
    const rest = slots.filter((s) => s.id !== "radar" && s.id !== "conquistas");
    const anchor = Math.max(rest.findIndex((s) => s.id === "categorias"), rest.findIndex((s) => s.id === "fluxo"));
    const where = anchor < 0 ? 0 : anchor + 1;
    const next = [...rest.slice(0, where), ...pair.map((s) => ({ ...s, size: "half" as const })), ...rest.slice(where)];
    saveLayout(userId, next);
    return next;
  } catch {
    return slots;
  }
}

const journeyed = (userId?: string) => `willo.home.widgets.phone-jornada-v1.${userId ?? "anon"}`;

/**
 * Conquistas became Sua jornada. Once, the journey takes the top of the board, right
 * under Saldo em contas, full width; after that it moves like any other card.
 */
function journeyInPlace(userId: string | undefined, slots: WidgetSlot[]): WidgetSlot[] {
  try {
    if (localStorage.getItem(journeyed(userId))) return slots;
    localStorage.setItem(journeyed(userId), "1");
    const rest = slots.filter((s) => s.id !== "jornada" && s.id !== "conquistas");
    const where = rest.findIndex((s) => s.id === "saldo") + 1;
    const next = [...rest.slice(0, where), { id: "jornada", size: "full" as const }, ...rest.slice(where)];
    saveLayout(userId, next);
    return next;
  } catch {
    return slots;
  }
}

export function loadPhoneLayout(userId?: string): WidgetSlot[] {
  const slots = journeyInPlace(userId, radarPairInPlace(userId, categoriesUnderFlows(userId, widened(userId))));
  /* Never the same card twice. */
  const seen = new Set<string>();
  const once = slots.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
  if (once.length !== slots.length) saveLayout(userId, once);
  return once;
}

function widened(userId?: string): WidgetSlot[] {
  const slots = loadLayout(userId, PHONE_WIDGETS);
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
