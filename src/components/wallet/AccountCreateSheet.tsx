import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, Landmark, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import BottomSheet from "@/components/shared/BottomSheet";
import { useAuth } from "@/contexts/AuthContext";
import { createAccount } from "@/services/transactionService";
import { bankFor, colorFor, initials } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { BankChips, ColorPicker, MoneyField, PillInput, SectionLabel, SheetAction } from "./sheetParts";

type AccountType = "checking" | "savings" | "cash";

const TYPES: { value: AccountType; label: string; icon: typeof Landmark }[] = [
  { value: "checking", label: "Conta corrente", icon: Landmark },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "cash", label: "Dinheiro", icon: Banknote },
];

const plain = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "Nova conta": a live preview of how the account will look in Carteira,
 * common banks one tap away, the type, today's balance and a color.
 */
const AccountCreateSheet = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) => {
  const { user } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [cents, setCents] = useState(0);
  const [negative, setNegative] = useState(false);
  const [color, setColor] = useState("violet");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("checking");
    setCents(0);
    setNegative(false);
    setColor("violet");
    setSaving(false);
  }, [open]);

  const bank = bankFor(name);
  const hex = colorFor(name, color);
  const TypeIcon = TYPES.find((t) => t.value === type)!.icon;
  const canSave = name.trim().length > 0 && !saving;

  const pickType = (t: AccountType) => {
    setType(t);
    if (t === "cash" && !name.trim()) setName("Carteira");
  };

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await createAccount(user.id, {
        name: name.trim(),
        type,
        initial_balance: (negative ? -cents : cents) / 100,
        color: bank?.accent ?? color,
      });
      toast.success("Conta criada!");
      onCreated?.();
      onClose();
    } catch {
      toast.error("Não foi possível criar a conta");
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="full"
      footer={<SheetAction onClick={save} disabled={!canSave} loading={saving} loadingLabel="Criando…">Criar conta</SheetAction>}
    >
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold tracking-tight text-white">Nova conta</p>
        <p className="text-[14px] leading-snug text-white/62">Onde seu dinheiro fica. Dá pra editar depois.</p>

        {/* Live preview */}
        <motion.div
          layout
          className="relative mt-5 overflow-hidden rounded-[24px] border border-white/[0.08] willo-glass p-4"
        >
          <motion.div
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full blur-[60px]"
            animate={{ background: hex, opacity: 0.35 }}
            transition={{ duration: 0.4 }}
          />
          <div className="relative flex items-center gap-3.5">
            <motion.span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
              animate={{ background: hex }}
              transition={{ duration: 0.3 }}
            >
              {name.trim() ? initials(name) : <TypeIcon className="h-5 w-5" />}
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[17px] font-semibold", name.trim() ? "text-white" : "text-white/45")}>{name.trim() || "Nome da conta"}</p>
              <p className="text-[13px] text-white/62">{TYPES.find((t) => t.value === type)!.label}</p>
            </div>
          </div>
          <p className="relative mt-4 text-[12px] text-white/56">Saldo de hoje</p>
          <p className={cn("relative text-[28px] font-extrabold leading-tight tracking-tight tabular-nums", negative && cents > 0 ? "text-red-400" : "text-white")}>
            {negative && cents > 0 ? "−" : ""}{currencySymbol()} {plain(cents)}
          </p>
        </motion.div>

        <SectionLabel>Banco</SectionLabel>
        <BankChips
          selectedId={bank?.id ?? null}
          onPick={(b) => setName(b.name)}
          onOther={() => { setName(""); nameRef.current?.focus(); }}
        />
        <PillInput
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da conta (ex: Nubank, Carteira)"
          maxLength={40}
          className="mt-2.5"
        />

        <SectionLabel>Tipo</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ value, label, icon: Icon }) => {
            const selected = type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => pickType(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[20px] border px-2 py-3.5 transition-colors",
                  selected ? "border-white bg-white/[0.08]" : "border-white/[0.06] willo-glass-inset",
                )}
              >
                <Icon className={cn("h-5 w-5", selected ? "text-white" : "text-white/66")} />
                <span className={cn("text-[12.5px]", selected ? "text-white" : "text-white/74")}>{label}</span>
              </button>
            );
          })}
        </div>

        <SectionLabel>Quanto tem nela hoje?</SectionLabel>
        <MoneyField cents={cents} onChange={setCents} negative={negative}>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
            <span className="text-[13px] text-white/66">Está no negativo</span>
            <button
              type="button"
              role="switch"
              aria-checked={negative}
              onClick={() => setNegative((v) => !v)}
              className={cn("relative h-7 w-12 rounded-full transition-colors", negative ? "bg-red-400" : "bg-white/15")}
            >
              <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-white" animate={{ left: negative ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
            </button>
          </div>
        </MoneyField>
        <p className="mt-2 px-1 text-[12px] text-white/50">Use o saldo que aparece no app do banco agora. A partir daqui, o Willo acompanha.</p>

        {bank ? (
          <p className="mt-6 flex items-center gap-2 px-1 text-[13px] text-white/62">
            <span className="h-3 w-3 rounded-full" style={{ background: bank.hex }} /> Cor do banco aplicada automaticamente
          </p>
        ) : (
          <>
            <SectionLabel>Cor</SectionLabel>
            <ColorPicker value={color} onChange={setColor} />
          </>
        )}
      </div>
    </BottomSheet>
  );
};

export default AccountCreateSheet;
