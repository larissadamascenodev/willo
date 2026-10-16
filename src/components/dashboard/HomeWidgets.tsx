import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { chipFill, chipInk } from "@/lib/chipColor";
import { getCurrency } from "@/lib/currency";
import { StatTile } from "./StatTile";
import SaldoContasCard from "./SaldoContasCard";
import FluxoReceitasDespesasCard from "./FluxoReceitasDespesasCard";
import ProximosEventos from "./ProximosEventos";
import CartoesResumoCard, { CartoesResumoTile } from "./CartoesResumoCard";
import ParcelamentosAtivosCard from "./ParcelamentosAtivosCard";
import AssinaturasTile from "./AssinaturasTile";
import MetasResumoCard from "./MetasResumoCard";
import GastosFixosCard from "./GastosFixosCard";
import GastosPorCategoria from "./GastosPorCategoria";
import TransacoesRecentes from "./TransacoesRecentes";
import type { WidgetSize } from "@/lib/homeWidgets";
import type { FinanceEvent, Transaction, CategoryExpense } from "@/types/finance";

/**
 * Which component is which widget, at the width it has been given.
 *
 * Kept away from the page so the home is a board and a list of ingredients rather
 * than one long file of JSX. A widget that can be squeezed has something to show at
 * half a row — usually one figure and a line of context, which is what a tile is; a
 * widget that cannot is a list or a chart, and those are declared unresizable.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

export interface HomeWidgetContext {
  saldoPrevisto: number;
  receitas: number;
  despesas: number;
  selectedMonth: number;
  selectedYear: number;
  isCurrentMonth: boolean;
  events: FinanceEvent[];
  categories: CategoryExpense[];
  transactions: Transaction[];
  onEventClick: (event: FinanceEvent) => void;
  onRefetch: () => void;
}

/** One of the two screens the home cannot show a piece of. */
export function SectionTile({ label, caption, accent, path }: {
  label: string;
  caption: string;
  accent: string;
  path: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="relative flex min-h-[150px] w-full flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass p-4 text-left transition-transform active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[14px] font-medium t-soft">{label}</p>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
      </div>
      <div>
        <p className="text-[19px] font-bold tracking-[-0.025em] text-white">{label}</p>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug t-softer">{caption}</p>
      </div>
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
        style={{ background: chipInk(accent), opacity: 0.6 }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-[40px]"
        style={{ background: chipFill(accent) }}
      />
    </button>
  );
}

export function renderHomeWidget(id: string, size: WidgetSize, ctx: HomeWidgetContext): ReactNode {
  const half = size === "half";

  switch (id) {
    case "saldo":
      return <SaldoContasCard saldoPrevisto={ctx.saldoPrevisto} />;

    case "fluxo":
      return half ? (
        <FluxoTile receitas={ctx.receitas} despesas={ctx.despesas} />
      ) : (
        <FluxoReceitasDespesasCard
          receitas={ctx.receitas}
          despesas={ctx.despesas}
          month={ctx.selectedMonth}
          isCurrentMonth={ctx.isCurrentMonth}
        />
      );

    case "eventos":
      return half ? (
        <EventosTile events={ctx.events} />
      ) : (
        <ProximosEventos
          events={ctx.events}
          selectedMonth={ctx.selectedMonth}
          selectedYear={ctx.selectedYear}
          onEventClick={ctx.onEventClick}
        />
      );

    case "cartoes":
      return half ? <CartoesResumoTile /> : <CartoesResumoCard />;

    case "parcelamentos":
      return <ParcelamentosAtivosCard compact={half} />;

    case "assinaturas":
      return <AssinaturasTile />;

    case "metas":
      return <MetasResumoCard compact={half} />;

    case "fixos":
      return <GastosFixosCard compact={half} />;

    case "financeiro":
      return (
        <SectionTile
          label="Financeiro"
          caption="Balanço, fluxo e projeções"
          accent="#7DD3FC"
          path="/bot-finance/balanco"
        />
      );

    case "raiox":
      return (
        <SectionTile
          label="Raio-X"
          caption="Para onde o dinheiro vai"
          accent="#C8F36D"
          path="/bot-finance"
        />
      );

    case "categorias":
      return ctx.categories.length > 0 ? (
        <CategoriasWidget categories={ctx.categories} month={ctx.selectedMonth} />
      ) : null;

    case "recentes":
      return <TransacoesRecentes transactions={ctx.transactions} onDelete={ctx.onRefetch} />;

    default:
      return null;
  }
}

/** Kept as a component so it can still navigate; the renderer itself is not one. */
function CategoriasWidget({ categories, month }: { categories: CategoryExpense[]; month: number }) {
  const navigate = useNavigate();
  return (
    <GastosPorCategoria
      categories={categories}
      selectedMonth={month}
      onVerAnalise={() => navigate("/transacoes")}
    />
  );
}

/** The month's two flows, squeezed into one figure: what is left of them. */
function FluxoTile({ receitas, despesas }: { receitas: number; despesas: number }) {
  const navigate = useNavigate();
  const saldo = receitas - despesas;
  return (
    <StatTile
      label="Receitas e despesas"
      value={`${saldo >= 0 ? "+" : "−"}${fmt(Math.abs(saldo))}`}
      caption={`entrou ${fmt(receitas)} · saiu ${fmt(despesas)}`}
      accent="#C8F36D"
      onClick={() => navigate("/fluxo-de-caixa")}
    />
  );
}

/** The next thing due, which is the only part of the list a tile has room for. */
function EventosTile({ events }: { events: FinanceEvent[] }) {
  const navigate = useNavigate();
  const pending = events.filter((e) => e?.status !== "pago");
  const next = pending[0];
  return (
    <StatTile
      label="Próximos eventos"
      value={next ? fmt(Number(next.amount)) : fmt(0)}
      caption={next ? `${next.name} · ${next.date}` : "Nada a vencer por aqui"}
      accent="#F59E0B"
      empty={!next}
      onClick={() => navigate("/transacoes")}
    />
  );
}
