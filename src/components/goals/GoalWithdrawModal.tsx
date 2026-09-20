import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Calendar, ChevronDown, ArrowUpRight } from "lucide-react";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { currencySymbol, getCurrency } from "@/lib/currency";
interface Account {
  id: string;
  name: string;
  current_balance: number;
  color: string | null;
  type: string;
}

interface GoalWithdrawModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number; date: string; account_id?: string; destination?: string }) => void;
  goalName: string;
  maxAmount: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const GoalWithdrawModal = ({ open, onClose, onSubmit, goalName, maxAmount }: GoalWithdrawModalProps) => {
  const [amount, setAmount] = useState("");
  const [dateMode, setDateMode] = useState<"hoje" | "ontem" | "outros">("hoje");
  const [customDate, setCustomDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDateMode("hoje");
    setCustomDate("");
    (async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, name, current_balance, color, type")
        .eq("is_active", true)
        .not("type", "eq", "investment")
        .order("is_default", { ascending: false });
      const accs = (data ?? []) as Account[];
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
    })();
  }, [open]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const getDate = () => {
    if (dateMode === "hoje") return new Date().toISOString().split("T")[0];
    if (dateMode === "ontem") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    }
    return customDate || new Date().toISOString().split("T")[0];
  };

  const handleSubmit = async () => {
    const val = parseFloat(amount.replace(",", "."));
    if (!val || val <= 0 || val > maxAmount || !selectedAccountId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        amount: val,
        date: getDate(),
        account_id: selectedAccountId,
      });
      setAmount("");
      setDateMode("hoje");
      setCustomDate("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAmountChange = (raw: string) => {
    setAmount(raw.replace(/[^\d,\.]/g, ""));
  };

  const parsedAmount = parseFloat(amount.replace(",", ".")) || 0;
  const exceedsBalance = parsedAmount > maxAmount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border/20 shadow-2xl p-5 pb-24 sm:pb-5 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-destructive/15 border border-destructive/20 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Sacar</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Target className="w-3 h-3 text-primary" />
                    <span className="text-[11px] text-muted-foreground">{goalName}</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Available balance */}
            <div className="rounded-xl px-3 py-2.5 bg-muted/10 border border-border/15">
              <p className="text-[10px] text-muted-foreground">Disponível para saque</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{fmt(maxAmount)}</p>
            </div>

            {/* Account selector */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Enviar para</p>
              <div className="relative">
                <button
                  onClick={() => setShowAccountPicker(!showAccountPicker)}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 bg-muted/10 border border-border/15 hover:bg-muted/15 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: (selectedAccount?.color || "#8b5cf6") + "20" }}>
                      <Wallet className="w-3.5 h-3.5" style={{ color: selectedAccount?.color || "#8b5cf6" }} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">{selectedAccount?.name || "Selecione"}</p>
                      {selectedAccount && <p className="text-[10px] text-muted-foreground tabular-nums">Saldo: {fmt(selectedAccount.current_balance)}</p>}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showAccountPicker ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showAccountPicker && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute z-10 w-full mt-1 rounded-xl bg-card border border-border/20 shadow-xl overflow-hidden">
                      {accounts.map((acc) => (
                        <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setShowAccountPicker(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/10 transition-colors ${acc.id === selectedAccountId ? "bg-primary/5" : ""}`}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: (acc.color || "#8b5cf6") + "20" }}>
                            <Wallet className="w-3.5 h-3.5" style={{ color: acc.color || "#8b5cf6" }} />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-semibold text-foreground">{acc.name}</p>
                            <p className="text-[10px] text-muted-foreground tabular-nums">{fmt(acc.current_balance)}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Valor do saque</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">{currencySymbol()}</span>
                <input type="text" inputMode="decimal" value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0,00" className="bg-transparent text-3xl font-bold text-foreground outline-none w-full tabular-nums placeholder:text-muted-foreground/30" autoFocus />
              </div>
              {exceedsBalance && <p className="text-[10px] text-destructive mt-1 font-medium">Valor excede o saldo da meta</p>}
            </div>

            {/* Date selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
              <div className="flex items-center gap-1.5">
                {(["hoje", "ontem", "outros"] as const).map((mode) => (
                  <motion.button key={mode} whileTap={{ scale: 0.95 }} onClick={() => setDateMode(mode)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${dateMode === mode ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/10 border-border/15 text-muted-foreground hover:bg-muted/20"}`}>
                    {mode === "hoje" ? "Hoje" : mode === "ontem" ? "Ontem" : "Outros"}
                  </motion.button>
                ))}
              </div>
            </div>
            {dateMode === "outros" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="w-full bg-muted/10 border border-border/15 rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
              </motion.div>
            )}

            {/* Submit */}
            <motion.button whileTap={{ scale: 0.97 }} disabled={!amount || !selectedAccountId || submitting || exceedsBalance} onClick={handleSubmit} className="w-full py-3.5 rounded-xl text-sm font-bold bg-destructive/15 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Sacando..." : "Confirmar Saque"}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoalWithdrawModal;
