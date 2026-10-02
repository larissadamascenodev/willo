import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { Banknote, Check, Landmark, PiggyBank } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { bankFor, colorFor, initials } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { createAccount } from "@/services/transactionService";
import { BottomSheet, Button, Glass, Text, colors, toast, white } from "~/ui";
import { BankChips, ColorPicker, MoneyField, PillInput, SectionLabel } from "./sheetParts";

type AccountType = "checking" | "savings" | "cash";

const TYPES = [
  { value: "checking" as const, label: "Conta corrente", Icon: Landmark },
  { value: "savings" as const, label: "Poupança", Icon: PiggyBank },
  { value: "cash" as const, label: "Dinheiro", Icon: Banknote },
];

const plain = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Nova conta": uma prévia viva de como ela vai aparecer, o banco, o tipo, o saldo de hoje e a cor. */
export function AccountCreateSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const { user } = useAuth();
  const nameRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [cents, setCents] = useState(0);
  const [negative, setNegative] = useState(false);
  const [color, setColor] = useState("violet");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(""); setType("checking"); setCents(0); setNegative(false); setColor("violet"); setSaving(false);
  }, [open]);

  const bank = bankFor(name);
  const hex = colorFor(name, color);
  const TypeIcon = TYPES.find((t) => t.value === type)!.Icon;
  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await createAccount(user.id, { name: name.trim(), type, initial_balance: (negative ? -cents : cents) / 100, color: bank?.accent ?? color });
      toast.success("Conta criada!");
      onCreated?.();
      onClose();
    } catch {
      toast.error("Não foi possível criar a conta");
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={saving ? "Criando…" : "Criar conta"} disabled={!canSave} loading={saving} onPress={save} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Nova conta</Text>
        <Text size={14} color={white(0.62)}>Onde seu dinheiro fica. Dá pra editar depois.</Text>

        <Glass radius={24} style={{ marginTop: 20, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: hex, alignItems: "center", justifyContent: "center" }}>
              {name.trim() ? <Text weight="bold" size={15}>{initials(name)}</Text> : <TypeIcon size={20} color="#fff" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="semibold" size={17} numberOfLines={1} color={name.trim() ? "#fff" : white(0.45)}>{name.trim() || "Nome da conta"}</Text>
              <Text size={13} color={white(0.62)}>{TYPES.find((t) => t.value === type)!.label}</Text>
            </View>
          </View>
          <Text size={12} color={white(0.56)} style={{ marginTop: 16 }}>Saldo de hoje</Text>
          <Text weight="extrabold" size={28} tabular color={negative && cents > 0 ? colors.red : "#fff"} style={{ letterSpacing: -0.6 }}>
            {negative && cents > 0 ? "−" : ""}{currencySymbol()} {plain(cents)}
          </Text>
        </Glass>

        <SectionLabel>Banco</SectionLabel>
        <BankChips selectedId={bank?.id ?? null} onPick={(b) => setName(b.name)} onOther={() => { setName(""); nameRef.current?.focus(); }} />
        <PillInput ref={nameRef} value={name} onChangeText={setName} placeholder="Nome da conta (ex: Nubank, Carteira)" maxLength={40} style={{ marginTop: 10 }} />

        <SectionLabel>Tipo</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {TYPES.map(({ value, label, Icon }) => {
            const on = type === value;
            return (
              <Pressable
                key={value}
                onPress={() => { setType(value); if (value === "cash" && !name.trim()) setName("Carteira"); }}
                style={{ flex: 1, alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? "#fff" : white(0.06), backgroundColor: on ? white(0.08) : white(0.1), paddingHorizontal: 8, paddingVertical: 14 }}
              >
                <Icon size={20} color={on ? "#fff" : white(0.66)} />
                <Text size={12.5} align="center" color={on ? "#fff" : white(0.74)}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>Quanto tem nela hoje?</SectionLabel>
        <MoneyField cents={cents} onChange={setCents} negative={negative}>
          <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 14 }}>
            <Text size={13} color={white(0.66)}>Está no negativo</Text>
            <Switch value={negative} onValueChange={setNegative} trackColor={{ true: colors.red, false: white(0.15) }} ios_backgroundColor={white(0.15)} />
          </View>
        </MoneyField>
        <Text size={12} color={white(0.5)} style={{ marginTop: 8, paddingHorizontal: 4 }}>Use o saldo que aparece no app do banco agora. A partir daqui, o Willo acompanha.</Text>

        {bank ? (
          <View style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: bank.hex }} />
            <Text size={13} color={white(0.62)}>Cor do banco aplicada automaticamente</Text>
          </View>
        ) : (
          <>
            <SectionLabel>Cor</SectionLabel>
            <ColorPicker value={color} onChange={setColor} />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
