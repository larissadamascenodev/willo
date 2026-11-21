import { type ReactNode } from "react";
import type { WidgetSize } from "@/lib/homeWidgets";
import type { CategoryExpense, FinanceEvent, Transaction } from "@/types/finance";
import type { RecurringItem } from "@/hooks/useRecorrentes";
import type { EndedSubscription } from "~/lib/subscriptionCheck";
import { FEATURES } from "~/lib/features";
import { upcoming } from "~/lib/events";
import HomeBalanceCard from "~/components/home/HomeBalanceCard";
import GastosCard from "~/components/home/GastosCard";
import CategoryStrip from "~/components/home/CategoryStrip";
import JornadaCard from "~/components/home/JornadaCard";
import FluxoWeeksCard from "~/components/home/FluxoWeeksCard";
import PlanoCard from "~/components/home/PlanoCard";
import ProximosEventos from "~/components/home/ProximosEventos";
import CartoesResumoCard from "~/components/home/CartoesResumoCard";
import SaudeDoMesCard from "~/components/home/SaudeDoMesCard";
import GastosFixosCard from "~/components/home/GastosFixosCard";
import TransacoesRecentes from "~/components/home/TransacoesRecentes";
import { AssinaturasTile, MetasTile, ParcelamentosTile } from "~/components/home/Tiles";
import { CategoriasCompact, EventosCompact } from "~/components/home/CompactCards";
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
  assinaturasLoading?: boolean;
  totalAssinaturas: number;
  ended: EndedSubscription[];
  keepEnded: (e: EndedSubscription) => void;
  cancelEnded: (e: EndedSubscription) => void;
  /** Whether there is a caixinha worth a card: money in one, or more than the reserve made at sign-up. Null while unknown. */
  hasGoals?: boolean | null;
  /** Figures masked with dots. */
  hidden?: boolean;
  /** How many charges each category had this month, for the category cards. */
  counts?: Record<string, number>;
}

/**
 * Cards that have nothing to say are not on the board at all, rather than drawn empty.
 * Subscriptions are always on it: with none, the card offers to add one.
 */
export function widgetIsEmpty(id: string, ctx: HomeWidgetContext): boolean {
  if (id === "plano") return !FEATURES.plano;
  /* Only there when there is something in them, so the home is not a stack of empty boxes. */
  if (id === "assinaturas") return ctx.assinaturas.length === 0 && ctx.ended.length === 0;
  if (id === "eventos") return upcoming(ctx.events).length === 0;
  if (id === "metas") return ctx.hasGoals !== true;
  return false;
}

export function renderHomeWidget(
  id: string,
  size: WidgetSize,
  ctx: HomeWidgetContext,
): ReactNode {
  switch (id) {
    case "saldo":
      return <HomeBalanceCard saldoPrevisto={ctx.saldoPrevisto} hidden={ctx.hidden} />;

    case "gastos":
      return <GastosCard size={size} hidden={ctx.hidden} />;

    case "plano":
      return <PlanoCard />;

    case "fluxo":
      return (
        <FluxoWeeksCard
          size={size}
          receitas={ctx.receitas}
          despesas={ctx.despesas}
          transactions={ctx.transactions}
          month={ctx.month}
          isCurrentMonth={ctx.isCurrentMonth}
          hidden={ctx.hidden}
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
          loading={ctx.assinaturasLoading}
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
      return <CategoryStrip categories={ctx.categories} counts={ctx.counts} month={ctx.month} hidden={ctx.hidden} />;

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
