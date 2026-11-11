import { WIDGETS, type WidgetDef } from "@/lib/homeWidgets";

/**
 * The phone's own list of home cards.
 *
 * The shared list is the web's; the phone draws a few differently. Here:
 * - the Radar is a card like the rest, half a row, so it can be moved, taken off and
 *   put back;
 * - Sua jornada holds what Conquistas was (points, medals, the sequence) with the
 *   stage and the mini-metas;
 * - "Saúde do mês" is not offered — the Radar answers the same question;
 * - Receitas e despesas, Gastos por categoria, Próximos eventos and the caixinhas each
 *   have a small version, half a row, as a dial or a single figure.
 */

const PHONE_ONLY: WidgetDef[] = [
  { id: "copilot", label: "Willo Copilot", description: "Compras captadas dos bancos, esperando sua confirmação", resizable: true, defaultSize: "half" },
  { id: "radar", label: "Radar financeiro", description: "As seis áreas do mês num radar", resizable: true, defaultSize: "half" },
  { id: "jornada", label: "Sua jornada", description: "Sua etapa, as mini-metas, os pontos e as medalhas", resizable: true, defaultSize: "full" },
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
