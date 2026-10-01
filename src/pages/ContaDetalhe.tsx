import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Landmark, Banknote, Vault, Pencil, Trash2, X, TrendingUp, TrendingDown, ChevronRight, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { getAccounts, getTransactions, updateAccount, deleteAccount } from "@/services/transactionService";
import { cn } from "@/lib/utils";

import { getCurrency } from "@/lib/currency";
interface Account {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  current_balance: number;
  initial_balance: number;
  color: string | null;
}

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: string;
  status: string;
  account_id: string | null;
}

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: typeof Landmark }> = {
  cash: { label: "Dinheiro", icon: Banknote },
  checking: { label: "Conta corrente", icon: Landmark },
  savings: { label: "Poupança", icon: Vault },
};

const COLOR_OPTIONS = [
  { value: "violet", label: "Roxo", accent: "bg-violet-500" },
  { value: "emerald", label: "Verde", accent: "bg-emerald-500" },
  { value: "sky", label: "Azul", accent: "bg-sky-500" },
  { value: "amber", label: "Laranja", accent: "bg-amber-500" },
  { value: "rose", label: "Rosa", accent: "bg-rose-500" },
  { value: "cyan", label: "Ciano", accent: "bg-cyan-500" },
  { value: "fuchsia", label: "Fúcsia", accent: "bg-fuchsia-500" },
  { value: "lime", label: "Lima", accent: "bg-lime-500" },
];

const ACCENT_MAP: Record<string, { iconBg: string; dot: string }> = {
  violet: { iconBg: "bg-violet-500/15", dot: "bg-violet-400" },
  emerald: { iconBg: "bg-emerald-500/15", dot: "bg-emerald-400" },
  sky: { iconBg: "bg-sky-500/15", dot: "bg-sky-400" },
  amber: { iconBg: "bg-amber-500/15", dot: "bg-amber-400" },
  rose: { iconBg: "bg-rose-500/15", dot: "bg-rose-400" },
  cyan: { iconBg: "bg-cyan-500/15", dot: "bg-cyan-400" },
  fuchsia: { iconBg: "bg-fuchsia-500/15", dot: "bg-fuchsia-400" },
  lime: { iconBg: "bg-lime-500/15", dot: "bg-lime-400" },
};

function getAccent(color: string | null) {
  return ACCENT_MAP[color ?? "violet"] ?? ACCENT_MAP.violet;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ContaDetalhe = () => {
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>("checking");
  const [editColor, setEditColor] = useState("violet");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user || !accountId) return;
    const load = async () => {
      setLoading(true);
      try {
        const accs = await getAccounts();
        const acc = (accs as unknown as Account[]).find((a) => a.id === accountId);
        if (!acc) {
          toast.error("Conta não encontrada");
          navigate("/gestao");
          return;
        }
        setAccount(acc);
        setEditName(acc.name);
        setEditType(acc.type);
        setEditColor(acc.color || "violet");

        const txs = await getTransactions({ month: selectedMonth, year: selectedYear });
        setTransactions((txs as unknown as Transaction[]).filter((t) => t.account_id === accountId));
      } catch {
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, accountId, selectedMonth, selectedYear]);

  const handleSaveEdit = async () => {
    if (!accountId || !editName.trim()) return;
    try {
      const updated = await updateAccount(accountId, {
        name: editName.trim(),
        type: editType,
        color: editColor,
      });
      setAccount((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      toast.success("Conta atualizada!");
    } catch {
      toast.error("Erro ao atualizar conta");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!accountId) return;
    try {
      await deleteAccount(accountId);
      toast.success("Conta excluída!");
      navigate("/gestao");
    } catch {
      toast.error("Erro ao excluir conta");
    }
  };

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "despesa" && t.status === "pago")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }));
  }, [transactions]);

  const totalDespesas = categoryData.reduce((s, c) => s + c.amount, 0);
  const totalReceitas = transactions
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((s, t) => s + Number(t.amount), 0);

  if (loading) {
    return (
      <div className="pt-2 pb-8 space-y-4">
        <div className="h-40 rounded-2xl bg-card animate-pulse" />
        <div className="h-24 rounded-2xl bg-card animate-pulse" />
      </div>
    );
  }

  if (!account) return null;

  const typeInfo = ACCOUNT_TYPE_LABELS[account.type] ?? ACCOUNT_TYPE_LABELS.checking;
  const Icon = typeInfo.icon;
  const accent = getAccent(account.color);
  const balance = Number(account.current_balance);

  return (
    <div className="pt-2 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/gestao")}
          className="-ml-2 flex h-9 items-center gap-0.5 text-sm text-white/82 hover:text-white active:opacity-60 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-primary" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      </div>

      {/* ===== Account Card ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-border/10"
        style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
      >
        <div className="p-5 space-y-4">
          {/* Account info row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", accent.iconBg)}>
                <Icon className={cn("w-4 h-4", accent.dot.replace("bg-", "text-"))} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">{account.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{typeInfo.label}</p>
              </div>
            </div>
            {account.is_default && (
              <span className="text-[8px] bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider">
                Principal
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/10" />

          {/* Balance */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", balance >= 0 ? "bg-willo-green" : "bg-destructive")} />
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Saldo disponível</p>
            </div>
            <p className={cn("text-3xl font-extrabold tabular-nums tracking-tight", balance >= 0 ? "text-foreground" : "text-destructive")}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ===== Resumo do mês ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-3"
      >
        <h2 className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium px-1">
          Resumo · {MONTH_NAMES[selectedMonth]} {selectedYear}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl border border-border/10 p-4"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                <ArrowDownLeft className="w-3 h-3 text-primary" />
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Receitas</span>
            </div>
            <p className="text-lg font-extrabold text-willo-green tabular-nums">{formatCurrency(totalReceitas)}</p>
          </div>
          <div
            className="rounded-2xl border border-border/10 p-4"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-destructive/15 flex items-center justify-center">
                <ArrowUpRight className="w-3 h-3 text-destructive" />
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Despesas</span>
            </div>
            <p className="text-lg font-extrabold text-destructive tabular-nums">{formatCurrency(totalDespesas)}</p>
          </div>
        </div>
      </motion.div>

      {/* ===== Gastos por Categoria ===== */}
      {categoryData.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium px-1 mb-3">
            Gastos por categoria
          </h2>
          <div
            className="rounded-2xl border border-border/10 overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
          >
            {categoryData.map((cat, idx) => {
              const pct = totalDespesas > 0 ? (cat.amount / totalDespesas) * 100 : 0;
              return (
                <div
                  key={cat.name}
                  className={cn("p-4", idx < categoryData.length - 1 && "border-b border-border/10")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">{cat.name}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 }}
                      className="h-full rounded-full bg-primary/40"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(0)}% do total</p>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ===== Transações ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium px-1 mb-3">
          Transações
        </h2>
        {transactions.length === 0 ? (
          <div
            className="rounded-2xl border border-border/10 p-8 text-center"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
          >
            <p className="text-sm text-muted-foreground">Nenhuma transação neste mês</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border border-border/10 overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
          >
            {transactions.map((tx, idx) => (
              <div
                key={tx.id}
                className={cn(
                  "flex items-center gap-3 p-4",
                  idx < transactions.length - 1 && "border-b border-border/10"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  tx.type === "receita" ? "bg-primary/15" : "bg-destructive/15"
                )}>
                  {tx.type === "receita"
                    ? <ArrowDownLeft className="w-4 h-4 text-primary" />
                    : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{tx.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {tx.category} · {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className={cn("text-sm font-bold tabular-nums", tx.type === "receita" ? "text-primary" : "text-destructive")}>
                  {tx.type === "receita" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Edit modal */}
      {editing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border/40 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-foreground">Editar Conta</p>
              <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <Input
              placeholder="Nome da conta"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-muted/30 border-border/20 h-11 rounded-xl"
            />
            <Select value={editType} onValueChange={setEditType}>
              <SelectTrigger className="bg-muted/30 border-border/20 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Conta Corrente</SelectItem>
                <SelectItem value="savings">Poupança</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditColor(c.value)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      c.accent,
                      editColor === c.value
                        ? "ring-2 ring-white ring-offset-2 ring-offset-card scale-110"
                        : "opacity-60 hover:opacity-100"
                    )}
                  />
                ))}
              </div>
            </div>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim()}
              className="w-full h-11 rounded-xl bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 font-bold"
            >
              Salvar
            </Button>
          </motion.div>
        </motion.div>
      )}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta? As transações associadas não serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContaDetalhe;
