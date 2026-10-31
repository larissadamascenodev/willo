import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { Chip, Choice, Field, PartsBar, REPEAT_LABEL, REPEAT_NOTE, RepeatList, dayLabel, invoiceMonthOf, nums, type Account, type Card, type Kind, type Method, type Repeat } from "~/components/registro/entryParts";
import { ChevronLeft, ChevronRight, CreditCard, Landmark, Tag } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";

/**
 * Everything about one entry on one page, each part changeable where it is: out or in,
 * the amount, the words, the category, how it was paid, whether it repeats, when, and
 * whether it is settled. The check of the guided entry, and the editor.
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
  note: string;
}


const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
const yesterdayIso = () => isoOf(new Date(Date.now() - 86_400_000));

/** Ahead of today: not paid yet — scheduled. */
export const isAhead = (iso: string) => iso > todayIso();

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
  const [paying, setPaying] = useState(false);
  const [repeating, setRepeating] = useState(false);

  const income = v.type === "receita";
  const credit = !income && v.method === "cartao";
  const list: (Account | Card)[] = credit ? cards : accounts;
  const picked = list.find((o) => o.id === v.whereId) ?? null;
  const Icon = v.category ? categoryIcon(v.category) : Tag;
  const hex = v.category ? categoryHex(v.category) : "#8B8D94";
  const parcelado = v.repeat === "parcelado" && !!v.parts;

  return (
    <View>
      {/* Out or in */}
      {!lockedCard && (
        <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
          {(["despesa", "receita"] as const).map((t) => {
            const on = v.type === t;
            return (
              <Pressable
                key={t}
                onPress={() => onChange(t === "receita" ? { type: t, method: "conta", whereId: v.method === "conta" ? v.whereId : null, repeat: v.repeat === "parcelado" ? "unica" : v.repeat, parts: null } : { type: t })}
                style={({ pressed }) => ({ flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)", backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: on ? (t === "receita" ? GREEN : "#fff") : INK.soft }}>{t === "despesa" ? "Despesa" : "Receita"}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* The amount, large; in instalments, the total with the split beside it */}
      <Field label={partOf ? "Valor da parcela" : parcelado ? "Valor total" : v.repeat === "fixa" ? "Valor por mês" : "Valor"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TextInput
            value={money(v.cents / 100)}
            onChangeText={(t) => onChange({ cents: Math.min(Number(t.replace(/\D/g, "") || "0"), 99999999) })}
            keyboardType="number-pad"
            style={[nums, { flex: 1, minWidth: 0, padding: 0, fontSize: 30, fontWeight: "800", letterSpacing: -1, color: income ? GREEN : "#FF8A9A" }]}
          />
          {parcelado && v.parts ? (
            <Text numberOfLines={1} style={[nums, { fontSize: 13.5, fontWeight: "700", color: INK.soft }]}>
              {v.parts}x de {money(v.cents / 100 / v.parts)}
            </Text>
          ) : null}
        </View>
      </Field>
      <Field label="Descrição">
        <TextInput value={v.name} onChangeText={(name) => onChange({ name })} maxLength={40} placeholder="O que foi?" placeholderTextColor={INK.faint} style={{ padding: 0, fontSize: 17, fontWeight: "600", color: "#fff" }} />
      </Field>

      {/* Category and how it was paid, side by side, the names in full */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field label="Categoria" changeable style={{ flex: 1 }}>
          <Pressable onPress={onPickCategory} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
              <Icon size={12} color={chipInk(hex)} strokeWidth={2.2} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: v.category ? "#fff" : AMBER }}>
              {v.category ?? "Escolher"}
            </Text>
          </Pressable>
        </Field>
        <Field label={income ? "Entrou em" : `Pagamento · ${credit ? "Crédito" : "Débito"}`} changeable={!lockedCard} style={{ flex: 1 }}>
          <Pressable disabled={lockedCard} onPress={() => setPaying((p) => !p)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}>
            {picked ? <BankMark name={picked.name} hex={colorFor(picked.name, picked.color)} size={24} /> : null}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: picked ? "#fff" : AMBER }}>
              {picked?.name ?? "Escolher"}
            </Text>
          </Pressable>
        </Field>
      </View>

      {/* How it was paid, changed right here */}
      {paying && !lockedCard && (
        <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 10, gap: 10 }}>
          {!income && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Choice icon={<Landmark size={18} color="#fff" strokeWidth={2.1} />} label="Débito" onPress={() => onChange({ method: "conta", whereId: accounts.length === 1 ? accounts[0].id : null })} />
              <Choice icon={<CreditCard size={18} color="#fff" strokeWidth={2.1} />} label="Crédito" onPress={() => onChange({ method: "cartao", whereId: cards.length === 1 ? cards[0].id : null })} />
            </View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {list.map((o) => (
              <Choice
                key={o.id}
                wide
                icon={<BankMark name={o.name} hex={colorFor(o.name, o.color)} size={26} />}
                label={o.name}
                onPress={() => {
                  onChange({ whereId: o.id });
                  setPaying(false);
                }}
              />
            ))}
          </View>
        </Animated.View>
      )}

      {/* Whether it repeats */}
      <Field label="Repetição" changeable={!partOf}>
        {partOf ? (
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{partOf}</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <Pressable onPress={() => setRepeating((r) => !r)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                {REPEAT_LABEL[v.repeat]}
                <Text style={{ fontWeight: "400", color: INK.soft }}>
                  {"  ·  "}
                  {parcelado && v.parts ? `${v.parts}x de ${money(v.cents / 100 / v.parts)}` : REPEAT_NOTE[v.repeat]}
                </Text>
              </Text>
            </Pressable>
            {repeating && (
              <Animated.View entering={FadeIn.duration(180)} style={{ gap: 10 }}>
                <RepeatList
                  value={v.repeat}
                  income={income}
                  onPick={(r: Repeat) => {
                    onChange({ repeat: r, parts: r === "parcelado" ? (v.parts ?? 2) : null });
                    if (r !== "parcelado") setRepeating(false);
                  }}
                />
                {v.repeat === "parcelado" && <PartsBar cents={v.cents} value={v.parts} onChange={(parts) => onChange({ parts })} />}
              </Animated.View>
            )}
          </View>
        )}
      </Field>

      {/* When, and whether it is settled — together */}
      <Field label={credit ? "Quando" : "Quando · Situação"}>
        <WhenPicker values={v} onChange={onChange} cards={cards} />
      </Field>

      <Field label="Observação">
        <TextInput value={v.note} onChangeText={(note) => onChange({ note })} placeholder="Opcional" placeholderTextColor={INK.faint} multiline maxLength={200} style={{ padding: 0, fontSize: 15, color: "#fff", minHeight: 22 }} />
      </Field>
    </View>
  );
}

/** The day and, off a card, whether it is settled — together, for the form. */
export function WhenPicker({ values: v, onChange, cards }: { values: EntryValues; onChange: (patch: Partial<EntryValues>) => void; cards: Card[] }) {
  const income = v.type === "receita";
  const credit = !income && v.method === "cartao";
  return (
    <View>
      <DatePick values={v} onChange={onChange} cards={cards} />
      {!credit && (
        <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
          <Chip height={38} label={income ? "Recebido" : "Pago"} on={v.status === "pago"} onPress={() => onChange({ status: "pago" })} />
          <Chip height={38} label={income ? "A receber" : "Pendente"} on={v.status === "pendente"} onPress={() => onChange({ status: "pendente" })} />
        </View>
      )}
    </View>
  );
}

/**
 * The day: today, yesterday or one from the calendar. A day ahead makes it scheduled;
 * on a card it says which invoice it falls in, by the card's closing day.
 */
export function DatePick({ values: v, onChange, cards }: { values: EntryValues; onChange: (patch: Partial<EntryValues>) => void; cards: Card[] }) {
  const [calendar, setCalendar] = useState(false);
  const [cal, setCal] = useState(() => {
    const d = new Date(`${v.date}T12:00:00`);
    return { m: d.getMonth(), y: d.getFullYear() };
  });
  const income = v.type === "receita";
  const credit = !income && v.method === "cartao";
  const card = credit ? (cards.find((c) => c.id === v.whereId) ?? null) : null;
  const custom = v.date !== todayIso() && v.date !== yesterdayIso();

  /* A day ahead is scheduled; back to today it is settled again. */
  const setDate = (date: string) => onChange({ date, status: isAhead(date) ? "pendente" : isAhead(v.date) ? "pago" : v.status });

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip height={38} label="Hoje" on={v.date === todayIso()} onPress={() => setDate(todayIso())} />
        <Chip height={38} label="Ontem" on={v.date === yesterdayIso()} onPress={() => setDate(yesterdayIso())} />
        <Chip height={38} label={custom ? dayLabel(v.date) : "Outra data"} on={custom} onPress={() => setCalendar((c) => !c)} />
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
              setCalendar(false);
            }}
          />
        </Animated.View>
      )}
      {credit ? (
        <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.soft }}>
          {card ? `Entra na fatura de ${invoiceMonthOf(v.date, card.closing_day).label} do ${card.name}.` : "Entra na fatura do cartão."}
        </Text>
      ) : isAhead(v.date) ? (
        <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.soft }}>Fica agendado para {dayLabel(v.date).toLowerCase()}.</Text>
      ) : null}
    </View>
  );
}
