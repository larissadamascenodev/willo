import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import type { CardBadge } from "@/services/activeInstallments";
import CenterModal from "~/components/CenterModal";
import SegmentedTabs from "~/components/SegmentedTabs";
import { ChevronDown } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { EXPAND } from "~/lib/expand";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

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
}: {
  entries: MonthPart[];
  title: string;
  emptyLabel: string;
  customCats: CustomCategory[];
  cardsById: Record<string, CardBadge>;
}) {
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<"todos" | "cartao" | "conta">("todos");
  const [opened, setOpened] = useState<MonthPart | null>(null);

  const filtered = all
    ? entries.filter(({ item }) => (filter === "todos" ? true : filter === "cartao" ? item.payment_method === "cartao" : item.payment_method !== "cartao"))
    : entries.slice(0, FIRST);

  return (
    <View>
      <View style={{ paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={T.eyebrow}>{title}</Text>
        <Text style={{ fontSize: 12, color: INK.faint }}>{entries.length}</Text>
      </View>

      {all && (
        <Animated.View entering={FadeIn.duration(320)} style={{ marginTop: 12 }}>
          <SegmentedTabs
            value={filter}
            onChange={setFilter}
            height={32}
            compact
            options={[
              { key: "todos" as const, label: "Todas" },
              { key: "cartao" as const, label: "No cartão" },
              { key: "conta" as const, label: "Na conta" },
            ]}
          />
        </Animated.View>
      )}

      <Animated.View layout={EXPAND} style={{ marginTop: 6 }}>
        {filtered.length === 0 ? (
          <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, color: INK.softer }}>{emptyLabel}</Text>
        ) : (
          filtered.map((entry, i) => (
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
      </Animated.View>

      {entries.length > FIRST && (
        <Pressable
          onPress={() => {
            setAll((v) => !v);
            setFilter("todos");
          }}
          style={({ pressed }) => ({
            marginTop: 14,
            height: 50,
            borderRadius: 25,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            backgroundColor: "rgba(255,255,255,0.05)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: "500", color: "#fff" }}>{all ? "Mostrar menos" : `Ver todas as parcelas (${entries.length})`}</Text>
          <ChevronDown size={15} color="#fff" style={{ transform: [{ rotate: all ? "180deg" : "0deg" }] }} />
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

function InstallmentRow({
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
  const last = number === item.installments;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
        <Icon size={20} color={chipInk(hex)} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: item.isOverdue ? RED : INK.soft }}>
          {item.isOverdue ? `Em atraso · ${where}` : `${where} · ${item.category}`}
        </Text>
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, maxWidth: 120, height: 4, flexDirection: "row", gap: item.installments > 24 ? 1 : 2 }}>
            {Array.from({ length: item.installments }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < number ? hex : "rgba(255,255,255,0.12)" }} />
            ))}
          </View>
          <Text style={{ fontSize: 11.5, fontWeight: "600", color: INK.soft }}>{last ? "última" : `${number} de ${item.installments}`}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{money(item.amount)}</Text>
    </Pressable>
  );
}

function InstallmentDetail({
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
  const [shown, setShown] = useState<MonthPart | null>(entry);
  if (entry && entry !== shown) setShown(entry);
  if (!shown) return null;

  const { item, number } = shown;
  const hex = categoryHex(item.category, customCats);
  const Icon = categoryIcon(item.category, customCats);
  const paidCount = item.installment_current - 1;
  const where = item.payment_method === "cartao" ? (card?.name ?? "Cartão") : "Conta";
  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const day = start.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  /* The instalments still to come, month by month. */
  const ahead = Array.from({ length: item.installments - paidCount }, (_, k) => {
    const n = paidCount + k + 1;
    const d = new Date(start);
    d.setMonth(d.getMonth() + n - 1);
    return { n, label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` };
  });

  return (
    <CenterModal open={!!entry} onClose={onClose} title={item.name} subtitle={where}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
          <Icon size={21} color={chipInk(hex)} strokeWidth={2} />
        </View>
        <View>
          <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: "#fff" }}>{money(item.amount)}</Text>
          <Text style={{ marginTop: 1, fontSize: 13, color: INK.soft }}>por mês</Text>
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
            Parcela {number} de {item.installments}
          </Text>
          <Text style={{ fontSize: 13, color: INK.soft }}>
            {number === item.installments ? "última parcela" : `faltam ${money(item.amount * (item.installments - number))}`}
          </Text>
        </View>
        <View style={{ marginTop: 10, height: 6, flexDirection: "row", gap: 3 }}>
          {Array.from({ length: item.installments }, (_, i) => (
            <View key={i} style={{ flex: 1, borderRadius: 3, backgroundColor: i < number ? hex : "rgba(255,255,255,0.10)" }} />
          ))}
        </View>
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11.5, color: INK.softer }}>Pago</Text>
            <Text style={{ marginTop: 2, fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{money(item.amount * paidCount)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11.5, color: INK.softer }}>Total da compra</Text>
            <Text style={{ marginTop: 2, fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>{money(item.amount * item.installments)}</Text>
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
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.n === paidCount + 1 ? "#fff" : "rgba(255,255,255,0.22)" }} />
            <Text style={{ width: 30, fontSize: 12.5, color: INK.softer }}>{a.n}ª</Text>
            <Text style={{ flex: 1, fontSize: 14, color: "#fff" }}>{a.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{money(item.amount)}</Text>
          </View>
        ))}
      </View>
    </CenterModal>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
      <Text style={{ fontSize: 14.5, color: INK.soft }}>{label}</Text>
      <Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 15, fontWeight: "600", color: "#fff", textAlign: "right" }}>{value}</Text>
    </View>
  );
}
