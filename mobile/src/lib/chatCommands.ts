import { supabase } from "@/integrations/supabase/client";
import { money } from "~/lib/money";
import { paymentMention } from "~/lib/paymentMention";
import { scheduleReminder } from "~/lib/reminders";
import { voiced } from "~/lib/voiceTone";

/**
 * Things said to Willo that are orders rather than questions: "cria um limite de R$ 300 para
 * farmácia", "me lembra da luz dia 10". Read on the phone, with no AI, and done straight
 * away, because being asked to do it is the confirmation. What cannot be understood whole
 * is asked about, never guessed.
 */

export type Command =
  | { kind: "limit"; amount: number | null; category: string | null; heard: string | null }
  | { kind: "limit-watch"; category: string | null; heard: string | null }
  | { kind: "reminder"; name: string; amount: number | null; date: string | null };

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const toNumber = (s: string) => Number(s.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));

function amountIn(q: string): number | null {
  const m = q.match(/\d[\d.]*(?:,\d{1,2})?/);
  const v = m ? toNumber(m[0]) : NaN;
  return v > 0 ? v : null;
}

/** Which of the person's categories the words name; the longest match, so "conta de luz" beats "conta". */
function categoryIn(q: string, categories: string[]): string | null {
  return (
    categories
      .filter((c) => q.includes(plain(c)))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

/** The word after "para", "em" or "de", to say back when it is not one of the categories. */
const wordAfter = (q: string) => q.match(/.*\b(?:para|pra|em|no|na|de)\s+([a-z ]+?)\s*$/)?.[1]?.trim() ?? null;

export function parseCommand(said: string, categories: string[]): Command | null {
  const q = plain(said).replace(/[?!.]+$/, "").trim();

  if (/\blimite\b/.test(q)) {
    if (/\b(cria|criar|crie|coloca|coloque|colocar|define|defina|definir|bota|poe|ajusta|ajuste|muda|mude|mudar|quero)\b/.test(q)) {
      return { kind: "limit", amount: amountIn(q), category: categoryIn(q, categories), heard: wordAfter(q.replace(/r\$\s*/g, "").replace(/\d[\d.,]*(\s*reais)?/g, "").trim()) };
    }
    if (/\b(me avisa|me avise|avisa|avise)\b/.test(q)) return { kind: "limit-watch", category: categoryIn(q, categories), heard: wordAfter(q) };
    return null;
  }

  if (/\b(me lembra|me lembre|lembrete|lembra de|lembra da|lembra do)\b/.test(q)) {
    const date = paymentMention(said, [], []).date ?? null;
    /* Without the day, what is left is the name and perhaps the value. */
    const rest = q
      .replace(/\b(dia\s+)?\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
      .replace(/\b(todo\s+)?dia\s+\d{1,2}(\s+de\s+[a-z]+)?\b/g, " ")
      .replace(/\b(amanha|hoje|mensal|todo mes|recorrente)\b/g, " ");
    const amount = amountIn(rest);
    const name = rest
      .replace(/r\$\s*/g, "")
      .replace(/\d[\d.,]*(\s*reais)?/g, " ")
      .replace(/\b(me lembra|me lembre|me lembrar|cria|criar|crie|coloca|coloque|um|lembrete|lembra)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^((de|da|do|para|pra|que|pagar|a|o|conta)\s+)+/, "")
      .replace(/(\s+(de|da|do|no|na|em|para|pra|valor))+$/, "")
      .trim();
    if (!name) return { kind: "reminder", name: "", amount, date };
    return { kind: "reminder", name: name[0].toUpperCase() + name.slice(1), amount, date };
  }
  return null;
}

/** Does what was asked, and returns what he says about it. */
export async function runCommand(command: Command, userId: string): Promise<string> {
  if (command.kind === "limit-watch") {
    if (!command.category) return "De qual categoria? Me diz, por exemplo: “me avisa se passar do limite de lazer”.";
    const { data } = await supabase.from("category_limits").select("limit_amount").eq("user_id", userId).eq("category", command.category).maybeSingle();
    if (!data) return `Você ainda não tem limite em ${command.category}. Me diz o valor: “cria um limite de R$ 300 em ${command.category}”.`;
    return voiced(`Combinado. Te aviso em 80% e em 100% de ${money(Number((data as { limit_amount: number }).limit_amount))} em ${command.category}.`, "good");
  }

  if (command.kind === "limit") {
    if (!command.category) return `Não achei a categoria${command.heard ? ` “${command.heard}”` : ""}. Fala igual ela aparece no app, por exemplo “Farmácia”.`;
    if (!command.amount) return `Qual o valor do limite de ${command.category}?`;
    const { data: row, error: readError } = await supabase.from("category_limits").select("id").eq("user_id", userId).eq("category", command.category).maybeSingle();
    if (readError) throw readError;
    const { error } = row
      ? await supabase.from("category_limits").update({ limit_amount: command.amount }).eq("id", (row as { id: string }).id)
      : await supabase.from("category_limits").insert({ user_id: userId, category: command.category, limit_amount: command.amount } as never);
    if (error) throw error;
    window.dispatchEvent(new CustomEvent("finance-data-changed"));
    return voiced(`Pronto: limite de ${money(command.amount)} em ${command.category}. Te aviso em 80% e em 100%.`, "good");
  }

  if (!command.name) return "Lembrete de quê? Me diz assim: “me lembra da luz dia 10”.";
  if (!command.date) return `Para que dia é o lembrete de ${command.name}? Pode dizer “dia 10”.`;
  const { error } = await supabase.from("finance_events").insert({ user_id: userId, name: command.name, amount: command.amount ?? 0, category: "Contas", date: command.date, status: "pendente" } as never);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("finance-data-changed"));
  const notified = await scheduleReminder(command.name, command.amount, command.date);
  const day = new Date(`${command.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return voiced(
    notified
      ? `Combinado: te lembro de ${command.name} um dia antes e no dia, ${day}, às 9h.`
      : `Anotei ${command.name} para ${day} nos seus eventos. A notificação não foi agendada: libere as notificações do Willo nos Ajustes.`,
    "good",
  );
}
