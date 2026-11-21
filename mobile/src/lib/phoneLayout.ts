import { loadLayout, saveLayout, setDismissed, type WidgetSlot } from "@/lib/homeWidgets";
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

/**
 * The board a new account opens on, in the order Larissa set (2026-11-19). Above the board,
 * fixed, are the balance, what can be spent today, Receitas e despesas and Gastos por
 * categoria (their slots below are kept so the order stays readable, and the page skips
 * them). On the board: the cards, then the instalments beside the journey. The caixinhas sit
 * between those two and show only once there is one: then they take the place beside the
 * instalments and the journey, alone on its row, is drawn large (see WidgetBoard's lonely
 * cards). The next events and the subscriptions come after, only when they have something.
 * The Radar, the Copilot card, the fixed entries and the recent transactions wait in
 * "Adicionar widgets". After this the board is the person's to rearrange.
 */
const STARTING: WidgetSlot[] = [
  { id: "saldo", size: "full" },
  { id: "fluxo", size: "full" },
  { id: "categorias", size: "full" },
  { id: "cartoes", size: "full" },
  { id: "parcelamentos", size: "half" },
  { id: "metas", size: "half" },
  { id: "jornada", size: "half" },
  { id: "eventos", size: "full" },
  { id: "assinaturas", size: "full" },
  /* Hidden while the plan is switched off; it takes its place when it comes back. */
  { id: "plano", size: "full" },
];
const WAITING = ["radar", "copilot", "fixos", "recentes", "raiox"];

const ORDERED = (userId?: string) => `willo.home.widgets.phone-default-v2.${userId ?? "anon"}`;

/**
 * A board never arranged before starts from STARTING, and the old one-time moves are marked
 * done. A board arranged before this order was set is put on it once, too.
 */
function firstBoard(userId: string | undefined) {
  try {
    const fresh = !localStorage.getItem(`willo.home.widgets.${userId ?? "anon"}`);
    if (!fresh && localStorage.getItem(ORDERED(userId))) return;
    saveLayout(userId, STARTING);
    for (const id of WAITING) setDismissed(userId, id, true);
    for (const id of STARTING.map((x) => x.id)) setDismissed(userId, id, false);
    for (const k of [moved(userId), placed(userId), paired(userId), journeyed(userId), ORDERED(userId)]) localStorage.setItem(k, "1");
  } catch {
    /* Without storage the shared default is used. */
  }
}

/**
 * The home made lean (Larissa, 2026-11-20): the balance, Fluxo de caixa, Gastos do mês, the
 * month by category, the cards and the instalments — all cards of the board. What used to
 * be a card of its own — the bills to pay, the caixinhas, the journey — is now a
 * shortcut at the top; it and everything else waits switched off in "Ativar widgets". Every
 * board is put on this once; after that it is the person's again.
 */
const LEAN: WidgetSlot[] = [
  /* Every one a card of the board: each can be held, moved, made compact or large, or switched
     off. Larissa's starting board (2026-11-22): the balance; Fluxo do mês and the cards side by
     side, compact; Gastos do mês; the categories; the instalments. */
  { id: "saldo", size: "full" },
  { id: "fluxo", size: "half" },
  { id: "cartoes", size: "half" },
  { id: "gastos", size: "full" },
  { id: "categorias", size: "full" },
  { id: "parcelamentos", size: "full" },
];
const LEAN_OFF = ["eventos", "metas", "jornada", "assinaturas", "radar", "copilot", "fixos", "recentes", "plano", "raiox"];
const LEANED = (userId?: string) => `willo.home.widgets.phone-lean-v5.${userId ?? "anon"}`;

function leanBoard(userId: string | undefined) {
  try {
    if (localStorage.getItem(LEANED(userId))) return;
    saveLayout(userId, LEAN);
    for (const id of LEAN_OFF) setDismissed(userId, id, true);
    for (const id of LEAN.map((x) => x.id)) setDismissed(userId, id, false);
    localStorage.setItem(LEANED(userId), "1");
  } catch {
    /* Without storage the board is read as it is. */
  }
}

export function loadPhoneLayout(userId?: string): WidgetSlot[] {
  firstBoard(userId);
  leanBoard(userId);
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
