import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, PiggyBank, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import GoalCreateModal from "@/components/goals/GoalCreateModal";
import { createGoal, RESERVE_NAME, isReserveGoal, type Goal } from "@/services/goalService";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrency } from "@/lib/currency";
import { shade } from "@/lib/tone";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });

export { RESERVE_NAME, isReserveGoal };

const RESERVE_HEX = "#C8F36D";
const POTS_HEX = "#7DD3FC";

interface Props {
  goals: Goal[];
  /** Monthly essential spending, used to suggest a reserve target. */
  essentialMonthly?: number;
  onCreated: () => void;
}

/** A line, in the shape the accounts above it use. */
function SavedRow({ hex, icon: Icon, title, subtitle, amount, progress, empty, index, onOpen }: {
  hex: string;
  icon: typeof ShieldCheck;
  title: string;
  subtitle: string;
  amount: number | null;
  /** 0–1, when the thing being saved towards has a target. */
  progress?: number;
  empty: boolean;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.05, duration: 0.35 }}
      onClick={onOpen}
      className="w-full px-1 py-4 text-left transition-opacity active:opacity-60"
    >
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
          style={{
            background: `linear-gradient(145deg, ${shade(hex, 0.18)} 0%, ${hex} 58%, ${shade(hex, -0.26)} 100%)`,
            boxShadow: `0 10px 22px -12px ${hex}, inset 0 1px 0 rgb(255 255 255 / 0.3)`,
          }}
        >
          <Icon className="h-[18px] w-[18px] text-[#101014]" strokeWidth={2.4} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="truncate text-[15.5px] font-semibold text-white">{title}</span>
          <span className="mt-0.5 block truncate text-[12px] t-softer">{subtitle}</span>
        </span>

        {empty ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/70">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </span>
        ) : (
          <span className="shrink-0 text-right">
            <span className={cn(
              "block text-[15.5px] font-bold tabular-nums",
              amount && amount > 0 ? "text-white" : "t-softer",
            )}>
              {fmt(amount ?? 0)}
            </span>
            {progress !== undefined && (
              <span className="mt-0.5 block text-[12px] tabular-nums" style={{ color: shade(hex, 0.3) }}>
                {Math.round(Math.min(progress, 1) * 100)}%
              </span>
            )}
          </span>
        )}

        {!empty && <ChevronRight className="h-4 w-4 shrink-0 t-faint" />}
      </div>

      {progress !== undefined && !empty && (
        <div className="ml-[54px] mt-2.5 h-[4px] overflow-hidden rounded-full bg-white/[0.08]">
          <motion.span
            className="block h-full rounded-full"
            style={{ background: hex }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 1) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          />
        </div>
      )}
    </motion.button>
  );
}

/**
 * Reserve and pots, as two lines rather than two cards.
 *
 * They sit under a list of accounts and are the same kind of thing — a name, a figure,
 * somewhere to go — so they are written the same way. A cofrinho is a goal like any
 * other and shows up in Metas too; the reserve is its own reserved thing, which is why
 * it keeps its own line and its own progress.
 */
const ReserveAndPots = ({ goals, onCreated }: Props) => {
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

  const reserveProgress =
    reserve && reserve.target_amount > 0 ? Number(reserve.current_amount) / reserve.target_amount : 0;

  return (
    <>
      <div className="divide-y divide-white/[0.06]">
        <SavedRow
          index={0}
          hex={RESERVE_HEX}
          icon={ShieldCheck}
          title="Reserva de emergência"
          subtitle={
            reserve
              ? `de ${fmt(Number(reserve.target_amount))}`
              : "Guarde uma parte para imprevistos"
          }
          amount={reserve ? Number(reserve.current_amount) : null}
          progress={reserve ? reserveProgress : undefined}
          empty={!reserve}
          onOpen={() => (reserve ? navigate(`/metas/${reserve.id}`) : openCreate("reserva"))}
        />

        <SavedRow
          index={1}
          hex={POTS_HEX}
          icon={PiggyBank}
          title="Cofrinhos"
          subtitle={
            pots.length > 0
              ? `${pots.length} ${pots.length === 1 ? "cofrinho" : "cofrinhos"} · ${pots[0].name}`
              : "Um cofrinho para cada objetivo"
          }
          amount={pots.length > 0 ? potsTotal : null}
          empty={pots.length === 0}
          onOpen={() => (pots.length > 0 ? navigate("/metas") : openCreate())}
        />
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
