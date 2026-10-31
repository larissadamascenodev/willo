import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, FadeIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { categoryHex } from "@/lib/categoryData";
import ParticleOrb from "~/components/registro/ParticleOrb";
import ReceiptCard, { type ReceiptLine } from "~/components/registro/ReceiptCard";
import { Banknote, CalendarClock, Check, ChevronLeft, ChevronRight, Download, Minus, Plus, Repeat as RepeatIcon, Share2, Tag } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { saveReceipt, shareReceipt } from "~/lib/receiptShare";
import { showToast } from "~/lib/toast";
import { AMBER, INCOME, INK } from "~/theme/tokens";

/**
 * The pieces the entry flows share — Registro rápido, the guided manual entry and the
 * editor: the card of what an entry became, the large answers, the fields of the check,
 * the instalment bar, and the saved screen with its receipt.
 */

export type Kind = "despesa" | "receita";
export type Method = "conta" | "cartao";

export interface Account {
  id: string;
  name: string;
  color: string | null;
  type?: string;
}
export interface Card {
  id: string;
  name: string;
  color: string | null;
  limit?: number | null;
  used_limit?: number | null;
  closing_day?: number | null;
}

export const GLASS = { borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(255,255,255,0.05)" } as const;

export const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff === -1) return "Amanhã";
  return `${d} ${MONTHS[m - 1]}`;
}

export const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** The invoice a purchase on this day falls in: on or after the closing day, the next one — as the database bills it. */
export function invoiceMonthOf(iso: string, closingDay: number | null | undefined) {
  const [y, m, d] = iso.split("-").map(Number);
  const next = closingDay != null && d >= closingDay;
  const month = next ? (m === 12 ? 1 : m + 1) : m;
  const year = next && m === 12 ? y + 1 : y;
  return { month, year, label: MONTH_NAMES[month - 1] };
}

/* How many instalments: the usual ones in the bar, any other on the stepper behind "Mais". */
const QUICK_PARTS = [2, 3, 4, 5];
const MAX_PARTS = 48;

/** What it became, small: what and its category, the amount, when, and how it was paid. */
export function EntryCard({
  name,
  cents,
  type,
  category,
  when,
  pay,
  parts,
  payMissing,
}: {
  name: string;
  cents: number;
  type: Kind;
  category: string | null;
  when: string | null;
  pay: string | null;
  /** "5x de R$ 100,00", "À vista", "Recorrente" — once known. */
  parts?: string | null;
  payMissing?: string | null;
}) {
  const Icon = category ? categoryIcon(category) : Tag;
  const hex = category ? categoryHex(category) : "#8B8D94";
  const income = type === "receita";
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
          <Icon size={18} color={chipInk(hex)} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: name ? "#fff" : INK.faint }}>
            {name || "Descrição"}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, color: category ? INK.soft : AMBER }}>
            {category ?? "Falta a categoria"}
          </Text>
        </View>
        <Text style={[nums, { fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: income ? INCOME : "#fff" }]}>
          {income ? "+" : "−"}
          {money(cents / 100)}
        </Text>
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {when ? <Pill label={when} /> : null}
        {pay ? <Pill label={pay} /> : payMissing ? <Pill label={payMissing} warn /> : null}
        {parts ? <Pill label={parts} /> : null}
      </View>
    </View>
  );
}

export function Pill({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: "center", backgroundColor: warn ? "rgba(249,206,78,0.12)" : "rgba(255,255,255,0.07)" }}>
      <Text style={{ fontSize: 12.5, fontWeight: "500", color: warn ? AMBER : "rgba(255,255,255,0.8)" }}>{label}</Text>
    </View>
  );
}

/** An answer, as a large glass button: two or three share a row, more go two by two. The one already chosen, lit. */
export function Choice({ icon, label, wide, on, onPress }: { icon: React.ReactNode; label: string; wide?: boolean; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: wide ? "45%" : 0,
        minWidth: 100,
        height: 56,
        borderRadius: 20,
        borderCurve: "continuous",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.16)",
        backgroundColor: pressed || on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon}
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: "700", color: "#fff" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* The phone's own switch, measured: a 63×28 track, a 36×24 capsule inside it. */
const TRACK_W = 63;
const TRACK_H = 28;
const KNOB_W = 36;
const KNOB_H = 24;
const INSET = 2;
const TRAVEL = TRACK_W - KNOB_W - INSET * 2;
const SWITCH_OFF = "rgba(120,120,128,0.36)";

/**
 * On or off, the way the phone draws it: a white capsule inside the track, sliding
 * across with a soft ease while the track turns green behind it.
 */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (on: boolean) => void; label: string }) {
  const at = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    at.set(withTiming(value ? 1 : 0, { duration: 260, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
  }, [value, at]);

  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(at.get(), [0, 1], [SWITCH_OFF, INCOME]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: at.get() * TRAVEL }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onChange(!value);
      }}
    >
      <Animated.View style={[{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: INSET, justifyContent: "center" }, track]}>
        <Animated.View style={[{ width: KNOB_W, height: KNOB_H, borderRadius: KNOB_H / 2, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }, knob]} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Where in the steps: Voltar at the left when there is a step to go back to, the step
 * centred in the room beside it, and the bars under them.
 */
export function StepHeader({ label, stage, total, onBack }: { label: string; stage: number; total: number; onBack?: () => void }) {
  return (
    <>
      {/* Voltar first, then the step centred in the room left beside it — never touching. */}
      <View style={{ minHeight: 30, flexDirection: "row", alignItems: "center", gap: 16 }}>
        {onBack && (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, height: 30, paddingLeft: 6, paddingRight: 11, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}
          >
            <ChevronLeft size={15} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>Voltar</Text>
          </Pressable>
        )}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,255,255,0.72)" }}>
          {label}
        </Text>
      </View>
      <View style={{ marginTop: 8, flexDirection: "row", gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < stage ? "#fff" : "rgba(255,255,255,0.12)" }} />
        ))}
      </View>
    </>
  );
}

/** A small choice in a row of them; the chosen one lit. */
export function Chip({ label, on, onPress, height = 48 }: { label: string; on: boolean; onPress: () => void; height?: number }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        height,
        borderRadius: height / 2.6,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.14)",
        backgroundColor: on ? "#fff" : pressed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)",
      })}
    >
      <Text numberOfLines={1} style={{ fontSize: height < 44 ? 14 : 16, fontWeight: "700", color: on ? "#0B0B0B" : "#fff" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StepButton({ icon, label, disabled, onPress }: { icon: React.ReactNode; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", opacity: disabled ? 0.3 : pressed ? 0.6 : 1 })}
    >
      {icon}
    </Pressable>
  );
}

/**
 * How many instalments: one bar — 2x to 5x, and "Mais" for a stepper up to 48x — and,
 * once one is chosen, what each instalment comes to and the total.
 */
export function PartsBar({ cents, value, onChange }: { cents: number; value: number | null; onChange: (n: number) => void }) {
  const [more, setMore] = useState(value != null && value > QUICK_PARTS[QUICK_PARTS.length - 1]);
  const n = value ?? 6;
  return (
    <View>
      {more ? (
        <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.07)" }}>
          <StepButton icon={<Minus size={18} color="#fff" strokeWidth={2.4} />} label="Menos uma parcela" disabled={n <= 2} onPress={() => onChange(Math.max(2, n - 1))} />
          <Text style={[nums, { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }]}>{n}x</Text>
          <StepButton icon={<Plus size={18} color="#fff" strokeWidth={2.4} />} label="Mais uma parcela" disabled={n >= MAX_PARTS} onPress={() => onChange(Math.min(MAX_PARTS, n + 1))} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {QUICK_PARTS.map((q) => (
            <Chip key={q} label={`${q}x`} on={value === q} onPress={() => onChange(q)} />
          ))}
          <Chip
            label="Mais"
            on={false}
            onPress={() => {
              setMore(true);
              onChange(value && value > QUICK_PARTS[QUICK_PARTS.length - 1] ? value : 6);
            }}
          />
        </View>
      )}
      {value ? (
        <Text style={[nums, { marginTop: 12, fontSize: 14.5, color: INK.soft }]}>
          <Text style={{ fontWeight: "800", color: "#fff" }}>
            {value}x de {money(cents / 100 / value)}
          </Text>
          {"  ·  "}total {money(cents / 100)}
        </Text>
      ) : null}
    </View>
  );
}

export type Repeat = "unica" | "parcelado" | "fixa";

export const REPEAT_LABEL: Record<Repeat, string> = { unica: "Única", parcelado: "Parcelada", fixa: "Recorrente" };
export const REPEAT_NOTE: Record<Repeat, string> = { unica: "Só desta vez", parcelado: "Dividida em parcelas", fixa: "Todo mês, até você cancelar" };

const REPEAT_ICON: Record<Repeat, typeof Banknote> = { unica: Banknote, parcelado: CalendarClock, fixa: RepeatIcon };

/**
 * Once, in instalments or every month: one tile under the other, each with its mark,
 * what it is and what it means; the chosen one lit, with a tick.
 */
export function RepeatList({ value, income, onPick }: { value: Repeat | null; income: boolean; onPick: (r: Repeat) => void }) {
  const options: Repeat[] = income ? ["unica", "fixa"] : ["unica", "parcelado", "fixa"];
  return (
    <View style={{ gap: 8 }}>
      {options.map((r) => {
        const on = value === r;
        const Icon = REPEAT_ICON[r];
        return (
          <Pressable
            key={r}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              onPick(r);
            }}
            style={({ pressed }) => ({
              minHeight: 64,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 20,
              borderCurve: "continuous",
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? "#fff" : "rgba(255,255,255,0.12)",
              backgroundColor: pressed ? "rgba(255,255,255,0.12)" : on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fff" : "rgba(255,255,255,0.08)" }}>
              <Icon size={19} color={on ? "#0B0B0B" : "#fff"} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16.5, fontWeight: "700", letterSpacing: -0.2, color: "#fff" }}>{REPEAT_LABEL[r]}</Text>
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.soft }}>
                {REPEAT_NOTE[r]}
              </Text>
            </View>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: on ? "#fff" : "transparent" }}>
              {on ? <Check size={14} color="#0B0B0B" strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One field that opens the categories, not a row of guesses. */
export function CategoryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: pressed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)" })}
    >
      <Tag size={18} color="#fff" strokeWidth={2.1} />
      <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "#fff" }}>Escolher categoria</Text>
      <ChevronRight size={18} color={INK.soft} />
    </Pressable>
  );
}

export function Field({ label, changeable, children, style }: { label: string; changeable?: boolean; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.04)" }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 5 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, color: INK.softer }}>
          {label}
        </Text>
        {changeable ? <ChevronRight size={12} color={INK.softer} /> : null}
      </View>
      {children}
    </View>
  );
}

export function Primary({ label, onPress, disabled, busy, tight }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tight?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ marginTop: tight ? 10 : 16, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: "#fff", opacity: disabled && !busy ? 0.35 : pressed ? 0.85 : 1 })}
    >
      {busy && <ActivityIndicator color="#0B0B0B" />}
      <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>{label}</Text>
    </Pressable>
  );
}

export function Secondary({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 })}
    >
      {icon}
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Saved: the receipt, and what to do with it — share it, keep it in the gallery, close,
 * or see it where it lives (the card's invoice for a purchase on a card).
 */
export function SavedView({
  line,
  savedAt,
  title,
  onLanded,
  onClose,
  onSee,
  seeLabel,
}: {
  line: ReceiptLine;
  savedAt: Date;
  /** "Gasto registrado", "Gasto agendado"… */
  title?: string;
  onLanded?: () => void;
  onClose: () => void;
  onSee: () => void;
  seeLabel: string;
}) {
  const receiptRef = useRef<ComponentRef<typeof View>>(null);
  const sign = line.type === "receita" ? "+" : "−";
  return (
    <Animated.View key="done" entering={FadeIn.duration(240)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ParticleOrb size={34} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 21, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>{title ?? (line.type === "receita" ? "Receita registrada" : "Gasto registrado")}</Text>
          <Text style={{ marginTop: 1, fontSize: 13, color: INK.soft }}>Anotado pelo Willo às {hhmm(savedAt)}</Text>
        </View>
      </View>
      <View ref={receiptRef} collapsable={false} style={{ marginTop: 10, paddingTop: 2, paddingBottom: 4 }}>
        <ReceiptCard when={savedAt} onLanded={onLanded} lines={[line]} />
      </View>

      <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
        <Secondary
          icon={<Share2 size={16} color="#fff" />}
          label="Compartilhar"
          onPress={() => void shareReceipt(receiptRef, `Willo · ${line.name} · ${sign}${money(line.amount)} · ${line.category} · ${savedAt.toLocaleDateString("pt-BR")}`)}
        />
        <Secondary
          icon={<Download size={16} color="#fff" />}
          label="Salvar"
          onPress={() =>
            void saveReceipt(receiptRef).then((r) =>
              showToast(r === "saved" ? "Comprovante salvo na galeria" : r === "denied" ? "Libere o acesso às fotos para salvar" : "Salvar na galeria chega com a nova versão do app"),
            )
          }
        />
      </View>
      <Primary label="Concluir" onPress={onClose} tight />
      <Pressable onPress={onSee} style={({ pressed }) => ({ marginTop: 2, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>{seeLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}
