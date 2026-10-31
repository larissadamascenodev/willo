import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { InvoiceLine } from "@/lib/invoice/readModel";
import { categoryHex } from "@/lib/categoryData";
import { deleteTransaction, getTransactionById } from "@/services/transactionService";
import CenterModal from "~/components/CenterModal";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { MoreVertical, Pencil, Trash2 } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * One line of a card's statement, opened.
 *
 * What it was, when, and what it costs on this bill; for a purchase in instalments, where
 * the plan stands — which one this is, how much of the purchase is behind and how much is
 * still to come. Editing and removing act on the purchase itself: an instalment is not a
 * thing of its own, so removing one removes the plan, and the pane says so before it does.
 */

export default function LineDetail({
  line,
  cardName,
  onClose,
  onChanged,
}: {
  line: InvoiceLine | null;
  cardName?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  /* The purchase the line belongs to: itself, or the plan it is an instalment of. */
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setPurchaseId(null);
    setMenu(false);
    setConfirming(false);
    if (!line) return;
    let alive = true;
    getTransactionById(line.transactionId)
      .then((tx: any) => alive && setPurchaseId(tx?.parent_transaction_id ?? tx?.id ?? line.transactionId))
      .catch(() => alive && setPurchaseId(line.transactionId));
    return () => {
      alive = false;
    };
  }, [line]);

  const [shown, setShown] = useState<InvoiceLine | null>(line);
  useEffect(() => {
    if (line) setShown(line);
  }, [line]);

  if (!shown) return null;
  const isRefund = shown.amount < 0;
  const hex = isRefund ? GREEN : categoryHex(shown.category);
  const Icon = categoryIcon(shown.category);
  const each = Math.abs(shown.amount);
  const plan = shown.installment;
  const day = new Date(`${shown.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });

  const remove = async () => {
    if (!purchaseId) return;
    setBusy(true);
    try {
      await deleteTransaction(purchaseId);
      onClose();
      onChanged();
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      showToast(`“${shown.name}” excluído`);
    } catch {
      showToast("Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <CenterModal
        open={!!line}
        onClose={onClose}
        title={shown.name}
        subtitle={cardName}
        actions={
          !isRefund && !confirming ? (
            <Pressable
              onPress={() => setMenu((v) => !v)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Opções do lançamento"
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: menu ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MoreVertical size={16} color="rgba(255,255,255,0.86)" strokeWidth={2.4} />
            </Pressable>
          ) : null
        }
      >
        {/* ══ The three dots: edit or remove, over the top of the pane ══ */}
        {menu && (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 20,
              zIndex: 10,
              minWidth: 170,
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              backgroundColor: "rgba(30,32,38,0.98)",
            }}
          >
            <MenuItem
              icon={Pencil}
              label="Editar"
              disabled={!purchaseId}
              onPress={() => {
                if (!purchaseId) return;
                setMenu(false);
                onClose();
                router.push({ pathname: "/manual", params: { editar: purchaseId } } as never);
              }}
            />
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
            <MenuItem
              icon={Trash2}
              label="Excluir"
              danger
              disabled={!purchaseId}
              onPress={() => {
                setMenu(false);
                setConfirming(true);
              }}
            />
          </View>
        )}

        {confirming ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,107,107,0.14)" }}>
              <Trash2 size={24} color={RED} />
            </View>
            <Text style={{ marginTop: 14, fontSize: 18, fontWeight: "700", color: "#fff", textAlign: "center" }}>
              Excluir “{shown.name}”?
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: INK.soft, textAlign: "center" }}>
              {plan
                ? `As ${plan.total} parcelas de ${money(each)} saem de todas as faturas e o limite do cartão volta a ficar livre.`
                : "Sai da fatura e o limite do cartão volta a ficar livre."}
            </Text>
            <View style={{ marginTop: 22, alignSelf: "stretch", flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setConfirming(false)}
                disabled={busy}
                style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void remove()}
                disabled={busy || !purchaseId}
                style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: RED, opacity: busy || !purchaseId ? 0.5 : pressed ? 0.8 : 1 })}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{busy ? "Excluindo…" : "Excluir"}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
        {/* ══ What it costs on this bill ══ */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
            <Icon size={21} color={chipInk(hex)} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: isRefund ? GREEN : "#fff" }}>
              {isRefund ? "+" : ""}
              {money(each)}
            </Text>
            <Text style={{ marginTop: 1, fontSize: 13, color: INK.soft }}>{plan ? "Valor da parcela nesta fatura" : "Nesta fatura"}</Text>
          </View>
        </View>

        {/* ══ Where the plan stands: which one, how far, what is paid against the whole ══ */}
        {plan && (
          <View style={{ marginTop: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                Parcela {plan.current} de {plan.total}
              </Text>
              <Text style={{ fontSize: 13, color: INK.soft }}>
                {plan.total - plan.current === 0
                  ? ""
                  : `faltam ${money(each * (plan.total - plan.current))}`}
              </Text>
            </View>
            <View style={{ marginTop: 10, height: 6, flexDirection: "row", gap: 3 }}>
              {Array.from({ length: plan.total }, (_, i) => (
                <View key={i} style={{ flex: 1, borderRadius: 3, backgroundColor: i < plan.current ? hex : "rgba(255,255,255,0.10)" }} />
              ))}
            </View>
            <View style={{ marginTop: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 11.5, color: INK.softer }}>Pago até esta parcela</Text>
                <Text style={{ marginTop: 2, fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{money(each * plan.current)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 11.5, color: INK.softer }}>Total da compra</Text>
                <Text style={{ marginTop: 2, fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>{money(each * plan.total)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ══ The facts ══ */}
        <View style={{ marginTop: 14 }}>
          <Fact label="Data da compra" value={day} />
          <Fact label="Categoria" value={shown.category} last={!(!plan && cardName)} />
          {!plan && cardName && <Fact label="Cartão" value={cardName} last />}
        </View>
          </Animated.View>
        )}
      </CenterModal>

    </>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Text style={{ fontSize: 14.5, color: INK.soft }}>{label}</Text>
      <Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 15, fontWeight: "600", color: "#fff", textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 13,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Icon size={16} color={danger ? RED : "#fff"} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: danger ? RED : "#fff" }}>{label}</Text>
    </Pressable>
  );
}
