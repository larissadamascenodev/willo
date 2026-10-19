import { type ReactNode } from "react";
import type { WidgetSize } from "@/lib/homeWidgets";
import type { CategoryExpense, FinanceEvent, Transaction } from "@/types/finance";
import SaldoContasCard from "~/components/home/SaldoContasCard";
import FluxoCard from "~/components/home/FluxoCard";
import ProximosEventos from "~/components/home/ProximosEventos";
import CartoesResumoCard from "~/components/home/CartoesResumoCard";
import SaudeDoMesCard from "~/components/home/SaudeDoMesCard";
import GastosFixosCard from "~/components/home/GastosFixosCard";
import GastosPorCategoria from "~/components/home/GastosPorCategoria";
import TransacoesRecentes from "~/components/home/TransacoesRecentes";
import { AssinaturasTile, MetasTile, ParcelamentosTile } from "~/components/home/Tiles";

/**
 * Which card a widget id draws.
 *
 * The board knows the order and the width; it does not know what any of them are.
 * Keeping the mapping here is what lets the board stay about arrangement and the
 * cards stay about money.
 */

export interface HomeWidgetContext {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  categories: CategoryExpense[];
  events: FinanceEvent[];
  transactions: Transaction[];
  month: number;
  isCurrentMonth: boolean;
}

export function renderHomeWidget(
  id: string,
  size: WidgetSize,
  ctx: HomeWidgetContext,
): ReactNode {
  switch (id) {
    case "saldo":
      return <SaldoContasCard saldoPrevisto={ctx.saldoPrevisto} />;

    case "fluxo":
      return (
        <FluxoCard
          receitas={ctx.receitas}
          despesas={ctx.despesas}
          month={ctx.month}
          isCurrentMonth={ctx.isCurrentMonth}
        />
      );

    case "eventos":
      return <ProximosEventos events={ctx.events} />;

    case "cartoes":
      return <CartoesResumoCard />;

    case "parcelamentos":
      return <ParcelamentosTile />;

    case "assinaturas":
      return <AssinaturasTile />;

    case "metas":
      return <MetasTile />;

    case "fixos":
      return <GastosFixosCard />;

    case "raiox":
      return (
        <SaudeDoMesCard
          receitas={ctx.receitas}
          despesas={ctx.despesas}
          saldoPrevisto={ctx.saldoPrevisto}
          categories={ctx.categories}
          isCurrentMonth={ctx.isCurrentMonth}
        />
      );

    case "categorias":
      return <GastosPorCategoria categories={ctx.categories} month={ctx.month} />;

    case "recentes":
      return <TransacoesRecentes transactions={ctx.transactions} />;

    default:
      return null;
  }
}
