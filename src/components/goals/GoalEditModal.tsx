import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target, Camera, Image } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGoal, type Goal } from "@/services/goalService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { currencySymbol } from "@/lib/currency";
interface GoalEditModalProps {
  open: boolean;
  onClose: () => void;
  goal: Goal;
  onUpdated: () => void;
}

const GoalEditModal = ({ open, onClose, goal, onUpdated }: GoalEditModalProps) => {
  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(String(goal.target_amount));
  const [monthlyContribution, setMonthlyContribution] = useState(
    goal.monthly_contribution ? String(goal.monthly_contribution) : ""
  );
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [coverPreview, setCoverPreview] = useState(goal.cover_image ?? "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `goals/${goal.id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setCoverPreview(urlData.publicUrl);
    } catch {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !targetAmount) return;
    setSubmitting(true);
    try {
      await updateGoal(goal.id, {
        name: name.trim(),
        target_amount: parseFloat(targetAmount),
        monthly_contribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
        deadline: deadline || null,
        cover_image: coverPreview || null,
      });
      toast.success("Meta atualizada! ✅");
      onUpdated();
      onClose();
    } catch {
      toast.error("Erro ao atualizar meta");
    } finally {
      setSubmitting(false);
    }
  };

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
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border/20 shadow-2xl p-5 pb-24 sm:pb-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Editar Meta</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Cover image */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Foto de capa</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="relative h-24 rounded-xl overflow-hidden bg-muted/10 border border-border/15 cursor-pointer hover:border-primary/30 transition-colors group"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Nome da meta</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Viagem, Reserva de emergência..."
                  className="bg-muted/10 border-border/15"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Valor alvo ({currencySymbol()})</Label>
                <Input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="10000"
                  min="1"
                  step="0.01"
                  className="bg-muted/10 border-border/15"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Aporte mensal ({currencySymbol()})</Label>
                <Input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  placeholder="500"
                  min="0"
                  step="0.01"
                  className="bg-muted/10 border-border/15"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Prazo</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="bg-muted/10 border-border/15"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!name.trim() || !targetAmount || submitting}
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary/15 border border-primary/20 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Salvando..." : "Salvar alterações"}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoalEditModal;
