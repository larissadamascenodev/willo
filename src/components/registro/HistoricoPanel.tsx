import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { getCurrency } from "@/lib/currency";
import { parseDateOnly } from "@/lib/dateOnly";

/**
 * What has been filed lately, newest first.
 *
 * It reads the transactions themselves rather than a log of this screen's own doings,
 * because the question behind "ver o histórico" is "did that go in?", and only the
 * table can answer it. An entry typed here and an entry typed in the full form are the
 * same thing once saved, so both show up.
 */

interface Row {
  id: string;
  name: string;
  type: string;
  amount: number;
  category: string;
  date: string;
  time: string | null;
  payment_method: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** "Hoje", "Ontem", or the date — people read recency, not calendars. */
function dayLabel(iso: string): string {
  const { year, month, day } = parseDateOnly(iso);
  const that = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return that.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export default function HistoricoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useScrollLock(open);
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let dead = false;
    setRows(null);

    supabase
      .from("transactions")
      .select("id, name, type, amount, category, date, time, payment_method")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { if (!dead) setRows((data as unknown as Row[]) ?? []); });

    return () => { dead = true; };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Grouped by day, in the order things were entered — which is the order this screen
  // is about. Sorting by the day itself looked tidier and was wrong: an instalment
  // plan carries dates a year out, so the newest-first calendar put next May above
  // what was typed a minute ago.
  //
  // A Map keeps insertion order, so each day appears once, where it first appeared.
  const byDay = new Map<string, Row[]>();
  for (const row of rows ?? []) {
    const list = byDay.get(row.date);
    if (list) list.push(row);
    else byDay.set(row.date, [row]);
  }
  const groups = [...byDay.entries()].map(([date, list]) => ({ label: dayLabel(date), rows: list }));

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="willo-aurora fixed inset-0 z-[135] flex flex-col"
        role="dialog"
        aria-label="Histórico"
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.02em] text-white">Histórico</h2>
            <p className="text-[12.5px] text-white/42">Os últimos lançamentos</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/15 backdrop-blur-md active:scale-95"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {rows === null && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          )}

          {rows?.length === 0 && (
            <p className="py-12 text-center text-[14px] text-white/45">
              Nada lançado ainda.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
                {group.label}
              </p>
              <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.045]">
                {group.rows.map((row, i) => (
                  <div
                    key={row.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold leading-tight text-white">{row.name}</p>
                      <p className="truncate text-[12px] leading-tight text-white/42">
                        {row.category}
                        {row.payment_method === "cartao" ? " · Crédito" : ""}
                        {row.time ? ` · ${row.time.slice(0, 5)}` : ""}
                      </p>
                    </div>
                    {/* A refund is stored as a negative expense, so the direction comes
                        from the signed value rather than from the type alone —
                        otherwise it printed its own minus on top of mine. */}
                    {(() => {
                      const signed = row.type === "receita" ? Number(row.amount) : -Number(row.amount);
                      return (
                        <p className={`shrink-0 text-[15px] font-bold tabular-nums ${
                          signed >= 0 ? "text-willo-green" : "text-white"
                        }`}>
                          {signed >= 0 ? "+" : "−"}{fmt(Math.abs(signed))}
                        </p>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
