import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { GOAL_PRESET_DATA, goalPresetIcon } from "~/lib/goalIcon";
import { isReserveGoal } from "@/services/goalService";
import { deadlineIn, monthYear, monthlyNeeded, monthsUntil } from "~/lib/cofrinho";
import { money } from "~/lib/money";
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
  saved = 0,
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
    deadline: string | null;
  }) => Promise<void> | void;
  title: string;
  initial?: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
    deadline?: string | null;
  };
  /** What is already in the goal, so the monthly figure is for what is left. */
  saved?: number;
  existingNames?: string[];
}) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cents, setCents] = useState(500000);
  const [monthlyCents, setMonthlyCents] = useState(0);
  /* How long it is meant to take; none is a goal without a date. */
  const [span, setSpan] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCents(Math.round((initial?.target_amount ?? 5000) * 100));
    setMonthlyCents(Math.round((initial?.monthly_contribution ?? 0) * 100));
    setSpan(initial?.deadline ? monthsUntil(initial.deadline) : 0);
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
      /* A date that was not touched stays the date it was, rather than sliding to
         "N months from today" every time the goal is saved. */
      const kept = initial?.deadline && span === monthsUntil(initial.deadline) ? initial.deadline : null;
      await onSubmit({
        name: trimmed,
        target_amount: cents / 100,
        monthly_contribution: dated ? monthlyNeeded(Math.max(cents / 100 - saved, 0), span) || null : monthlyCents > 0 ? monthlyCents / 100 : null,
        deadline: dated ? (kept ?? deadlineIn(span)) : null,
      });
    } catch {
      setError("Não foi possível salvar a meta.");
    } finally {
      setSaving(false);
    }
  };

  /* With a monthly figure, the goal can say when it arrives — which is the one thing
     a target on its own never tells you. */
  const reach =
    monthlyCents > 0 ? Math.ceil(cents / monthlyCents) : 0;
  /* The reserve has no date: it is filled as you go. */
  const dated = span > 0 && !isReserveGoal({ name });
  const perMonth = dated ? monthlyNeeded(Math.max(cents / 100 - saved, 0), span) : 0;
  const spans = [0, 6, 12, 24, 36, 60].includes(span) ? [0, 6, 12, 24, 36, 60] : [0, span, 6, 12, 24, 36, 60].sort((a, b) => a - b);
  const spanLabel = (n: number) =>
    n === 0 ? "Sem prazo" : n % 12 === 0 ? `${n / 12} ${n === 12 ? "ano" : "anos"}` : `${n} meses`;

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

        {!isReserveGoal({ name }) && (
          <>
            <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Em quanto tempo</Text>
            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {spans.map((n) => {
                const on = span === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setSpan(n)}
                    style={{
                      height: 38,
                      paddingHorizontal: 15,
                      borderRadius: 19,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: on ? "#fff" : "rgba(255,255,255,0.09)",
                      backgroundColor: on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>{spanLabel(n)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {dated ? (
          <View
            style={{
              marginTop: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.04)",
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={{ fontSize: 12.5, color: INK.soft }}>Para chegar em {monthYear(deadlineIn(span))}, guarde</Text>
            <Text style={{ marginTop: 3, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
              {money(perMonth)}
              <Text style={{ fontSize: 13.5, fontWeight: "500", letterSpacing: 0, color: INK.soft }}> por mês</Text>
            </Text>
          </View>
        ) : (
          <>
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
            {reach > 0 && (
              <Text style={{ marginTop: 8, fontSize: 12.5, color: INK.soft }}>
                Nesse ritmo, {reach} {reach === 1 ? "mês" : "meses"} até chegar lá.
              </Text>
            )}
          </>
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
