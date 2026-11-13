import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { deleteTransaction } from "@/services/transactionService";
import { categoryHex } from "@/lib/categoryData";
import { partAmount, type ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import type { CardBadge } from "@/services/activeInstallments";
import CenterModal from "~/components/CenterModal";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { Pencil, Trash2 } from "~/components/icons";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/**
 * The purchases with an instalment in the chosen month, written the way a card's
 * statement is: on the ground, a few at first, each with its glyph, where it is paid
 * and how far along it is in a bar cut once per instalment. The rest open under them,
 * and only then the choice of card or account, since with five lines there is nothing
 * to filter. A purchase opens in the middle of the screen, with its plan written out.
 */

const FIRST = 5;
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface MonthPart {
  item: ActiveInstallmentItem;
  /** The instalment that falls in the month being read. */
  number: number;
}

export default function InstallmentList({
  entries,
  title,
  emptyLabel,
  customCats,
  cardsById,
  onSeeAll,
}: {
  entries: MonthPart[];
  title: string;
  emptyLabel: string;
  customCats: CustomCategory[];
  cardsById: Record<string, CardBadge>;
  onSeeAll: () => void;
}) {
  const [opened, setOpened] = useState<MonthPart | null>(null);
  const visible = entries.slice(0, FIRST);

  return (
    <View>
      <View style={{ paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={T.eyebrow}>{title}</Text>
        <Text style={{ fontSize: 12, color: th(INK.faint) }}>{entries.length}</Text>
      </View>

      <View style={{ marginTop: 6 }}>
        {visible.length === 0 ? (
          <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, color: th(INK.softer) }}>{emptyLabel}</Text>
        ) : (
          visible.map((entry, i) => (
            <Animated.View key={entry.item.id} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(320)}>
              <InstallmentRow
                entry={entry}
                customCats={customCats}
                card={entry.item.credit_card_id ? cardsById[entry.item.credit_card_id] : undefined}
                onPress={() => setOpened(entry)}
              />
            </Animated.View>
          ))
        )}
      </View>

      {entries.length > 0 && (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => ({
            marginTop: 14,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: th("rgba(255,255,255,0.08)", "line"),
            backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 15.5, fontWeight: "500", color: th("#fff") }}>Ver todos os parcelamentos</Text>
        </Pressable>
      )}

      <InstallmentDetail
        entry={opened}
        customCats={customCats}
        card={opened?.item.credit_card_id ? cardsById[opened.item.credit_card_id] : undefined}
        onClose={() => setOpened(null)}
      />
    </View>
  );
}

export function InstallmentRow({
  entry,
  customCats,
  card,
  onPress,
}: {
  entry: MonthPart;
  customCats: CustomCategory[];
  card?: CardBadge;
  onPress: () => void;
}) {
  const { item, number } = entry;
  const hex = categoryHex(item.category, customCats);
  const Icon = categoryIcon(item.category, customCats);
  const where = item.payment_method === "cartao" ? (card?.name ?? "Cartão") : "Conta";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
        <Icon size={20} color={th(chipInk(hex))} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(item.isOverdue ? RED : INK.soft) }}>
          {item.isOverdue ? `Em atraso · ${where}` : `${where} · ${item.category}`}
        </Text>
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, maxWidth: 120, height: 4, flexDirection: "row", gap: item.installments > 24 ? 1 : 2 }}>
            {Array.from({ length: item.installments }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: th(i < number ? hex : "rgba(255,255,255,0.12)", "bg") }} />
            ))}
          </View>
          <Text style={{ fontSize: 11.5, fontWeight: "600", color: th(INK.soft) }}>{`${number} de ${item.installments}`}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>{money(partAmount(item, number))}</Text>
    </Pressable>
  );
}

export function InstallmentDetail({
  entry,
  customCats,
  card,
  onClose,
}: {
  entry: MonthPart | null;
  customCats: CustomCategory[];
  card?: CardBadge;
  onClose: () => void;
}) {
  const router = useRouter();
  const [shown, setShown] = useState<MonthPart | null>(entry);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (entry && entry !== shown) {
    setShown(entry);
    setConfirming(false);
  }
  if (!shown) return null;

  const { item, number } = shown;
  const hex = categoryHex(item.category, customCats);
  const Icon = categoryIcon(item.category, customCats);
  const paidCount = item.installment_current - 1;
  /* Instalment by instalment, since one may have been changed on its own. */
  const sumOf = (from: number, to: number) => {
    let sum = 0;
    for (let n = from; n <= to; n++) sum += partAmount(item, n);
    return sum;
  };
  const where = item.payment_method === "cartao" ? (card?.name ?? "Cartão") : "Conta";
  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const day = start.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  /* The instalments still to come, month by month. */
  /* On a card, the month of the invoice the next one is billed on; otherwise the purchase's. */
  const due = item.dueDate ? new Date(item.dueDate) : null;
  const first = due ? due.getFullYear() * 12 + due.getMonth() : start.getFullYear() * 12 + start.getMonth() + paidCount;
  const ahead = Array.from({ length: item.installments - paidCount }, (_, k) => {
    const p = first + k;
    return { n: paidCount + k + 1, label: `${MONTHS_SHORT[p % 12]} ${Math.floor(p / 12)}` };
  });

  return (
    <CenterModal open={!!entry} onClose={onClose} title={item.name} subtitle={where}>
      {confirming ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 8 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,107,107,0.14)", "bg") }}>
            <Trash2 size={24} color={th(RED)} />
          </View>
          <Text style={{ marginTop: 14, fontSize: 18, fontWeight: "700", color: th("#fff"), textAlign: "center" }}>Excluir “{item.name}”?</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: th(INK.soft), textAlign: "center" }}>
            {item.payment_method === "cartao"
              ? `As ${item.installments} parcelas, ${money(sumOf(1, item.installments))} ao todo, saem de todas as faturas e o limite do cartão volta a ficar livre.`
              : `As ${item.installments} parcelas, ${money(sumOf(1, item.installments))} ao todo, saem dos seus lançamentos.`}
          </Text>
          <View style={{ marginTop: 22, alignSelf: "stretch", flexDirection: "row", gap: 10 }}>
            <ModalButton label="Cancelar" disabled={busy} onPress={() => setConfirming(false)} />
            <ModalButton
              label={busy ? "Excluindo…" : "Excluir"}
              danger
              disabled={busy}
              onPress={() => {
                setBusy(true);
                deleteTransaction(item.id)
                  .then(() => {
                    onClose();
                    showToast(`“${item.name}” excluído`);
                  })
                  .catch(() => showToast("Não foi possível excluir."))
                  .finally(() => setBusy(false));
              }}
            />
          </View>
        </Animated.View>
      ) : (
      <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
          <Icon size={21} color={th(chipInk(hex))} strokeWidth={2} />
        </View>
        <View>
          <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: th("#fff") }}>{money(partAmount(item, number))}</Text>
          <Text style={{ marginTop: 1, fontSize: 13, color: th(INK.soft) }}>por mês</Text>
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>
            Parcela {number} de {item.installments}
          </Text>
          <Text style={{ fontSize: 13, color: th(INK.soft) }}>
            {/* What is still to be paid: every instalment not paid yet, this one included. */}
            {paidCount >= item.installments ? "" : `faltam ${money(sumOf(paidCount + 1, item.installments))}`}
          </Text>
        </View>
        <View style={{ marginTop: 10, height: 6, flexDirection: "row", gap: 3 }}>
          {Array.from({ length: item.installments }, (_, i) => (
            <View key={i} style={{ flex: 1, borderRadius: 3, backgroundColor: th(i < paidCount ? hex : i < number ? `${hex}66` : "rgba(255,255,255,0.10)", "bg") }} />
          ))}
        </View>
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>Pago</Text>
            <Text style={{ marginTop: 2, fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>{money(sumOf(1, paidCount))}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>Total da compra</Text>
            <Text style={{ marginTop: 2, fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>{money(sumOf(1, item.installments))}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <Fact label="Data da compra" value={day} />
        <Fact label="Categoria" value={item.category} last />
      </View>

      {/* What is still to come, one line a month. */}
      <Text style={[T.eyebrow, { marginTop: 18, fontSize: 11 }]}>Próximas parcelas</Text>
      <View style={{ marginTop: 6 }}>
        {ahead.map((a) => (
          <View key={a.n} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(a.n === paidCount + 1 ? "#fff" : "rgba(255,255,255,0.22)", "bg") }} />
            <Text style={{ width: 30, fontSize: 12.5, color: th(INK.softer) }}>{a.n}ª</Text>
            <Text style={{ flex: 1, fontSize: 14, color: th("#fff") }}>{a.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: th("#fff") }}>{money(partAmount(item, a.n))}</Text>
          </View>
        ))}
      </View>

      {/* The plan as a whole: change it, or remove every instalment of it. */}
      <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
        <ModalButton
          label="Editar"
          icon={Pencil}
          onPress={() => {
            onClose();
            router.push({ pathname: "/manual", params: { editar: item.id } } as never);
          }}
        />
        <ModalButton label="Excluir" icon={Trash2} danger soft onPress={() => setConfirming(true)} />
      </View>
      </>
      )}
    </CenterModal>
  );
}

function ModalButton({ label, onPress, icon: Icon, danger = false, soft = false, disabled = false }: { label: string; onPress: () => void; icon?: typeof Pencil; danger?: boolean; soft?: boolean; disabled?: boolean }) {
  const solid = danger && !soft;
  const ink = solid ? "#fff" : danger ? RED : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: 24,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: th(solid ? RED : danger ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.10)", "bg"),
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {Icon && <Icon size={16} color={th(ink)} strokeWidth={2.2} />}
      <Text style={{ fontSize: 15, fontWeight: solid ? "700" : "600", color: th(ink) }}>{label}</Text>
    </Pressable>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: th("rgba(255,255,255,0.06)", "line") }}>
      <Text style={{ fontSize: 14.5, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 15, fontWeight: "600", color: th("#fff"), textAlign: "right" }}>{value}</Text>
    </View>
  );
}
