import { WIDGETS, type WidgetDef } from "@/lib/homeWidgets";

/**
 * The phone's own list of home cards.
 *
 * The shared list is the web's; the phone draws a few differently. Here:
 * - the Radar and Conquistas are cards like the rest, each half a row, so they can be
 *   moved, taken off and put back;
 * - "Saúde do mês" is not offered — the Radar answers the same question;
 * - Receitas e despesas, Gastos por categoria, Próximos eventos and the caixinhas each
 *   have a small version, half a row, as a dial or a single figure.
 */

const PHONE_ONLY: WidgetDef[] = [
  { id: "radar", label: "Radar financeiro", description: "As seis áreas do mês num radar", resizable: false, defaultSize: "half" },
  { id: "conquistas", label: "Conquistas", description: "Sua sequência de dias e as medalhas", resizable: false, defaultSize: "half" },
];

const DROPPED = new Set(["raiox"]);

/** Cards with a small version on the phone, though the web keeps them whole. */
const SHRINKS = new Set(["fluxo", "categorias", "eventos", "metas"]);

const LABEL: Record<string, string> = { metas: "Caixinhas" };
const DESCRIPTION: Record<string, string> = { metas: "Quanto está guardado em cada caixinha" };

export const PHONE_WIDGETS: WidgetDef[] = [
  ...WIDGETS.filter((w) => !DROPPED.has(w.id)).map((w) => ({
    ...w,
    label: LABEL[w.id] ?? w.label,
    description: DESCRIPTION[w.id] ?? w.description,
    resizable: w.resizable || SHRINKS.has(w.id),
  })),
  ...PHONE_ONLY,
];

export const phoneWidgetById = (id: string) => PHONE_WIDGETS.find((w) => w.id === id);
