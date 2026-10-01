import {
  createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BrainCircuit, CheckCircle2, ChevronRight, CreditCard, FileText, Plus, Search, SlidersHorizontal, Tag, TrendingDown, Wallet, X, Zap,
} from "lucide-react";
import BalanceHeroCard from "@/components/dashboard/BalanceHeroCard";
import MonthFiguresCard from "@/components/dashboard/MonthFiguresCard";
import GastosPorCategoria from "@/components/dashboard/GastosPorCategoria";
import FinanceOverviewCard from "@/components/dashboard/FinanceOverviewCard";
import TransacoesRecentes from "@/components/dashboard/TransacoesRecentes";
import { CardsOverviewView } from "@/components/dashboard/CardsOverviewSection";
import ProximosEventos from "@/components/dashboard/ProximosEventos";
import { MetasResumoView, type GoalRow } from "@/components/dashboard/MetasResumoCard";
import MonthSelector from "@/components/dashboard/MonthSelector";
import AccountsBalanceCard from "@/components/wallet/AccountsBalanceCard";
import ReserveAndPots from "@/components/wallet/ReserveAndPots";
import { CreditCardTile, type CreditCardItem } from "@/components/wallet/CreditCardTile";
import {
  TransactionListItem, TransactionTabs, TransactionsSummaryCard, formatDateHeader, type TransactionRow,
} from "@/components/transactions/TransactionParts";
import type { OverviewCard, OverviewInvoice } from "@/hooks/useCardsOverview";
import type { Goal } from "@/services/goalService";
import { AddActionsMenu, BottomNavBar } from "@/components/dashboard/MobileBottomNav";
import ScanCaptureScreen from "@/components/scan/ScanCaptureScreen";
import { SavedToastCard } from "@/components/scan/scanSavedToast";
import type { ScanResultItem } from "@/components/scan/ScanResultCard";
import { DailyLightCard, ScoreCard } from "@/components/raiox/SummaryTab";
import { Segmented } from "@/components/raiox/primitives";
import { scoreLevel } from "@/services/raioXService";
import type { RaioXData } from "@/hooks/useRaioX";
import type { CategoryExpense, FinanceEvent, Transaction } from "@/types/finance";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";
import DemoReceipt from "./DemoReceipt";

/** Logical size the app is drawn at, then scaled into the phone. */
const SCREEN_W = 390;
const SCREEN_H = 844;
const STATUS_H = 40;
const noop = () => {};

/* ══════════════════════════ Sample data ══════════════════════════ */

const BASE_TX: Transaction[] = [
  { id: "t1", name: "Salário", category: "Salário", date: "05 set", amount: 6200, type: "receita", status: "pago" },
  { id: "t2", name: "Uber", category: "Transporte", date: "16 set", amount: 27.9, type: "despesa", status: "pago" },
  { id: "t3", name: "Netflix", category: "Assinaturas", date: "15 set", amount: 55.9, type: "despesa", status: "pendente" },
  { id: "t4", name: "Conta de Luz", category: "Conta de Luz", date: "12 set", amount: 184.3, type: "despesa", status: "pago" },
  { id: "t5", name: "Academia", category: "Academia", date: "10 set", amount: 119.9, type: "despesa", status: "pago" },
];
const IFOOD_TX: Transaction = { id: "t-ifood", name: "iFood", category: "Delivery", date: "18 set", amount: 45.9, type: "despesa", status: "pago" };
const MARKET_TX: Transaction = { id: "t-market", name: "Supermercado Extra", category: "Supermercado", date: "18 set", amount: 312.4, type: "despesa", status: "pago" };

/** The demo's "today": receipts, lists and invoices are all dated around it. */
const TODAY = new Date(2026, 8, 18);
const noopNavigate = () => {};

const categoriesFor = (withIfood: boolean): CategoryExpense[] => [
  { name: "Supermercado", amount: 1240, color: "", icon: "" },
  { name: "Moradia", amount: 980, color: "", icon: "" },
  { name: "Delivery", amount: withIfood ? 457.9 : 412, color: "", icon: "" },
  { name: "Transporte", amount: 318, color: "", icon: "" },
  { name: "Assinaturas", amount: 265.8, color: "", icon: "" },
];

const CARDS: OverviewCard[] = [
  { id: "c-nu", name: "Nubank", limit: 8000, used: 2140.35, closingDay: 20, dueDay: 27, color: "violet", lastFour: "4821" },
  { id: "c-itau", name: "Itaú Click", limit: 5000, used: 870, closingDay: 3, dueDay: 10, color: "amber", lastFour: "1107" },
];
const INVOICES: OverviewInvoice[] = [
  { id: "i-nu", cardId: "c-nu", month: 9, year: 2026, total: 1284.9, paid: 0, isPaid: false },
  { id: "i-itau", cardId: "c-itau", month: 9, year: 2026, total: 412.3, paid: 412.3, isPaid: true },
];

const EVENTS: FinanceEvent[] = [
  { id: "e1", name: "Aluguel", category: "Moradia", date: "20 set", rawDate: "2026-09-20", amount: 1450, status: "pendente", type: "despesa" },
  { id: "e2", name: "Internet", category: "Internet", date: "22 set", rawDate: "2026-09-22", amount: 99.9, status: "pendente", type: "despesa" },
  { id: "e3", name: "Fatura Nubank", category: "Cartão", date: "27 set", rawDate: "2026-09-27", amount: 1284.9, status: "pendente", type: "despesa" },
];

const GOALS: GoalRow[] = [
  { id: "g1", name: "Viagem pro Chile", target_amount: 12000, current_amount: 4200, cover_image: null, deadline: null },
  { id: "g2", name: "Reserva de emergência", target_amount: 21600, current_amount: 9800, cover_image: null, deadline: null },
  { id: "g3", name: "Notebook novo", target_amount: 6000, current_amount: 2600, cover_image: null, deadline: null },
];

const ACCOUNTS = [
  { id: "a-nu", name: "Nubank", type: "checking", color: "violet", current_balance: 5230.4, is_default: true },
  { id: "a-itau", name: "Itaú", type: "checking", color: "amber", current_balance: 2890.1, is_default: false },
  { id: "a-cash", name: "Carteira", type: "cash", color: "emerald", current_balance: 300, is_default: false },
];

const WALLET_GOALS = [
  { id: "g2", name: "Reserva de emergência", target_amount: 21600, current_amount: 9800, cover_image: null },
  { id: "g1", name: "Viagem pro Chile", target_amount: 12000, current_amount: 4200, cover_image: null },
  { id: "g3", name: "Notebook novo", target_amount: 6000, current_amount: 2600, cover_image: null },
] as unknown as Goal[];

const WALLET_CARDS: CreditCardItem[] = [
  { id: "c-nu", name: "Nubank", limit: 8000, used_limit: 2140.35, closing_day: 20, due_day: 27, color: "violet", last_four_digits: "4821" },
  { id: "c-itau", name: "Itaú Click", limit: 5000, used_limit: 870, closing_day: 3, due_day: 10, color: "amber", last_four_digits: "1107" },
];

const row = (id: string, name: string, category: string, date: string, amount: number, type: "receita" | "despesa", extra: Partial<TransactionRow> = {}): TransactionRow => ({
  id, name, category, date, amount, type, status: "pago", payment_method: "conta", recurrence_type: "unica",
  installment_current: null, installments: null, observation: null, account_id: "a-nu", credit_card_id: null, ...extra,
});

const BASE_ROWS: TransactionRow[] = [
  row("r-uber", "Uber", "Transporte", "2026-09-16", 27.9, "despesa", { time: "08:12" }),
  row("r-netflix", "Netflix", "Assinaturas", "2026-09-15", 55.9, "despesa", { status: "pendente", recurrence_type: "fixa" }),
  row("r-luz", "Conta de Luz", "Conta de Luz", "2026-09-12", 184.3, "despesa", { account_id: "a-itau" }),
  row("r-academia", "Academia", "Academia", "2026-09-10", 119.9, "despesa", { recurrence_type: "fixa" }),
  row("r-salario", "Salário", "Salário", "2026-09-05", 6200, "receita"),
];
const IFOOD_ROW = row("r-ifood", "iFood", "Delivery", "2026-09-18", 45.9, "despesa", { time: "12:34" });
const MARKET_ROW = row("r-market", "Supermercado Extra", "Supermercado", "2026-09-18", 312.4, "despesa", { time: "18:42" });
const ACCOUNT_NAME: Record<string, string> = { "a-nu": "Nubank", "a-itau": "Itaú" };

const SCAN_ITEMS: ScanResultItem[] = [
  { description: "Supermercado Extra", merchant: "Supermercado Extra", amount: 312.4, category: "Supermercado", date: "2026-09-18", time: "18:42" },
];

const RAIOX_MOCK = {
  report: { score: 780, level: scoreLevel(780), pillars: [], hasData: true },
  trend: [
    { score: 598, month: 3 }, { score: 634, month: 4 }, { score: 671, month: 5 },
    { score: 702, month: 6 }, { score: 745, month: 7 }, { score: 780, month: 8 },
  ],
  light: { light: "verde", message: "Você pode gastar até R$ 136 hoje sem comprometer o mês.", allowance: 136, leftToday: 136 },
} as unknown as RaioXData;

/* ══════════════════════════ Demo plumbing ══════════════════════════ */

const DemoCtx = createContext<{ root: RefObject<HTMLDivElement>; scale: number }>({ root: { current: null }, scale: 1 });

type Finder = (root: HTMLElement) => Element | null | undefined;
const bySelector = (sel: string): Finder => (root) => root.querySelector(sel);
const byText = (text: string): Finder => (root) =>
  [...root.querySelectorAll("button")].reverse().find((el) => el.textContent?.toLowerCase().includes(text.toLowerCase()));

/** A finger tap on a real element of the screen, like a screen recording. */
const Tap = ({ find }: { find: Finder }) => {
  const { root, scale } = useContext(DemoCtx);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const r = root.current;
    const el = r && find(r);
    if (!r || !el) return;
    const a = r.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setPos({ x: (b.left + b.width / 2 - a.left) / scale, y: (b.top + b.height / 2 - a.top) / scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pos) return null;
  return (
    <motion.span
      className="pointer-events-none absolute z-[95] h-12 w-12 rounded-full border-2 border-white/80 bg-white/30 shadow-[0_0_24px_rgba(255,255,255,0.35)]"
      style={{ left: pos.x - 24, top: pos.y - 24 }}
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [1.5, 1, 0.82, 0.82] }}
      transition={{ duration: 0.7, times: [0, 0.3, 0.65, 1] }}
    />
  );
};

/* ══════════════════════════ Screens ══════════════════════════ */

/**
 * A tall page that glides to the section named by `to` (a `data-section`
 * inside it), never past its own end — so the phone never shows empty space.
 */
const ScrollPage = ({ to, children }: { to?: string; children: ReactNode }) => {
  const content = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const max = Math.max(el.scrollHeight - SCREEN_H, 0);
    const target = to ? el.querySelector<HTMLElement>(`[data-section="${to}"]`) : null;
    setOffset(target ? Math.min(Math.max(target.offsetTop - STATUS_H - 16, 0), max) : 0);
  }, [to]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div ref={content} className="relative px-4" animate={{ y: -offset }} transition={{ duration: 1, ease: [0.45, 0, 0.2, 1] }}>
        {children}
      </motion.div>
      {/* Content scrolling under the clock fades out, like the app's header */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-[40] h-[88px] bg-gradient-to-b from-black via-black/85 to-transparent"
        initial={false}
        animate={{ opacity: offset > 0 ? 1 : 0 }}
      />
    </div>
  );
};

/** The app's top bar on every tab but Início. */
const AppHeader = () => (
  <div className="-mx-4 px-4 pb-4" style={{ paddingTop: STATUS_H + 14 }}>
    <div className="flex items-center justify-between">
      <img src={wordmarkOnDark} alt="Willo" className="h-5 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="relative flex h-9 w-9 items-center justify-center text-white/85">
          <Bell className="h-5 w-5" />
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white">L</span>
      </div>
    </div>
  </div>
);

/** Room at the bottom so the last card clears the floating nav. */
const NavSpacer = () => <div className="h-[120px]" />;

/** The real home, top to bottom: balance, categories, Financeiro, cards, recent, upcoming and goals. */
export const HomeScreen = ({ to, extra = [], withIfood = false }: { to?: string; extra?: Transaction[]; withIfood?: boolean }) => {
  const spent = withIfood ? 45.9 : 0;
  return (
    <ScrollPage to={to}>
      <BalanceHeroCard saldoAtual={8420.5 - spent} topInset={STATUS_H} />
      <div className="mt-3 space-y-3">
        <MonthFiguresCard
          receitas={6450}
          despesas={3215.8 + spent}
          selectedMonth={8}
          selectedYear={2026}
          onMonthChange={noop}
        />
        <div data-section="categorias">
          <GastosPorCategoria categories={categoriesFor(withIfood)} selectedMonth={8} onVerAnalise={noop} />
        </div>
        <FinanceOverviewCard receitas={6450} despesas={3215.8 + spent} saldoPrevisto={9120.3 - spent} nextMonthBalance={10480} />
        <div data-section="cartoes">
          <CardsOverviewView cards={CARDS} invoices={INVOICES} today={TODAY} />
        </div>
        <div data-section="recentes">
          <TransacoesRecentes transactions={[...extra, ...BASE_TX]} onVerTodas={noop} />
        </div>
        <div data-section="fim">
          <ProximosEventos events={EVENTS} selectedMonth={8} selectedYear={2026} />
        </div>
        <MetasResumoView goals={GOALS} />
      </div>
      <NavSpacer />
    </ScrollPage>
  );
};

/** The real Transações tab: summary, filters and the day-by-day list. */
const TransactionsScreen = ({ rows, spent }: { rows: TransactionRow[]; spent: number }) => {
  const byDay = new Map<string, TransactionRow[]>();
  rows.forEach((r) => byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]));
  const days = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <ScrollPage>
      <AppHeader />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 pt-1">
          <h1 className="text-[28px] font-extrabold tracking-tight text-white">Transações</h1>
          <MonthSelector selectedMonth={8} selectedYear={2026} onMonthChange={noop} />
        </div>
        <TransactionsSummaryCard saldoAtual={8420.5 - spent} saldoPrevisto={9120.3 - spent} receitas={6450} despesas={3215.8 + spent} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TransactionTabs value="todos" onChange={noop} layoutId="demo-tx-tabs" />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.12] willo-glass text-white/70">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <div className="flex h-11 w-full items-center rounded-full border border-white/[0.12] willo-glass pl-11 text-[14px] text-white/30">Buscar transação...</div>
          </div>
        </div>
        <div>
          {days.map(([date, txs], gi) => {
            const { label, isToday } = formatDateHeader(date, TODAY);
            const net = txs.reduce((s, t) => s + (t.type === "receita" ? t.amount : -t.amount), 0);
            return (
              <div key={date} className={gi > 0 ? "mt-5" : ""}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={`text-[13px] font-semibold ${isToday ? "text-white" : "text-white/50"}`}>{isToday ? `Hoje, ${label}` : label}</span>
                  <span className={`text-[12px] tabular-nums ${net > 0 ? "text-willo-green" : "text-white/45"}`}>
                    {net > 0 ? "+" : "−"}R$ {Math.abs(net).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.12] willo-glass">
                  {txs.map((tx) => (
                    <motion.div key={tx.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                      <TransactionListItem tx={tx} accountName={ACCOUNT_NAME[tx.account_id ?? ""] ?? "Conta"} onDelete={noop} onEdit={noop} />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <NavSpacer />
    </ScrollPage>
  );
};

/** The real Carteira tab: accounts, what's saved and the credit cards. */
const WalletScreen = ({ to }: { to?: string }) => (
  <ScrollPage to={to}>
    <AppHeader />
    <div className="space-y-6">
      <div className="pt-1">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white">Carteira</h1>
        <p className="text-[14px] text-white/45">Suas contas e cartões em um só lugar</p>
      </div>
      <AccountsBalanceCard accounts={ACCOUNTS} onOpen={noop} onAdd={noop} savedTotal={16600} />
      <section data-section="guardado">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[18px] font-bold text-white">Guardado</h2>
          <p className="text-[13px] text-white/45 tabular-nums">R$ 16.600</p>
        </div>
        <ReserveAndPots goals={WALLET_GOALS} onCreated={noop} />
      </section>
      <section data-section="cartoes">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[18px] font-bold text-white">Cartões de crédito</h2>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] willo-glass text-white">
            <Plus className="h-4 w-4" />
          </span>
        </div>
        <div className="space-y-2.5">
          {WALLET_CARDS.map((card, idx) => (
            <CreditCardTile
              key={card.id}
              card={card}
              idx={idx}
              navigate={noopNavigate}
              invoiceInfo={card.id === "c-nu" ? { amount: 1284.9, month: 9, year: 2026, isPaid: false } : { amount: 0, month: 10, year: 2026, isPaid: false }}
            />
          ))}
        </div>
      </section>
    </div>
    <NavSpacer />
  </ScrollPage>
);

/** The real Raio-X tab: app header, page header, day light and the score. */
export const RaioXScreen = () => (
  <div className="absolute inset-0 overflow-hidden px-4">
    <AppHeader />
    <header className="px-1 pt-1">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-willo-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-willo-green" />
        </span>
        Análise em tempo real
      </p>
      <h1 className="mt-1 flex items-center gap-2 text-[30px] font-extrabold leading-none tracking-tight text-white">
        Raio-X
        <BrainCircuit className="h-6 w-6 text-willo-green" />
      </h1>
      <p className="mt-1.5 text-[14px] text-white/45">O cérebro do seu dinheiro: o que você faz certo, o que dá pra melhorar.</p>
    </header>
    <DailyLightCard data={RAIOX_MOCK} />
    <div className="mt-4">
      <Segmented value="geral" onChange={noop} layoutId="demo-raiox-tabs" options={[{ key: "geral", label: "Geral" }, { key: "simular", label: "Simular" }]} />
    </div>
    <ScoreCard data={RAIOX_MOCK} />
  </div>
);

const ModalRow = ({ icon: Icon, label, children }: { icon: typeof FileText; label: string; children?: ReactNode }) => (
  <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
      <Icon className="h-4 w-4 text-white/70" />
    </span>
    <span className="shrink-0 text-[15px] text-white">{label}</span>
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">{children}</div>
  </div>
);

/** Same layout as NovaTransacaoModal, filling itself in like someone typing. */
const NewExpenseDemo = () => {
  const [cents, setCents] = useState(0);
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const timers = [
      ...[4, 45, 459, 4590].map((v, i) => setTimeout(() => setCents(v), 450 + i * 260)),
      ..."iFood".split("").map((_, i) => setTimeout(() => setDesc("iFood".slice(0, i + 1)), 1700 + i * 110)),
      setTimeout(() => setCategory("Delivery"), 2450),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const chip = (active: boolean) => cn("flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold", active ? "bg-white text-[#0B0B0B]" : "bg-white/[0.06] text-white/60");
  const CatIcon = category ? getDefaultCategoryIcon(category) : null;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 34, stiffness: 320 }}
      className="willo-bg absolute inset-0 z-[60] flex flex-col"
    >
      <div className="shrink-0 px-4" style={{ paddingTop: STATUS_H + 10 }}>
        <div className="flex h-11 items-center justify-between">
          <span className="-ml-1 flex h-10 w-10 items-center justify-center text-white/70"><X className="h-6 w-6" /></span>
          <span className="text-[16px] font-semibold text-white">Nova despesa</span>
          <span className="w-10" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4">
        <div className="flex flex-col items-center pb-7 pt-6">
          <span className="flex items-center gap-1.5 text-[14px] text-white/50">
            <TrendingDown className="h-4 w-4" style={{ color: "#F87171" }} /> Valor da despesa
          </span>
          <div className="relative mt-2 flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-white/40">R$</span>
            <motion.span
              key={cents}
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              className={cn("text-[52px] font-extrabold leading-none tracking-tight tabular-nums", cents === 0 ? "text-white/30" : "text-white")}
            >
              {(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.span>
          </div>
          <span className="mt-3 h-1 w-10 rounded-full bg-[#F87171]" />
        </div>

        <div className="divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.12] willo-glass">
          <ModalRow icon={FileText} label="Descrição">
            <span className={cn("text-[15px]", desc ? "text-white" : "text-white/30")}>{desc || "Ex: Mercado"}</span>
            {desc && desc.length < 5 && <span className="h-5 w-[2px] animate-pulse bg-white" />}
          </ModalRow>
          <ModalRow icon={Tag} label="Categoria">
            {category && CatIcon ? (
              <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex min-w-0 items-center gap-2">
                <CatIcon className="h-4 w-4 shrink-0" style={{ color: getCategoryHexColor(category) }} />
                <span className="truncate text-[15px] text-white">{category}</span>
                <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/60">IA</span>
              </motion.span>
            ) : (
              <span className="text-[15px] text-white/35">Escolher</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
          </ModalRow>
        </div>

        <p className="mb-2 mt-6 px-1 text-[13px] font-semibold text-white/45">Data</p>
        <div className="rounded-[22px] border border-white/[0.12] willo-glass p-3">
          <div className="flex gap-2">
            <span className={chip(true)}>Hoje</span>
            <span className={chip(false)}>Ontem</span>
            <span className={chip(false)}>Outra data</span>
          </div>
        </div>

        <p className="mb-2 mt-6 px-1 text-[13px] font-semibold text-white/45">Como pagou</p>
        <div className="rounded-[22px] border border-white/[0.12] willo-glass">
          <div className="grid grid-cols-2 gap-1 p-1.5">
            {([["Conta", Wallet, true], ["Cartão de crédito", CreditCard, false]] as const).map(([label, Icon, on]) => (
              <span key={label} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold", on ? "bg-white text-[#0B0B0B]" : "text-white/55")}>
                <Icon className="h-4 w-4" /> {label}
              </span>
            ))}
          </div>
          <div className="border-t border-white/[0.06] px-4 py-3.5">
            <span className="flex items-center gap-2.5 text-[15px] text-white/60">
              <Wallet className="h-[18px] w-[18px] text-white/45" /> Conta
            </span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className="flex h-10 items-center gap-2 rounded-full border border-white bg-white px-3.5 text-[14px] font-medium text-[#0B0B0B]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0B0B0B]" /> Nubank
                <span className="text-[11px] text-[#0B0B0B]/60">padrão</span>
              </span>
              <span className="flex h-10 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 text-[14px] font-medium text-white/80">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> Itaú
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3" style={{ paddingBottom: 34 }}>
        <button
          type="button"
          className={cn(
            "h-14 w-full rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-opacity",
            cents === 0 && "opacity-35",
          )}
        >
          Adicionar despesa
        </button>
      </div>
    </motion.div>
  );
};

/** The phone camera pointed at a receipt, before the shot. */
const CameraDemo = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[65] bg-black">
    <motion.div className="absolute inset-0" initial={{ scale: 1.1 }} animate={{ scale: 1.04 }} transition={{ duration: 1.4 }}>
      <DemoReceipt />
    </motion.div>
    <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5" style={{ paddingTop: STATUS_H + 12 }}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"><X className="h-5 w-5" /></span>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"><Zap className="h-5 w-5" /></span>
    </div>
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent pb-12 pt-16">
      <span className="rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">Foto do comprovante</span>
      <span data-demo="shutter" className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[4px] border-white">
        <span className="h-[60px] w-[60px] rounded-full bg-white" />
      </span>
    </div>
  </motion.div>
);

/** The sonner toast the app shows after saving a transaction. */
const SavedTransactionToast = () => (
  <div className="flex w-[calc(100%-24px)] items-start gap-2.5 rounded-[20px] border border-white/10 willo-glass-inset/95 px-4 py-3.5 text-[14px] font-medium text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
    <CheckCircle2 className="mt-px h-5 w-5 shrink-0 fill-willo-green text-[#1A1A1A]" />
    <div>
      <p>Transação registrada 🎯</p>
      <p className="text-[13px] font-normal text-white/55">Despesa de R$ 45,90</p>
    </div>
  </div>
);

/* ══════════════════════════ Script ══════════════════════════ */

type Phase =
  | "home" | "tapPlus" | "sheet" | "tapDespesa" | "modal" | "tapSave" | "saved"
  | "tourCats" | "tourCards" | "tourRecent" | "tourEnd"
  | "tapTx" | "transactions"
  | "tapPlus2" | "sheet2" | "tapScan" | "camera" | "tapShutter" | "reading" | "result" | "tapConfirm" | "scanSaved"
  | "tapWallet" | "wallet" | "walletCards"
  | "tapRaio" | "raiox" | "tapHome";

const SCRIPT: { id: Phase; ms: number }[] = [
  { id: "home", ms: 2600 },
  { id: "tapPlus", ms: 450 },
  { id: "sheet", ms: 1000 },
  { id: "tapDespesa", ms: 400 },
  { id: "modal", ms: 3200 },
  { id: "tapSave", ms: 450 },
  { id: "saved", ms: 2200 },
  { id: "tourCats", ms: 1700 },
  { id: "tourCards", ms: 1900 },
  { id: "tourRecent", ms: 1900 },
  { id: "tourEnd", ms: 2000 },
  { id: "tapTx", ms: 450 },
  { id: "transactions", ms: 2200 },
  { id: "tapPlus2", ms: 450 },
  { id: "sheet2", ms: 900 },
  { id: "tapScan", ms: 400 },
  { id: "camera", ms: 1300 },
  { id: "tapShutter", ms: 350 },
  { id: "reading", ms: 1900 },
  { id: "result", ms: 2300 },
  { id: "tapConfirm", ms: 450 },
  { id: "scanSaved", ms: 2600 },
  { id: "tapWallet", ms: 450 },
  { id: "wallet", ms: 2200 },
  { id: "walletCards", ms: 2400 },
  { id: "tapRaio", ms: 400 },
  { id: "raiox", ms: 4000 },
  { id: "tapHome", ms: 450 },
];

const indexOf = (p: Phase) => SCRIPT.findIndex((s) => s.id === p);

const TAPS: Partial<Record<Phase, Finder>> = {
  tapPlus: bySelector('[aria-label="Adicionar transação"]'),
  tapPlus2: bySelector('[aria-label="Adicionar transação"]'),
  tapDespesa: bySelector('[data-action="despesa"]'),
  tapSave: byText("Adicionar despesa"),
  tapTx: bySelector('[aria-label="Transações"]'),
  tapScan: bySelector('[data-action="scanner"]'),
  tapShutter: bySelector('[data-demo="shutter"]'),
  tapConfirm: byText("Confirmar gasto"),
  tapWallet: bySelector('[aria-label="Carteira"]'),
  tapRaio: bySelector('[aria-label="Raio-X"]'),
  tapHome: bySelector('[aria-label="Início"]'),
};

/** Where the home is scrolled to during the dashboard tour. */
const HOME_SCROLL: Partial<Record<Phase, string>> = {
  tourCats: "categorias",
  tourCards: "cartoes",
  tourRecent: "recentes",
  tourEnd: "fim",
  tapTx: "fim",
};

/** Plays the script once; the parent remounts it to loop. */
const DemoReel = ({ onDone }: { onDone: () => void }) => {
  // Dev only: /welcome?demo=tourEnd freezes the reel on that step
  const [hold] = useState(() => (import.meta.env.DEV ? indexOf(new URLSearchParams(window.location.search).get("demo") as Phase) : -1));
  const [i, setI] = useState(Math.max(hold, 0));

  useEffect(() => {
    if (hold >= 0) return;
    const t = setTimeout(() => (i + 1 >= SCRIPT.length ? onDone() : setI(i + 1)), SCRIPT[i].ms);
    return () => clearTimeout(t);
  }, [i, onDone, hold]);

  const phase = SCRIPT[i].id;
  const past = (p: Phase) => i >= indexOf(p);
  const between = (a: Phase, b: Phase) => i >= indexOf(a) && i <= indexOf(b);

  const screen = between("transactions", "tapWallet") ? "tx" : between("wallet", "tapRaio") ? "wallet" : between("raiox", "tapHome") ? "raiox" : "home";
  const activePath = { home: "/", tx: "/transacoes", wallet: "/gestao", raiox: "/bot-finance" }[screen];
  const sheetOpen = between("sheet", "tapDespesa") || between("sheet2", "tapScan");
  const extra = [...(past("scanSaved") ? [MARKET_TX] : []), ...(past("saved") ? [IFOOD_TX] : [])];
  const rows = [...(past("scanSaved") ? [MARKET_ROW] : []), IFOOD_ROW, ...BASE_ROWS];
  const tap = TAPS[phase];

  return (
    <>
      <AnimatePresence initial={false}>
        <motion.div
          key={screen}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {screen === "home" && <HomeScreen to={HOME_SCROLL[phase]} extra={extra} withIfood={past("saved")} />}
          {screen === "tx" && <TransactionsScreen rows={rows} spent={45.9 + (past("scanSaved") ? 312.4 : 0)} />}
          {screen === "wallet" && <WalletScreen to={phase === "walletCards" || phase === "tapRaio" ? "cartoes" : undefined} />}
          {screen === "raiox" && <RaioXScreen />}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 px-5" style={{ paddingBottom: 30 }}>
        <BottomNavBar activePath={activePath} plusOpen={sheetOpen} />
      </div>

      <AddActionsMenu inline open={sheetOpen} onClose={noop} bottom="116px" />

      <AnimatePresence>{between("modal", "tapSave") && <NewExpenseDemo key="modal" />}</AnimatePresence>
      <AnimatePresence>{between("camera", "tapShutter") && <CameraDemo key="camera" />}</AnimatePresence>

      <ScanCaptureScreen
        open={between("reading", "tapConfirm")}
        photoUrl={null}
        backdrop={<DemoReceipt />}
        items={between("result", "tapConfirm") ? SCAN_ITEMS : null}
        onItemsChange={noop}
        accounts={[{ id: "nubank", name: "Nubank" }]}
        accountId="nubank"
        onAccountChange={noop}
        onClose={noop}
        onConfirm={noop}
        topInset={STATUS_H}
      />

      <AnimatePresence>
        {(phase === "saved" || phase === "scanSaved") && (
          <motion.div
            key={phase}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute inset-x-0 z-[85] flex justify-center"
            style={{ top: STATUS_H + 12 }}
          >
            {phase === "saved" ? <SavedTransactionToast /> : <SavedToastCard items={SCAN_ITEMS} />}
          </motion.div>
        )}
      </AnimatePresence>

      {tap && <Tap key={phase} find={tap} />}
    </>
  );
};

/* ══════════════════════════ Phone ══════════════════════════ */

/** Draws the 390pt-wide app scaled into the phone's glass. */
const PhoneScreen = ({ children }: { children: ReactNode }) => {
  const outer = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SCREEN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="absolute inset-0 overflow-hidden">
      <DemoCtx.Provider value={{ root, scale }}>
        <div
          ref={root}
          className="willo-bg pointer-events-none absolute left-0 top-0 origin-top-left overflow-hidden text-white"
          style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </DemoCtx.Provider>
    </div>
  );
};

const StatusBar = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 z-[90] flex h-[48px] items-center justify-between px-9 pt-1 text-white">
    <span className="text-[15px] font-semibold tracking-tight">9:41</span>
    <span className="flex items-center gap-1.5">
      <span className="flex items-end gap-[2px]">
        {[5, 7, 9, 11].map((h) => <span key={h} className="w-[3px] rounded-[1px] bg-white" style={{ height: h }} />)}
      </span>
      <span className="text-[13px] font-semibold">5G</span>
      <span className="relative ml-0.5 h-[12px] w-[25px] rounded-[4px] border border-white/60 p-[1.5px]">
        <span className="block h-full w-[80%] rounded-[2px] bg-white" />
      </span>
    </span>
  </div>
);

/** Brushed-titanium side key. */
const SideKey = ({ side, top, height }: { side: "left" | "right"; top: string; height: string }) => (
  <span
    className={cn("absolute w-[1.6%] rounded-sm", side === "left" ? "-left-[1.3%]" : "-right-[1.3%]")}
    style={{ top, height, background: "linear-gradient(90deg, #4a4a4e 0%, #9a9aa0 45%, #3a3a3d 100%)" }}
  />
);

/** A still of the scan result, for places that show the app without playing it. */
export const ScanStill = () => (
  <ScanCaptureScreen
    open
    photoUrl={null}
    backdrop={<DemoReceipt />}
    items={SCAN_ITEMS}
    onItemsChange={noop}
    accounts={[{ id: "nubank", name: "Nubank" }]}
    accountId="nubank"
    onAccountChange={noop}
    onClose={noop}
    onConfirm={noop}
    topInset={STATUS_H}
  />
);

/** The titanium iPhone itself, drawing whatever app screen it's given. */
export const PhoneFrame = ({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={cn("relative", className)} style={{ aspectRatio: "0.49", ...style }}>
    <div
      className="absolute inset-0"
      style={{
        borderRadius: "17% / 8.2%",
        padding: "1.1%",
        background: "linear-gradient(135deg, #b8b8bd 0%, #5d5d62 14%, #2a2a2d 32%, #1d1d1f 50%, #3f3f43 68%, #8c8c92 86%, #505055 100%)",
        boxShadow: "0 50px 90px -30px rgba(0,0,0,0.95), 0 0 0 0.5px rgba(255,255,255,0.25), inset 0 0 0 0.6px rgba(255,255,255,0.35)",
      }}
    >
      <SideKey side="left" top="17%" height="4.5%" />
      <SideKey side="left" top="25%" height="8.5%" />
      <SideKey side="left" top="35.5%" height="8.5%" />
      <SideKey side="right" top="27%" height="12.5%" />

      {/* Black bezel */}
      <div className="relative h-full w-full bg-black p-[2.4%]" style={{ borderRadius: "16% / 7.7%" }}>
        {/* Glass */}
        <div className="relative h-full w-full overflow-hidden bg-black" style={{ borderRadius: "13.5% / 6.3%" }}>
          <PhoneScreen>
            {children}
            <StatusBar />
            <span className="absolute left-1/2 top-[10px] z-[91] h-[32px] w-[112px] -translate-x-1/2 rounded-full bg-black" />
            <span className="absolute bottom-[8px] left-1/2 z-[91] h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white/80" />
          </PhoneScreen>
          {/* Glass reflection */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_28%,transparent_40%)]" />
        </div>
      </div>
    </div>
  </div>
);

/** Real bottom nav, as it sits on the home tab. */
export const NavStill = ({ activePath = "/" }: { activePath?: string }) => (
  <div className="absolute inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 px-5" style={{ paddingBottom: 30 }}>
    <BottomNavBar activePath={activePath} />
  </div>
);

/**
 * The hero of the welcome screen: a real-looking titanium iPhone playing a
 * looping recording of the actual app — adding an expense, scanning a
 * receipt and checking the Raio-X.
 */
const WelcomeShowcase = () => {
  const [loop, setLoop] = useState(0);

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-5" style={{ perspective: 1400 }} aria-hidden="true">
      <motion.div
        className="relative h-[94%] max-h-[560px]"
        style={{ aspectRatio: "0.49", transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, rotateX: 20, rotateY: -16, rotateZ: -3, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, rotateX: 0, rotateY: 0, rotateZ: 0, y: 0, scale: 1 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Floor shadow */}
        <div className="pointer-events-none absolute -bottom-6 left-1/2 h-10 w-[80%] -translate-x-1/2 rounded-[50%] bg-black blur-2xl" />
        <PhoneFrame className="h-full">
          <DemoReel key={loop} onDone={() => setLoop((l) => l + 1)} />
        </PhoneFrame>
      </motion.div>
    </div>
  );
};

export default WelcomeShowcase;
