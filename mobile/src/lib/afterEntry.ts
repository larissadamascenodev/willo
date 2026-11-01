import { supabase } from "@/integrations/supabase/client";
import { money } from "~/lib/money";
import { voiced, type Mood } from "~/lib/voiceTone";
import { getWilloPrefs } from "~/lib/willoPrefs";

/**
 * What Willo says after writing an entry down, from the person's own numbers, with no AI
 * in between: how the entry repeats, how the category stands against its limit or, with
 * none set, against what the last three months usually came to. Where it is heading for
 * trouble he says so before it happens. In the relaxed voice he also has a joke about
 * what keeps being bought, never at the person's expense.
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

/** For what keeps coming up: the third time in a month is when it becomes funny. */
const JOKES: { match: RegExp; lines: string[] }[] = [
  { match: /delivery|ifood|rappi|lanche|pizza|hamb|sushi/i, lines: ["O motoboy já é quase da família 😄", "Tem fogão aí ou virou enfeite? 😄", "Mais um e o entregador te chama pelo nome 🛵"] },
  { match: /aliment|restaurante|almo|jantar|comida/i, lines: ["Comer bem cobra o preço dele 😄", "Seu paladar anda com vida boa 🍽️"] },
  { match: /caf[eé]|padaria/i, lines: ["O barista já sabe seu pedido de cor ☕", "Esse café tá saindo mais forte no bolso ☕"] },
  { match: /mercado|supermerc/i, lines: ["Pelo menos foi tudo pra dentro de casa 🛒"] },
  { match: /transporte|uber|99|combust|gasolina/i, lines: ["Desse jeito o motorista já vira sócio 🚗", "Tá rodando mais que o Waze 🚗"] },
  { match: /lazer|cinema|bar\b|festa|entreteni/i, lines: ["Pelo menos tá rendendo história 🎉", "A vida social agradece, o bolso nem tanto 🎉"] },
  { match: /roupa|vestu|compras|shopping/i, lines: ["O guarda-roupa tá feliz, hein 🛍️"] },
  { match: /assinatu|streaming/i, lines: ["Você ainda usa todas elas? 📺"] },
];

function jokeFor(entry: EntryToComment): string | null {
  if (getWilloPrefs().style !== "descontraido") return null;
  const found = JOKES.find((j) => j.match.test(entry.category) || j.match.test(entry.name));
  return found ? found.lines[Math.floor(Math.random() * found.lines.length)] : null;
}

function howItRepeats(e: EntryToComment) {
  if (e.repeat === "fixa") return `Ficou recorrente: ${money(e.amount)} todo mês a partir de ${dayMonth(e.day)}, até você cancelar.`;
  if (e.repeat === "parcelado" && e.installments) return `São ${e.installments}x de ${money(e.amount / e.installments)}.`;
  if (e.scheduled) return `Deixei agendado para ${dayMonth(e.day)}.`;
  return null;
}

function aboutTheCategory(category: string, total: number, count: number, usual: number | null, limit: number | null): { text: string; mood: Mood } {
  if (limit) {
    const used = Math.round((total / limit) * 100);
    if (used >= 100) return { mood: "bad", text: `Passou do limite de ${category}: ${money(total)} de ${money(limit)}.` };
    if (used >= 80) return { mood: "bad", text: `${category} já está em ${used}% do limite. Faltam só ${money(limit - total)} até o fim do mês.` };
    return { mood: "good", text: `${category} está em ${used}% do limite.` };
  }
  if (usual) {
    const over = Math.round((total / usual - 1) * 100);
    if (over > 0) return { mood: "bad", text: `${category} já está em ${money(total)} este mês, ${over}% acima do seu normal.` };
    if (total >= usual * 0.8) return { mood: "plain", text: `${category} está em ${money(total)}, quase no seu normal de ${money(usual)}.` };
    return { mood: "good", text: `${category} está em ${money(total)}, abaixo do seu normal.` };
  }
  if (count >= 3) return { mood: "plain", text: `É a ${count}ª vez em ${category} este mês, ${money(total)} no total.` };
  return { mood: "plain", text: "" };
}

/** `monthEnds` is where the month is heading, when known: he warns before it goes negative. */
export async function commentAfter(entry: EntryToComment, monthEnds?: number | null): Promise<string> {
  const repeats = howItRepeats(entry);
  const opening = entry.type === "receita" ? "Recebido, anotado." : "Anotado.";
  try {
    const [y, m] = entry.day.split("-").map(Number);
    const from = new Date(y, m - 4, 1);
    const last = new Date(y, m, 0);
    const [{ data, error }, { data: limitRow }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount,date")
        .eq("category", entry.category)
        .eq("type", entry.type)
        .gte("date", `${from.getFullYear()}-${pad(from.getMonth() + 1)}-01`)
        .lte("date", `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`),
      supabase.from("category_limits").select("limit_amount").eq("category", entry.category).maybeSingle(),
    ]);
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

    if (entry.type === "receita") return voiced([opening, repeats, `${entry.category} soma ${money(now.total)} este mês.`].filter(Boolean).join(" "), "good");

    const limit = limitRow ? Number((limitRow as { limit_amount: number }).limit_amount) : null;
    const about = aboutTheCategory(entry.category, now.total, now.count, usual, limit);
    const joke = now.count >= 3 ? jokeFor(entry) : null;
    const warning = monthEnds != null && monthEnds < 0 ? `Atenção: nesse ritmo, o mês fecha em ${money(monthEnds)}.` : null;
    return voiced([opening, repeats, about.text, joke].filter(Boolean).join(" "), warning ? "bad" : about.mood) + (warning ? `\n\n${warning}` : "");
  } catch {
    return [opening, repeats].filter(Boolean).join(" ");
  }
}
