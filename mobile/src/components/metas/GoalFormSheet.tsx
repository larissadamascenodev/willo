import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { GOAL_PRESET_DATA, goalPresetIcon } from "~/lib/goalIcon";
import BottomSheet from "~/components/BottomSheet";
import { Check, X } from "~/components/icons";
import { INK, RED } from "~/theme/tokens";

/**
 * Naming a goal and saying how much it costs.
 *
 * It opens on the eight goals people are actually saving for, because choosing from
 * a list is faster than writing from nothing and the one you pick carries its own
 * glyph and colour for free. Writing your own is the ninth option rather than the
 * default, and the monthly amount is optional: a goal with no monthly figure is
 * still a goal, it just cannot say when it will arrive.
 */

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function GoalFormSheet({
  open,
  onClose,
  onSubmit,
  title,
  initial,
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
  }) => Promise<void> | void;
  title: string;
  initial?: { name: string; target_amount: number; monthly_contribution: number | null };
  existingNames?: string[];
}) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cents, setCents] = useState(500000);
  const [monthlyCents, setMonthlyCents] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCents(Math.round((initial?.target_amount ?? 5000) * 100));
    setMonthlyCents(Math.round((initial?.monthly_contribution ?? 0) * 100));
    setPresetId(
      initial ? (GOAL_PRESET_DATA.find((p) => p.name === initial.name)?.id ?? null) : null,
    );
    setError(null);
    setSaving(false);
  }, [open, initial]);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Dê um nome à meta.");
      return;
    }
    if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
      setError("Você já tem uma meta com esse nome.");
      return;
    }
    if (cents <= 0) {
      setError("Diga quanto a meta custa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmed,
        target_amount: cents / 100,
        monthly_contribution: monthlyCents > 0 ? monthlyCents / 100 : null,
      });
    } catch {
      setError("Não foi possível salvar a meta.");
    } finally {
      setSaving(false);
    }
  };

  /* With a monthly figure, the goal can say when it arrives — which is the one thing
     a target on its own never tells you. */
  const months =
    monthlyCents > 0 ? Math.ceil(cents / monthlyCents) : 0;

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>{title}</Text>
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
              backgroundColor: "rgba(255,255,255,0.06)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={16} color={INK.soft} />
          </Pressable>
        </View>

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>O que você quer</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {GOAL_PRESET_DATA.map((preset) => {
            const Icon = goalPresetIcon(preset.icon);
            const on = presetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => {
                  setPresetId(preset.id);
                  setName(preset.name);
                  setError(null);
                }}
                style={{
                  width: "48%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: on ? preset.hex : "rgba(255,255,255,0.07)",
                  backgroundColor: on ? `${preset.hex}1A` : "rgba(255,255,255,0.035)",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <Icon size={18} color={preset.hex} strokeWidth={2} />
                <Text
                  numberOfLines={2}
                  style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: "600", color: "#fff" }}
                >
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Nome da meta</Text>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setPresetId(null);
            setError(null);
          }}
          placeholder="Ex: Entrada do apartamento"
          placeholderTextColor={INK.faint}
          maxLength={60}
          style={{
            marginTop: 8,
            height: 48,
            minWidth: 0,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: INK.edge,
            backgroundColor: "rgba(255,255,255,0.05)",
            paddingHorizontal: 16,
            fontSize: 15.5,
            color: "#fff",
          }}
        />

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Quanto custa</Text>
        <TextInput
          value={brl(cents)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 11);
            setCents(Math.min(Number(digits || "0"), 999999999));
            setError(null);
          }}
          keyboardType="number-pad"
          style={{
            marginTop: 8,
            minWidth: 0,
            fontSize: 34,
            fontWeight: "800",
            letterSpacing: -1.2,
            color: cents === 0 ? INK.faint : "#fff",
            padding: 0,
          }}
        />

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>
          Quanto guardar por mês (opcional)
        </Text>
        <TextInput
          value={monthlyCents === 0 ? "" : brl(monthlyCents)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 10);
            setMonthlyCents(Math.min(Number(digits || "0"), 99999999));
          }}
          keyboardType="number-pad"
          placeholder="Sem valor fixo"
          placeholderTextColor={INK.faint}
          style={{
            marginTop: 8,
            height: 48,
            minWidth: 0,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: INK.edge,
            backgroundColor: "rgba(255,255,255,0.05)",
            paddingHorizontal: 16,
            fontSize: 15.5,
            color: "#fff",
          }}
        />
        {months > 0 && (
          <Text style={{ marginTop: 8, fontSize: 12.5, color: INK.soft }}>
            Nesse ritmo, {months} {months === 1 ? "mês" : "meses"} até chegar lá.
          </Text>
        )}

        {error && <Text style={{ marginTop: 16, fontSize: 13, color: RED }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: saving ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
            {saving ? "Salvando..." : "Salvar meta"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
