import { type ReactNode } from "react";
import type { WidgetSize } from "@/lib/homeWidgets";
import type { CategoryExpense, FinanceEvent, Transaction } from "@/types/finance";
import type { RecurringItem } from "@/hooks/useRecorrentes";
import type { EndedSubscription } from "~/lib/subscriptionCheck";
import { upcoming } from "~/lib/events";
import { FEATURES } from "~/lib/features";
import SaldoContasCard from "~/components/home/SaldoContasCard";
import JornadaCard from "~/components/home/JornadaCard";
import FluxoCard from "~/components/home/FluxoCard";
import PlanoCard from "~/components/home/PlanoCard";
import ProximosEventos from "~/components/home/ProximosEventos";
import CartoesResumoCard from "~/components/home/CartoesResumoCard";
import SaudeDoMesCard from "~/components/home/SaudeDoMesCard";
import GastosFixosCard from "~/components/home/GastosFixosCard";
import GastosPorCategoria from "~/components/home/GastosPorCategoria";
import TransacoesRecentes from "~/components/home/TransacoesRecentes";
import { AssinaturasTile, MetasTile, ParcelamentosTile } from "~/components/home/Tiles";
import { CategoriasCompact, EventosCompact, FluxoCompact } from "~/components/home/CompactCards";
import { RadarWidget } from "~/components/home/ShortcutPair";
import CopilotCard from "~/components/home/CopilotCard";

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
  assinaturas: RecurringItem[];
  totalAssinaturas: number;
  ended: EndedSubscription[];
  keepEnded: (e: EndedSubscription) => void;
  cancelEnded: (e: EndedSubscription) => void;
}

/**
 * Cards that have nothing to say are not on the board at all, rather than drawn empty:
 * subscriptions when there are none, and the events once the month is settled. They are
 * back as soon as there is something, so nothing is removed from the person's layout.
 */
export function widgetIsEmpty(id: string, ctx: HomeWidgetContext): boolean {
  if (id === "plano") return !FEATURES.plano;
  if (id === "assinaturas") return ctx.assinaturas.length === 0 && ctx.ended.length === 0;
  if (id === "eventos") return upcoming(ctx.events).length === 0;
  return false;
}

export function renderHomeWidget(
  id: string,
  size: WidgetSize,
  ctx: HomeWidgetContext,
): ReactNode {
  switch (id) {
    case "saldo":
      return <SaldoContasCard saldoPrevisto={ctx.saldoPrevisto} />;

    case "plano":
      return <PlanoCard />;

    case "fluxo":
      if (size === "half") return <FluxoCompact receitas={ctx.receitas} despesas={ctx.despesas} />;
      return (
        <FluxoCard
          receitas={ctx.receitas}
          despesas={ctx.despesas}
          month={ctx.month}
          isCurrentMonth={ctx.isCurrentMonth}
        />
      );

    case "eventos":
      if (size === "half") return <EventosCompact events={ctx.events} />;
      return <ProximosEventos events={ctx.events} />;

    case "cartoes":
      return <CartoesResumoCard size={size} />;

    case "parcelamentos":
      return <ParcelamentosTile size={size} />;

    case "assinaturas":
      return (
        <AssinaturasTile
          size={size}
          assinaturas={ctx.assinaturas}
          total={ctx.totalAssinaturas}
          ended={ctx.ended}
          onKeep={ctx.keepEnded}
          onCancel={ctx.cancelEnded}
        />
      );

    case "metas":
      return <MetasTile size={size} />;

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
      if (size === "half") return <CategoriasCompact categories={ctx.categories} />;
      return <GastosPorCategoria categories={ctx.categories} month={ctx.month} />;

    case "copilot":
      return <CopilotCard size={size} />;

    case "radar":
      return <RadarWidget size={size} />;

    case "jornada":
      return <JornadaCard size={size} />;

    case "recentes":
      return <TransacoesRecentes transactions={ctx.transactions} />;

    default:
      return null;
  }
}
