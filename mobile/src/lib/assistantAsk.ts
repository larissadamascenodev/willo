import { supabase } from "~/supabase/client";
import { getWilloPrefs } from "~/lib/willoPrefs";
import type { Simulation } from "~/components/willo/AnswerCards";

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
  { match: /\b(meta|metas|objetivo|objetivos|caixinha|caixinhas|cofrinho|cofrinhos)\b/, href: "/gestao", label: "Abrir caixinhas" },
  { match: /\b(evento|eventos|calendario|vencimento|vencimentos|vencem|vence|a pagar|a receber|contas a pagar)\b/, href: "/eventos", label: "Abrir próximos eventos" },
  { match: /\b(fluxo|balanco|projecao|projecoes|previsao)\b/, href: "/fluxo-de-caixa", label: "Abrir receitas e despesas" },
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

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

const GIVE_UP_MS = 50_000;

/**
 * Puts the conversation to the Willo assistant — the same function the web's assistant
 * page calls, with the same snapshot of the person's money, so what it says is built on
 * the app's own numbers — and returns what it answered.
 */
export async function askWillo(messages: Turn[], snapshot: unknown): Promise<string> {
  return (await askWilloFull(messages, snapshot)).reply;
}

/** The reply and which of Willo's specialists worked on it. */
export async function askWilloFull(messages: Turn[], snapshot: unknown, nome?: string | null): Promise<{ reply: string; agents: string[]; simulation: Simulation | null }> {
  const { style, length, agents } = getWilloPrefs();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("O Willo demorou a responder. Tente de novo.")), GIVE_UP_MS),
  );
  const { data, error } = await Promise.race([
    supabase.functions.invoke("willo-assistant", { body: { messages, snapshot, prefs: { style, length, agents, nome: nome ?? undefined } } }),
    timeout,
  ]);
  if (error) {
    let said: string | null = null;
    try {
      said = (await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.())?.error ?? null;
    } catch {
      said = null;
    }
    throw new Error(said || "Não consegui falar com o Willo agora.");
  }
  if (data?.error) throw new Error(data.error);
  return {
    reply: String(data?.reply ?? ""),
    agents: Array.isArray(data?.especialistas) ? data.especialistas : [],
    simulation: (data?.simulacao as Simulation | undefined) ?? null,
  };
}

/** In a chat the answer can run longer than under the sphere, but still plain. */
export const converseAsking = (question: string) => `${question.trim()}

[Responda em português, só a esta mensagem.]`;

/**
 * A reply as the thread shows it: bold and short lists kept, headings and tables gone,
 * and a ceiling on length that only a runaway answer reaches.
 */
export function tidyReply(reply: string, max = 1800): string {
  let text = reply
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/\|/g, " ")
    .replace(/R\$ ?(?=\d)/g, "R$\u00A0")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length > max) {
    const cut = text.slice(0, max);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
    text = `${cut.slice(0, stop > max * 0.6 ? stop + 1 : max).trim()}…`;
  }
  return text;
}
