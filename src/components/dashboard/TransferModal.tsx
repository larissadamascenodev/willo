import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, X, CalendarDays, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";

import { currencySymbol, getCurrency } from "@/lib/currency";
interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatCurrencyDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

const TRANSFER_MESSAGES = [
  "Movendo dinheiro ou fugindo do limite? 😏",
  "Organizando as contas… agora sim 👀",
  "Dinheiro em trânsito! 🚀",
];

const INVESTMENT_MESSAGES = [
  "Agora sim, dinheiro trabalhando por você 💰",
  "Isso aqui é o começo do jogo virar 😎",
  "Investir é o melhor gasto que existe 🧠",
];

const TransferModal = ({ open, onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      getAccounts(true).then((accs) => {
        setAccounts(accs as unknown as Account[]);
      });
      setFromAccountId("");
      setToAccountId("");
      setAmountCents(0);
      setDate(new Date());
      setShowCalendar(false);
    }
  }, [open, user]);

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setAmountCents((prev) => Math.floor(prev / 10));
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setAmountCents((prev) => {
        const next = prev * 10 + parseInt(e.key);
        return next > 99999999 ? prev : next;
      });
    }
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const isInvestment = toAccount?.type === "investment";
  const realAmount = amountCents / 100;
  const insufficientBalance = fromAccount ? realAmount > Number(fromAccount.current_balance) : false;
  const sameAccount = fromAccountId && toAccountId && fromAccountId === toAccountId;

  const handleSubmit = async () => {
    if (!user) return;
    if (!fromAccountId || !toAccountId) {
      toast.error("Selecione as contas de origem e destino");
      return;
    }
    if (sameAccount) {
      toast.error("As contas devem ser diferentes");
      return;
    }
    if (amountCents === 0) {
      toast.error("Digite um valor");
      return;
    }
    if (insufficientBalance) {
      toast.error("Saldo insuficiente na conta de origem");
      return;
    }

    setSubmitting(true);
    try {
      const txType = isInvestment ? "investimento" : "transferencia";
      const dateStr = format(date, "yyyy-MM-dd");

      const { error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          name: isInvestment
            ? `Investimento: ${fromAccount?.name} → ${toAccount?.name}`
            : `Transferência: ${fromAccount?.name} → ${toAccount?.name}`,
          type: txType,
          amount: realAmount,
          category: isInvestment ? "Investimentos" : "Transferência",
          date: dateStr,
          status: "pago",
          account_id: fromAccountId,
          to_account_id: toAccountId,
          payment_method: "conta",
          recurrence_type: "unica",
        } as any);

      if (error) throw error;

      const messages = isInvestment ? INVESTMENT_MESSAGES : TRANSFER_MESSAGES;
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];

      toast.success(randomMsg, {
        description: `${currencySymbol()} ${formatCurrencyDisplay(amountCents)} ${isInvestment ? "investido" : "transferido"}`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao realizar transferência");
    } finally {
      setSubmitting(false);
    }
  };

  const availableToAccounts = accounts.filter((a) => a.id !== fromAccountId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full md:h-auto md:max-h-[92vh] max-w-md mx-0 md:mx-4 rounded-none md:rounded-2xl bg-card border-0 md:border md:border-border/20 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="relative flex items-center justify-center pt-5 pb-3 px-5">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                <span className="text-lg font-bold text-foreground">
                  Transferência
                </span>
              </div>
              <button
                onClick={onClose}
                className="absolute right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-20 md:pb-4">
              {/* Value display */}
              <div
                className="mx-5 mb-4 rounded-xl p-5 text-center cursor-text border border-sky-500/10 bg-sky-500/[0.04]"
                onClick={() => amountInputRef.current?.focus()}
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-xl font-bold text-sky-400">{currencySymbol()}</span>
                  <motion.span
                    key={amountCents}
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    className="font-display text-4xl font-bold tabular-nums tracking-tight text-foreground/80"
                  >
                    {formatCurrencyDisplay(amountCents)}
                  </motion.span>
                </div>
                <input
                  ref={amountInputRef}
                  className="sr-only"
                  onKeyDown={handleAmountKeyDown}
                  aria-label="Valor da transferência"
                  autoFocus
                />
              </div>

              <div className="px-5 space-y-4">
                {/* From account */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center text-[10px]">↑</div>
                    Conta de origem
                  </label>
                  <Select value={fromAccountId} onValueChange={setFromAccountId}>
                    <SelectTrigger className="bg-muted/30 border-border/20 h-11 rounded-xl">
                      <SelectValue placeholder="Selecionar conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{acc.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(Number(acc.current_balance))}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fromAccount && (
                    <p className="text-[10px] text-muted-foreground">
                      Saldo: {formatCurrency(Number(fromAccount.current_balance))}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <motion.div
                    animate={{ y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center"
                  >
                    <ArrowDown className="w-4 h-4 text-sky-400" />
                  </motion.div>
                </div>

                {/* To account */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px]">↓</div>
                    Conta de destino
                  </label>
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger className="bg-muted/30 border-border/20 h-11 rounded-xl">
                      <SelectValue placeholder="Selecionar destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <span>{acc.name}</span>
                            {acc.type === "investment" && (
                              <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">Investimento</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Validations */}
                {sameAccount && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    ⚠️ As contas de origem e destino devem ser diferentes
                  </p>
                )}
                {insufficientBalance && !sameAccount && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    ⚠️ Saldo insuficiente na conta de origem
                  </p>
                )}

                {/* Investment indicator */}
                {isInvestment && !sameAccount && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-amber-500/[0.08] border border-amber-500/20 p-3 text-center"
                  >
                    <p className="text-xs text-amber-400 font-medium">
                      💰 Será registrado como investimento
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      O valor permanece no seu patrimônio total
                    </p>
                  </motion.div>
                )}

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    Data
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm bg-muted/30 border border-border/20 text-foreground"
                  >
                    {format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </button>
                  <AnimatePresence>
                    {showCalendar && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={(d) => { if (d) { setDate(d); setShowCalendar(false); } }}
                          className="p-3 pointer-events-auto rounded-xl border border-border/20"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !fromAccountId || !toAccountId || amountCents === 0 || !!sameAccount || insufficientBalance}
                  className="w-full h-12 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-600 text-white"
                >
                  {submitting ? "Transferindo..." : isInvestment ? "Investir" : "Transferir"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TransferModal;
