import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import Animated, { FadeIn, FadeInLeft } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, {
  todayIso,
  type EntryValues,
} from "~/components/registro/EntryForm";
import type { Account, Card } from "~/components/registro/entryParts";
import { AlertTriangle, Check, Pencil } from "~/components/icons";
import { money } from "~/lib/money";
import { AMBER, INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * What the reader found on the receipt, laid over the photo of it — the phone's
 * copy of the web's result card.
 *
 * One purchase reads as a statement: its name, category, date and account, and the
 * amount large at the foot. Several read item by item, each with a tick to leave it
 * out. The pencil turns the same card into its own editor rather than opening a
 * second one, because what needs fixing is almost always one word or one figure.
 *
 * Editing one purchase is the same check the guided entry ends on: out or in, the
 * amount, the words, whether it is settled, the category from the full list, how it
 * was paid, whether it repeats, the day. The two places change an entry alike.
 */

export interface ScanItem {
  description: string;
  amount: number;
  category: string;
  date?: string | null;
  time?: string | null;
  merchant?: string | null;
  type?: string;
  selected?: boolean;
  is_recurring?: boolean;
  installment_total?: number | null;
  installment_current?: number | null;
  account_id?: string | null;
  /** Set when it is changed by hand: debit from an account, or credit on a card. */
  payment_method?: "conta" | "cartao";
  credit_card_id?: string | null;
  status?: "pago" | "pendente";
}

export interface ScanAccount {
  id: string;
  name: string;
  color?: string | null;
  is_default?: boolean;
}

/* The colour the web gives to "the AI read it". */
const TEAL = "#5ED8C8";
const RULE = "rgba(255,255,255,0.08)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const plain = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fromDigits = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

function formatDate(date?: string | null, time?: string | null) {
  if (!date) return time ?? "Hoje";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const otherYear = d.getFullYear() !== new Date().getFullYear();
  const label = d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      ...(otherYear ? { year: "numeric" } : {}),
    })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
  return time ? `${label} · ${time}` : label;
}

/** One purchase as the shared check sees it: the whole amount, and how it was paid. */
function toEntry(item: ScanItem, accountId: string | null): EntryValues {
  const parts =
    item.installment_total && item.installment_total > 1
      ? item.installment_total
      : null;
  const method =
    item.type === "receita" ? "conta" : (item.payment_method ?? "conta");
  return {
    type: item.type === "receita" ? "receita" : "despesa",
    /* In instalments the reader gives one instalment; the check edits the whole. */
    cents: Math.round(item.amount * (parts ?? 1) * 100),
    name: item.merchant || item.description,
    category: item.category || null,
    method,
    whereId:
      method === "cartao"
        ? (item.credit_card_id ?? null)
        : (item.account_id ?? accountId),
    repeat: item.is_recurring ? "fixa" : parts ? "parcelado" : "unica",
    parts,
    date: item.date || todayIso(),
    status: item.status ?? "pago",
    note: "",
  };
}

/** And back. */
function fromEntry(v: EntryValues): Partial<ScanItem> {
  const parts =
    v.repeat === "parcelado" && v.parts && v.parts > 1 ? v.parts : null;
  return {
    type: v.type,
    amount: parts ? Math.round(v.cents / parts) / 100 : v.cents / 100,
    description: v.name,
    merchant: null,
    category: v.category ?? "Outros",
    payment_method: v.method ?? "conta",
    credit_card_id: v.method === "cartao" ? v.whereId : null,
    account_id: v.method === "cartao" ? null : v.whereId,
    is_recurring: v.repeat === "fixa",
    installment_total: parts,
    installment_current: parts ? 1 : null,
    date: v.date,
    status: v.method === "cartao" ? "pendente" : v.status,
  };
}

/** Receipts from another month land in that month, not in this one. */
function isOtherMonth(date?: string | null) {
  if (!date) return false;
  const d = new Date(`${date}T12:00:00`);
  const now = new Date();
  return (
    d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()
  );
}

export default function ScanResultCard({
  items,
  onItemsChange,
  accounts,
  cards = [],
  accountId,
  onAccountChange,
  lowConfidence,
  confirming,
  onConfirm,
}: {
  items: ScanItem[];
  onItemsChange: (items: ScanItem[]) => void;
  accounts: ScanAccount[];
  /** The cards, so a purchase read from a receipt can be put on one. */
  cards?: Card[];
  accountId: string | null;
  onAccountChange: (id: string) => void;
  lowConfidence?: boolean;
  confirming?: boolean;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);

  const active = items.filter((i) => i.selected !== false);
  const single = items.length === 1 ? items[0] : null;
  const total = active.reduce((s, i) => s + i.amount, 0);
  /* A purchase in instalments shows its whole price, as the receipt does; each instalment under it. */
  const parts = items.length === 1 && items[0].installment_total && items[0].installment_total > 1 ? items[0].installment_total : null;
  const shownTotal = parts ? Math.round(items[0].amount * parts * 100) / 100 : total;
  const isIncome = single?.type === "receita";

  const update = (index: number, patch: Partial<ScanItem>) =>
    onItemsChange(
      items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );

  const merchant = single
    ? single.merchant || single.description
    : items.find((i) => i.merchant)?.merchant;
  const title = merchant || `${items.length} lançamentos`;
  const credit =
    !!single && single.type !== "receita" && single.payment_method === "cartao";
  const shownAccount = credit
    ? cards.find((c) => c.id === single?.credit_card_id)?.name
    : accounts.find((a) => a.id === (single?.account_id ?? accountId))?.name;
  const entry = single ? toEntry(single, accountId) : null;

  const rows: { label: string; value: string; hex?: string }[] = single
    ? [
        ...(single.merchant && single.merchant !== single.description
          ? [{ label: "Descrição", value: single.description }]
          : []),
        {
          label: "Categoria",
          value: single.category || "Outros",
          hex: categoryHex(single.category || "Outros"),
        },
        { label: "Data", value: formatDate(single.date, single.time) },
        /* In instalments: how many, and each, as the receipt said it. */
        ...(single.installment_total && single.installment_total > 1
          ? [{ label: "Parcelas", value: `${single.installment_total}x de ${money(single.amount)}` }]
          : []),
        ...(shownAccount
          ? [{ label: credit ? "Cartão" : "Conta", value: shownAccount }]
          : []),
      ]
    : [];

  const statusLabel = editing
    ? "Editando"
    : lowConfidence
      ? "Confira antes de salvar"
      : single
        ? "Identificado pela IA"
        : "Identificado item por item";

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 }}>
      {/* ── Status, and the pencil ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Animated.View
          entering={FadeInLeft.duration(260)}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          {!editing && !lowConfidence ? (
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th(TEAL, "bg"),
              }}
            >
              <Check size={12} color={th("#0B0B0B")} strokeWidth={3.5} />
            </View>
          ) : editing ? (
            <Pencil size={14} color={th("rgba(255,255,255,0.8)")} />
          ) : (
            <AlertTriangle size={16} color={th(AMBER)} />
          )}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 2.2,
              textTransform: "uppercase",
              color: th(
                editing
                  ? "rgba(255,255,255,0.8)"
                  : lowConfidence
                    ? AMBER
                    : TEAL,
              ),
            }}
          >
            {statusLabel}
          </Text>
        </Animated.View>
        <Pressable
          onPress={() => {
            setEditing((v) => !v);
            setPickingCategory(false);
          }}
          accessibilityLabel={editing ? "Concluir edição" : "Editar"}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: th(
              editing ? "#fff" : "rgba(255,255,255,0.08)",
              "bg",
            ),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {editing ? (
            <Check size={16} color={th("#0B0B0B")} strokeWidth={3} />
          ) : (
            <Pencil size={16} color={th("#fff")} />
          )}
        </Pressable>
      </View>

      {/* ── Title ── */}
      {editing && single ? null : (
        <Text
          numberOfLines={2}
          style={{
            marginTop: 12,
            fontSize: 22,
            fontWeight: "800",
            letterSpacing: -0.3,
            lineHeight: 26,
            textTransform: "uppercase",
            color: th("#fff"),
          }}
        >
          {title}
        </Text>
      )}

      {/* ── Details ── */}
      {!editing ? (
        <View style={{ marginTop: 8 }}>
          {single
            ? rows.map((row, i) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    paddingVertical: 13,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: th(RULE, "line"),
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 16,
                      color: th("rgba(255,255,255,0.74)"),
                    }}
                  >
                    {row.label}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 1,
                    }}
                  >
                    {row.hex && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: th(row.hex, "bg"),
                        }}
                      />
                    )}
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: th("#fff"),
                      }}
                    >
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))
            : items.slice(0, 5).map((item, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    paddingVertical: 13,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: th(RULE, "line"),
                    opacity: item.selected === false ? 0.4 : 1,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 16,
                      color: th("rgba(255,255,255,0.74)"),
                    }}
                  >
                    {item.description}
                  </Text>
                  <Text
                    style={[
                      nums,
                      { fontSize: 16, fontWeight: "500", color: th("#fff") },
                    ]}
                  >
                    {money(item.amount)}
                  </Text>
                </View>
              ))}
          {!single && items.length > 5 && (
            <Text
              style={{ paddingVertical: 8, fontSize: 13, color: th(INK.soft) }}
            >
              +{items.length - 5} itens
            </Text>
          )}
          {single && isOtherMonth(single.date) && (
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 6,
                borderRadius: 14,
                backgroundColor: th("rgba(249,206,78,0.10)", "bg"),
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <AlertTriangle size={14} color={th(AMBER)} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 17,
                  color: th("#FDE68A"),
                }}
              >
                Comprovante de outro mês: ele entra no histórico dessa data e
                não muda o saldo deste mês. Toque no lápis para alterar a data.
              </Text>
            </View>
          )}
        </View>
      ) : single && entry ? (
        <View style={{ marginTop: 2 }}>
          <EntryForm
            values={entry}
            onChange={(patch) => {
              const next = fromEntry({ ...entry, ...patch });
              update(0, next);
              if (next.account_id) onAccountChange(next.account_id);
            }}
            accounts={
              accounts.map((a) => ({
                id: a.id,
                name: a.name,
                color: a.color ?? null,
              })) as Account[]
            }
            cards={cards}
            onPickCategory={() => setPickingCategory(true)}
          />
          <CategoryPicker
            open={pickingCategory}
            type={entry.type}
            value={entry.category ?? ""}
            onPick={(c) => {
              setPickingCategory(false);
              update(0, { category: c });
            }}
            onClose={() => setPickingCategory(false)}
          />
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: 6, maxHeight: 280 }}
          nestedScrollEnabled
        >
          {items.map((item, i) => {
            const on = item.selected !== false;
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: th("rgba(255,255,255,0.06)", "line"),
                  opacity: on ? 1 : 0.4,
                }}
              >
                <Pressable
                  onPress={() => update(i, { selected: !on })}
                  accessibilityLabel={on ? "Remover" : "Incluir"}
                  hitSlop={8}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: on ? 0 : 1,
                    borderColor: th("rgba(255,255,255,0.3)", "line"),
                    backgroundColor: th(on ? "#fff" : "transparent", "bg"),
                  }}
                >
                  {on && (
                    <Check size={14} color={th("#0B0B0B")} strokeWidth={3} />
                  )}
                </Pressable>
                <TextInput
                  value={item.description}
                  onChangeText={(v) => update(i, { description: v })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 15,
                    color: th("#fff"),
                  }}
                />
                <TextInput
                  value={plain(item.amount)}
                  onChangeText={(v) => update(i, { amount: fromDigits(v) })}
                  keyboardType="number-pad"
                  style={[
                    nums,
                    {
                      width: 96,
                      textAlign: "right",
                      fontSize: 15,
                      fontWeight: "600",
                      color: th("#fff"),
                    },
                  ]}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── The amount ── (the check shows its own while editing one) */}
      {!(editing && single) && (
        <View style={{ marginTop: 18 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 2.6,
              textTransform: "uppercase",
              color: th("rgba(255,255,255,0.62)"),
            }}
          >
            {single ? (isIncome ? "Receita" : parts ? "Compra parcelada" : "Despesa") : "Total"}
          </Text>
          <View
            style={{
              marginTop: 4,
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                letterSpacing: 1.5,
                color: th("rgba(255,255,255,0.66)"),
              }}
            >
              R$
            </Text>
            {
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  nums,
                  {
                    flexShrink: 1,
                    fontSize: plain(shownTotal).length <= 8 ? 48 : 40,
                    fontWeight: "800",
                    letterSpacing: -1.4,
                    color: th("#fff"),
                  },
                ]}
              >
                {plain(shownTotal)}
              </Text>
            }
          </View>
          {parts ? (
            <Text style={[nums, { marginTop: 2, fontSize: 14, fontWeight: "600", color: th("rgba(255,255,255,0.7)") }]}>
              em {parts}x de {money(single?.amount ?? 0)}
            </Text>
          ) : null}
        </View>
      )}

      <Pressable
        onPress={onConfirm}
        disabled={confirming || active.length === 0 || total <= 0}
        style={({ pressed }) => ({
          marginTop: 20,
          height: 56,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: th("#fff", "bg"),
          opacity:
            confirming || active.length === 0 || total <= 0
              ? 0.45
              : pressed
                ? 0.82
                : 1,
        })}
      >
        {confirming ? (
          <ActivityIndicator color={th("#0B0B0B")} />
        ) : (
          <Text
            style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}
          >
            {single
              ? isIncome
                ? "Confirmar receita"
                : single.status === "pendente" && !credit
                  ? "Agendar gasto"
                  : "Confirmar gasto"
              : `Confirmar ${active.length}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
