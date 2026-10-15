import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Landmark, Plus, Banknote, Vault, PiggyBank } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import BackButton from "@/components/shared/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { colorFor } from "@/lib/banks";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import AccountTile from "@/components/wallet/AccountTile";
import AccountCreateSheet from "@/components/wallet/AccountCreateSheet";
import ReserveAndPots from "@/components/wallet/ReserveAndPots";
import { fetchGoals, type Goal } from "@/services/goalService";

/**
 * Contas.
 *
 * The same shape the wallet has, because it answers the same two questions in the
 * same order: what does all of this add up to, and which account do I want. The total
 * stands alone at the top and stays there while the accounts travel up over it; each
 * account is glass with its bank's colour on its mark and on the share rule, so four
 * banks read as four marks rather than four coloured panels.
 */

interface Account {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  current_balance: number;
  initial_balance: number;
  color: string | null;
}

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: typeof Landmark }> = {
  cash: { label: "Dinheiro", icon: Banknote },
  checking: { label: "Conta corrente", icon: Landmark },
  savings: { label: "Poupança", icon: Vault },
  investment: { label: "Investimento", icon: PiggyBank },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** How far the page scrolls before the pinned total has fully receded. */
const PIN_TRAVEL = 150;

const GestaoFinanceira = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Opened as a shortcut from the dashboard's "Complete sua conta" card —
  // /gestao?abrir=conta opens the account sheet right away.
  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (!abrir) return;
    if (abrir === "conta") setShowAddAccount(true);
    // Cards have their own screen, so an old link to add one goes there.
    if (abrir === "cartao") navigate("/cartoes", { replace: true });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("abrir");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [accs, goalsData] = await Promise.all([getAccounts(), fetchGoals()]);
      setAccounts(accs as unknown as Account[]);
      setGoals(goalsData);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const onChange = () => fetchData();
    window.addEventListener("finance-data-changed", onChange);

    const channel = supabase
      .channel("gestao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    return () => {
      window.removeEventListener("finance-data-changed", onChange);
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const rows = useMemo(
    () =>
      accounts
        .map((a) => ({
          account: a,
          balance: Number(a.current_balance) || 0,
          hex: colorFor(a.name, a.color, "#6B7280"),
          typeLabel: (ACCOUNT_TYPE_LABELS[a.type] ?? ACCOUNT_TYPE_LABELS.checking).label,
        }))
        .sort((a, b) => b.balance - a.balance),
    [accounts],
  );

  const saldo = rows.reduce((s, r) => s + r.balance, 0);
  /* Only what is actually in hand can take up room on a share rule; an account in the
     red still gets its tile, so the list stays the whole truth. */
  const positive = rows.reduce((s, r) => s + Math.max(r.balance, 0), 0);
  const guardado = goals.reduce((s, g) => s + Number(g.current_amount), 0);

  /* The total does not scroll: it stays and recedes while the accounts travel over it. */
  const markerRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [summaryTop, setSummaryTop] = useState(0);
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const measure = () => {
      setSummaryHeight(el.offsetHeight);
      const marker = markerRef.current;
      if (marker) setSummaryTop(marker.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loading, rows.length, guardado]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setProgress(Math.min(Math.max(window.scrollY / PIN_TRAVEL, 0), 1));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg pb-28 pt-4">
      {/* Over the pinned total as it leaves, like the accounts. */}
      <div className="relative z-20 flex h-11 items-center justify-between">
        <BackButton to="/" />
        <button
          type="button"
          onClick={() => setShowAddAccount(true)}
          aria-label="Adicionar conta"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.07] text-white active:scale-95"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 space-y-4">
          <div className="h-[96px] animate-pulse rounded-[24px] bg-white/[0.04]" />
          <div className="h-[170px] animate-pulse rounded-[24px] border border-white/[0.08] willo-glass" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-[26px] border border-white/[0.08] willo-glass px-5 pb-5 pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
            <Landmark className="h-[22px] w-[22px] text-white/70" strokeWidth={2} />
          </div>
          <p className="mt-3.5 text-[17px] font-bold text-white">Nenhuma conta cadastrada</p>
          <p className="mx-auto mt-1.5 max-w-[16rem] text-[13.5px] leading-snug t-soft">
            Cadastre uma conta para acompanhar o saldo e o que entra e sai dela.
          </p>
          <button
            onClick={() => setShowAddAccount(true)}
            className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[18px] bg-white text-[15px] font-semibold willo-on-invert active:opacity-80"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} /> Adicionar conta
          </button>
        </div>
      ) : (
        <>
          {/* ══ Pinned: everything you hold ══ */}
          <div ref={markerRef} aria-hidden="true" />
          <div
            ref={summaryRef}
            className="fixed inset-x-0 z-10 mx-auto max-w-lg px-4"
            style={{
              top: summaryTop,
              filter: progress > 0.001 ? `blur(${(progress * 12).toFixed(2)}px)` : undefined,
              opacity: 1 - progress * 0.8,
              transform: `scale(${1 - progress * 0.03})`,
              transformOrigin: "50% 0%",
              willChange: "filter, opacity, transform",
              pointerEvents: progress > 0.4 ? "none" : undefined,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative px-1 pt-3"
            >
              {/* The page's own light, behind the figure rather than around it. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-10 -top-8 h-44 w-72 rounded-full blur-[64px]"
                style={{ background: "#8B93A8", opacity: 0.16 }}
              />
              <p className="relative text-[13.5px] text-white/62">Saldo em contas</p>
              <p className={cn(
                "relative mt-1 truncate text-[40px] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
                saldo < 0 ? "text-red-400" : "text-white",
              )}>
                {fmt(saldo)}
              </p>
              <p className="relative mt-2.5 text-[12.5px] t-soft">
                {rows.length} {rows.length === 1 ? "conta" : "contas"}
                {guardado > 0 && (
                  <>
                    <span className="text-white/20"> · </span>
                    <span className="tabular-nums text-willo-green-ink">{fmt(guardado)}</span> guardado
                  </>
                )}
              </p>
            </motion.div>
          </div>

          {/* The room the pinned block takes, so the accounts begin under it. */}
          <div aria-hidden="true" style={{ height: summaryHeight }} />

          {/* ══ The accounts ══ */}
          <div className="relative z-20 mt-6 space-y-3">
            {rows.map((r, i) => (
              <AccountTile
                key={r.account.id}
                index={i}
                hex={r.hex}
                share={positive > 0 ? Math.max(r.balance, 0) / positive : 0}
                account={{
                  id: r.account.id,
                  name: r.account.name,
                  typeLabel: r.typeLabel,
                  balance: r.balance,
                  isDefault: r.account.is_default,
                }}
                onOpen={() => navigate(`/conta/${r.account.id}`)}
              />
            ))}

            <button
              onClick={() => setShowAddAccount(true)}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/20 text-[14.5px] font-semibold text-white/82 active:opacity-70"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} /> Adicionar conta
            </button>

            {/* ══ What is put away ══ */}
            <section className="pt-5">
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <h2 className="text-[15px] font-bold text-white">Guardado</h2>
                <p className="text-[13px] tabular-nums t-soft">{fmt(guardado)}</p>
              </div>
              <ReserveAndPots goals={goals} onCreated={fetchData} />
            </section>
          </div>
        </>
      )}

      <AccountCreateSheet
        open={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onCreated={fetchData}
      />
    </div>
  );
};

export default GestaoFinanceira;
