import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Check, HandCoins, PiggyBank, Wallet } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { GOAL_PRESETS } from "@/lib/goalIcons";
import { updateGoal, type Goal } from "@/services/goalService";
import { useMoney } from "@/components/projecoes/shared";
import { BottomSheet, Button, Chip, Glass, Text, colors, toast, white } from "~/ui";
import { tint } from "~/lib/color";
import { MoneyField, PillInput, SectionLabel } from "../wallet/sheetParts";
import { toDateKey } from "../nova/format";

interface Account { id: string; name: string; current_balance: number }

const EXTERNAL = "__externa__";
/** Dinheiro que nunca passou por uma conta: espécie, presente, alguém que te pagou. */
const EXTERNAL_ORIGINS = ["Dinheiro em espécie", "Presente", "Pagamento de alguém", "Venda", "Outro"];
const DEPOSIT_CHIPS = [50, 100, 200, 500, 1000];

function useAccounts(open: boolean) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    if (!open) return;
    supabase.from("accounts").select("id, name, current_balance").eq("is_active", true).not("type", "eq", "investment").order("is_default", { ascending: false })
      .then(({ data }) => setAccounts((data ?? []) as Account[]));
  }, [open]);
  return accounts;
}

function AccountOption({ icon: Icon, hex, title, sub, on, onPress }: { icon: any; hex: string; title: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
        <Icon size={16} color={hex} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="medium" size={15} numberOfLines={1}>{title}</Text>
        <Text size={12} color={white(0.56)} tabular>{sub}</Text>
      </View>
      {on && <Check size={20} color="#fff" />}
    </Pressable>
  );
}

function DateChips({ value, onChange }: { value: "hoje" | "ontem"; onChange: (v: "hoje" | "ontem") => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Chip label="Hoje" on={value === "hoje"} onPress={() => onChange("hoje")} />
      <Chip label="Ontem" on={value === "ontem"} onPress={() => onChange("ontem")} />
    </View>
  );
}

const dateFor = (mode: "hoje" | "ontem") => {
  const d = new Date();
  if (mode === "ontem") d.setDate(d.getDate() - 1);
  return toDateKey(d);
};

/** Guardar dinheiro numa meta: sai de uma conta ou vem de fora (espécie, presente…). */
export function GoalDepositSheet({ open, onClose, goalName, onSubmit }: {
  open: boolean;
  onClose: () => void;
  goalName: string;
  onSubmit: (d: { amount: number; date: string; source?: string; account_id?: string }) => Promise<void>;
}) {
  const { fmt } = useMoney();
  const accounts = useAccounts(open);
  const [cents, setCents] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [origin, setOrigin] = useState(EXTERNAL_ORIGINS[0]);
  const [when, setWhen] = useState<"hoje" | "ontem">("hoje");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setCents(0); setOrigin(EXTERNAL_ORIGINS[0]); setWhen("hoje"); setNote(""); setBusy(false); } }, [open]);
  useEffect(() => { if (open && !accountId) setAccountId(accounts[0]?.id ?? (accounts.length === 0 ? "" : EXTERNAL)); }, [open, accounts, accountId]);
  useEffect(() => { if (open && accounts.length > 0 && !accounts.some((a) => a.id === accountId) && accountId !== EXTERNAL) setAccountId(accounts[0].id); }, [open, accounts, accountId]);

  const external = accountId === EXTERNAL || (accounts.length === 0 && open);
  const account = accounts.find((a) => a.id === accountId);
  const amount = cents / 100;
  const short = !external && !!account && amount > Number(account.current_balance);
  const can = amount > 0 && !busy && (external || !!accountId);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ amount, date: dateFor(when), source: note.trim() || (external ? origin : undefined), account_id: external ? undefined : accountId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={busy ? "Guardando…" : "Guardar dinheiro"} disabled={!can} loading={busy} onPress={submit} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Guardar dinheiro</Text>
        <Text size={14} color={white(0.62)}>{goalName}</Text>

        <SectionLabel>Valor</SectionLabel>
        <MoneyField cents={cents} onChange={setCents} chips={DEPOSIT_CHIPS} />
        {short && <Text size={13} color={colors.amber} style={{ marginTop: 8 }}>Passa do saldo desta conta ({fmt(Number(account!.current_balance))}).</Text>}

        <SectionLabel>De onde vem o dinheiro</SectionLabel>
        <Glass radius={22} style={{ paddingHorizontal: 16 }}>
          {accounts.map((a) => (
            <AccountOption key={a.id} icon={Wallet} hex="#8B5CF6" title={a.name} sub={fmt(Number(a.current_balance))} on={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
          <View style={{ borderTopWidth: accounts.length ? 1 : 0, borderTopColor: white(0.06) }}>
            <AccountOption icon={HandCoins} hex="#F59E0B" title="Dinheiro de fora" sub="Não sai de nenhuma conta" on={external} onPress={() => setAccountId(EXTERNAL)} />
          </View>
        </Glass>
        {external && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
            {EXTERNAL_ORIGINS.map((o) => <Chip key={o} label={o} on={origin === o} onPress={() => setOrigin(o)} />)}
          </ScrollView>
        )}

        <SectionLabel>Quando</SectionLabel>
        <DateChips value={when} onChange={setWhen} />

        <SectionLabel>Observação (opcional)</SectionLabel>
        <PillInput value={note} onChangeText={setNote} placeholder="Ex.: 13º salário" maxLength={80} />
      </ScrollView>
    </BottomSheet>
  );
}

/** Sacar de uma meta: devolve para uma conta ou registra que foi retirado em dinheiro. */
export function GoalWithdrawSheet({ open, onClose, goalName, maxAmount, onSubmit }: {
  open: boolean;
  onClose: () => void;
  goalName: string;
  maxAmount: number;
  onSubmit: (d: { amount: number; date: string; account_id?: string; destination?: string }) => Promise<void>;
}) {
  const { fmt } = useMoney();
  const accounts = useAccounts(open);
  const [cents, setCents] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [when, setWhen] = useState<"hoje" | "ontem">("hoje");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setCents(0); setWhen("hoje"); setBusy(false); setAccountId(""); } }, [open]);
  useEffect(() => { if (open && !accountId && accounts[0]) setAccountId(accounts[0].id); }, [open, accounts, accountId]);

  const amount = cents / 100;
  const external = accountId === EXTERNAL || accounts.length === 0;
  const over = amount > maxAmount;
  const can = amount > 0 && !over && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ amount, date: dateFor(when), account_id: external ? undefined : accountId, destination: external ? "Dinheiro de fora" : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={busy ? "Sacando…" : "Sacar"} disabled={!can} loading={busy} onPress={submit} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Sacar da meta</Text>
        <Text size={14} color={white(0.62)}>{goalName} · disponível {fmt(maxAmount)}</Text>

        <SectionLabel>Valor</SectionLabel>
        <MoneyField cents={cents} onChange={setCents} />
        {over && <Text size={13} color={colors.red} style={{ marginTop: 8 }}>Mais do que há guardado nesta meta.</Text>}

        <SectionLabel>Para onde vai</SectionLabel>
        <Glass radius={22} style={{ paddingHorizontal: 16 }}>
          {accounts.map((a) => (
            <AccountOption key={a.id} icon={Wallet} hex="#8B5CF6" title={a.name} sub={fmt(Number(a.current_balance))} on={!external && accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
          <View style={{ borderTopWidth: accounts.length ? 1 : 0, borderTopColor: white(0.06) }}>
            <AccountOption icon={HandCoins} hex="#F59E0B" title="Retirar em dinheiro" sub="Não volta para nenhuma conta" on={external} onPress={() => setAccountId(EXTERNAL)} />
          </View>
        </Glass>

        <SectionLabel>Quando</SectionLabel>
        <DateChips value={when} onChange={setWhen} />
      </ScrollView>
    </BottomSheet>
  );
}

/** Nova meta: um objetivo (ícone e cor), o nome e quanto juntar — ou nenhum alvo. */
export function GoalCreateSheet({ open, onClose, existingNames, initialPresetId, onSubmit }: {
  open: boolean;
  onClose: () => void;
  existingNames: string[];
  initialPresetId?: string;
  onSubmit: (d: { name: string; target_amount: number }) => Promise<void>;
}) {
  const taken = new Set(existingNames.map((n) => n.trim().toLocaleLowerCase("pt-BR")));
  const presets = GOAL_PRESETS.filter((p) => !taken.has(p.name.toLocaleLowerCase("pt-BR")));
  const [presetId, setPresetId] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [cents, setCents] = useState(5_000_000);
  const [openEnded, setOpenEnded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPresetId(initialPresetId && presets.some((p) => p.id === initialPresetId) ? initialPresetId : null);
    setCustom(""); setCents(5_000_000); setOpenEnded(false); setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPresetId]);

  const preset = presets.find((p) => p.id === presetId);
  const name = presetId === "custom" ? custom.trim() : preset?.name ?? "";
  const can = name.length > 0 && (openEnded || cents > 0) && !busy;

  const submit = async () => {
    setBusy(true);
    try { await onSubmit({ name, target_amount: openEnded ? 0 : cents / 100 }); } finally { setBusy(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={busy ? "Criando…" : "Criar meta"} disabled={!can} loading={busy} onPress={submit} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Nova meta</Text>
        <Text size={14} color={white(0.62)} style={{ lineHeight: 20 }}>Escolha um objetivo, dê um nome e, se quiser, defina quanto quer juntar.</Text>

        <View style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[...presets, { id: "custom", name: "Outro objetivo", icon: PiggyBank, hex: "#7DD3FC", subtitle: "" }].map((p) => {
            const Icon = p.icon;
            const on = presetId === p.id;
            return (
              <Pressable key={p.id} onPress={() => setPresetId(p.id)} style={{ width: "31.5%", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, borderWidth: 1, borderColor: on ? "#fff" : white(0.06), backgroundColor: on ? white(0.08) : white(0.05) }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(p.hex, 0.13) }}>
                  <Icon size={20} color={p.hex} />
                </View>
                <Text size={12} color={white(0.85)} align="center" numberOfLines={2}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {presetId === "custom" && (
          <View style={{ marginTop: 12 }}>
            <PillInput value={custom} onChangeText={setCustom} placeholder="Nome da meta" maxLength={40} />
          </View>
        )}

        {presetId && (
          <>
            <SectionLabel right={<Chip label="Sem valor definido" on={openEnded} onPress={() => setOpenEnded((v) => !v)} />}>Quanto quer juntar</SectionLabel>
            {openEnded ? (
              <Glass radius={22} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <PiggyBank size={20} color={colors.green} />
                <Text size={13} color={white(0.74)} style={{ flex: 1, lineHeight: 18 }}>Você vai só guardando, sem um alvo. Dá para definir um valor depois, quando quiser.</Text>
              </Glass>
            ) : (
              <MoneyField cents={cents} onChange={setCents} chips={[5000, 10000, 25000, 50000, 100000, 250000]} />
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

/** Editar o nome, o alvo e a contribuição mensal. */
export function GoalEditSheet({ goal, onClose, onUpdated }: { goal: Goal | null; onClose: () => void; onUpdated: () => void }) {
  const [name, setName] = useState("");
  const [cents, setCents] = useState(0);
  const [monthly, setMonthly] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setName(goal.name); setCents(Math.round(Number(goal.target_amount) * 100)); setMonthly(Math.round(Number(goal.monthly_contribution ?? 0) * 100)); setBusy(false);
  }, [goal]);

  const save = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      await updateGoal(goal.id, { name: name.trim(), target_amount: cents / 100, monthly_contribution: monthly > 0 ? monthly / 100 : null });
      toast.success("Meta atualizada");
      onUpdated();
      onClose();
    } catch {
      toast.error("Não foi possível salvar");
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={!!goal} onClose={onClose} size="full" footer={<Button label={busy ? "Salvando…" : "Salvar alterações"} disabled={!name.trim() || busy} loading={busy} onPress={save} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Editar meta</Text>
        <SectionLabel>Nome</SectionLabel>
        <PillInput value={name} onChangeText={setName} maxLength={40} />
        <SectionLabel>Valor da meta</SectionLabel>
        <MoneyField cents={cents} onChange={setCents} />
        <SectionLabel>Quanto guardar por mês (opcional)</SectionLabel>
        <MoneyField cents={monthly} onChange={setMonthly} />
      </ScrollView>
    </BottomSheet>
  );
}
