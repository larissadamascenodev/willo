/**
 * What to do with a question put to the sphere.
 *
 * Two pieces. `routeFor` reads the words for a screen the question is about, and
 * whether it was an instruction to go there; and `brief` trims the assistant's reply
 * to something that fits under the sphere — it is told to be short, but a model told
 * to be short is only usually short, and the space is not negotiable.
 */

export interface AssistantRoute {
  href: string;
  /** "Abrir faturas" — the button, and what is said while going. */
  label: string;
  /** Said as an instruction ("abre as faturas"), so go now rather than answer. */
  go: boolean;
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PLACES: { match: RegExp; href: string; label: string }[] = [
  { match: /\b(fatura|faturas|cartao|cartoes|limite)\b/, href: "/cartoes", label: "Abrir faturas" },
  { match: /\b(parcela|parcelas|parcelamento|parcelamentos|parcelado|parcelei)\b/, href: "/parcelamentos", label: "Abrir parcelamentos" },
  { match: /\b(meta|metas|objetivo|objetivos)\b/, href: "/metas", label: "Abrir metas" },
  { match: /\b(evento|eventos|calendario|vencimento|vencimentos|vencem|vence|a pagar|a receber|contas a pagar)\b/, href: "/eventos", label: "Abrir próximos eventos" },
  { match: /\b(fluxo|balanco|projecao|projecoes|previsao)\b/, href: "/fluxo-de-caixa", label: "Abrir fluxo de caixa" },
  { match: /\b(categoria|categorias)\b/, href: "/analytics/categorias", label: "Abrir categorias" },
  { match: /\b(transacao|transacoes|lancamento|lancamentos|extrato|movimentacao|movimentacoes)\b/, href: "/(tabs)/transacoes", label: "Abrir transações" },
];

const GO = /\b(abre|abrir|abra|mostra|mostrar|mostre|me leva|leva|levar|vai para|ir para|va para|quero ver|me mostra)\b/;

export function routeFor(said: string): AssistantRoute | null {
  const q = plain(said);
  const place = PLACES.find((p) => p.match.test(q));
  if (!place) return null;
  return { href: place.href, label: place.label, go: GO.test(q) };
}

/** Plain text, at most a couple of sentences, at most `max` characters. */
export function brief(reply: string, max = 190): string {
  const text = reply
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    /* "R$" stays with its figure when the line breaks. */
    .replace(/R\$ ?(?=\d)/g, "R$\u00A0")
    .trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > max * 0.45) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : max).replace(/[,;:]$/, "")}…`;
}

/** What the assistant is asked, with the shape of the answer asked for. */
export const asking = (question: string) =>
  `${question.trim()}\n\n[Responda em português, falando como numa conversa: no máximo duas frases curtas, até 170 caracteres no total, sem listas, sem markdown e sem repetir a pergunta.]`;
