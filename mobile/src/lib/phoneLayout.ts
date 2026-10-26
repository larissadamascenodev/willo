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

export function loadPhoneLayout(userId?: string): WidgetSlot[] {
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
