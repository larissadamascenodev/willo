import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ComponentRef } from "react";
import * as Haptics from "expo-haptics";
import { RESERVE_NAME } from "@/services/goalService";
import { deadlineIn, monthYear, monthlyNeeded, monthsUntil } from "~/lib/caixinha";
import { KIND_ORDER, coverKind, type CoverKind } from "~/lib/coverKind";
import { money } from "~/lib/money";
import BottomSheet from "~/components/BottomSheet";
import CoverArt from "~/components/accounts/CoverArt";
import { AmountField, Group, Row, Segments, Stepper, brl } from "~/components/accounts/caixinhaUi";
import { Check, Minus, Plus, X } from "~/components/icons";
import { INK, RED } from "~/theme/tokens";

/**
 * Changing a caixinha, in the same glass it was made in.
 *
 * What it is for (the pictures, as when it was made), its name, whether it has an amount
 * to reach and how much, and by when. A caixinha made "sem valor definido" can be given
 * one here, and the amount of one that has it can go up or down. The yield is not here
 * for now: what was set before is sent back untouched.
 */

const LABEL: Record<CoverKind, string> = {
  reserva: "Reserva",
  viagem: "Viagem",
  reforma: "Reforma",
  carreira: "Carreira",
  consumo: "Desejo",
  carro: "Carro",
  casa: "Casa",
  educacao: "Educação",
};

/** The name a caixinha takes when its purpose is changed to this. */
const NAME: Record<CoverKind, string> = {
  reserva: RESERVE_NAME,
  viagem: "Viagem dos Sonhos",
  reforma: "Reformar a casa",
  carreira: "Focar na carreira",
  consumo: "Sonho de consumo",
  carro: "Carro Novo",
  casa: "Casa Própria",
  educacao: "Educação",
};

const SPANS: { value: number | "more"; label: string }[] = [
  { value: 6, label: "6 meses" },
  { value: 12, label: "1 ano" },
  { value: 24, label: "2 anos" },
  { value: "more", label: "Outro" },
];

const spanLabel = (n: number) => {
  const y = Math.floor(n / 12);
  const m = n % 12;
  const years = y > 0 ? `${y} ${y === 1 ? "ano" : "anos"}` : "";
  const months = m > 0 ? `${m} ${m === 1 ? "mês" : "meses"}` : "";
  return [years, months].filter(Boolean).join(" e ");
};

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
  const [name, setName] = useState("");
  const [hasValue, setHasValue] = useState(true);
  const [cents, setCents] = useState(0);
  /* How long it is meant to take, in months; 0 is no date at all. */
  const [span, setSpan] = useState(0);
  const [more, setMore] = useState(false);
  const [monthlyCents, setMonthlyCents] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!open) return;
    const months = initial?.deadline ? monthsUntil(initial.deadline) : 0;
    setName(initial?.name ?? "");
    setHasValue(initial ? Number(initial.target_amount) > 0 : true);
    setCents(Math.round(Number(initial?.target_amount ?? 0) * 100));
    setSpan(months);
    setMore(months > 0 && ![6, 12, 24].includes(months));
    setMonthlyCents(Math.round(Number(initial?.monthly_contribution ?? 0) * 100));
    setError(null);
    setSaving(false);
  }, [open, initial]);

  const kind = coverKind(name);
  const dated = hasValue && span > 0;
  const perMonth = dated ? monthlyNeeded(Math.max(cents / 100 - saved, 0), span) : 0;
  const segment: number | "more" | null = span === 0 ? null : more ? "more" : span;

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
      setError("Diga quanto quer juntar, ou escolha sem valor definido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      /* A date that was not touched stays the date it was, rather than sliding to
         "N months from today" every time the caixinha is saved. */
      const kept = initial?.deadline && span === monthsUntil(initial.deadline) ? initial.deadline : null;
      await onSubmit({
        name: trimmed,
        target_amount: hasValue ? cents / 100 : 0,
        monthly_contribution: dated ? perMonth || null : hasValue && monthlyCents > 0 ? monthlyCents / 100 : null,
        deadline: dated ? (kept ?? deadlineIn(span)) : null,
        yield_type: initial?.yield_type ?? null,
        yield_percent: initial?.yield_percent ?? null,
      });
    } catch {
      setError("Não foi possível salvar a caixinha.");
    } finally {
      setSaving(false);
    }
  };

  const label = (t: string) => <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>{t}</Text>;

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{title}</Text>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              backgroundColor: "rgba(255,255,255,0.07)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={16} color="rgba(255,255,255,0.86)" strokeWidth={2.3} />
          </Pressable>
        </View>

        {/* ══ What it is for ══ */}
        <View style={{ marginTop: 20 }}>{label("Objetivo")}</View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ marginHorizontal: -20, marginTop: 10 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {KIND_ORDER.map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setName(NAME[k]);
                  if (k === "reserva") setHasValue(false);
                  setError(null);
                }}
                style={({ pressed }) => ({ alignItems: "center", transform: [{ scale: pressed ? 0.96 : 1 }] })}
              >
                <View
                  style={{
                    width: 84,
                    height: 64,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.12)",
                  }}
                >
                  <CoverArt kind={k} />
                  {on && (
                    <View style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
                      <Check size={12} color="#0B0B0B" strokeWidth={3.2} />
                    </View>
                  )}
                </View>
                <Text style={{ marginTop: 6, fontSize: 12, fontWeight: on ? "700" : "500", color: on ? "#fff" : INK.soft }}>{LABEL[k]}</Text>
              </Pressable>
            );
          })}
          {/* Their own: the name is cleared to be written. */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              setName("");
              setError(null);
              nameRef.current?.focus();
            }}
            style={({ pressed }) => ({ alignItems: "center", transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <View
              style={{
                width: 84,
                height: 64,
                borderRadius: 18,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: kind === null ? 2 : 1,
                borderColor: kind === null ? "#fff" : "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.07)",
              }}
            >
              <Plus size={20} color="#fff" strokeWidth={2.2} />
            </View>
            <Text style={{ marginTop: 6, fontSize: 12, fontWeight: kind === null ? "700" : "500", color: kind === null ? "#fff" : INK.soft }}>Personalizado</Text>
          </Pressable>
        </ScrollView>

        {/* ══ Name and amount ══ */}
        <Group style={{ marginTop: 18 }}>
          <Row>
            {label("Nome")}
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(null);
              }}
              placeholder="Ex.: Viagem para o Japão"
              placeholderTextColor={INK.faint}
              maxLength={60}
              style={{ marginTop: 4, minWidth: 0, padding: 0, fontSize: 17, fontWeight: "600", color: "#fff" }}
            />
          </Row>
          <Row last={!hasValue}>
            {label("Valor")}
            <View style={{ marginTop: 10 }}>
              <Segments
                height={42}
                value={hasValue ? "com" : "sem"}
                options={[
                  { value: "com", label: "Com meta" },
                  { value: "sem", label: "Sem valor definido" },
                ]}
                onChange={(v) => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setHasValue(v === "com");
                  setError(null);
                }}
              />
            </View>
          </Row>
          {hasValue && (
            <Row last>
              {label("Quanto quer juntar")}
              <AmountField cents={cents} onChange={(c) => { setCents(c); setError(null); }} size={34} />
              {saved > 0 && <Text style={{ marginTop: 4, fontSize: 12.5, color: INK.soft }}>{money(saved)} já guardados</Text>}
            </Row>
          )}
        </Group>

        {/* ══ By when ══ */}
        {hasValue && (
          <>
            <View style={{ marginTop: 20, marginBottom: 10 }}>{label("Prazo")}</View>
            <Segments
              height={46}
              value={segment}
              options={SPANS}
              onChange={(v) => {
                void Haptics.selectionAsync().catch(() => undefined);
                if (v === "more") {
                  setMore(true);
                  setSpan((s) => (s > 0 && ![6, 12, 24].includes(s) ? s : 36));
                } else {
                  setMore(false);
                  setSpan(v);
                }
              }}
            />

            <Pressable
              onPress={() => {
                setMore(false);
                setSpan(span === 0 ? 12 : 0);
              }}
              hitSlop={10}
              style={{ alignSelf: "center", marginTop: 12, paddingVertical: 2 }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>{span === 0 ? "Definir um prazo" : "Não tem prazo"}</Text>
            </Pressable>

            {more && span > 0 && (
              <Group style={{ marginTop: 10 }}>
                <Row last>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Stepper icon={Minus} label="Menos seis meses" disabled={span <= 6} onPress={() => setSpan(Math.max(6, span - 6))} />
                    <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{spanLabel(span)}</Text>
                    <Stepper icon={Plus} label="Mais seis meses" disabled={span >= 360} onPress={() => setSpan(Math.min(360, span + 6))} />
                  </View>
                </Row>
              </Group>
            )}

            <Group style={{ marginTop: 10 }}>
              <Row last>
                {dated ? (
                  <>
                    {label(`Para chegar em ${monthYear(deadlineIn(span))}`)}
                    <Text style={{ marginTop: 4, fontSize: 28, fontWeight: "800", letterSpacing: -1, color: "#fff" }}>
                      {money(perMonth)}
                      <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: 0, color: INK.soft }}> por mês</Text>
                    </Text>
                  </>
                ) : (
                  <>
                    {label("Quanto por mês (opcional)")}
                    <TextInput
                      value={monthlyCents === 0 ? "" : brl(monthlyCents)}
                      onChangeText={(t) => {
                        const digits = t.replace(/\D/g, "").slice(0, 10);
                        setMonthlyCents(Math.min(Number(digits || "0"), 99999999));
                      }}
                      keyboardType="number-pad"
                      placeholder="Conforme der"
                      placeholderTextColor={INK.faint}
                      style={{ marginTop: 4, minWidth: 0, padding: 0, fontSize: 22, fontWeight: "700", color: "#fff" }}
                    />
                  </>
                )}
              </Row>
            </Group>
          </>
        )}

        {error && <Text style={{ marginTop: 16, fontSize: 13.5, lineHeight: 18, color: RED }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: saving ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>{saving ? "Salvando…" : "Salvar alterações"}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
