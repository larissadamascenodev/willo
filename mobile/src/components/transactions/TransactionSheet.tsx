import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { showToast } from "~/lib/toast";
import { behind, showNow, type OptimisticChange } from "~/lib/optimistic";
import { ActivityIndicator, Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { categoryHex } from "@/lib/categoryData";
import { setOccurrenceStatus } from "@/services/recurringService";
import { deleteInSeries } from "@/services/seriesActions";
import type { TransactionRow as Row } from "@/services/monthTransactions";
import type { CustomCategory } from "@/services/categoryService";
import { BlurView } from "expo-blur";
import BottomSheet from "~/components/BottomSheet";
import RoundButton from "~/components/RoundButton";
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

import { th } from "~/theme/theme";
/**
 * One movement, opened — the phone's copy of the web's detail sheet.
 *
 * What it is and how much, large; whether it has happened; then the facts in rows
 * the eye can run down.
 *
 * Editing and deleting live behind the three dots beside the cross, because they
 * are things done to the entry rather than what the person came for. What they
 * came for is marking it paid, or, once it has happened, putting it back to pending:
 * either way the balance moves with it, by the same amount.
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

/**
 * Takes a movement out of the books.
 *
 * A fixed entry or one instalment of a purchase is asked first: only this one, or this
 * one and the ones after. What that does to the rows is decided in one place
 * (seriesPlan) and nothing is moved to another date to make it disappear.
 */
export async function removeTransaction(
  tx: Pick<Row, "id">,
  scope: "month" | "all",
  where: { month: number; year: number; userId?: string },
) {
  if (!where.userId) throw new Error("Entre na sua conta de novo.");
  await deleteInSeries(tx.id, scope, { month: where.month, year: where.year, userId: where.userId });
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

  /* Shown on the list at once and the sheet gone; the database catches up behind. */
  const now = (change: OptimisticChange, fn: () => Promise<unknown>, said: string, failed: string) => {
    showNow(change);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    showToast(said);
    onClose();
    void behind(tx.id, fn, () => showToast(failed));
  };

  const markPaid = () =>
    now({ id: tx.id, row: { ...tx, status: "pago" } }, () => setOccurrenceStatus(tx as never, "pago"), isReceita ? "Marcada como recebida" : "Marcada como paga", "Não foi possível marcar. Tente de novo.");
  const markPending = () =>
    now({ id: tx.id, row: { ...tx, status: "pendente" } }, () => setOccurrenceStatus(tx as never, "pendente"), "Voltou para pendente", "Não foi possível mudar. Tente de novo.");

  const removeThisMonth = () =>
    now({ id: tx.id, removed: true }, () => removeTransaction(tx, "month", { month, year, userId }), `“${tx.name}” excluído`, "Não foi possível excluir. Tente de novo.");
  const removeAll = () =>
    now({ id: tx.id, removed: true }, () => removeTransaction(tx, "all", { month, year, userId }), `“${tx.name}” excluído`, "Não foi possível excluir. Tente de novo.");

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
              borderColor: th("rgba(255,255,255,0.12)", "line"),
              overflow: "hidden",
            }}
          >
            <BlurView intensity={70} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(18,20,26,0.5)", "bg") }} />
            <MenuItem
              icon={Pencil}
              label="Editar"
              onPress={() => {
                setMenuOpen(false);
                onEdit(tx);
              }}
            />
            <View style={{ height: 1, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />
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
          <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
            <Icon size={21} color={th(chipInk(hex))} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
              {tx.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isCard ? <CreditCard size={13} color={th(INK.soft)} /> : <Wallet size={13} color={th(INK.soft)} />}
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.soft) }}>
                {accountName}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <RoundButton label="Mais opções" onPress={() => setMenuOpen((v) => !v)}>
              <MoreVertical size={18} color={th("rgba(255,255,255,0.9)")} />
            </RoundButton>
            <RoundButton label="Fechar" onPress={onClose}>
              <X size={18} color={th("rgba(255,255,255,0.9)")} />
            </RoundButton>
          </View>
        </View>

        {/* ── How much, and whether it has happened ── */}
        <View style={{ marginTop: 26, alignItems: "center" }}>
          <Text style={[nums, { fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: th(isReceita ? GREEN : "#fff") }]}>
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
              backgroundColor: th(isPaid ? "rgba(200,243,109,0.12)" : "rgba(249,206,78,0.12)", "bg"),
            }}
          >
            {isPaid ? <Check size={13} color={th(GREEN)} strokeWidth={3} /> : <Clock size={13} color={th(AMBER)} strokeWidth={2.6} />}
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(isPaid ? GREEN : AMBER) }}>
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
            borderColor: th("rgba(255,255,255,0.07)", "line"),
            backgroundColor: th("rgba(255,255,255,0.035)", "bg"),
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

        {error && <Text style={{ marginTop: 12, fontSize: 13, color: th(RED) }}>{error}</Text>}

        {/* ── What can be done ── */}
        {!confirming ? (
          /* A purchase on a card is settled by its invoice, not here. */
          isPaid ? (
            !isCard && (
              <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 22 }}>
                <Pressable
                  onPress={() => void markPending()}
                  disabled={busy}
                  style={({ pressed }) => ({ height: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: busy ? 0.5 : pressed ? 0.85 : 1 })}
                >
                  {busy ? <ActivityIndicator color={th("#fff")} /> : <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Voltar para pendente</Text>}
                </Pressable>
              </Animated.View>
            )
          ) : (
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
                  backgroundColor: th("#fff", "bg"),
                  opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color={th("#0B0B0B")} />
                ) : (
                  <>
                    <Check size={16} color={th("#0B0B0B")} strokeWidth={3} />
                    <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>
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
                borderColor: th("rgba(248,113,113,0.22)", "line"),
                backgroundColor: th("rgba(248,113,113,0.07)", "bg"),
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <AlertTriangle size={16} color={th(RED)} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: th("rgba(255,255,255,0.82)") }}>
                {isFixed
                  ? "Essa transação se repete todo mês. Quer tirar só deste mês ou dela em diante?"
                  : isParcelled
                    ? `É a parcela ${tx.installment_current ?? 1} de ${tx.installments}. Quer tirar só esta ou esta e as próximas?`
                    : "Essa transação será excluída e não dá para desfazer."}
              </Text>
            </View>
            {(isFixed || isParcelled) && (
              <Wide label={isFixed ? "Só deste mês" : "Só esta parcela"} onPress={() => void removeThisMonth()} disabled={busy} />
            )}
            <Wide
              label={isFixed ? "Deste mês em diante" : isParcelled ? "Esta e as próximas" : "Excluir"}
              danger
              onPress={() => void removeAll()}
              disabled={busy}
              loading={busy}
            />
            <Pressable onPress={() => setConfirming(false)} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, color: th("rgba(255,255,255,0.7)") }}>Cancelar</Text>
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
        borderTopColor: th("rgba(255,255,255,0.06)", "line"),
      }}
    >
      <Icon size={15} color={th(INK.softer)} />
      <Text style={{ fontSize: 14, color: th(INK.soft) }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
        {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th(dot, "bg") }} />}
        <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 14.5, color: th("#fff") }]}>
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
        backgroundColor: th(pressed ? "rgba(255,255,255,0.06)" : "transparent", "bg"),
      })}
    >
      <Icon size={17} color={th(danger ? RED : "#fff")} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: th(danger ? RED : "#fff") }}>{label}</Text>
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
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th(danger ? "#EF4444" : "rgba(255,255,255,0.04)", "bg"),
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={th("#fff")} />
      ) : (
        <Text style={{ fontSize: 14.5, fontWeight: danger ? "700" : "600", color: th("#fff") }}>{label}</Text>
      )}
    </Pressable>
  );
}
