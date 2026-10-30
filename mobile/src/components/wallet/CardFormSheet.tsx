import { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BankMark from "~/components/BankMark";
import { Minus, Plus, X } from "~/components/icons";
import { catalogFor } from "~/lib/bankCatalog";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";

/**
 * A credit card, made or changed — the same sheet for both, so the card reads as the
 * same thing seen twice.
 *
 * Name, the last four digits, the limit and the two days that run the bill. A limit can
 * be lowered only as far as what is already spent on it: a card does not get smaller
 * than its own debt, so going below that is refused with the figure that sets the floor.
 */

export interface CardDraft {
  name: string;
  last_four_digits: string | null;
  limit: number;
  closing_day: number;
  due_day: number;
  color: string;
}

export default function CardFormSheet({
  open,
  initial,
  used = 0,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  /** The card being changed; none when making a new one. */
  initial?: { name: string; last_four_digits: string | null; limit: number; closing_day: number; due_day: number; color: string | null } | null;
  /** What is already spent on the card — the lowest the limit can go. */
  used?: number;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: CardDraft) => void;
}) {
  const insets = useSafeAreaInsets();
  const editing = !!initial;
  const [name, setName] = useState("");
  const [four, setFour] = useState("");
  const [cents, setCents] = useState(0);
  const [closing, setClosing] = useState(1);
  const [due, setDue] = useState(10);
  const [lift, setLift] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setFour(initial?.last_four_digits ?? "");
    setCents(Math.round((initial?.limit ?? 0) * 100));
    setClosing(initial?.closing_day ?? 1);
    setDue(initial?.due_day ?? 10);
    setProblem(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) {
      setLift(0);
      return;
    }
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) =>
      setLift(Math.max(0, e.endCoordinates.height - (ios ? insets.bottom : 0))),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open, insets.bottom]);

  const hex = initial?.color?.startsWith("#") ? initial.color : catalogFor(name)?.hex ?? "#8B5CF6";
  const floor = Math.max(0, used);
  /* Raising the limit, or leaving it, is always fine; only a cut below what is spent is not. */
  const lowered = cents / 100 < floor - 0.004 && cents < Math.round((initial?.limit ?? Infinity) * 100);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setProblem("Dê um nome ao cartão.");
      return;
    }
    if (cents <= 0) {
      setProblem("Informe o limite do cartão.");
      return;
    }
    if (lowered) {
      setProblem(`O limite não pode ficar abaixo do que já está usado: ${money(floor)}.`);
      return;
    }
    if (four && four.length !== 4) {
      setProblem("O final do cartão tem 4 números.");
      return;
    }
    onSave({
      name: trimmed,
      last_four_digits: four || null,
      limit: cents / 100,
      closing_day: closing,
      due_day: due,
      color: initial?.color ?? hex,
    });
  };

  const unchanged =
    editing &&
    name.trim() === initial!.name &&
    (four || null) === (initial!.last_four_digits || null) &&
    cents === Math.round(initial!.limit * 100) &&
    closing === initial!.closing_day &&
    due === initial!.due_day;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={saving ? undefined : onClose}>
        <BlurView intensity={18} tint="dark" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} />
      </Pressable>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: lift,
          maxHeight: "92%",
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        <BlurView intensity={70} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.5)" }} />

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>
              {editing ? "Editar cartão" : "Novo cartão"}
            </Text>
            <Pressable
              accessibilityLabel="Fechar"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.09)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={16} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Nome</Text>
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BankMark name={name.trim() || "Cartão"} hex={hex} size={52} />
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setProblem(null);
              }}
              placeholder="Ex.: Nubank, Itaú Platinum"
              placeholderTextColor={INK.faint}
              maxLength={40}
              style={field}
            />
          </View>

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Final do cartão (opcional)</Text>
          <TextInput
            value={four}
            onChangeText={(t) => {
              setFour(t.replace(/\D/g, "").slice(0, 4));
              setProblem(null);
            }}
            placeholder="0000"
            placeholderTextColor={INK.faint}
            keyboardType="number-pad"
            maxLength={4}
            style={[field, { marginTop: 8, flex: 0, letterSpacing: 4 }]}
          />

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Limite</Text>
          <TextInput
            value={money(cents / 100)}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, "").slice(0, 11);
              setCents(Math.min(Number(digits || "0"), 999999999));
              setProblem(null);
            }}
            keyboardType="number-pad"
            style={{ marginTop: 6, fontSize: 34, fontWeight: "800", letterSpacing: -1.2, color: cents === 0 ? INK.faint : "#fff", padding: 0 }}
          />
          {editing && floor > 0 && (
            <Text style={{ marginTop: 6, fontSize: 12.5, color: lowered ? RED : INK.softer }}>
              Já usado: {money(floor)} · dá para diminuir o limite só até esse valor
            </Text>
          )}

          <View style={{ marginTop: 22, flexDirection: "row", gap: 12 }}>
            <DayStepper label="Fecha dia" value={closing} onChange={setClosing} />
            <DayStepper label="Vence dia" value={due} onChange={setDue} />
          </View>

          {(problem || error) && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{problem ?? error}</Text>}

          <Pressable
            onPress={submit}
            disabled={saving || unchanged}
            style={({ pressed }) => ({
              marginTop: 22,
              height: 54,
              borderRadius: 27,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: saving || unchanged ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar cartão"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const field = {
  flex: 1,
  minWidth: 0,
  height: 52,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.06)",
  paddingHorizontal: 16,
  fontSize: 16.5,
  color: "#fff",
} as const;

/** A day of the month, one step at a time, wrapping from 31 back to 1. */
function DayStepper({ label, value, onChange }: { label: string; value: number; onChange: (d: number) => void }) {
  const step = (by: number) => onChange(((value - 1 + by + 31) % 31) + 1);
  return (
    <View style={{ flex: 1, borderRadius: 20, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 12, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 12, color: INK.soft, textAlign: "center" }}>{label}</Text>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <StepButton icon="minus" onPress={() => step(-1)} />
        <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: "#fff", fontVariant: ["tabular-nums"] }}>{value}</Text>
        <StepButton icon="plus" onPress={() => step(1)} />
      </View>
    </View>
  );
}

function StepButton({ icon, onPress }: { icon: "minus" | "plus"; onPress: () => void }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={icon === "minus" ? "Dia anterior" : "Próximo dia"}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={16} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
}
