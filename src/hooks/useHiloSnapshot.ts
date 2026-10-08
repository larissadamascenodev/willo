import { useCallback, useEffect, useState } from "react";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { getAccounts } from "@/services/transactionService";

/**
 * What Hilo is told about the person's money before it is asked anything.
 *
 * The derived figures live here rather than in the edge function on purpose: the
 * projection, the month's totals and the invoice maths are the app's own rules, already
 * written once. Sending the result keeps a single definition of "sobra prevista" instead
 * of a second one on the server that would drift from the screens.
 */

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export type HiloSnapshot = Record<string, unknown>;

export function useHiloSnapshot() {
  const { data, projections, loading: projLoading } = useFinancialProjection();
  const { cards, invoices, loading: cardsLoading } = useCardsOverview();
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    getAccounts()
      .then((rows) => { if (alive) setAccounts(rows as any[]); })
      .catch(() => { if (alive) setAccounts([]); });
    return () => { alive = false; };
  }, []);

  const build = useCallback((): HiloSnapshot => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    // The invoice that matters for "what do I owe now" is the EARLIEST unpaid one, so the
    // list is ordered before it is read: taking whichever came first in the array handed
    // back an invoice months away and called it the open one.
    const openByCard = new Map<string, { total: number; month: number; year: number }>();
    for (const inv of invoices) {
      if (inv.isPaid) continue;
      const isFuture = inv.year > year || (inv.year === year && inv.month - 1 >= month);
      if (!isFuture) continue;
      const prev = openByCard.get(inv.cardId);
      const earlier =
        !prev || inv.year < prev.year || (inv.year === prev.year && inv.month < prev.month);
      if (earlier) openByCard.set(inv.cardId, { total: inv.total, month: inv.month, year: inv.year });
    }

    return {
      hoje: now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),

      contas: {
        saldo_atual: data.saldoAtual,
        saldo_previsto_fim_mes: data.saldoPrevisto,
        lista: accounts.map((a) => ({ nome: a.name, saldo: Number(a.current_balance ?? a.initial_balance ?? 0) })),
      },

      mes: {
        referencia: `${MONTHS[month]} de ${year}`,
        receitas: data.receitas,
        receitas_recebidas: data.receitasRecebidas,
        despesas: data.despesas,
        despesas_pagas: data.despesasPagas,
        balanco: data.balanco,
        media_diaria: data.mediaGastosDiarios,
      },

      // Only the month-by-month projection goes up. DashboardData.projection carries
      // three-month averages that come back as 0 on this screen's fetch, and a zero
      // presented as a fact is exactly the thing Hilo must never do.
      previsao: {
        proximos_meses: projections.slice(0, 6).map((p) => ({
          mes: `${MONTHS[p.month]} de ${p.year}`,
          receita: p.income,
          despesa: p.expense,
          sobra: p.delta,
        })),
      },

      cartoes: cards.map((c) => ({
        nome: c.name,
        limite: c.limit,
        usado: c.used,
        disponivel: Math.max(c.limit - c.used, 0),
        fatura_aberta: openByCard.get(c.id)?.total ?? 0,
        vencimento: c.dueDay,
        fechamento: c.closingDay,
        vence_em: invoiceDueDate(c, year, month + 1).toLocaleDateString("pt-BR"),
      })),

      proximos_eventos: (data.events ?? [])
        .filter((e) => e.status === "pendente" || e.status === "atrasado")
        .slice(0, 10)
        .map((e) => ({ data: e.date, nome: e.name, valor: e.amount, tipo: e.type ?? "despesa" })),
    };
  }, [data, projections, cards, invoices, accounts]);

  return { build, loading: projLoading || cardsLoading };
}
