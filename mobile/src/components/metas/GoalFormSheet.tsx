import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { GOAL_PRESET_DATA, goalPresetIcon } from "~/lib/goalIcon";
import { earns } from "~/lib/yields";
import { deadlineIn, monthYear, monthlyNeeded, monthsUntil } from "~/lib/caixinha";
import { money } from "~/lib/money";
import BottomSheet from "~/components/BottomSheet";
import { Check, X } from "~/components/icons";
import { INK, RED } from "~/theme/tokens";

/**
 * Changing a caixinha: its name, whether it has an amount to reach, by when, and
 * whether it earns.
 *
 * It offers the goals people are actually saving for, because choosing from a list is
 * faster than writing from nothing and the one you pick carries its own glyph and
 * colour for free. The monthly amount is optional: one with no monthly figure is still
 * a caixinha, it just cannot say when it will arrive. One with no amount to reach, like
 * the reserve, is not asked for a date at all.
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
    yield_type: "cdi" | null;
    yield_percent: number | null;
  }) => Promise<void> | void;
  title: string;
  initial?: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
    deadline?: string | null;
    yield_type?: "cdi" | null;
    yield_percent?: number | null;
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
  /* No amount to reach at all, like the reserve. */
  const [hasValue, setHasValue] = useState(true);
  const [earning, setEarning] = useState(false);
  const [percent, setPercent] = useState("100");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setHasValue(initial ? Number(initial.target_amount) > 0 : true);
    setCents(Math.round((initial?.target_amount ?? 5000) * 100));
    setEarning(initial ? earns({ yield_type: initial.yield_type ?? null, yield_percent: initial.yield_percent ?? null }) : false);
    setPercent(initial?.yield_percent ? String(initial.yield_percent).replace(".", ",") : "100");
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
      setError("Dê um nome à caixinha.");
      return;
    }
    if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
      setError("Você já tem uma caixinha com esse nome.");
      return;
    }
    if (hasValue && cents <= 0) {
      setError("Diga quanto quer juntar, ou marque sem valor definido.");
      return;
    }
    const share = Number(percent.replace(",", "."));
    if (earning && !(Number.isFinite(share) && share >= 1 && share <= 500)) {
      setError("Diga quanto do CDI ela rende, por exemplo 100.");
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
        target_amount: hasValue ? cents / 100 : 0,
        monthly_contribution: dated ? monthlyNeeded(Math.max(cents / 100 - saved, 0), span) || null : hasValue && monthlyCents > 0 ? monthlyCents / 100 : null,
        deadline: dated ? (kept ?? deadlineIn(span)) : null,
        yield_type: earning ? "cdi" : null,
        yield_percent: earning ? Math.round(share * 100) / 100 : null,
      });
    } catch {
      setError("Não foi possível salvar a caixinha.");
    } finally {
      setSaving(false);
    }
  };

  /* With a monthly figure, the goal can say when it arrives — which is the one thing
     a target on its own never tells you. */
  const reach =
    monthlyCents > 0 ? Math.ceil(cents / monthlyCents) : 0;
  /* Without an amount to reach there is no date to arrive on. */
  const dated = span > 0 && hasValue;
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

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Nome da caixinha</Text>
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

        <View style={{ marginTop: 20, flexDirection: "row", gap: 8 }}>
          {[
            { label: "Valor definido", on: hasValue, set: true },
            { label: "Sem valor definido", on: !hasValue, set: false },
          ].map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                setHasValue(o.set);
                setError(null);
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: o.on ? "#fff" : "rgba(255,255,255,0.09)",
                backgroundColor: o.on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
              }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        {hasValue && (
          <>
            <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Quanto quer juntar</Text>
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
          </>
        )}

        {hasValue && (
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
        ) : hasValue ? (
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
        ) : null}

        {/* Whether the money in it earns. */}
        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Rendimento</Text>
        <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
          {[
            { label: "Não rende", on: !earning, set: false },
            { label: "Rende (CDI)", on: earning, set: true },
          ].map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                setEarning(o.set);
                setError(null);
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: o.on ? "#fff" : "rgba(255,255,255,0.09)",
                backgroundColor: o.on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
              }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {earning && (
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              value={percent}
              onChangeText={(t) => {
                setPercent(t.replace(/[^0-9,.]/g, "").slice(0, 6));
                setError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={INK.faint}
              style={{
                width: 110,
                height: 48,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: INK.edge,
                backgroundColor: "rgba(255,255,255,0.05)",
                textAlign: "center",
                fontSize: 16,
                fontWeight: "700",
                color: "#fff",
              }}
            />
            <Text style={{ fontSize: 15, color: INK.soft }}>% do CDI</Text>
          </View>
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
            {saving ? "Salvando..." : "Salvar caixinha"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
