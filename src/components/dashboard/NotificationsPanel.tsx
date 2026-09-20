import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Bell, CheckCheck, AlertTriangle, Info, Target, CreditCard, Wallet, X, Check, ChevronLeft, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchNotifications,
  countUnread,
  markRelatedAsRead,
  markAllAsRead,
  generateNotifications,
  deleteNotification,
  type AppNotification,
} from "@/services/notificationService";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

const CATEGORY_CONFIG: Record<string, { icon: typeof Bell; className: string; bg: string }> = {
  vencimento: { icon: AlertTriangle, className: "text-amber-300", bg: "bg-amber-300/[0.12]" },
  fatura: { icon: CreditCard, className: "text-red-400", bg: "bg-red-400/[0.12]" },
  meta: { icon: Target, className: "text-willo-green", bg: "bg-willo-green/[0.12]" },
  saldo: { icon: Wallet, className: "text-orange-300", bg: "bg-orange-300/[0.12]" },
  geral: { icon: Info, className: "text-white/80", bg: "bg-white/[0.08]" },
};

const NOTIFICATION_LIMIT = 30;
const notificationCache = new Map<string, AppNotification[]>();
const notificationRequests = new Map<string, Promise<AppNotification[]>>();

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

function groupLabel(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(dateStr);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return "Esta semana";
  return "Anteriores";
}

// Collapses repeated alerts about the same item (older duplicates stored before
// generation was deduplicated), keeping the newest one.
function dedupeNotifications(items: AppNotification[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.related_id) return true;
    const key = `${item.category}:${item.related_id}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getUnreadTotal(items: AppNotification[]) {
  return items.filter((item) => !item.is_read).length;
}

function updateNotificationCache(userId: string, items: AppNotification[]) {
  notificationCache.set(userId, items);
}

function clearNotificationCache(userId: string) {
  notificationCache.delete(userId);
  notificationRequests.delete(userId);
}

async function ensureNotificationsLoaded(userId: string, force = false) {
  if (!force) {
    const cached = notificationCache.get(userId);
    if (cached) return cached;
  }

  const inFlight = notificationRequests.get(userId);
  if (inFlight) return inFlight;

  const request = fetchNotifications(userId, NOTIFICATION_LIMIT)
    .then(dedupeNotifications)
    .then((data) => {
      updateNotificationCache(userId, data);
      return data;
    })
    .finally(() => {
      notificationRequests.delete(userId);
    });

  notificationRequests.set(userId, request);
  return request;
}

export function useNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [generated, setGenerated] = useState(false);

  const refresh = useCallback(async (force = false) => {
    if (!user) return;

    if (!force) {
      const cached = notificationCache.get(user.id);
      if (cached) {
        setUnreadCount(getUnreadTotal(cached));
        return;
      }
    }

    const count = await countUnread(user.id);
    setUnreadCount(count);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGenerated(false);
      setUnreadCount(0);
      return;
    }

    setGenerated(false);

    const cached = notificationCache.get(user.id);
    if (cached) {
      setUnreadCount(getUnreadTotal(cached));
    }

    void ensureNotificationsLoaded(user.id)
      .then((data) => setUnreadCount(getUnreadTotal(data)))
      .catch(() => {
        void refresh(true);
      });
  }, [user, refresh]);

  useEffect(() => {
    if (!user || generated) return;

    setGenerated(true);
    void generateNotifications(user.id)
      .then(async () => {
        clearNotificationCache(user.id);
        const data = await ensureNotificationsLoaded(user.id, true);
        setUnreadCount(getUnreadTotal(data));
      })
      .catch(() => {
        void refresh(true);
      });
  }, [user, generated, refresh]);

  return { unreadCount, refresh };
}

function NotificationRow({
  notification: n,
  isLast,
  onMarkRead,
  onDelete,
}: {
  notification: AppNotification;
  isLast: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const config = CATEGORY_CONFIG[n.category] ?? CATEGORY_CONFIG.geral;
  const Icon = config.icon;
  const canMarkRead = !n.is_read;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Right → left deletes; left → right marks as read
    if (info.offset.x < -70) onDelete(n.id);
    else if (info.offset.x > 70 && canMarkRead) onMarkRead(n.id);
  };

  return (
    <div className="relative overflow-hidden">
      {/* iOS-style swipe actions revealed underneath — drag right to mark as read, left to delete */}
      {canMarkRead && (
        <div className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-0.5 text-[#0B0B0B]">
            <Check className="h-4 w-4" strokeWidth={3} />
            <span className="text-[10px] font-bold">Lida</span>
          </div>
        </div>
      )}
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-[#F87171]">
        <div className="flex flex-col items-center gap-0.5 text-white">
          <Trash2 className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-[10px] font-bold">Excluir</span>
        </div>
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -96, right: canMarkRead ? 96 : 0 }}
        dragElastic={0.1}
        dragSnapToOrigin
        transition={{ type: "spring", stiffness: 420, damping: 42, mass: 0.6 }}
        onDragEnd={handleDragEnd}
        onClick={() => canMarkRead && onMarkRead(n.id)}
        className="relative flex select-none items-start gap-3 bg-[#141414] pl-3 pr-4 pt-3.5"
      >
        <span className={cn("mt-4 h-2 w-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-willo-green")} />
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", config.bg)}>
          <Icon className={cn("h-[18px] w-[18px]", config.className)} strokeWidth={2.25} />
        </div>
        <div className={cn("min-w-0 flex-1 pb-3.5", !isLast && "border-b border-white/[0.06]")}>
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("truncate text-[15px] font-semibold leading-snug tracking-tight", n.is_read ? "text-white/55" : "text-white")}>
              {n.title}
            </p>
            <span className="shrink-0 text-[12px] text-white/35 tabular-nums">{timeAgo(n.created_at)}</span>
          </div>
          <p className={cn("mt-0.5 line-clamp-2 text-[13px] leading-snug", n.is_read ? "text-white/35" : "text-white/60")}>
            {n.message}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

type Filter = "todas" | "nao-lidas";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "nao-lidas", label: "Não lidas" },
];

function NotificationContent({
  notifications,
  loading,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onDelete,
  onClose,
  variant,
}: {
  notifications: AppNotification[];
  loading: boolean;
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  variant: "screen" | "dialog";
}) {
  const [filter, setFilter] = useState<Filter>("todas");
  const visible = filter === "todas" ? notifications : notifications.filter((n) => !n.is_read);
  const isScreen = variant === "screen";

  const groups = visible.reduce<{ label: string; items: AppNotification[] }[]>((acc, n) => {
    const label = groupLabel(n.created_at);
    const group = acc.find((g) => g.label === label);
    if (group) group.items.push(n);
    else acc.push({ label, items: [n] });
    return acc;
  }, []);

  return (
    <div className={cn("flex flex-col", isScreen ? "h-full" : "max-h-[75vh]")}>
      {/* Nav bar */}
      <div
        className="shrink-0 px-4"
        style={{ paddingTop: isScreen ? "calc(env(safe-area-inset-top, 0px) + 10px)" : 16 }}
      >
        <div className="flex h-10 items-center justify-between">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white transition-transform active:scale-95"
            aria-label="Fechar"
          >
            {isScreen ? <ChevronLeft className="-ml-0.5 h-5 w-5" /> : <X className="h-4 w-4" />}
          </button>
          <button
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13px] font-semibold text-white transition-opacity disabled:opacity-35"
          >
            <CheckCheck className="h-4 w-4" />
            Ler todas
          </button>
        </div>

        {/* Large title */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <h1 className="text-[32px] font-extrabold leading-none tracking-tight text-white">Notificações</h1>
          {unreadCount > 0 && (
            <span className="mb-1 shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-[#0B0B0B]">
              {unreadCount} {unreadCount === 1 ? "nova" : "novas"}
            </span>
          )}
        </div>

        {/* Segmented control */}
        <div className="mt-4 grid grid-cols-2 rounded-full bg-white/[0.07] p-1">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} className="relative h-9 rounded-full text-[13px] font-semibold">
              {filter === key && (
                <motion.span
                  layoutId={`notif-seg-${variant}`}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_4px_14px_-6px_rgba(255,255,255,0.4)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={cn("relative z-10 transition-colors", filter === key ? "text-[#0B0B0B]" : "text-white/55")}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div
        className="mt-2 flex-1 overflow-y-auto overscroll-contain px-4"
        style={{ paddingBottom: isScreen ? "calc(env(safe-area-inset-bottom, 0px) + 24px)" : 20 }}
      >
        {loading && notifications.length === 0 ? (
          <div className="space-y-2 pt-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-[22px] bg-white/[0.05]" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06]">
              <Bell className="h-8 w-8 text-white/40" />
            </div>
            <p className="mt-5 text-[18px] font-bold text-white">Tudo em dia</p>
            <p className="mt-1 text-[14px] text-white/45">
              {filter === "nao-lidas" ? "Você leu todas as suas notificações." : "Nenhuma notificação por aqui ainda."}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="pt-5">
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/40">{group.label}</h2>
              <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#141414]">
                <AnimatePresence initial={false}>
                  {group.items.map((n, i) => (
                    <motion.div key={n.id} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                      <NotificationRow notification={n} isLast={i === group.items.length - 1} onMarkRead={onMarkRead} onDelete={onDelete} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))
        )}

        {groups.length > 0 && (
          <p className="select-none pt-5 text-center text-[12px] text-white/30">
            {unreadCount > 0 ? "Deslize para a direita para marcar como lida, ou para a esquerda para excluir" : "Deslize para a esquerda para excluir"}
          </p>
        )}
      </div>
    </div>
  );
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!user) return;

    const cached = notificationCache.get(user.id);
    if (cached) {
      setNotifications(cached);
      setLoading(false);
      if (!force) return;
    } else {
      setLoading(true);
    }

    try {
      const data = await ensureNotificationsLoaded(user.id, force);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const cached = notificationCache.get(user.id);
    if (cached) {
      setNotifications(cached);
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    void load(true);
  }, [open, load, user]);

  // Lock page scroll behind the full-screen mobile view
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const applyUpdate = (next: AppNotification[]) => {
    setNotifications(next);
    if (user) updateNotificationCache(user.id, next);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    applyUpdate(notifications.map((n) => ({ ...n, is_read: true })));
    await markAllAsRead(user.id);
  };

  const handleMarkRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!user || !target) return;
    applyUpdate(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markRelatedAsRead(user.id, target);
  };

  const handleDelete = async (id: string) => {
    applyUpdate(notifications.filter((n) => n.id !== id));
    await deleteNotification(id);
  };

  const contentProps = {
    notifications,
    loading,
    unreadCount: getUnreadTotal(notifications),
    onMarkAllRead: handleMarkAllRead,
    onMarkRead: handleMarkRead,
    onDelete: handleDelete,
    onClose,
  };

  if (isMobile) {
    // Full-screen iOS push-style view sliding in from the right
    const screen = (
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-screen"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 320 }}
            className="willo-bg fixed inset-0 z-[9999] shadow-[-20px_0_60px_rgba(0,0,0,0.6)]"
          >
            <NotificationContent {...contentProps} variant="screen" />
          </motion.div>
        )}
      </AnimatePresence>
    );

    return typeof document !== "undefined" ? createPortal(screen, document.body) : null;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-[28px] border-white/[0.08] bg-[#0E0E0E]/95 p-0 backdrop-blur-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Notificações</DialogTitle>
        <DialogDescription className="sr-only">Lista das suas notificações recentes.</DialogDescription>
        <NotificationContent {...contentProps} variant="dialog" />
      </DialogContent>
    </Dialog>
  );
}
