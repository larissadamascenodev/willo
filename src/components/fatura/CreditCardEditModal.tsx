import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CreditCard, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { currencySymbol } from "@/lib/currency";
interface Props {
  open: boolean;
  onClose: () => void;
  card: {
    id: string;
    name: string;
    closing_day: number;
    due_day: number;
    limit: number;
    color: string | null;
    last_four_digits: string | null;
  };
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function CreditCardEditModal({ open, onClose, card, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(card.name);
  const [closingDay, setClosingDay] = useState(String(card.closing_day));
  const [dueDay, setDueDay] = useState(String(card.due_day));
  const [limit, setLimit] = useState(String(card.limit));
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(card.name);
      setClosingDay(String(card.closing_day));
      setDueDay(String(card.due_day));
      setLimit(String(card.limit));
      setShowDeleteConfirm(false);
    }
  }, [open, card]);

  const handleSave = async () => {
    const parsedClosing = parseInt(closingDay);
    const parsedDue = parseInt(dueDay);
    const parsedLimit = parseFloat(limit.replace(/\./g, "").replace(",", ".")) || 0;

    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (parsedClosing < 1 || parsedClosing > 31) { toast.error("Dia de fechamento inválido"); return; }
    if (parsedDue < 1 || parsedDue > 31) { toast.error("Dia de vencimento inválido"); return; }

    // Validate limit decrease: new limit must be >= used_limit
    if (parsedLimit < card.limit) {
      // Fetch current used_limit
      const { data: cardData } = await supabase
        .from("credit_cards")
        .select("used_limit")
        .eq("id", card.id)
        .single();

      const usedLimit = (cardData as any)?.used_limit ?? 0;
      if (parsedLimit < usedLimit) {
        toast.error(
          `Não é possível diminuir o limite para ${currencySymbol()} ${parsedLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ` +
          `O limite utilizado atualmente é ${currencySymbol()} ${usedLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ` +
          `Pague as faturas em aberto para liberar limite antes de diminuí-lo.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("credit_cards")
        .update({
          name: name.trim(),
          closing_day: parsedClosing,
          due_day: parsedDue,
          limit: parsedLimit,
        } as any)
        .eq("id", card.id);

      if (error) throw error;

      const messages: string[] = ["Cartão atualizado!"];
      if (parsedClosing !== card.closing_day || parsedDue !== card.due_day) {
        messages.push("As mudanças nas datas valem a partir da próxima fatura.");
      }
      toast.success(messages.join(" "));
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar cartão");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete all invoice items, invoices, and transactions related to this card
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("id")
        .eq("credit_card_id", card.id) as any;

      if (invoicesData && invoicesData.length > 0) {
        const invoiceIds = invoicesData.map((i: any) => i.id);
        await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds) as any;
        await supabase.from("invoices").delete().eq("credit_card_id", card.id) as any;
      }

      // Delete transactions linked to this card
      await supabase.from("transactions").delete().eq("credit_card_id", card.id);

      // Delete the card itself
      const { error } = await supabase.from("credit_cards").delete().eq("id", card.id);
      if (error) throw error;

      toast.success("Cartão excluído com sucesso");
      onDeleted();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir cartão");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[72] flex items-center justify-center bg-black/66 p-4 backdrop-blur-[20px]"
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
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Editar Cartão</h3>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Nome do cartão</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Limit */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Limite</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currencySymbol()}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Closing day / Due day */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Dia fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Dia vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full h-11 rounded-xl bg-muted/20 border border-border/20 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                ⚠️ Alterações nas datas de fechamento e vencimento entram em vigor a partir da <span className="font-bold text-foreground">próxima fatura</span>.
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-11 px-3 rounded-xl text-xs font-bold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all flex items-center justify-center gap-1.5"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>

              {/* Delete confirmation */}
              <AnimatePresence>
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 space-y-2">
                      <p className="text-xs text-destructive font-bold">Tem certeza?</p>
                      <p className="text-[10px] text-muted-foreground">
                        Isso excluirá o cartão, todas as faturas e lançamentos associados. Esta ação não pode ser desfeita.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 h-9 rounded-lg text-[10px] font-bold border border-border/30 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 h-9 rounded-lg text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                        >
                          {deleting ? "Excluindo..." : "Confirmar exclusão"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
