import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check } from "lucide-react-native";
import { useMoney } from "@/components/projecoes/shared";
import { BottomSheet, Button, Chip, Glass, Text, colors, white } from "~/ui";
import { MoneyField, SectionLabel } from "../wallet/sheetParts";

export type PaymentMode = "total" | "minimo" | "parcelado";

export interface PaymentDetails {
  mode: PaymentMode;
  amountPaid?: number;
  installments?: number;
  entryAmount?: number;
  installmentAmount?: number;
}

export interface PayAccount {
  id: string;
  name: string;
  current_balance: number;
}

const MODES: { key: PaymentMode; label: string }[] = [
  { key: "total", label: "Valor total" },
  { key: "minimo", label: "Pagar parte" },
  { key: "parcelado", label: "Parcelar" },
];

/** Pagar a fatura: de qual conta sai, e se é tudo, uma parte ou parcelado. */
export function PaySheet({ open, onClose, outstanding, accounts, accountId, onAccount, onConfirm, paying }: {
  open: boolean;
  onClose: () => void;
  outstanding: number;
  accounts: PayAccount[];
  accountId: string;
  onAccount: (id: string) => void;
  onConfirm: (details: PaymentDetails) => void;
  paying: boolean;
}) {
  const { fmt } = useMoney();
  const [mode, setMode] = useState<PaymentMode>("total");
  const [partCents, setPartCents] = useState(0);
  const [entryCents, setEntryCents] = useState(0);
  const [count, setCount] = useState(2);
  const [eachCents, setEachCents] = useState(0);

  useEffect(() => {
    if (!open) return;
    setMode("total"); setPartCents(0); setEntryCents(0); setCount(2); setEachCents(0);
  }, [open]);

  const part = partCents / 100;
  const entry = entryCents / 100;
  const each = eachCents / 100;
  const financed = each * count;
  const interest = Math.max(0, entry + financed - outstanding);

  const canConfirm = !!accountId && (mode === "total" || (mode === "minimo" ? part > 0 && part < outstanding : count >= 2 && each > 0));

  const confirm = () => {
    if (mode === "total") onConfirm({ mode });
    else if (mode === "minimo") onConfirm({ mode, amountPaid: part });
    else onConfirm({ mode, entryAmount: entry, installments: count, installmentAmount: each });
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={paying ? "Pagando…" : `Pagar fatura`} disabled={!canConfirm} loading={paying} onPress={confirm} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Pagar fatura</Text>
        <Text size={13} color={white(0.62)} style={{ marginTop: 14 }}>Saldo em aberto</Text>
        <Text weight="extrabold" size={32} tabular style={{ letterSpacing: -0.8 }}>{fmt(outstanding)}</Text>

        <SectionLabel>Debitar da conta</SectionLabel>
        <Glass radius={22} style={{ paddingHorizontal: 16 }}>
          {accounts.map((a, i) => (
            <Pressable key={a.id} onPress={() => onAccount(a.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium" size={15} numberOfLines={1}>{a.name}</Text>
                <Text size={12} color={white(0.56)} tabular>{fmt(Number(a.current_balance))}</Text>
              </View>
              {accountId === a.id && <Check size={20} color="#fff" />}
            </Pressable>
          ))}
        </Glass>

        <SectionLabel>Forma de pagamento</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {MODES.map((m) => <Chip key={m.key} label={m.label} on={mode === m.key} onPress={() => setMode(m.key)} />)}
        </View>

        {mode === "minimo" && (
          <>
            <SectionLabel>Quanto quer pagar?</SectionLabel>
            <MoneyField cents={partCents} onChange={setPartCents} />
            {part > 0 && part < outstanding && (
              <Text size={13} color={colors.amber} style={{ marginTop: 10 }}>Fica {fmt(outstanding - part)} em aberto na fatura até o vencimento.</Text>
            )}
            {part >= outstanding && part > 0 && (
              <Text size={13} color={colors.red} style={{ marginTop: 10 }}>O valor precisa ser menor que a fatura. Para pagar tudo, use "Valor total".</Text>
            )}
          </>
        )}

        {mode === "parcelado" && (
          <>
            <SectionLabel>Entrada (opcional)</SectionLabel>
            <MoneyField cents={entryCents} onChange={setEntryCents} />
            <SectionLabel>Número de parcelas</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => <Chip key={n} label={`${n}x`} on={count === n} onPress={() => setCount(n)} />)}
            </View>
            <SectionLabel>Valor de cada parcela</SectionLabel>
            <MoneyField cents={eachCents} onChange={setEachCents} />
            {each > 0 && (
              <Glass radius={18} style={{ marginTop: 12, padding: 14, gap: 6 }}>
                {entry > 0 && <Row label="Entrada" value={fmt(entry)} />}
                <Row label="Parcelas" value={`${count}x de ${fmt(each)}`} />
                <Row label="Total a pagar" value={fmt(entry + financed)} />
                {interest > 0 && <Row label="Juros" value={fmt(interest)} color={colors.amber} />}
              </Glass>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function Row({ label, value, color = "#fff" }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text size={13} color={white(0.62)}>{label}</Text>
      <Text size={14} weight="semibold" tabular color={color}>{value}</Text>
    </View>
  );
}
