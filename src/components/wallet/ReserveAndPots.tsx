import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, PiggyBank, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import GoalCreateModal from "@/components/goals/GoalCreateModal";
import { createGoal, RESERVE_NAME, isReserveGoal, type Goal } from "@/services/goalService";
import { useAuth } from "@/contexts/AuthContext";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });

export { RESERVE_NAME, isReserveGoal };

interface Props {
  goals: Goal[];
  /** Monthly essential spending, used to suggest a reserve target. */
  essentialMonthly?: number;
  onCreated: () => void;
}

/**
 * Reserve and pots, side by side and kept separate: a cofrinho is a goal like any
 * other and shows up in Metas too, while the reserve is its own reserved thing.
 * Both share the same modern creation sheet, just with a different starting preset.
 */
const ReserveAndPots = ({ goals, essentialMonthly = 0, onCreated }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reserve = goals.find(isReserveGoal) ?? null;
  const pots = goals.filter((g) => !isReserveGoal(g));
  const potsTotal = pots.reduce((s, g) => s + Number(g.current_amount), 0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<string | undefined>(undefined);

  const openCreate = (preset?: string) => {
    setCreatePreset(preset);
    setCreateOpen(true);
  };

  const handleCreate = async (data: { name: string; target_amount: number; monthly_contribution?: number | null; deadline?: string | null; cover_image?: string | null }) => {
    if (!user) return;
    try {
      const goal = await createGoal(data, user.id);
      toast.success(isReserveGoal(goal) ? "Reserva de emergência criada" : "Cofrinho criado! 🐷");
      setCreateOpen(false);
      onCreated();
      navigate(`/metas/${goal.id}`);
    } catch {
      toast.error("Não foi possível criar a meta");
    }
  };

  const reserveProgress = reserve && reserve.target_amount > 0 ? Number(reserve.current_amount) / reserve.target_amount : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {/* Emergency reserve */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => (reserve ? navigate(`/metas/${reserve.id}`) : openCreate("reserva"))}
          className="flex min-h-[148px] flex-col rounded-[22px] border border-white/[0.12] willo-glass p-4 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-willo-green/15">
              <ShieldCheck className="h-[18px] w-[18px] text-willo-green" />
            </span>
            {reserve ? <ChevronRight className="h-4 w-4 text-white/38" /> : <Plus className="h-4 w-4 text-white/56" />}
          </div>
          <p className="mt-auto text-[13px] text-white/66">Reserva de emergência</p>
          {reserve ? (
            <>
              <p className="truncate text-[20px] font-extrabold leading-tight tracking-tight text-white tabular-nums">
                {fmt(Number(reserve.current_amount))}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-willo-green" style={{ width: `${Math.min(reserveProgress, 1) * 100}%` }} />
              </div>
              <p className="mt-1.5 truncate text-[11px] text-white/56 tabular-nums">
                {Math.round(Math.min(reserveProgress, 1) * 100)}% de {fmt(reserve.target_amount)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[12.5px] leading-snug text-white/62">Guarde uma parte para imprevistos</p>
          )}
        </motion.button>

        {/* Pots */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => (pots.length > 0 ? navigate("/metas") : openCreate())}
          className="flex min-h-[148px] flex-col rounded-[22px] border border-white/[0.12] willo-glass p-4 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7DD3FC]/15">
              <PiggyBank className="h-[18px] w-[18px] text-[#7DD3FC]" />
            </span>
            {pots.length > 0 ? <ChevronRight className="h-4 w-4 text-white/38" /> : <Plus className="h-4 w-4 text-white/56" />}
          </div>
          <p className="mt-auto text-[13px] text-white/66">Cofrinhos</p>
          {pots.length > 0 ? (
            <>
              <p className="truncate text-[20px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{fmt(potsTotal)}</p>
              <p className="mt-2 truncate text-[11px] text-white/56">
                {pots.length} {pots.length === 1 ? "cofrinho" : "cofrinhos"} · {pots[0].name}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[12.5px] leading-snug text-white/62">Crie um cofrinho para cada objetivo</p>
          )}
        </motion.button>
      </div>

      <GoalCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        initialPresetId={createPreset}
        existingNames={goals.map((g) => g.name)}
      />
    </>
  );
};

export default ReserveAndPots;
