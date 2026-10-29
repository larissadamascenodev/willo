import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, type TextStyle } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { QuickDraft, QuickSetup } from "@/lib/quickEntry/types";
import BottomSheet from "~/components/BottomSheet";
import ParticleOrb from "~/components/registro/ParticleOrb";
import ReceiptCard, { type ReceiptLine } from "~/components/registro/ReceiptCard";
import { Check, Pencil, Tag, Undo2 } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import type { VoiceEntry } from "~/lib/voiceEntry";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * What was heard, for a look before it is written — and the receipt once it is.
 *
 * Willo's own mark at the top, the words as they were heard, and then what they
 * became, set on a card of glass: for one entry, its figure large, with what it is
 * and when and how it was paid; for several, one row each and a total. The pencil
 * turns the card into fields — a name and an amount can be put right where they
 * are. If the app could not know something it asks underneath, with the answers as
 * large buttons, and answering the last one writes the entry: that answer is the
 * yes. With nothing to ask, a button confirms.
 *
 * Once it is written the sheet shows the receipt, arriving, and offers to take it
 * back; it goes by itself after a while, since the point of speaking was that it
 * was quick.
 */

const SAVED_FOR_MS = 7500;
const GLASS = { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(255,255,255,0.05)" } as const;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return `${d} ${MONTHS[m - 1]}`;
}

function how(draft: QuickDraft, setup: QuickSetup) {
  if (draft.paymentMethod === "cartao") {
    const card = setup.cards.find((c) => c.id === draft.creditCardId);
    return card ? `Crédito · ${card.name}` : "Crédito";
  }
  if (draft.paymentMethod === "conta") {
    const account = setup.accounts.find((a) => a.id === draft.accountId);
    return account ? `Débito · ${account.name}` : "Débito";
  }
  return null;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VoiceEntrySheet({ entry }: { entry: VoiceEntry }) {
  const { state, lines, transcript, question, categoryChips, setup, message } = entry;
  const open = state === "confirm" || state === "saving" || state === "saved";
  const saved = state === "saved";
  const busy = state === "saving";
  const [editing, setEditing] = useState(false);

  /* A new round starts out of the editor. */
  useEffect(() => {
    if (state === "idle") setEditing(false);
  }, [state]);

  /* It goes by itself, a while after the receipt has finished arriving. */
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(entry.reset, SAVED_FOR_MS);
    return () => clearTimeout(t);
  }, [saved, entry.reset]);

  const total = lines.reduce((t, l) => t + (l.draft.type === "receita" ? l.draft.amount : -l.draft.amount), 0);
  const options = question && question.kind !== "category" ? question.options : [];
  const single = lines.length === 1 ? lines[0].draft : null;

  const receipt: ReceiptLine[] = lines.map((l) => ({
    id: l.draft.id,
    name: l.draft.name,
    category: l.draft.category ?? "Outros",
    amount: l.draft.amount,
    type: l.draft.type,
    method: how(l.draft, setup),
  }));

  return (
    <BottomSheet open={open} onClose={() => (saved ? entry.reset() : busy ? undefined : entry.reset())}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        {saved ? (
          <View style={{ paddingTop: 4 }}>
            <ReceiptCard lines={receipt} />
          </View>
        ) : (
          <>
            {/* ── Who is asking, and the way to put it right ── */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ParticleOrb size={38} mode={busy ? "thinking" : "idle"} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16.5, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
                  {editing ? "Corrija o que precisar" : "Confirme o que ouvi"}
                </Text>
                {transcript && !editing ? (
                  <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, fontStyle: "italic", color: INK.softer }}>
                    “{transcript}”
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setEditing((v) => !v)}
                disabled={busy}
                accessibilityLabel={editing ? "Concluir a edição" : "Editar"}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: editing ? "#fff" : "rgba(255,255,255,0.08)",
                  opacity: busy ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                {editing ? <Check size={18} color="#0B0B0B" strokeWidth={3} /> : <Pencil size={16} color="rgba(255,255,255,0.85)" />}
              </Pressable>
            </View>

            {/* ── What it became ── */}
            {single ? (
              <Animated.View entering={FadeInDown.duration(280)} style={[GLASS, { marginTop: 16, padding: 18 }]}>
                <HeroEntry d={single} setup={setup} editing={editing} onName={(t) => entry.edit(single.id, { name: t })} onAmount={(v) => entry.edit(single.id, { amount: v })} />
              </Animated.View>
            ) : (
              <View style={[GLASS, { marginTop: 16, paddingHorizontal: 16, paddingVertical: 4 }]}>
                {lines.map((l, i) => (
                  <Animated.View key={l.draft.id} entering={FadeInDown.delay(i * 50).duration(260)}>
                    <RowEntry
                      d={l.draft}
                      setup={setup}
                      editing={editing}
                      first={i === 0}
                      onName={(t) => entry.edit(l.draft.id, { name: t })}
                      onAmount={(v) => entry.edit(l.draft.id, { amount: v })}
                    />
                  </Animated.View>
                ))}
                {!editing && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" }}>
                    <Text style={{ fontSize: 13.5, color: INK.soft }}>Total</Text>
                    <Text style={[nums, { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.88)" }]}>
                      {total >= 0 ? "+" : "−"}
                      {money(Math.abs(total))}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {message ? <Text style={{ marginTop: 12, fontSize: 13.5, color: RED }}>{message}</Text> : null}

            {/* ── What is still to answer — and answering the last one writes it ── */}
            {question && !editing && (
              <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>{question.prompt}</Text>
                {options.length > 0 && (
                  <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {options.map((o) => (
                      <Pressable
                        key={o.id}
                        onPress={() => entry.answer(question, o.id)}
                        style={({ pressed }) => ({
                          flexGrow: 1,
                          flexBasis: options.length <= 3 ? 0 : "45%",
                          minWidth: 96,
                          height: 54,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#fff",
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                        })}
                      >
                        <Text numberOfLines={1} style={{ paddingHorizontal: 10, fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {categoryChips.length > 0 && (
                  <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {categoryChips.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => entry.answer(question, c)}
                        style={({ pressed }) => ({
                          height: 40,
                          paddingHorizontal: 16,
                          borderRadius: 20,
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.12)",
                          backgroundColor: "rgba(255,255,255,0.06)",
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        })}
                      >
                        <Text style={{ fontSize: 14.5, fontWeight: "500", color: "rgba(255,255,255,0.88)" }}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}
          </>
        )}

        {/* ── The decision ── */}
        <View style={{ marginTop: saved ? 22 : 18, gap: 6 }}>
          {saved ? (
            <Animated.View entering={FadeIn.delay(900).duration(300)} style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => void entry.undo()}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 52,
                  borderRadius: 26,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Undo2 size={16} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>Desfazer</Text>
              </Pressable>
              <Pressable
                onPress={entry.reset}
                style={({ pressed }) => ({ flex: 1.4, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>Concluir</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              {(!question || editing || busy) && (
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    void entry.confirm();
                  }}
                  disabled={busy || !!question}
                  style={({ pressed }) => ({
                    height: 56,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: busy ? 0.75 : question ? 0.35 : pressed ? 0.85 : 1,
                  })}
                >
                  {busy ? (
                    <ActivityIndicator color="#0B0B0B" />
                  ) : (
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>
                      {question ? "Falta responder" : lines.length > 1 ? `Confirmar ${lines.length}` : "Confirmar"}
                    </Text>
                  )}
                </Pressable>
              )}
              <Pressable onPress={entry.reset} disabled={busy} style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 15, fontWeight: "500", color: INK.soft }}>Cancelar</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

/** One entry, large: what it is, the figure, when, and how it was paid. */
function HeroEntry({
  d,
  setup,
  editing,
  onName,
  onAmount,
}: {
  d: QuickDraft;
  setup: QuickSetup;
  editing: boolean;
  onName: (t: string) => void;
  onAmount: (v: number) => void;
}) {
  const Icon = d.category ? categoryIcon(d.category) : Tag;
  const hex = d.category ? categoryHex(d.category) : "#8B8D94";
  const method = how(d, setup);
  const income = d.type === "receita";

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
          <Icon size={23} color={chipInk(hex)} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <TextInput
              value={d.name}
              onChangeText={onName}
              placeholder="Nome"
              placeholderTextColor={INK.faint}
              style={{ height: 40, paddingHorizontal: 12, borderRadius: 12, fontSize: 20, fontWeight: "700", color: "#fff", backgroundColor: "rgba(255,255,255,0.08)" }}
            />
          ) : (
            <Text numberOfLines={1} style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>
              {d.name}
            </Text>
          )}
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13.5, color: d.category ? INK.soft : AMBER }}>
            {d.category ?? "Falta a categoria"}
          </Text>
        </View>
      </View>

      {editing ? (
        <View style={{ marginTop: 16, height: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: INK.softer }}>{income ? "+ R$" : "− R$"}</Text>
          <TextInput
            value={brl(d.amount)}
            onChangeText={(t) => onAmount(Number(t.replace(/\D/g, "") || "0") / 100)}
            keyboardType="number-pad"
            style={[nums, { flex: 1, marginLeft: 8, fontSize: 34, fontWeight: "800", letterSpacing: -1, color: "#fff", padding: 0 }]}
          />
        </View>
      ) : (
        <Text numberOfLines={1} adjustsFontSizeToFit style={[nums, { marginTop: 16, fontSize: 44, fontWeight: "800", letterSpacing: -1.6, color: income ? GREEN : "#fff" }]}>
          {income ? "+" : "−"}
          {money(d.amount)}
        </Text>
      )}

      <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pill label={dayLabel(d.date)} />
        {method ? <Pill label={method} /> : <Pill label="Falta a forma de pagamento" warn />}
      </View>
    </View>
  );
}

/** One entry among several: a row. */
function RowEntry({
  d,
  setup,
  editing,
  first,
  onName,
  onAmount,
}: {
  d: QuickDraft;
  setup: QuickSetup;
  editing: boolean;
  first: boolean;
  onName: (t: string) => void;
  onAmount: (v: number) => void;
}) {
  const Icon = d.category ? categoryIcon(d.category) : Tag;
  const hex = d.category ? categoryHex(d.category) : "#8B8D94";
  const method = how(d, setup);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: "rgba(255,255,255,0.07)" }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
        <Icon size={17} color={chipInk(hex)} strokeWidth={2} />
      </View>
      {editing ? (
        <>
          <TextInput
            value={d.name}
            onChangeText={onName}
            placeholder="Nome"
            placeholderTextColor={INK.faint}
            style={{ flex: 1, minWidth: 0, height: 42, paddingHorizontal: 12, borderRadius: 12, fontSize: 16, fontWeight: "600", color: "#fff", backgroundColor: "rgba(255,255,255,0.08)" }}
          />
          <View style={{ width: 112, height: 42, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ fontSize: 13, color: INK.softer }}>R$</Text>
            <TextInput
              value={brl(d.amount)}
              onChangeText={(t) => onAmount(Number(t.replace(/\D/g, "") || "0") / 100)}
              keyboardType="number-pad"
              style={[nums, { flex: 1, minWidth: 0, marginLeft: 4, textAlign: "right", fontSize: 16, fontWeight: "700", color: "#fff", padding: 0 }]}
            />
          </View>
        </>
      ) : (
        <>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>
              {d.name}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: d.category ? INK.softer : AMBER }}>
              {[d.category ?? "Falta a categoria", dayLabel(d.date), method].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text style={[nums, { fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: d.type === "receita" ? GREEN : "#fff" }]}>
            {d.type === "receita" ? "+" : "−"}
            {money(d.amount)}
          </Text>
        </>
      )}
    </View>
  );
}

function Pill({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <View
      style={{
        height: 30,
        paddingHorizontal: 12,
        borderRadius: 15,
        justifyContent: "center",
        backgroundColor: warn ? "rgba(249,206,78,0.12)" : "rgba(255,255,255,0.07)",
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "500", color: warn ? AMBER : "rgba(255,255,255,0.8)" }}>{label}</Text>
    </View>
  );
}
