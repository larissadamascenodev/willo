import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { CustomCategory } from "@/services/categoryService";
import { categoryHex } from "@/lib/categoryData";
import SubLogo from "~/components/SubLogo";
import { Receipt } from "~/components/icons";
import { knownSub } from "~/lib/subscriptionLogos";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Últimos lançamentos, everywhere it appears — drawn as the card's statement draws it.
 *
 * A quiet title, the newest few on the ground (no box around them), each with its category's
 * mark in a soft circle (a known service's own logo), its name, the day and the category, and —
 * for an instalment — how far the plan has gone as a row of little segments with "1 de 12".
 * The figure on the right: white for what went out, green with a plus for what came in. The
 * whole list is the button under them.
 */

export interface RecentEntry {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: string;
  status?: string | null;
  installments?: number | null;
  installment_current?: number | null;
}

export default function RecentEntries({
  items,
  customCats,
  hidden,
  onOpen,
  onSeeAll,
  empty = "Nada por aqui neste mês",
}: {
  items: RecentEntry[];
  customCats?: CustomCategory[];
  hidden?: boolean;
  onOpen?: (entry: RecentEntry) => void;
  onSeeAll: () => void;
  empty?: string;
}) {
  return (
    <View>
      <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Últimos lançamentos</Text>

      {items.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <Receipt size={20} color={th(INK.soft)} />
          <Text style={{ marginTop: 10, fontSize: 14, color: th(INK.soft) }}>{empty}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 6 }}>
          {items.map((entry, i) => (
            <Animated.View key={entry.id} entering={FadeInDown.delay(40 + i * 35).duration(260)}>
              <EntryRow entry={entry} customCats={customCats} hidden={hidden} onPress={onOpen ? () => onOpen(entry) : undefined} />
            </Animated.View>
          ))}
        </View>
      )}

      {items.length > 0 && (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => ({
            marginTop: 16,
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
          <Text style={{ fontSize: 15.5, fontWeight: "500", color: th("#fff") }}>Ver todos os lançamentos</Text>
        </Pressable>
      )}
    </View>
  );
}

/** One entry, as a line of the card's statement. */
export function EntryRow({ entry, customCats, hidden, onPress }: { entry: RecentEntry; customCats?: CustomCategory[]; hidden?: boolean; onPress?: () => void }) {
  const income = entry.type === "receita";
  const hex = categoryHex(entry.category, customCats);
  const Icon = categoryIcon(entry.category, customCats);
  const day = new Date(`${entry.date.slice(0, 10)}T12:00:00`);
  const sameYear = day.getFullYear() === new Date().getFullYear();
  const date = day.toLocaleDateString("pt-BR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
  const total = entry.installments ?? 0;
  const current = entry.installment_current ?? 0;
  const plan = total > 1 && current > 0 ? { current, total } : null;
  const pending = entry.status && entry.status !== "pago";

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      {!income && knownSub(entry.name) ? (
        <SubLogo name={entry.name} size={46} round />
      ) : (
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
          <Icon size={20} color={th(chipInk(hex))} strokeWidth={2} />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>
          {entry.name}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
          {date} · {entry.category}
          {pending ? " · pendente" : ""}
        </Text>
        {plan && (
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, maxWidth: 120, height: 4, flexDirection: "row", gap: plan.total > 24 ? 1 : 2 }}>
              {Array.from({ length: plan.total }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: th(i < plan.current ? hex : "rgba(255,255,255,0.12)", "bg") }} />
              ))}
            </View>
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: th(INK.soft) }}>
              {plan.current} de {plan.total}
            </Text>
          </View>
        )}
      </View>

      <Text style={{ fontSize: 15, fontWeight: "600", color: th(income ? GREEN : "#fff") }}>
        {hidden ? "R$ •••" : `${income ? "+" : ""}${money(Math.abs(Number(entry.amount)))}`}
      </Text>
    </Pressable>
  );
}
