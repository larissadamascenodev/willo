import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { showToast } from "~/lib/toast";
import { ActivityIndicator, Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { categoryHex } from "@/lib/categoryData";
import { deleteTransaction, updateTransaction, updateTransactionStatus } from "@/services/transactionService";
import { excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";
import type { TransactionRow as Row } from "@/services/monthTransactions";
import type { CustomCategory } from "@/services/categoryService";
import BottomSheet from "~/components/BottomSheet";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  FileText,
  MoreVertical,
  Pencil,
  Repeat,
  Tag,
  Trash2,
  Wallet,
  X,
} from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * One movement, opened — the phone's copy of the web's detail sheet.
 *
 * What it is and how much, large; whether it has happened; then the facts in rows
 * the eye can run down.
 *
 * Editing and deleting live behind the three dots beside the cross, because they
 * are things done to the entry rather than what the person came for. What they
 * came for is marking it paid — and that button is only there while it is still
 * pending: once something has happened it is not undone from here. To put it back
 * to pending, edit it; the form has that switch.
 *
 * Editing opens the same form it was made with, and deleting asks first, in place:
 * a fixed entry is asked whether to leave this month only or from here on, and a
 * parcelled one says it takes every instalment with it.
 */

const MONTHS_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS_FULL[m - 1]} de ${y}`;
};

const RECURRENCE: Record<string, string> = { fixa: "Todo mês", parcelado: "Parcelada" };

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Takes a movement out of the books, the way the web does.
 *
 * A fixed entry struck off one month: in its own month it moves to the next and
 * waits, which is what reverses its effect on the balance; in a later month that
 * month is excluded. "From here on" deletes it outright when it starts here, and
 * otherwise excludes every month from this one. Anything else is simply deleted —
 * a parcelled purchase with all its instalments.
 */
export async function removeTransaction(
  tx: Pick<Row, "id" | "date" | "recurrence_type">,
  scope: "month" | "all",
  where: { month: number; year: number; userId?: string },
) {
  const { month, year, userId } = where;
  if (tx.recurrence_type === "fixa") {
    if (!userId) throw new Error("Entre na sua conta de novo.");
    const [y, m] = tx.date.split("-").map(Number);
    if (scope === "month") {
      if (m - 1 === month && y === year) {
        const orig = new Date(`${tx.date}T12:00:00`);
        const next = new Date(orig.getFullYear(), orig.getMonth() + 1, Math.min(orig.getDate(), 28));
        await updateTransaction(tx.id, { date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`, status: "pendente" });
      } else {
        await excludeRecurringForMonth(tx.id, month, year, userId);
      }
      return;
    }
    if (y * 12 + (m - 1) >= year * 12 + month) await deleteTransaction(tx.id);
    else await excludeRecurringFromMonthOnward(tx.id, month, year, userId);
    return;
  }
  await deleteTransaction(tx.id);
}

export default function TransactionSheet({
  tx: asked,
  accountName,
  customCategories,
  userId,
  month,
  year,
  onClose,
  onEdit,
  onChanged,
}: {
  tx: Row | null;
  accountName: string;
  customCategories?: CustomCategory[];
  userId?: string;
  /** The month the list is showing, which a fixed entry is struck off. */
  month: number;
  year: number;
  onClose: () => void;
  onEdit: (tx: Row) => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The last one shown stays drawn while the sheet slides away. */
  const [tx, setTx] = useState<Row | null>(asked);

  useEffect(() => {
    if (asked) setTx(asked);
    setConfirming(false);
    setMenuOpen(false);
    setError(null);
  }, [asked]);

  if (!tx) return null;

  const isReceita = tx.type === "receita";
  const isPaid = tx.status === "pago";
  const isCard = tx.payment_method === "cartao";
  const isFixed = tx.recurrence_type === "fixa";
  const isParcelled = !!(tx.installments && tx.installments > 1);
  const Icon = categoryIcon(tx.category, customCategories);
  const hex = categoryHex(tx.category, customCategories);

  const run = async (fn: () => Promise<unknown>, said?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      window.dispatchEvent(new CustomEvent("transaction-created"));
      if (said) showToast(said);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = () => run(() => updateTransactionStatus(tx.id, "pago"), "Marcada como paga");

  const removeThisMonth = () => run(() => removeTransaction(tx, "month", { month, year, userId }), "Transação excluída");
  const removeAll = () => run(() => removeTransaction(tx, "all", { month, year, userId }), "Transação excluída");

  return (
    <BottomSheet open={!!asked} onClose={onClose}>
      <View style={{ paddingHorizontal: 20 }}>
        {/* Anywhere outside the menu closes it. */}
        {menuOpen && (
          <Pressable
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Fechar menu"
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 15 }}
          />
        )}
        {menuOpen && (
          <Animated.View
            entering={FadeIn.duration(140)}
            style={{
              position: "absolute",
              top: 46,
              right: 20,
              zIndex: 20,
              width: 188,
              borderRadius: 18,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              backgroundColor: "#1A1B1E",
              overflow: "hidden",
            }}
          >
            <MenuItem
              icon={Pencil}
              label="Editar"
              onPress={() => {
                setMenuOpen(false);
                onEdit(tx);
              }}
            />
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)" }} />
            <MenuItem
              icon={Trash2}
              label="Excluir"
              danger
              onPress={() => {
                setMenuOpen(false);
                setConfirming(true);
              }}
            />
          </Animated.View>
        )}

        {/* ── What it is ── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
            <Icon size={21} color={chipInk(hex)} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
              {tx.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isCard ? <CreditCard size={13} color={INK.soft} /> : <Wallet size={13} color={INK.soft} />}
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: INK.soft }}>
                {accountName}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => setMenuOpen((v) => !v)}
              accessibilityLabel="Mais opções"
              accessibilityState={{ expanded: menuOpen }}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: menuOpen ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MoreVertical size={17} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Fechar"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.06)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={16} color="rgba(255,255,255,0.74)" />
            </Pressable>
          </View>
        </View>

        {/* ── How much, and whether it has happened ── */}
        <View style={{ marginTop: 26, alignItems: "center" }}>
          <Text style={[nums, { fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: isReceita ? GREEN : "#fff" }]}>
            {isReceita ? "+" : "−"}
            {money(tx.amount)}
          </Text>
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: isPaid ? "rgba(200,243,109,0.12)" : "rgba(249,206,78,0.12)",
            }}
          >
            {isPaid ? <Check size={13} color={GREEN} strokeWidth={3} /> : <Clock size={13} color={AMBER} strokeWidth={2.6} />}
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: isPaid ? GREEN : AMBER }}>
              {isPaid ? (isReceita ? "Recebido" : "Pago") : isReceita ? "A receber" : "Pendente"}
            </Text>
          </View>
        </View>

        {/* ── The facts ── */}
        <View
          style={{
            marginTop: 24,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.07)",
            backgroundColor: "rgba(255,255,255,0.035)",
            paddingHorizontal: 14,
          }}
        >
          <Fact icon={CalendarDays} label="Data" first>
            {longDate(tx.date)}
          </Fact>
          {tx.time ? <Fact icon={Clock} label="Horário">{tx.time}</Fact> : null}
          <Fact icon={Tag} label="Categoria" dot={hex}>
            {tx.category}
          </Fact>
          <Fact icon={isCard ? CreditCard : Wallet} label={isCard ? "Cartão" : "Conta"}>
            {accountName}
          </Fact>
          {isParcelled && (
            <Fact icon={Repeat} label="Parcela">
              {tx.installment_current ?? 1} de {tx.installments}
            </Fact>
          )}
          {tx.recurrence_type && RECURRENCE[tx.recurrence_type] && !isParcelled ? (
            <Fact icon={Repeat} label="Repetição">
              {RECURRENCE[tx.recurrence_type]}
            </Fact>
          ) : null}
          {tx.observation && !tx.observation.startsWith("paid_installments:") ? (
            <Fact icon={FileText} label="Observação">
              {tx.observation}
            </Fact>
          ) : null}
        </View>

        {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}

        {/* ── What can be done ── */}
        {!confirming ? (
          /* Only while it is still to happen. Once it has, there is nothing to offer. */
          !isPaid && (
            <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 22 }}>
              <Pressable
                onPress={() => void markPaid()}
                disabled={busy}
                style={({ pressed }) => ({
                  height: 54,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: "#fff",
                  opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color="#0B0B0B" />
                ) : (
                  <>
                    <Check size={16} color="#0B0B0B" strokeWidth={3} />
                    <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#0B0B0B" }}>
                      {isReceita ? "Marcar como recebida" : "Marcar como paga"}
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          )
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: 22, gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(248,113,113,0.22)",
                backgroundColor: "rgba(248,113,113,0.07)",
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <AlertTriangle size={16} color={RED} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.82)" }}>
                {isFixed
                  ? "Essa transação se repete todo mês. Quer tirar só deste mês ou dela em diante?"
                  : isParcelled
                    ? `Isso remove a compra inteira, com as ${tx.installments} parcelas.`
                    : "Essa transação será excluída e não dá para desfazer."}
              </Text>
            </View>
            {isFixed && <Wide label="Só deste mês" onPress={() => void removeThisMonth()} disabled={busy} />}
            <Wide
              label={isFixed ? "Deste mês em diante" : "Excluir"}
              danger
              onPress={() => void removeAll()}
              disabled={busy}
              loading={busy}
            />
            <Pressable onPress={() => setConfirming(false)} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Cancelar</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

function Fact({
  icon: Icon,
  label,
  dot,
  first,
  children,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  dot?: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 13,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Icon size={15} color={INK.softer} />
      <Text style={{ fontSize: 14, color: INK.soft }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
        {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
        <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 14.5, color: "#fff" }]}>
          {children}
        </Text>
      </View>
    </View>
  );
}

/** One row of the menu behind the three dots. */
function MenuItem({
  icon: Icon,
  label,
  danger,
  onPress,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 50,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        backgroundColor: pressed ? "rgba(255,255,255,0.06)" : "transparent",
      })}
    >
      <Icon size={17} color={danger ? RED : "#fff"} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: danger ? RED : "#fff" }}>{label}</Text>
    </Pressable>
  );
}

function Wide({
  label,
  danger,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: danger ? 0 : 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: danger ? "#EF4444" : "rgba(255,255,255,0.04)",
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ fontSize: 14.5, fontWeight: danger ? "700" : "600", color: "#fff" }}>{label}</Text>
      )}
    </Pressable>
  );
}
