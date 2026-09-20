import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CreditCard, CheckCircle2, Banknote, CalendarClock, DollarSign, Percent } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, type AccountInfo } from "@/pages/FaturaCartao";
import { cn } from "@/lib/utils";

import { currencySymbol } from "@/lib/currency";
export type PaymentMode = "total" | "minimo" | "parcelado";

export interface PaymentDetails {
  mode: PaymentMode;
  amountPaid?: number;
  installments?: number;
  entryAmount?: number;
  installmentAmount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  total: number;
  accounts: AccountInfo[];
  payAccountId: string;
  setPayAccountId: (id: string) => void;
  onConfirm: (details: PaymentDetails) => void;
  paying: boolean;
}

const modeOptions: { value: PaymentMode; label: string; icon: React.ReactNode }[] = [
  { value: "total", label: "Valor Total", icon: <CheckCircle2 className="w-4 h-4" /> },
  { value: "minimo", label: "Pagar Parcial", icon: <Banknote className="w-4 h-4" /> },
  { value: "parcelado", label: "Parcelado", icon: <CalendarClock className="w-4 h-4" /> },
];

function parseAmount(val: string): number {
  // Handle Brazilian format: "1.234,56" → "1234.56"
  const cleaned = val.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export default function InvoicePayModal({
  open, onClose, total, accounts, payAccountId, setPayAccountId, onConfirm, paying,
}: Props) {
  const [mode, setMode] = useState<PaymentMode>("total");
  const [minAmount, setMinAmount] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [installments, setInstallments] = useState("2");
  const [installmentAmount, setInstallmentAmount] = useState("");

  useEffect(() => {
    if (open) {
      setMode("total");
      setMinAmount("");
      setEntryAmount("");
      setInstallments("2");
      setInstallmentAmount("");
    }
  }, [open]);

  const parsedMinAmount = parseAmount(minAmount);
  const parsedEntryAmount = parseAmount(entryAmount);
  const parsedInstallments = parseInt(installments) || 2;
  const parsedInstallmentAmount = parseAmount(installmentAmount);

  const remainder = mode === "minimo" ? Math.max(0, total - parsedMinAmount) : 0;

  // Parcelado: user defines entry + installment count + installment value
  // Interest = (entry + installments × installmentValue) - total
  const installmentCalc = useMemo(() => {
    if (mode !== "parcelado") return null;
    if (parsedInstallments < 2 || parsedInstallmentAmount <= 0) return null;
    const financedTotal = parsedInstallmentAmount * parsedInstallments;
    const totalPaid = parsedEntryAmount + financedTotal;
    const interest = Math.max(0, totalPaid - total);
    return {
      installmentValue: parsedInstallmentAmount,
      totalPaid,
      interest,
    };
  }, [mode, total, parsedEntryAmount, parsedInstallments, parsedInstallmentAmount]);

  const canConfirm = (() => {
    if (!payAccountId) return false;
    if (mode === "minimo") return parsedMinAmount > 0 && parsedMinAmount < total;
    if (mode === "parcelado") return parsedInstallments >= 2 && parsedInstallmentAmount > 0;
    return true;
  })();

  const handleConfirm = () => {
    if (mode === "total") {
      onConfirm({ mode: "total" });
    } else if (mode === "minimo") {
      onConfirm({ mode: "minimo", amountPaid: parsedMinAmount });
    } else {
      onConfirm({
        mode: "parcelado",
        entryAmount: parsedEntryAmount,
        installments: parsedInstallments,
        installmentAmount: parsedInstallmentAmount,
      });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-card border border-border/30 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                    style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.3))" }}
                  >
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Pagar Fatura</h3>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Amount */}
              <div className="text-center py-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Saldo em aberto</p>
                <p className="text-2xl font-extrabold text-primary tracking-tight">{formatCurrency(total)}</p>
              </div>

              {/* Account selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  Debitar da conta
                </label>
                <Select value={payAccountId} onValueChange={setPayAccountId}>
                  <SelectTrigger className="bg-muted/20 border-border/20 h-11 rounded-xl text-sm">
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(Number(acc.current_balance))})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment mode selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  Forma de pagamento
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {modeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center",
                        mode === opt.value
                          ? "bg-primary/15 border-primary/30 text-primary shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3)]"
                          : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20"
                      )}
                    >
                      {opt.icon}
                      <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic fields */}
              <AnimatePresence mode="wait">
                {mode === "minimo" && (
                  <motion.div
                    key="minimo"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Quanto deseja pagar?
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currencySymbol()}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                          placeholder="0,00"
                          className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    {parsedMinAmount > 0 && parsedMinAmount < total && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1"
                      >
                        <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Restante em aberto</p>
                        <p className="text-sm font-bold text-amber-400">{formatCurrency(remainder)}</p>
                        <p className="text-[9px] text-muted-foreground">
                          O valor restante continuará em aberto na fatura atual até o vencimento
                        </p>
                      </motion.div>
                    )}
                    {parsedMinAmount >= total && parsedMinAmount > 0 && (
                      <p className="text-[10px] text-destructive font-medium">
                        Valor deve ser menor que o total da fatura. Para pagar tudo, use "Valor Total".
                      </p>
                    )}
                  </motion.div>
                )}

                {mode === "parcelado" && (
                  <motion.div
                    key="parcelado"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {/* Entry amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Valor de entrada
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currencySymbol()}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entryAmount}
                          onChange={(e) => setEntryAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                          placeholder="0,00 (opcional)"
                          className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    {/* Number of installments */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Quantidade de parcelas
                      </label>
                      <Select value={installments} onValueChange={setInstallments}>
                        <SelectTrigger className="bg-muted/20 border-border/20 h-11 rounded-xl text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[70]">
                          {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x parcelas
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Installment value — user-defined */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1">
                        <Banknote className="w-3 h-3" /> Valor de cada parcela
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currencySymbol()}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={installmentAmount}
                          onChange={(e) => setInstallmentAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                          placeholder="0,00"
                          className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    {/* Calculation summary */}
                    {installmentCalc && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2"
                      >
                        {parsedEntryAmount > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase">Entrada</span>
                            <span className="text-sm font-bold text-foreground">{formatCurrency(parsedEntryAmount)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Parcelas</span>
                          <span className="text-sm font-bold text-foreground">
                            {parsedInstallments}x de {formatCurrency(installmentCalc.installmentValue)}
                          </span>
                        </div>
                        <div className="h-px bg-border/20" />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Total a pagar</span>
                          <span className="text-sm font-bold text-foreground">{formatCurrency(installmentCalc.totalPaid)}</span>
                        </div>
                        {installmentCalc.interest > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-destructive font-bold uppercase flex items-center gap-1">
                              <Percent className="w-3 h-3" /> Juros
                            </span>
                            <span className="text-sm font-bold text-destructive">
                              + {formatCurrency(installmentCalc.interest)}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl text-xs font-bold border border-border/30 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={paying || !canConfirm}
                  className={cn(
                    "flex-1 h-11 rounded-xl text-xs font-bold transition-all backdrop-blur-md flex items-center justify-center gap-1.5",
                    canConfirm
                      ? "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                      : "bg-muted/20 text-muted-foreground border border-border/10 cursor-not-allowed"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {paying ? "Processando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
