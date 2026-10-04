import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Loader2, Pencil, PiggyBank, X } from "lucide-react";
import { toast } from "sonner";
import BottomSheet from "@/components/shared/BottomSheet";
import { cn } from "@/lib/utils";
import { GOAL_PRESETS } from "@/lib/goalIcons";
import { currencySymbol } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface GoalCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    target_amount: number;
    monthly_contribution?: number | null;
    deadline?: string | null;
    cover_image?: string | null;
  }) => void;
  /** Preset id to start on — e.g. "reserva" when opened from the Reserva card in Carteira. */
  initialPresetId?: string;
  /** Names that already exist, so their preset (e.g. an existing reserve) doesn't show up again. */
  existingNames?: string[];
}

const AMOUNT_CHIPS = [5000, 10000, 25000, 50000, 100000, 250000];

const fmtShort = (v: number) => {
  if (v >= 1000000) return `${(v / 1000000).toLocaleString("pt-BR")}M`;
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR")}k`;
  return v.toLocaleString("pt-BR");
};

/** One screen: pick an objective (icon + color), name it, add a cover photo, set the target. */
const GoalCreateModal = ({ open, onClose, onSubmit, initialPresetId, existingNames = [] }: GoalCreateModalProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [cents, setCents] = useState(5000000);
  // A pot can just collect money, with no target to reach
  const [openEnded, setOpenEnded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const takenNames = new Set(existingNames.map((n) => n.trim().toLocaleLowerCase("pt-BR")));
  const presets = GOAL_PRESETS.filter((p) => !takenNames.has(p.name.toLocaleLowerCase("pt-BR")));

  useEffect(() => {
    if (open) {
      setPresetId(initialPresetId && presets.some((p) => p.id === initialPresetId) ? initialPresetId : null);
      setCustomName("");
      setCents(5000000);
      setOpenEnded(false);
      setSubmitting(false);
      setCoverImage(null);
      setUploadingCover(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPresetId]);

  const isCustom = presetId === "custom";
  const preset = presets.find((p) => p.id === presetId);
  const goalName = isCustom ? customName.trim() : (preset?.name ?? "");
  const canSubmit = goalName.length > 0 && (openEnded || cents > 0);

  const handlePickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/goal-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setCoverImage(`${publicUrl}?t=${Date.now()}`);
    } catch {
      toast.error("Não foi possível enviar a foto");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: goalName, target_amount: openEnded ? 0 : cents / 100, monthly_contribution: null, deadline: null, cover_image: coverImage });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full">
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold tracking-tight text-white">Nova meta</p>
        <p className="text-[14px] leading-snug text-white/62">Escolha um objetivo, dê um nome e, se quiser, defina quanto quer juntar.</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {presets.map((p) => {
            const Icon = p.icon;
            const selected = presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[20px] border px-2 py-3.5 text-center transition-colors",
                  selected ? "border-white bg-white/[0.08]" : "border-white/[0.06] willo-glass-inset",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${p.hex}22` }}>
                  <Icon className="h-5 w-5" style={{ color: p.hex }} />
                </span>
                <span className="line-clamp-2 text-[12px] leading-tight text-white/85">{p.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPresetId("custom")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-[20px] border px-2 py-3.5 text-center transition-colors",
              isCustom ? "border-white bg-white/[0.08]" : "border-dashed border-white/15",
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
              <Pencil className="h-5 w-5 text-white" />
            </span>
            <span className="text-[12px] text-white/82">Outro</span>
          </button>
        </div>

        <AnimatePresence>
          {isCustom && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nome da meta"
                autoFocus
                className="mt-3 h-12 w-full rounded-full bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/45 focus:outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {presetId && (
          <>
            <p className="mb-2 mt-6 px-1 text-[13px] font-semibold text-white/62">Foto de capa (opcional)</p>
            <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] willo-glass p-3">
              <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px]" style={{ background: preset ? `${preset.hex}22` : "rgba(255,255,255,0.06)" }}>
                {coverImage ? (
                  <img src={coverImage} alt="" className="h-full w-full object-cover" />
                ) : preset ? (
                  <preset.icon className="h-7 w-7" style={{ color: preset.hex }} />
                ) : (
                  <Camera className="h-6 w-6 text-white/56" />
                )}
                {uploadingCover && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white/70">Suba uma foto para essa meta, ou deixe o ícone padrão.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-white active:opacity-70"
                  >
                    <Camera className="h-3.5 w-3.5" /> {coverImage ? "Trocar foto" : "Adicionar foto"}
                  </button>
                  {coverImage && (
                    <button
                      type="button"
                      onClick={() => setCoverImage(null)}
                      className="flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] text-white/74 active:opacity-70"
                    >
                      <X className="h-3.5 w-3.5" /> Remover
                    </button>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickCover} className="hidden" />
            </div>

            <div className="mb-2 mt-6 flex items-center justify-between px-1">
              <p className="text-[13px] font-semibold text-white/62">Quanto quer juntar?</p>
              <button
                type="button"
                onClick={() => setOpenEnded((v) => !v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  openEnded ? "bg-white text-[#0B0B0B]" : "bg-white/[0.06] text-white/74",
                )}
              >
                Sem valor definido
              </button>
            </div>
            {openEnded ? (
              <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] willo-glass px-4 py-4">
                <PiggyBank className="h-5 w-5 shrink-0 text-willo-green" />
                <p className="text-[13px] leading-snug text-white/74">
                  Você vai só guardando, sem um alvo. Dá para definir um valor depois, quando quiser.
                </p>
              </div>
            ) : (
              <div className="rounded-[22px] border border-white/[0.08] willo-glass p-5">
                <div className="flex flex-col items-center">
                  <label className="relative flex items-baseline gap-1.5">
                    <span className="text-[22px] font-bold text-white/56">{currencySymbol()}</span>
                    <span className={cn("text-[40px] font-extrabold leading-none tracking-tight tabular-nums", cents === 0 ? "text-white/45" : "text-white")}>
                      {(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <input
                      inputMode="numeric"
                      value={cents === 0 ? "" : String(cents)}
                      onChange={(e) => setCents(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 9) || "0"), 999999999))}
                      aria-label="Valor da meta"
                      className="absolute inset-0 w-full opacity-0"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {AMOUNT_CHIPS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCents(v * 100)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                        cents === v * 100 ? "bg-white text-[#0B0B0B]" : "bg-white/[0.06] text-white/74",
                      )}
                    >
                      {fmtShort(v)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Criando...
            </>
          ) : (
            "Criar meta"
          )}
        </button>
      </div>
    </BottomSheet>
  );
};

export default GoalCreateModal;
