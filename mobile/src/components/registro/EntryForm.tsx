import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { Chip, Choice, PartsBar, REPEAT_LABEL, RepeatList, dayLabel, invoiceMonthOf, nums, type Account, type Card, type Kind, type Method, type Repeat } from "~/components/registro/entryParts";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, Landmark, Repeat as RepeatIcon, Tag } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";

/**
 * Everything about one entry on one page — the check of the guided entry, and the editor.
 *
 * Out or in at the top, then the amount, large; whether it is settled, a switch — off
 * until switched on — and on a card, which invoice it falls in; then the words. Under them
 * one group of rows — category, how it was paid, repetition, the day — each showing what
 * it is and opening its own choices under it when touched, one at a time.
 */

export type { Repeat };
export { REPEAT_LABEL };

export interface EntryValues {
  type: Kind;
  /** The whole amount; in instalments, the total of all of them. */
  cents: number;
  name: string;
  category: string | null;
  method: Method | null;
  whereId: string | null;
  repeat: Repeat;
  parts: number | null;
  date: string;
  status: "pago" | "pendente";
  /** Kept as it was; the check no longer asks for one. */
  note: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
const yesterdayIso = () => isoOf(new Date(Date.now() - 86_400_000));

/** Ahead of today: not paid yet — scheduled. */
export const isAhead = (iso: string) => iso > todayIso();

type Open = "pay" | "repeat" | "date" | null;

export default function EntryForm({
  values,
  onChange,
  accounts,
  cards,
  lockedCard,
  partOf,
  onPickCategory,
}: {
  values: EntryValues;
  onChange: (patch: Partial<EntryValues>) => void;
  accounts: Account[];
  cards: Card[];
  /** Started inside a card: credit on that card, not asked. */
  lockedCard?: boolean;
  /** One instalment of a purchase, "Parcela 3 de 10": its plan is the purchase's. */
  partOf?: string | null;
  onPickCategory: () => void;
}) {
  const v = values;
  const [open, setOpen] = useState<Open>(null);
  const toggle = (o: Exclude<Open, null>) => setOpen((cur) => (cur === o ? null : o));

  const income = v.type === "receita";
  const credit = !income && v.method === "cartao";
  const list: (Account | Card)[] = credit ? cards : accounts;
  const picked = list.find((o) => o.id === v.whereId) ?? null;
  const card = credit ? (cards.find((c) => c.id === v.whereId) ?? null) : null;
  const CatIcon = v.category ? categoryIcon(v.category) : Tag;
  const hex = v.category ? categoryHex(v.category) : "#8B8D94";
  const parcelado = v.repeat === "parcelado" && !!v.parts;

  const payValue = picked ? (income ? picked.name : `${credit ? "Crédito" : "Débito"} · ${picked.name}`) : null;
  const repeatValue = partOf ?? (parcelado && v.parts ? `${v.parts}x de ${money(v.cents / 100 / v.parts)}` : REPEAT_LABEL[v.repeat]);
  const dateValue = isAhead(v.date) ? `${dayLabel(v.date)} · agendado` : dayLabel(v.date);

  return (
    <View>
      {/* Out or in */}
      {!lockedCard && (
        <View style={{ marginTop: 14, flexDirection: "row", padding: 3, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.06)" }}>
          {(["despesa", "receita"] as const).map((t) => {
            const on = v.type === t;
            return (
              <Pressable
                key={t}
                onPress={() => onChange(t === "receita" ? { type: t, method: "conta", whereId: v.method === "conta" ? v.whereId : null, repeat: v.repeat === "parcelado" ? "unica" : v.repeat, parts: null } : { type: t })}
                style={({ pressed }) => ({ flex: 1, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(255,255,255,0.16)" : "transparent", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: on ? (t === "receita" ? GREEN : "#fff") : INK.soft }}>{t === "despesa" ? "Despesa" : "Receita"}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* The amount, large, and the words */}
      <View style={{ marginTop: 18, alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.4, color: INK.softer }}>
          {partOf ? "VALOR DA PARCELA" : parcelado ? "VALOR TOTAL" : v.repeat === "fixa" ? "VALOR POR MÊS" : "VALOR"}
        </Text>
        <TextInput
          value={money(v.cents / 100)}
          onChangeText={(t) => onChange({ cents: Math.min(Number(t.replace(/\D/g, "") || "0"), 99999999) })}
          keyboardType="number-pad"
          style={[nums, { marginTop: 2, padding: 0, minWidth: 160, textAlign: "center", fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: income ? GREEN : "#fff" }]}
        />
        {parcelado && v.parts ? (
          <Text style={[nums, { marginTop: 2, fontSize: 13.5, color: INK.soft }]}>
            {v.parts}x de {money(v.cents / 100 / v.parts)}
          </Text>
        ) : null}
      </View>
      {/* Whether it is settled — off until switched on. On a card, the invoice it falls in. */}
      <View style={{ marginTop: 14, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(255,255,255,0.04)" }}>
        <RowMark>{credit ? <CreditCard size={15} color="#fff" strokeWidth={2.1} /> : <Check size={15} color="#fff" strokeWidth={2.4} />}</RowMark>
        {credit ? (
          <Text style={{ flex: 1, fontSize: 14.5, color: INK.soft }}>
            Entra na fatura de <Text style={{ fontWeight: "700", color: "#fff" }}>{invoiceMonthOf(v.date, card?.closing_day).label}</Text>
            {card ? ` do ${card.name}` : ""}
          </Text>
        ) : (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{income ? "Já recebi" : "Já está pago"}</Text>
              <Text style={{ marginTop: 1, fontSize: 12.5, color: INK.soft }}>
                {v.status === "pago" ? (income ? "Entrou na conta" : "Saiu da conta") : isAhead(v.date) ? "Agendado" : income ? "A receber" : "Pendente"}
              </Text>
            </View>
            <Switch value={v.status === "pago"} onValueChange={(on) => onChange({ status: on ? "pago" : "pendente" })} trackColor={{ true: "rgba(200,243,109,0.42)", false: "rgba(255,255,255,0.14)" }} ios_backgroundColor="rgba(255,255,255,0.14)" thumbColor="#fff" />
          </>
        )}
      </View>
      <TextInput
        value={v.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={40}
        placeholder="Descrição"
        placeholderTextColor={INK.faint}
        style={{ marginTop: 14, height: 50, borderRadius: 18, paddingHorizontal: 16, textAlign: "center", fontSize: 17, fontWeight: "600", color: "#fff", backgroundColor: "rgba(255,255,255,0.06)" }}
      />

      {/* What it is, how it was paid, whether it repeats, the day */}
      <View style={{ marginTop: 14, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
        <Row
          first
          icon={
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
              <CatIcon size={15} color={chipInk(hex)} strokeWidth={2.2} />
            </View>
          }
          label="Categoria"
          value={v.category}
          missing="Escolher"
          onPress={onPickCategory}
        />

        <Row
          icon={<RowMark>{picked ? <BankMark name={picked.name} hex={colorFor(picked.name, picked.color)} size={32} /> : credit ? <CreditCard size={15} color="#fff" /> : <Landmark size={15} color="#fff" />}</RowMark>}
          label={income ? "Entrou em" : "Pagamento"}
          value={payValue}
          missing="Escolher"
          open={open === "pay"}
          disabled={lockedCard}
          onPress={() => toggle("pay")}
        />
        {open === "pay" && !lockedCard && (
          <Animated.View entering={FadeIn.duration(180)} style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            {!income && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Choice icon={<Landmark size={18} color="#fff" strokeWidth={2.1} />} label="Débito" on={v.method === "conta"} onPress={() => onChange({ method: "conta", whereId: accounts.length === 1 ? accounts[0].id : null })} />
                <Choice icon={<CreditCard size={18} color="#fff" strokeWidth={2.1} />} label="Crédito" on={v.method === "cartao"} onPress={() => onChange({ method: "cartao", whereId: cards.length === 1 ? cards[0].id : null })} />
              </View>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {list.map((o) => (
                <Choice
                  key={o.id}
                  wide
                  on={v.whereId === o.id}
                  icon={<BankMark name={o.name} hex={colorFor(o.name, o.color)} size={26} />}
                  label={o.name}
                  onPress={() => {
                    onChange({ whereId: o.id });
                    setOpen(null);
                  }}
                />
              ))}
            </View>
          </Animated.View>
        )}

        <Row
          icon={
            <RowMark>
              <RepeatIcon size={15} color="#fff" strokeWidth={2.1} />
            </RowMark>
          }
          label="Repetição"
          value={repeatValue}
          open={open === "repeat"}
          disabled={!!partOf}
          onPress={() => toggle("repeat")}
        />
        {open === "repeat" && !partOf && (
          <Animated.View entering={FadeIn.duration(180)} style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
            <RepeatList
              value={v.repeat}
              income={income}
              onPick={(r: Repeat) => {
                onChange({ repeat: r, parts: r === "parcelado" ? (v.parts ?? 2) : null });
                if (r !== "parcelado") setOpen(null);
              }}
            />
            {v.repeat === "parcelado" && <PartsBar cents={v.cents} value={v.parts} onChange={(parts) => onChange({ parts })} />}
          </Animated.View>
        )}

        <Row
          icon={
            <RowMark>
              <CalendarDays size={15} color="#fff" strokeWidth={2.1} />
            </RowMark>
          }
          label={v.repeat === "fixa" ? "A partir de" : "Data"}
          value={dateValue}
          open={open === "date"}
          onPress={() => toggle("date")}
        />
        {open === "date" && (
          <Animated.View entering={FadeIn.duration(180)} style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <DatePick values={v} onChange={onChange} cards={cards} quiet onPicked={() => setOpen(null)} />
          </Animated.View>
        )}
      </View>

    </View>
  );
}

/** The round mark at the start of a row. */
function RowMark({ children }: { children: React.ReactNode }) {
  return <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>{children}</View>;
}

/** One line of the group: its mark, what it is, what it is set to; touched, its choices open under it. */
function Row({
  icon,
  label,
  value,
  missing,
  open,
  first,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  missing?: string;
  open?: boolean;
  first?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(255,255,255,0.07)",
        backgroundColor: pressed ? "rgba(255,255,255,0.06)" : "transparent",
      })}
    >
      {icon}
      <Text style={{ fontSize: 14.5, color: INK.soft }}>{label}</Text>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", fontSize: 15, fontWeight: "600", color: value ? "#fff" : AMBER }}>
        {value ?? missing ?? ""}
      </Text>
      {!disabled && (
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <ChevronRight size={16} color={INK.softer} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * The day: today, yesterday or one from the calendar. A day ahead makes it scheduled;
 * on a card it says which invoice it falls in, by the card's closing day — unless the
 * page already says so (`quiet`).
 */
export function DatePick({
  values: v,
  onChange,
  cards,
  quiet,
  onPicked,
}: {
  values: EntryValues;
  onChange: (patch: Partial<EntryValues>) => void;
  cards: Card[];
  quiet?: boolean;
  /** A day was chosen: the calendar, and whatever holds it, can close. */
  onPicked?: () => void;
}) {
  const [calendar, setCalendar] = useState(false);
  const [cal, setCal] = useState(() => {
    const d = new Date(`${v.date}T12:00:00`);
    return { m: d.getMonth(), y: d.getFullYear() };
  });
  const income = v.type === "receita";
  const credit = !income && v.method === "cartao";
  const card = credit ? (cards.find((c) => c.id === v.whereId) ?? null) : null;
  const custom = v.date !== todayIso() && v.date !== yesterdayIso();

  /* A day ahead is not settled yet; choosing a day closes the calendar. */
  const setDate = (date: string) => {
    onChange({ date, status: isAhead(date) ? "pendente" : v.status });
    setCalendar(false);
    onPicked?.();
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip height={40} label="Hoje" on={v.date === todayIso()} onPress={() => setDate(todayIso())} />
        <Chip height={40} label="Ontem" on={v.date === yesterdayIso()} onPress={() => setDate(yesterdayIso())} />
        <Chip height={40} label={custom ? dayLabel(v.date) : "Outra data"} on={custom} onPress={() => setCalendar((c) => !c)} />
      </View>
      {calendar && (
        <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Pressable accessibilityLabel="Mês anterior" hitSlop={8} onPress={() => setCal(({ m, y }) => (m === 0 ? { m: 11, y: y - 1 } : { m: m - 1, y }))} style={{ padding: 6 }}>
              <ChevronLeft size={18} color="#fff" />
            </Pressable>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", textTransform: "capitalize" }}>{new Date(cal.y, cal.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
            <Pressable accessibilityLabel="Próximo mês" hitSlop={8} onPress={() => setCal(({ m, y }) => (m === 11 ? { m: 0, y: y + 1 } : { m: m + 1, y }))} style={{ padding: 6 }}>
              <ChevronRight size={18} color="#fff" />
            </Pressable>
          </View>
          <MonthCalendar
            month={cal.m}
            year={cal.y}
            events={[]}
            selectedDay={(() => {
              const d = new Date(`${v.date}T12:00:00`);
              return d.getMonth() === cal.m && d.getFullYear() === cal.y ? d.getDate() : null;
            })()}
            onSelectDay={(day) => {
              if (!day) return;
              setDate(isoOf(new Date(cal.y, cal.m, day)));
            }}
          />
        </Animated.View>
      )}
      {quiet ? null : credit ? (
        <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.soft }}>
          {card ? `Entra na fatura de ${invoiceMonthOf(v.date, card.closing_day).label} do ${card.name}.` : "Entra na fatura do cartão."}
        </Text>
      ) : isAhead(v.date) ? (
        <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.soft }}>Fica agendado para {dayLabel(v.date).toLowerCase()}.</Text>
      ) : null}
    </View>
  );
}
