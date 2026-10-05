import { memo, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { StatTile } from "@/components/dashboard/StatTile";
import { Check, ChevronDown, ChevronUp, Pencil, Repeat, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { deleteTransaction, getTransactionById } from "@/services/transactionService";
import { getRecurringSourceId, getRecurringTransactionsForMonth } from "@/services/recurringService";
import { toast } from "sonner";

import { getCurrency } from "@/lib/currency";
type RecurringType = "despesa" | "receita";

interface Subscription {
  id: string;
  sourceId: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  source: "conta" | "cartao";
  txType: RecurringType;
  isPaidThisMonth: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

type BrandInfo = {
  bg: string;
  fg: string;
  logo?: string;
  icon?: string;
};

const BRAND_MAP: Record<string, BrandInfo> = {
  netflix:        { bg: "#000000", fg: "#E50914", logo: "https://images.ctfassets.net/4cd45et68cgf/7LrExJ6PAj6MSIPkDrGdbk/c30d6fc8f5a9f1d73ac79e3fb5a2353e/Netflix-Brand-Symbol.png" },
  spotify:        { bg: "#191414", fg: "#1DB954", logo: "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png" },
  "apple music":  { bg: "#000000", fg: "#FC3C44", logo: "https://music.apple.com/assets/knowledge-graph/music.png" },
  "youtube music":{ bg: "#000000", fg: "#FF0000", logo: "https://lh3.googleusercontent.com/z6Sl4j9zQ88oUKNy0G3PAMiVwy8DzQLh_ygyvBXv0zVNUZ_wQPN_n7EAR2By3dhoUpX7kTpaHjRPni1MHwKpaBJbpNqdEsHZsH4q" },
  youtube:        { bg: "#000000", fg: "#FF0000", logo: "https://www.youtube.com/s/desktop/29d9ee5c/img/favicon_144x144.png" },
  deezer:         { bg: "#000000", fg: "#A238FF", logo: "https://e-cdns-files.dzcdn.net/cache/slash/images/common/logos/deezer_logo_circle.png" },
  "disney+":      { bg: "#040714", fg: "#0063e5", logo: "https://cnbl-cdn.bamgrid.com/assets/7ecc8bcb60ad77193058d63e321bd21cbac2fc67/original" },
  disney:         { bg: "#040714", fg: "#0063e5", logo: "https://cnbl-cdn.bamgrid.com/assets/7ecc8bcb60ad77193058d63e321bd21cbac2fc67/original" },
  "hbo max":      { bg: "#000000", fg: "#5822B4", icon: "HBO" },
  hbo:            { bg: "#000000", fg: "#fff", icon: "HBO" },
  max:            { bg: "#002BE7", fg: "#fff", icon: "MAX" },
  "prime video":  { bg: "#00131F", fg: "#00A8E1", logo: "https://m.media-amazon.com/images/G/01/digital/video/web/Logo-sm.png" },
  "amazon prime": { bg: "#00131F", fg: "#00A8E1", logo: "https://m.media-amazon.com/images/G/01/digital/video/web/Logo-sm.png" },
  amazon:         { bg: "#131921", fg: "#FF9900", icon: "A" },
  icloud:         { bg: "#000000", fg: "#3693F3", logo: "https://www.apple.com/v/icloud/d/images/overview/icloud-storage-icon__bxnlrftjhdiq_large.png" },
  "google one":   { bg: "#000000", fg: "#4285F4", logo: "https://www.gstatic.com/images/branding/product/2x/google_one_64dp.png" },
  dropbox:        { bg: "#000000", fg: "#0061FF", icon: "DB" },
  onedrive:       { bg: "#000000", fg: "#0078D4", icon: "OD" },
  chatgpt:        { bg: "#000000", fg: "#10A37F", logo: "https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nytnj.png" },
  openai:         { bg: "#000000", fg: "#10A37F", logo: "https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nytnj.png" },
  academia:       { bg: "#1a1a2e", fg: "#FF6B35" },
  "smart fit":    { bg: "#000000", fg: "#FFD100", icon: "SF" },
  smartfit:       { bg: "#000000", fg: "#FFD100", icon: "SF" },
  bluefit:        { bg: "#000000", fg: "#0077C8", icon: "BF" },
  claro:          { bg: "#000000", fg: "#ED1C24", icon: "C" },
  vivo:           { bg: "#1B003A", fg: "#660099", logo: "https://appvivo.vivo.com.br/images/icons/vivo-icon-192x192.png" },
  tim:            { bg: "#000000", fg: "#004B93", icon: "TIM" },
  uber:           { bg: "#000000", fg: "#fff", logo: "https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.3.8/d1a3f4spazzrp4.cloudfront.net/icons/uber_home_UberLogo_night_192x192.png" },
  "99":           { bg: "#000000", fg: "#FFCB05", icon: "99" },
  ifood:          { bg: "#000000", fg: "#EA1D2C", logo: "https://static.ifood-static.com.br/image/upload/t_high/webapp/landing/landing-logo-ifood.png" },
  rappi:          { bg: "#000000", fg: "#FF441F", icon: "R" },
  nubank:         { bg: "#1A0533", fg: "#8A05BE", logo: "https://nubank.com.br/images-cms/1652883558-nu-icon.png" },
  xbox:           { bg: "#000000", fg: "#107C10", icon: "X" },
  playstation:    { bg: "#000000", fg: "#003087", icon: "PS" },
  psn:            { bg: "#000000", fg: "#003087", icon: "PS" },
  "game pass":    { bg: "#000000", fg: "#107C10", icon: "GP" },
  canva:          { bg: "#000000", fg: "#00C4CC", icon: "Ca" },
  notion:         { bg: "#000000", fg: "#fff", icon: "N" },
  figma:          { bg: "#000000", fg: "#F24E1E", icon: "F" },
  github:         { bg: "#000000", fg: "#fff", logo: "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png" },
  globoplay:      { bg: "#000000", fg: "#E21B22", icon: "G" },
  crunchyroll:    { bg: "#000000", fg: "#F47521", icon: "CR" },
  paramount:      { bg: "#000000", fg: "#0064FF", icon: "P+" },
  "paramount+":   { bg: "#000000", fg: "#0064FF", icon: "P+" },
  "star+":        { bg: "#000000", fg: "#fff", icon: "S+" },
  twitch:         { bg: "#000000", fg: "#9146FF", logo: "https://static.twitchcdn.net/assets/mobile_iphone-526a7948e69b1a48.png" },
  kwai:           { bg: "#000000", fg: "#FF4906", icon: "K" },
  tiktok:         { bg: "#000000", fg: "#fff", icon: "TT" },
  telegram:       { bg: "#000000", fg: "#26A5E4", icon: "TG" },
  whatsapp:       { bg: "#000000", fg: "#25D366", icon: "WA" },
  linkedin:       { bg: "#000000", fg: "#0A66C2", icon: "In" },
  "apple tv":     { bg: "#000000", fg: "#fff", icon: "TV" },
  "apple tv+":    { bg: "#000000", fg: "#fff", icon: "TV" },
  mubi:           { bg: "#000000", fg: "#fff", icon: "M" },
  starzplay:      { bg: "#000000", fg: "#D4A017", icon: "SZ" },
  starz:          { bg: "#000000", fg: "#D4A017", icon: "SZ" },
  "lionsgate+":   { bg: "#000000", fg: "#F5A623", icon: "LG" },
  pluto:          { bg: "#000000", fg: "#fff", icon: "PT" },
  "pluto tv":     { bg: "#000000", fg: "#fff", icon: "PT" },
  duolingo:       { bg: "#000000", fg: "#58CC02", icon: "DL" },
  coursera:       { bg: "#000000", fg: "#0056D2", icon: "Co" },
  udemy:          { bg: "#000000", fg: "#A435F0", icon: "U" },
  alura:          { bg: "#000000", fg: "#0056FF", icon: "Al" },
  hotmart:        { bg: "#000000", fg: "#F04E23", icon: "HM" },
  mercado:        { bg: "#000000", fg: "#FFE600", icon: "ML" },
  "mercado livre": { bg: "#000000", fg: "#FFE600", icon: "ML" },
  shopee:         { bg: "#000000", fg: "#EE4D2D", icon: "Sh" },
  shein:          { bg: "#000000", fg: "#fff", icon: "SH" },
  magalu:         { bg: "#000000", fg: "#0086FF", icon: "MG" },
  "magazine luiza": { bg: "#000000", fg: "#0086FF", icon: "MG" },
  gympass:        { bg: "#000000", fg: "#D4FF00", icon: "GP" },
  wellhub:        { bg: "#000000", fg: "#D4FF00", icon: "WH" },
  totalpass:      { bg: "#000000", fg: "#FF6B00", icon: "TP" },
};

function getBrand(name: string): BrandInfo & { matched: boolean } {
  const n = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(BRAND_MAP)) {
    if (n.includes(key)) return { ...val, matched: true };
  }
  return { bg: "transparent", fg: "hsl(var(--primary))", matched: false };
}

function getDaysUntil(dueDay: number): number {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let nextDue: Date;
  if (dueDay >= today) {
    nextDue = new Date(currentYear, currentMonth, dueDay);
  } else {
    nextDue = new Date(currentYear, currentMonth + 1, dueDay);
  }

  const diff = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

const BrandIcon = ({ name, category, brand, customCategories }: { name: string; category: string; brand: BrandInfo & { matched: boolean }; customCategories?: CustomCategory[] }) => {
  const [imgError, setImgError] = useState(false);

  if (brand.matched && brand.logo && !imgError) {
    return (
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white/[0.06]" style={{ background: brand.bg }}>
        <img src={brand.logo} alt={name} className="w-6 h-6 object-contain" onError={() => setImgError(true)} loading="lazy" />
      </div>
    );
  }

  if (brand.matched) {
    return (
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-white/[0.06]" style={{ background: brand.bg, color: brand.fg }}>
        <span className="text-[11px] font-black leading-none">{brand.icon || name.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  const IconComponent = getCategoryIcon(category, customCategories);
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06]">
      <IconComponent className="w-5 h-5 text-white/80" />
    </div>
  );
};

const AssinaturasCard = memo(({ compact = false }: { compact?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedMonth, selectedYear } = useMonth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<RecurringType>("despesa");

  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSubs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const txs = await getRecurringTransactionsForMonth(selectedMonth, selectedYear, user.id);

      const seen = new Map<string, typeof txs[number]>();
      for (const tx of txs) {
        const key = `${tx.type}-${getRecurringSourceId(tx)}`;
        if (!seen.has(key)) {
          seen.set(key, tx);
        }
      }

      const subs: Subscription[] = Array.from(seen.values()).map((tx) => ({
        id: tx.id,
        sourceId: getRecurringSourceId(tx),
        name: tx.name,
        amount: Number(tx.amount),
        dueDay: new Date(tx.date + "T12:00:00").getDate(),
        category: tx.category,
        source: tx.payment_method === "cartao" ? "cartao" as const : "conta" as const,
        txType: tx.type as RecurringType,
        isPaidThisMonth: tx.status === "pago",
      }));

      subs.sort((a, b) => {
        if (a.isPaidThisMonth !== b.isPaidThisMonth) return a.isPaidThisMonth ? 1 : -1;
        return getDaysUntil(a.dueDay) - getDaysUntil(b.dueDay);
      });

      setSubscriptions(subs);
    } catch {
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchSubs();
    getCustomCategories().then(setCustomCats).catch(() => {});
  }, [fetchSubs]);

  useEffect(() => {
    const handler = () => fetchSubs();
    window.addEventListener("finance-data-changed", handler);
    window.addEventListener("transaction-created", handler);
    return () => {
      window.removeEventListener("finance-data-changed", handler);
      window.removeEventListener("transaction-created", handler);
    };
  }, [fetchSubs]);

  const handleEdit = useCallback(async (sub: Subscription) => {
    setShowActions(false);
    try {
      const tx = await getTransactionById(sub.sourceId);
      window.dispatchEvent(new CustomEvent("edit-transaction", {
        detail: {
          id: tx.id,
          name: tx.name,
          type: tx.type,
          amount: Number(tx.amount),
          category: tx.category,
          date: tx.date,
          status: tx.status,
          payment_method: tx.payment_method,
          account_id: tx.account_id,
          credit_card_id: tx.credit_card_id,
          recurrence_type: tx.recurrence_type,
          installments: tx.installments,
          installment_current: tx.installment_current,
          observation: tx.observation,
        },
      }));
    } catch {
      toast.error("Erro ao carregar transação");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedSub) return;
    setDeleting(true);
    try {
      await deleteTransaction(selectedSub.sourceId);
      toast.success(`"${selectedSub.name}" removida com sucesso`);
      setShowDeleteConfirm(false);
      setShowActions(false);
      setSelectedSub(null);
      fetchSubs();
    } catch {
      toast.error("Erro ao excluir recorrência");
    } finally {
      setDeleting(false);
    }
  }, [selectedSub, fetchSubs]);

  const filtered = useMemo(() => subscriptions.filter((s) => s.txType === activeTab), [subscriptions, activeTab]);
  const total = useMemo(() => filtered.reduce((s, x) => s + x.amount, 0), [filtered]);
  const despesaCount = useMemo(() => subscriptions.filter((s) => s.txType === "despesa").length, [subscriptions]);
  const receitaCount = useMemo(() => subscriptions.filter((s) => s.txType === "receita").length, [subscriptions]);

  if (loading) {
    return <div className={`${compact ? "h-[138px]" : "h-[200px]"} animate-pulse rounded-[22px] border border-white/[0.08] willo-glass`} />;
  }

  if (subscriptions.length === 0) {
    // A tile cannot say "nothing here yet" in the room it has; the full card can.
    if (compact) return null;
    return (
      <div className="rounded-[22px] border border-white/[0.08] willo-glass p-4">
        <h2 className="text-[16px] font-semibold text-white">Recorrentes</h2>
        <p className="text-[12px] text-white/56">Contas fixas e assinaturas do mês</p>
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-white/[0.04] px-3.5 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <Repeat className="h-4 w-4 text-white/66" />
          </span>
          <p className="flex-1 text-[13px] text-white/66">Nenhuma despesa ou receita recorrente ainda.</p>
        </div>
      </div>
    );
  }

  if (compact) {
    const despesaTotal = subscriptions.filter((s) => s.txType === "despesa").reduce((acc, x) => acc + x.amount, 0);
    return (
      <StatTile
        label="Recorrentes"
        value={fmt(despesaTotal)}
        caption={`${despesaCount} ${despesaCount === 1 ? "cobrança" : "cobranças"} no mês`}
        icon={Repeat}
        accent="#7DD3FC"
        onClick={() => navigate("/transacoes?filtro=recorrentes")}
      />
    );
  }

  const displaySubs = expanded ? filtered : filtered.slice(0, 3);
  const hasMore = filtered.length > 3;
  const paidCount = filtered.filter((sub) => sub.isPaidThisMonth).length;

  return (
    <>
      <div className="rounded-[22px] border border-white/[0.08] willo-glass overflow-hidden">
        {/* Header with total */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Recorrentes</h2>
            <p className="text-[12px] text-white/56">
              {paidCount} de {filtered.length} {activeTab === "receita" ? "recebidas" : "pagas"} este mês
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/56">Total/mês</p>
            <p className={`text-[17px] font-bold tabular-nums ${activeTab === "receita" ? "text-willo-green" : "text-white"}`}>{fmt(total)}</p>
          </div>
        </div>

        {/* Progress of the month */}
        {filtered.length > 0 && (
          <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className={`h-full rounded-full ${activeTab === "receita" ? "bg-willo-green" : "bg-white"}`}
              initial={{ width: 0 }}
              animate={{ width: `${(paidCount / filtered.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 mt-3">
          <div className="grid grid-cols-2 isolate rounded-full bg-white/[0.06] p-1">
            {(["despesa", "receita"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setExpanded(false); }}
                className="relative h-8 rounded-full text-[12px] font-semibold"
              >
                {activeTab === tab && (
                  <motion.span
                    layoutId="recorrentes-tab"
                    className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className={`relative z-10 transition-colors ${activeTab === tab ? "text-[#0B0B0B]" : "text-white/70"}`}>
                  {tab === "despesa" ? "Despesas" : "Receitas"} ({tab === "despesa" ? despesaCount : receitaCount})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="px-4 pt-1 divide-y divide-white/[0.06]">
          <AnimatePresence mode="popLayout" initial={false}>
            {displaySubs.length > 0 ? displaySubs.map((sub, idx) => {
              const brand = getBrand(sub.name);
              const days = getDaysUntil(sub.dueDay);
              const dueSoon = !sub.isPaidThisMonth && days <= 3;

              return (
                <motion.button
                  key={sub.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex w-full items-center gap-3 py-3 text-left active:opacity-70"
                  onClick={() => { setSelectedSub(sub); setShowActions(true); }}
                >
                  <BrandIcon name={sub.name} category={sub.category} brand={brand} customCategories={customCats} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-medium ${sub.isPaidThisMonth ? "text-white/70" : "text-white"}`}>{sub.name}</p>
                    <p className={`text-[12px] ${dueSoon ? "text-amber-300/90" : "text-white/56"}`}>
                      {sub.isPaidThisMonth
                        ? activeTab === "receita" ? "Recebido este mês" : "Pago este mês"
                        : `Dia ${sub.dueDay} · ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className={`text-[15px] font-semibold tabular-nums ${sub.isPaidThisMonth ? "text-white/70" : "text-white"}`}>{fmt(sub.amount)}</p>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        sub.isPaidThisMonth ? "bg-willo-green text-[#0B0B0B]" : "border border-white/15"
                      }`}
                    >
                      {sub.isPaidThisMonth && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </div>
                </motion.button>
              );
            }) : (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center text-[13px] text-white/56">
                Nenhuma {activeTab === "receita" ? "receita recorrente" : "despesa recorrente"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Ver todos / Recolher */}
        {hasMore ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-white/[0.06] py-3 text-[13px] font-medium text-white/74 active:opacity-60"
          >
            {expanded ? <>Mostrar menos <ChevronUp className="h-4 w-4" /></> : <>Ver todas ({filtered.length}) <ChevronDown className="h-4 w-4" /></>}
          </button>
        ) : (
          <div className="h-1" />
        )}
      </div>

      {/* Action Sheet Modal */}
      <AnimatePresence>
        {showActions && selectedSub && !showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => { setShowActions(false); setSelectedSub(null); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] willo-glass border border-white/[0.08] shadow-2xl p-5 pb-24 sm:pb-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">{selectedSub.name}</h3>
                <button onClick={() => { setShowActions(false); setSelectedSub(null); }} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEdit(selectedSub)}
                  className="w-full flex items-center gap-3 rounded-[20px] bg-white/[0.05] hover:bg-white/[0.08] px-4 py-3.5 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white text-[#0B0B0B] flex items-center justify-center shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">Editar</p>
                    <p className="text-[11px] text-muted-foreground">Alterar valor, nome ou categoria</p>
                  </div>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 rounded-[20px] bg-red-500/[0.08] hover:bg-red-500/[0.12] px-4 py-3.5 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-red-400">Cancelar recorrência</p>
                    <p className="text-[11px] text-muted-foreground">Remove esta e todas as futuras</p>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && selectedSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[28px] willo-glass border border-white/[0.08] shadow-2xl p-5"
            >
              <h3 className="text-sm font-bold text-foreground mb-1">Cancelar recorrência</h3>
              <p className="text-[12px] text-muted-foreground mb-5">
                Tem certeza que deseja cancelar <span className="font-semibold text-foreground">"{selectedSub.name}"</span>? Isso removerá esta transação e todas as futuras ocorrências.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-[13px] font-semibold h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-white transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 text-[13px] font-semibold h-11 rounded-full bg-red-500 text-white transition-opacity disabled:opacity-50"
                >
                  {deleting ? "Removendo..." : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

AssinaturasCard.displayName = "AssinaturasCard";
export default AssinaturasCard;
