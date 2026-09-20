import { memo, useMemo, useState, useRef, useEffect } from "react";
import { LayoutDashboard, ArrowLeftRight, Plus, BrainCircuit, User, Bell, Flame, Settings, LogOut, TrendingUp, TrendingDown, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import NotificationsPanel, { useNotifications } from "./NotificationsPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";

export const useGreeting = () => {
  return useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let g = "Bom dia";
    if (hour >= 12 && hour < 18) g = "Boa tarde";
    else if (hour >= 18) g = "Boa noite";
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return { greeting: g, dateStr: `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}` };
  }, []);
};

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Transações", icon: ArrowLeftRight, path: "/transacoes" },
  { label: "Nova transação", icon: Plus, path: "/nova-transacao", isAction: true },
  { label: "Raio-X", icon: BrainCircuit, path: "/bot-finance" },
  { label: "Perfil", icon: User, path: "/configuracoes" },
];

/** Routes that keep the app header; every other screen shows a back bar instead. */
// Home is left out: BalanceHeroCard draws its own top row there.
const MAIN_TABS = ["/transacoes", "/gestao", "/bot-finance"];

const DashboardHeader = memo(({ profile, streak = 0, streakDates = [] }: { profile?: { display_name: string | null; avatar_url?: string | null } | null; streak?: number; streakDates?: string[] }) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const initial = (profile?.display_name ?? user?.email ?? "U").charAt(0).toUpperCase();
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email ?? "";
  const plan = "Free";
  const [menuOpen, setMenuOpen] = useState(false);
  const [transacaoMenuOpen, setTransacaoMenuOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const transacaoRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { unreadCount, refresh: refreshNotifs } = useNotifications();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (transacaoRef.current && !transacaoRef.current.contains(e.target as Node)) setTransacaoMenuOpen(false);
      if (streakRef.current && !streakRef.current.contains(e.target as Node)) setStreakOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleTransacaoOption = (type: "receita" | "despesa" | "scanner") => {
    setTransacaoMenuOpen(false);
    if (type === "scanner") {
      window.dispatchEvent(new CustomEvent("open-scanner"));
    } else {
      window.dispatchEvent(new CustomEvent("open-nova-transacao-direct", { detail: { type } }));
    }
  };

  const handleOpenNotif = () => {
    setNotifOpen((v) => !v);
    setStreakOpen(false);
    setMenuOpen(false);
  };

  const handleCloseNotif = () => {
    setNotifOpen(false);
    refreshNotifs();
  };

  const streakMessage = streak >= 7
    ? "🏆 Incrível! Você está arrasando!"
    : streak >= 3
      ? "🔥 Mandando bem! Continue assim!"
      : streak >= 1
        ? "👋 Bom te ver de volta!"
        : "Acesse todo dia para manter sua sequência!";

  const formatStreakDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  };

  const BellButton = ({ size = "md" }: { size?: "sm" | "md" }) => (
    <button
      onClick={handleOpenNotif}
      className={cn(
        "relative flex items-center justify-center transition-colors",
        size === "sm"
          ? "w-7 h-7 rounded-full text-muted-foreground hover:text-foreground"
          : "w-8 h-8 rounded-xl bg-card/60 border border-border/15 text-muted-foreground hover:text-foreground hover:bg-card/80"
      )}
    >
      <Bell className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {unreadCount > 0 && (
        <span className={cn(
          "absolute flex items-center justify-center rounded-full font-bold",
          size === "sm"
            ? "-top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[9px] bg-primary/20 text-primary ring-2 ring-background/80 backdrop-blur-sm"
            : "-top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 text-[10px] bg-primary/20 text-primary ring-2 ring-background/80 backdrop-blur-sm"
        )}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  const renderStreakPopover = () => (
    <AnimatePresence>
      {streakOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="absolute z-50 w-64 bg-card border border-border/30 rounded-2xl shadow-xl p-4 space-y-3 right-0 top-full mt-2"
        >
          <div className="text-center space-y-1">
            <div className="text-3xl">{streak >= 7 ? "🏆" : "🔥"}</div>
            <p className="text-lg font-bold text-foreground">{streak} {streak === 1 ? "dia" : "dias"}</p>
            <p className="text-xs text-muted-foreground">{streakMessage}</p>
          </div>
          {streakDates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sequência</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {streakDates.slice(0, 7).map((date, i) => (
                  <div key={date} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-warning/5 border border-warning/10">
                    <Flame className="w-3 h-3 text-warning flex-shrink-0" />
                    <span className="text-foreground capitalize">{formatStreakDate(date)}</span>
                    {i === 0 && (
                      <span className="ml-auto text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Hoje</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {streak > 0 && streak < 7 && (
            <p className="text-[10px] text-center text-muted-foreground">
              Faltam <span className="font-bold text-warning">{7 - streak}</span> dias para o troféu 🏆
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Desktop backdrop for transaction menu */}
      <AnimatePresence>
        {transacaoMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden md:block fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setTransacaoMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop Top Bar */}
      <div className="hidden md:flex items-center justify-between sticky top-0 z-50 bg-background/70 backdrop-blur-2xl px-6 py-3 border-b border-border/10 -mx-4 md:-mx-6 mb-4">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer" onClick={() => navigate("/")}>
          <img src={wordmarkOnDark} alt="Willo" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Center: Floating nav pill */}
        <nav className="flex items-center gap-1 bg-card/80 backdrop-blur-xl border border-border/20 rounded-2xl px-1.5 py-1 shadow-lg shadow-black/10">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isAction = item.isAction;

            if (isAction) {
              return (
                <div key={item.label} className="relative" ref={transacaoRef}>
                  <button
                    onClick={() => setTransacaoMenuOpen((v) => !v)}
                    className="relative -my-1 mx-1 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25"
                    style={{
                      boxShadow: "0 2px 12px -2px hsl(150 100% 45% / 0.3)",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>

                  <AnimatePresence>
                    {transacaoMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-50 p-1.5 rounded-xl bg-card/95 backdrop-blur-2xl border border-border/15 shadow-2xl shadow-black/40 flex flex-row text-left my-px py-[6px] gap-[6px]"
                      >
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card/95 border-l border-t border-border/15" />
                        <button onClick={() => handleTransacaoOption("receita")} className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors">
                          <TrendingUp className="w-3.5 h-3.5 text-willo-green" />
                          <span className="text-[11px] font-medium text-foreground whitespace-nowrap">Receita</span>
                        </button>
                        <button onClick={() => handleTransacaoOption("despesa")} className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-destructive/10 transition-colors">
                          <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                          <span className="text-[11px] font-medium text-foreground whitespace-nowrap">Despesa</span>
                        </button>
                        <button onClick={() => handleTransacaoOption("scanner")} className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors">
                          <Camera className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[11px] font-medium text-foreground whitespace-nowrap">Scanner</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Streak → Bell → Profile */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative" ref={streakRef}>
            <button
              onClick={() => setStreakOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 hover:border-warning/40 transition-all"
            >
              <Flame className="w-4 h-4 text-warning" />
              <span className="text-sm font-bold text-warning">{streak}</span>
            </button>
            {renderStreakPopover()}
          </div>
          <div className="relative" ref={notifRef}>
            <BellButton />
            {!isMobile && <NotificationsPanel open={notifOpen} onClose={handleCloseNotif} />}
          </div>
          {/* Profile chip + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 bg-card/80 border border-border/20 rounded-2xl px-2.5 py-1.5 hover:bg-card transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                {initial}
              </div>
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground truncate max-w-[100px]">{displayName}</span>
                  <span className="px-1.5 py-px rounded bg-primary/15 text-primary text-[8px] font-bold uppercase tracking-wide shrink-0">{plan}</span>
                </div>
                <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{email}</span>
              </div>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-card border border-border/20 rounded-xl shadow-xl shadow-black/20 overflow-hidden z-50"
                >
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/configuracoes"); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-foreground hover:bg-muted/30 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                    Configurações
                  </button>
                  <div className="h-px bg-border/10" />
                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair da conta
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Header — same top row as BalanceHeroCard on the home route
          (which renders its own), sitting directly on the page background. */}
      <header
        className={cn("md:hidden -mx-4 px-4 pb-4", !MAIN_TABS.includes(location.pathname) && "hidden")}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
      >
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} aria-label="Início">
            <img src={wordmarkOnDark} alt="Willo" className="h-5 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleOpenNotif}
                className="relative w-9 h-9 flex items-center justify-center text-white/85 hover:text-white transition-colors"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-willo-green ring-2 ring-[#0B0B0B]" />}
              </button>
              {isMobile && <NotificationsPanel open={notifOpen} onClose={handleCloseNotif} />}
            </div>
            <button
              onClick={() => navigate("/configuracoes")}
              className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[13px] font-bold text-white active:scale-95 transition-transform"
              aria-label="Perfil"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
});

DashboardHeader.displayName = "DashboardHeader";
export default DashboardHeader;
