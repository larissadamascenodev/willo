import { useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";
import Animated, { FadeIn, FadeInLeft } from "react-native-reanimated";
import { categoryHex, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { AlertTriangle, Check, ChevronDown, Pencil } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { AMBER, INK } from "~/theme/tokens";

/**
 * What the reader found on the receipt, laid over the photo of it — the phone's
 * copy of the web's result card.
 *
 * One purchase reads as a statement: its name, category, date and account, and the
 * amount large at the foot. Several read item by item, each with a tick to leave it
 * out. The pencil turns the same card into its own editor rather than opening a
 * second one, because what needs fixing is almost always one word or one figure.
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
}

export interface ScanAccount {
  id: string;
  name: string;
  is_default?: boolean;
}

/* The colour the web gives to "the AI read it". */
const TEAL = "#5ED8C8";
const RULE = "rgba(255,255,255,0.08)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const plain = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(otherYear ? { year: "numeric" } : {}) })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
  return time ? `${label} · ${time}` : label;
}

/** dd/mm/aaaa as typed, back to the yyyy-mm-dd the books keep — or null if not a date yet. */
function parseTyped(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return Number.isNaN(new Date(`${iso}T12:00:00`).getTime()) ? null : iso;
}
const toTyped = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Receipts from another month land in that month, not in this one. */
function isOtherMonth(date?: string | null) {
  if (!date) return false;
  const d = new Date(`${date}T12:00:00`);
  const now = new Date();
  return d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear();
}

export default function ScanResultCard({
  items,
  onItemsChange,
  accounts,
  accountId,
  onAccountChange,
  lowConfidence,
  confirming,
  onConfirm,
}: {
  items: ScanItem[];
  onItemsChange: (items: ScanItem[]) => void;
  accounts: ScanAccount[];
  accountId: string | null;
  onAccountChange: (id: string) => void;
  lowConfidence?: boolean;
  confirming?: boolean;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [typedDate, setTypedDate] = useState(() => toTyped(items[0]?.date));

  const active = items.filter((i) => i.selected !== false);
  const single = items.length === 1 ? items[0] : null;
  const total = active.reduce((s, i) => s + i.amount, 0);
  const isIncome = single?.type === "receita";

  const update = (index: number, patch: Partial<ScanItem>) =>
    onItemsChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const merchant = single ? single.merchant || single.description : items.find((i) => i.merchant)?.merchant;
  const title = merchant || `${items.length} lançamentos`;
  const shownAccount = accounts.find((a) => a.id === accountId)?.name;

  const rows: { label: string; value: string; hex?: string }[] = single
    ? [
        ...(single.merchant && single.merchant !== single.description ? [{ label: "Descrição", value: single.description }] : []),
        { label: "Categoria", value: single.category || "Outros", hex: categoryHex(single.category || "Outros") },
        { label: "Data", value: formatDate(single.date, single.time) },
        ...(shownAccount ? [{ label: "Conta", value: shownAccount }] : []),
      ]
    : [];

  const categoryOptions = isIncome ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Animated.View entering={FadeInLeft.duration(260)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!editing && !lowConfidence ? (
            <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: TEAL }}>
              <Check size={12} color="#0B0B0B" strokeWidth={3.5} />
            </View>
          ) : editing ? (
            <Pencil size={14} color="rgba(255,255,255,0.8)" />
          ) : (
            <AlertTriangle size={16} color={AMBER} />
          )}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 2.2,
              textTransform: "uppercase",
              color: editing ? "rgba(255,255,255,0.8)" : lowConfidence ? AMBER : TEAL,
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
            backgroundColor: editing ? "#fff" : "rgba(255,255,255,0.08)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {editing ? <Check size={16} color="#0B0B0B" strokeWidth={3} /> : <Pencil size={16} color="#fff" />}
        </Pressable>
      </View>

      {/* ── Title ── */}
      {editing && single ? (
        <TextInput
          value={single.merchant || single.description}
          onChangeText={(v) => update(0, single.merchant ? { merchant: v } : { description: v })}
          multiline
          scrollEnabled={false}
          submitBehavior="blurAndSubmit"
          style={{ marginTop: 12, fontSize: 22, fontWeight: "800", letterSpacing: -0.3, textTransform: "uppercase", color: "#fff" }}
          accessibilityLabel="Nome"
        />
      ) : (
        <Text numberOfLines={2} style={{ marginTop: 12, fontSize: 22, fontWeight: "800", letterSpacing: -0.3, lineHeight: 26, textTransform: "uppercase", color: "#fff" }}>
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
                    borderTopColor: RULE,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 16, color: "rgba(255,255,255,0.74)" }}>
                    {row.label}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                    {row.hex && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.hex }} />}
                    <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: "#fff" }}>
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
                    borderTopColor: RULE,
                    opacity: item.selected === false ? 0.4 : 1,
                  }}
                >
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 16, color: "rgba(255,255,255,0.74)" }}>
                    {item.description}
                  </Text>
                  <Text style={[nums, { fontSize: 16, fontWeight: "500", color: "#fff" }]}>{money(item.amount)}</Text>
                </View>
              ))}
          {!single && items.length > 5 && (
            <Text style={{ paddingVertical: 8, fontSize: 13, color: INK.soft }}>+{items.length - 5} itens</Text>
          )}
          {single && isOtherMonth(single.date) && (
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 6,
                borderRadius: 14,
                backgroundColor: "rgba(249,206,78,0.10)",
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <AlertTriangle size={14} color={AMBER} />
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: "#FDE68A" }}>
                Comprovante de outro mês: ele entra no histórico dessa data e não muda o saldo deste mês. Toque no lápis
                para alterar a data.
              </Text>
            </View>
          )}
        </View>
      ) : single ? (
        <View style={{ marginTop: 6 }}>
          <EditRow label="Tipo">
            <View style={{ flexDirection: "row", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", padding: 2 }}>
              {(["despesa", "receita"] as const).map((t) => {
                const on = (isIncome ? "receita" : "despesa") === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => update(0, { type: t })}
                    style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: on ? "#fff" : "transparent" }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#0B0B0B" : "rgba(255,255,255,0.7)" }}>
                      {t === "despesa" ? "Despesa" : "Receita"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </EditRow>

          {single.merchant ? (
            <EditRow label="Descrição">
              <TextInput
                value={single.description}
                onChangeText={(v) => update(0, { description: v })}
                style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 16, fontWeight: "500", color: "#fff" }}
              />
            </EditRow>
          ) : null}

          <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: RULE }}>
            <Pressable
              onPress={() => setPickingCategory((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.74)" }}>Categoria</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: categoryHex(single.category || "Outros") }} />
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#fff" }}>{single.category || "Escolher"}</Text>
                <ChevronDown size={16} color={INK.soft} style={{ transform: [{ rotate: pickingCategory ? "180deg" : "0deg" }] }} />
              </View>
            </Pressable>
            {pickingCategory && (
              <Animated.View entering={FadeIn.duration(180)}>
                <ScrollView style={{ maxHeight: 160, marginTop: 12 }} nestedScrollEnabled>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 }}>
                    {categoryOptions.map((cat) => {
                      const Icon = categoryIcon(cat);
                      const on = cat === single.category;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => {
                            update(0, { category: cat });
                            setPickingCategory(false);
                          }}
                          style={{
                            height: 36,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: on ? "#fff" : "rgba(255,255,255,0.08)",
                            backgroundColor: on ? "#fff" : "rgba(255,255,255,0.04)",
                          }}
                        >
                          <Icon size={14} color={on ? "#0B0B0B" : categoryHex(cat)} />
                          <Text style={{ fontSize: 13, color: on ? "#0B0B0B" : "rgba(255,255,255,0.8)" }}>{cat}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </Animated.View>
            )}
          </View>

          <EditRow label="Data">
            <TextInput
              value={typedDate}
              onChangeText={(v) => {
                setTypedDate(v);
                const iso = parseTyped(v);
                if (iso) update(0, { date: iso });
              }}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={INK.faint}
              keyboardType="numbers-and-punctuation"
              style={[nums, { flex: 1, minWidth: 0, textAlign: "right", fontSize: 16, fontWeight: "500", color: "#fff" }]}
            />
          </EditRow>

          {accounts.length > 0 && (
            <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: RULE }}>
              <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.74)" }}>Conta</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
                {accounts.map((a) => {
                  const on = a.id === accountId;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onAccountChange(a.id)}
                      style={{
                        height: 36,
                        justifyContent: "center",
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: on ? "#fff" : "rgba(255,255,255,0.08)",
                        backgroundColor: on ? "#fff" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "500", color: on ? "#0B0B0B" : "rgba(255,255,255,0.8)" }}>{a.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={{ marginTop: 6, maxHeight: 280 }} nestedScrollEnabled>
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
                  borderTopColor: "rgba(255,255,255,0.06)",
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
                    borderColor: "rgba(255,255,255,0.3)",
                    backgroundColor: on ? "#fff" : "transparent",
                  }}
                >
                  {on && <Check size={14} color="#0B0B0B" strokeWidth={3} />}
                </Pressable>
                <TextInput
                  value={item.description}
                  onChangeText={(v) => update(i, { description: v })}
                  style={{ flex: 1, minWidth: 0, fontSize: 15, color: "#fff" }}
                />
                <TextInput
                  value={plain(item.amount)}
                  onChangeText={(v) => update(i, { amount: fromDigits(v) })}
                  keyboardType="number-pad"
                  style={[nums, { width: 96, textAlign: "right", fontSize: 15, fontWeight: "600", color: "#fff" }]}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── The amount ── */}
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 2.6, textTransform: "uppercase", color: "rgba(255,255,255,0.62)" }}>
          {single ? (isIncome ? "Receita" : "Despesa") : "Total"}
        </Text>
        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: 1.5, color: "rgba(255,255,255,0.66)" }}>R$</Text>
          {editing && single ? (
            <TextInput
              value={plain(single.amount)}
              onChangeText={(v) => update(0, { amount: fromDigits(v) })}
              keyboardType="number-pad"
              accessibilityLabel="Valor"
              style={[nums, { flex: 1, minWidth: 0, fontSize: 44, fontWeight: "800", letterSpacing: -1.2, color: "#fff" }]}
            />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[nums, { flexShrink: 1, fontSize: plain(total).length <= 8 ? 48 : 40, fontWeight: "800", letterSpacing: -1.4, color: "#fff" }]}
            >
              {plain(total)}
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={onConfirm}
        disabled={confirming || active.length === 0 || total <= 0}
        style={({ pressed }) => ({
          marginTop: 20,
          height: 56,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
          opacity: confirming || active.length === 0 || total <= 0 ? 0.45 : pressed ? 0.82 : 1,
        })}
      >
        {confirming ? (
          <ActivityIndicator color="#0B0B0B" />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
            {single ? (isIncome ? "Confirmar receita" : "Confirmar gasto") : `Confirmar ${active.length}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function EditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: RULE,
      }}
    >
      <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.74)" }}>{label}</Text>
      {children}
    </View>
  );
}
