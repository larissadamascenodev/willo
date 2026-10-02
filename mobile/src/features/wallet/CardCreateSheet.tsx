import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarCheck, CalendarClock, Nfc, type LucideIcon } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { bankFor, colorFor } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { createCreditCard, updateCreditCard } from "@/services/transactionService";
import { BottomSheet, Button, Glass, Text, toast, white } from "~/ui";
import { BankChips, ColorPicker, DayGrid, MoneyField, PillInput, SectionLabel } from "./sheetParts";

const LIMIT_CHIPS = [1000, 2000, 5000, 10000];
/** A maioria dos cartões vence cerca de uma semana depois de fechar. */
const DUE_GAP = 7;
const addDays = (day: number, n: number) => ((day - 1 + n) % 31) + 1;

/** O cartão desenhado com o que já foi digitado. */
function CardPreview({ name, digits, limitCents, closing, due, hex }: { name: string; digits: string; limitCents: number; closing: number; due: number; hex: string }) {
  return (
    <View style={{ alignSelf: "center", width: "100%", maxWidth: 340, aspectRatio: 1.586, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: white(0.12), padding: 20 }}>
      <LinearGradient colors={[hex, `${hex}AA`, "#161616"]} locations={[0, 0.28, 0.72]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={[white(0.14), "rgba(255,255,255,0)"]} locations={[0, 0.38]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <Text weight="bold" size={17} numberOfLines={1} color={name.trim() ? "#fff" : white(0.62)} style={{ flexShrink: 1 }}>{name.trim() || "Seu cartão"}</Text>
        <Nfc size={24} color={white(0.8)} />
      </View>
      <View style={{ marginTop: 12, width: 44, height: 32, borderRadius: 7, backgroundColor: "#c9ab62" }} />
      <View style={{ flex: 1 }} />
      <Text size={16} color={white(0.9)} style={{ letterSpacing: 3.2 }}>•••• •••• •••• {digits.padEnd(4, "•")}</Text>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Text size={11} color={white(0.74)}>Fecha {closing} · Vence {due}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text size={11} color={white(0.66)}>Limite</Text>
          <Text weight="bold" size={14} tabular>{currencySymbol()} {(limitCents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</Text>
        </View>
      </View>
    </View>
  );
}

function DayButton({ label, day, Icon, active, onPress }: { label: string; day: number; Icon: LucideIcon; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, borderWidth: 1, borderColor: active ? "#fff" : white(0.06), backgroundColor: active ? white(0.08) : white(0.1), padding: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: white(0.07), alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={white(0.8)} />
      </View>
      <View>
        <Text size={12} color={white(0.62)}>{label}</Text>
        <Text weight="bold" size={17}>Dia {day}</Text>
      </View>
    </Pressable>
  );
}

/** "Novo cartão": o cartão desenhado ao vivo, bancos a um toque, o limite e os dias de fechar e vencer. */
export interface EditableCard { id: string; name: string; limit: number; closing_day: number; due_day: number; color: string | null; last_four_digits: string | null }

export function CardCreateSheet({ open, onClose, onCreated, card }: { open: boolean; onClose: () => void; onCreated?: () => void; /** Quando vem, a folha edita este cartão em vez de criar um novo. */ card?: EditableCard | null }) {
  const { user } = useAuth();
  const nameRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [limitCents, setLimitCents] = useState(0);
  const [closing, setClosing] = useState(10);
  const [due, setDue] = useState(17);
  const [dueTouched, setDueTouched] = useState(false);
  const [editing, setEditing] = useState<"closing" | "due" | null>(null);
  const [color, setColor] = useState("violet");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(card?.name ?? ""); setDigits(card?.last_four_digits ?? ""); setLimitCents(Math.round((card?.limit ?? 0) * 100));
    setClosing(card?.closing_day ?? 10); setDue(card?.due_day ?? 17); setDueTouched(!!card); setEditing(null); setColor(card?.color ?? "violet"); setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bank = bankFor(name);
  const hex = colorFor(name, color, "#3A3A3F");
  const canSave = name.trim().length > 0 && limitCents > 0 && !saving;

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      const fields = { name: name.trim(), limit: limitCents / 100, closing_day: closing, due_day: due, color: bank?.accent ?? color, last_four_digits: digits.length === 4 ? digits : null };
      if (card) await updateCreditCard(card.id, fields);
      else await createCreditCard(fields, user.id);
      toast.success(card ? "Cartão atualizado!" : "Cartão cadastrado!");
      onCreated?.();
      onClose();
    } catch {
      toast.error("Não foi possível cadastrar o cartão");
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={saving ? "Salvando…" : card ? "Salvar alterações" : "Cadastrar cartão"} disabled={!canSave} loading={saving} onPress={save} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>{card ? "Editar cartão" : "Novo cartão"}</Text>
        <Text size={14} color={white(0.62)} style={{ lineHeight: 20 }}>Com o fechamento e o vencimento, o Willo monta cada fatura sozinho.</Text>

        <View style={{ marginTop: 20 }}>
          <CardPreview name={name} digits={digits} limitCents={limitCents} closing={closing} due={due} hex={hex} />
        </View>

        <SectionLabel>Banco</SectionLabel>
        <BankChips selectedId={bank?.id ?? null} onPick={(b) => setName(b.name)} onOther={() => { setName(""); nameRef.current?.focus(); }} />
        <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
          <PillInput ref={nameRef} value={name} onChangeText={setName} placeholder="Nome do cartão" maxLength={40} style={{ flex: 1 }} />
          <PillInput value={digits} onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="Final" accessibilityLabel="4 últimos dígitos" style={{ width: 112, textAlign: "center", letterSpacing: 3 }} />
        </View>

        <SectionLabel>Limite total</SectionLabel>
        <MoneyField cents={limitCents} onChange={setLimitCents} chips={LIMIT_CHIPS} />

        {!bank && (
          <>
            <SectionLabel>Cor</SectionLabel>
            <ColorPicker value={color} onChange={setColor} />
          </>
        )}

        <SectionLabel>Datas da fatura</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <DayButton label="Fecha" day={closing} Icon={CalendarClock} active={editing === "closing"} onPress={() => setEditing(editing === "closing" ? null : "closing")} />
          <DayButton label="Vence" day={due} Icon={CalendarCheck} active={editing === "due"} onPress={() => setEditing(editing === "due" ? null : "due")} />
        </View>
        {editing && (
          <Glass radius={22} style={{ marginTop: 8, padding: 12 }}>
            <Text size={12} color={white(0.62)} style={{ marginBottom: 8, paddingHorizontal: 4 }}>{editing === "closing" ? "Dia em que a fatura fecha" : "Dia em que a fatura vence"}</Text>
            <DayGrid
              value={editing === "closing" ? closing : due}
              mark={editing === "closing" ? due : closing}
              onChange={(d) => {
                if (editing === "closing") { setClosing(d); if (!dueTouched) setDue(addDays(d, DUE_GAP)); }
                else { setDue(d); setDueTouched(true); }
                setEditing(null);
              }}
            />
          </Glass>
        )}
        <Text size={12} color={white(0.5)} style={{ marginTop: 8, paddingHorizontal: 4, lineHeight: 17 }}>
          Compras feitas depois do dia {closing} entram na fatura seguinte. Confira as datas no app do seu banco.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}
