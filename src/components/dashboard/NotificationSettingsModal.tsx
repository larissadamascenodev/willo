import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, CalendarClock, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateSettings, updateSettings, type NotificationSettings } from "@/services/notificationService";
import BottomSheet from "@/components/shared/BottomSheet";
import { SheetAction } from "@/components/wallet/sheetParts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PERIOD_OPTIONS = [
  { value: 0, label: "No dia" },
  { value: 1, label: "1 dia antes" },
  { value: 3, label: "3 dias antes" },
] as const;

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-willo-green" : "bg-white/15")}
    >
      <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow" animate={{ left: on ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
    </button>
  );
}

/** "Lembretes e alertas": which reminders the app sends, as a bottom sheet. */
export default function NotificationSettingsModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    getOrCreateSettings(user.id).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [open, user]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings.id, {
        bill_due_reminder: settings.bill_due_reminder,
        bill_due_days_before: settings.bill_due_days_before,
        invoice_reminder: settings.bill_due_reminder,
        goal_reminder: settings.goal_reminder,
        challenge_reminder: settings.challenge_reminder,
        category_limit_alert: settings.category_limit_alert,
        low_balance_alert: false,
        low_balance_threshold: settings.low_balance_threshold,
        weekly_summary: false,
      });
      toast.success("Lembretes salvos");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof NotificationSettings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const items = settings
    ? [
        { key: "bill_due_reminder" as const, icon: CalendarClock, label: "Contas e faturas a vencer", sub: "Antes de pagar juros" },
        { key: "goal_reminder" as const, icon: Target, label: "Metas", sub: "Quando o prazo se aproxima" },
        { key: "category_limit_alert" as const, icon: BarChart3, label: "Limite de categoria", sub: "Quando o gasto chega perto do limite" },
      ]
    : [];

  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      footer={<SheetAction onClick={handleSave} disabled={loading || !settings} loading={saving} loadingLabel="Salvando…">Salvar</SheetAction>}
    >
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold tracking-tight text-white">Lembretes e alertas</p>
        <p className="text-[14px] text-white/62">Escolha o que o Willo te avisa.</p>

        {loading || !settings ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/56" />
          </div>
        ) : (
          <div className="mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.12] willo-glass">
            {items.map(({ key, icon: Icon, label, sub }) => {
              const on = !!settings[key];
              return (
                <div key={key} className="px-4 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.06]">
                      <Icon className="h-[18px] w-[18px] text-white/80" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-white">{label}</span>
                      <span className="block truncate text-[12.5px] text-white/62">{sub}</span>
                    </span>
                    <Toggle on={on} onChange={() => toggle(key)} label={label} />
                  </div>
                  <AnimatePresence initial={false}>
                    {key === "bill_due_reminder" && on && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-white/[0.05] p-1">
                          {PERIOD_OPTIONS.map((opt) => {
                            const selected = settings.bill_due_days_before === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSettings({ ...settings, bill_due_days_before: opt.value })}
                                className={cn("h-9 rounded-full text-[12.5px] font-semibold transition-colors", selected ? "bg-white text-[#0B0B0B]" : "text-white/70")}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
