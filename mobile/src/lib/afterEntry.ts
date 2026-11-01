import { supabase } from "@/integrations/supabase/client";
import { money } from "~/lib/money";
import { voiced, type Mood } from "~/lib/voiceTone";

/**
 * What Willo says after writing an entry down, from the person's own numbers, with no AI
 * in between: how the entry repeats, then how this month's spending in its category
 * compares with what the last three months usually came to. Over the usual, a warning;
 * near it, a heads-up; under it, a word of calm. There are no category limits to compare
 * with yet, so the person's own average stands in for one.
 */

export interface EntryToComment {
  name: string;
  category: string;
  amount: number;
  type: "despesa" | "receita";
  /** yyyy-mm-dd */
  day: string;
  repeat: "unica" | "parcelado" | "fixa";
  installments?: number | null;
  scheduled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayMonth = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

function howItRepeats(e: EntryToComment) {
  if (e.repeat === "fixa") return `Ficou recorrente: ${money(e.amount)} todo mês a partir de ${dayMonth(e.day)}, até você cancelar. No ano, dá ${money(e.amount * 12)}.`;
  if (e.repeat === "parcelado" && e.installments) return `São ${e.installments}x de ${money(e.amount / e.installments)}: esse valor sai por ${e.installments} meses.`;
  if (e.scheduled) return `Deixei agendado para ${dayMonth(e.day)}.`;
  return null;
}

function aboutTheCategory(category: string, total: number, count: number, usual: number | null): { text: string; mood: Mood } {
  if (usual) {
    const over = Math.round((total / usual - 1) * 100);
    if (over > 0) return { mood: "bad", text: `${category} já está em ${money(total)} este mês, ${over}% acima da sua média.` };
    if (total >= usual * 0.8) return { mood: "plain", text: `${category} está em ${money(total)}, perto da sua média de ${money(usual)}.` };
    return { mood: "good", text: `${category} está em ${money(total)}, abaixo da sua média de ${money(usual)}.` };
  }
  if (count >= 3) return { mood: "plain", text: `É o ${count}º lançamento em ${category} este mês, ${money(total)} no total.` };
  if (count === 2) return { mood: "plain", text: `É o segundo em ${category} este mês: ${money(total)} no total.` };
  return { mood: "plain", text: `É o primeiro em ${category} este mês.` };
}

export async function commentAfter(entry: EntryToComment): Promise<string> {
  const repeats = howItRepeats(entry);
  const opening = entry.type === "receita" ? "Recebido, anotado." : "Anotado.";
  try {
    const [y, m] = entry.day.split("-").map(Number);
    const from = new Date(y, m - 4, 1);
    const last = new Date(y, m, 0);
    const { data, error } = await supabase
      .from("transactions")
      .select("amount,date")
      .eq("category", entry.category)
      .eq("type", entry.type)
      .gte("date", `${from.getFullYear()}-${pad(from.getMonth() + 1)}-01`)
      .lte("date", `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`);
    if (error) throw error;

    const key = `${y}-${pad(m)}`;
    const byMonth = new Map<string, { total: number; count: number }>();
    for (const row of (data ?? []) as { amount: number; date: string }[]) {
      const month = row.date.slice(0, 7);
      const seen = byMonth.get(month) ?? { total: 0, count: 0 };
      byMonth.set(month, { total: seen.total + Number(row.amount), count: seen.count + 1 });
    }
    const now = byMonth.get(key) ?? { total: entry.amount, count: 1 };
    const before = [...byMonth.entries()].filter(([month]) => month < key).map(([, v]) => v.total);
    const usual = before.length ? before.reduce((a, b) => a + b, 0) / before.length : null;

    if (entry.type === "receita") return [opening, repeats, `${entry.category} soma ${money(now.total)} este mês.`].filter(Boolean).join(" ");
    const about = aboutTheCategory(entry.category, now.total, now.count, usual);
    return voiced([opening, repeats, about.text].filter(Boolean).join(" "), about.mood);
  } catch {
    return [opening, repeats].filter(Boolean).join(" ");
  }
}
