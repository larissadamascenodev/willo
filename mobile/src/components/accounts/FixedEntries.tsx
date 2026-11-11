import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRecorrentes, type RecurringItem } from "@/hooks/useRecorrentes";
import Surface from "~/components/Surface";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * What comes in and goes out every month, in the wallet.
 *
 * Two tiles side by side — Receitas fixas, Despesas fixas — each with what it adds up
 * to in a month and a plus that opens Adicionar manualmente already set to that kind,
 * repeating every month: the value, what it is, the date, and it is in Transações.
 * Under them, the fixed entries themselves, the soonest first; a touch opens one to
 * change it.
 */

const SHOWN = 5;

export default function FixedEntries() {
  const router = useRouter();
  const { items, receitasFixas, totalReceitasFixas } = useRecorrentes();
  const despesas = items.filter((i) => i.txType === "despesa");
  const totalDespesas = despesas.reduce((s, i) => s + i.amount, 0);
  const list = [...receitasFixas, ...despesas].sort((a, b) => a.dueDay - b.dueDay);

  const add = (tipo: "receita" | "despesa") => router.push(`/manual?tipo=${tipo}&fixa=1` as never);

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(420)} style={{ marginTop: 30 }}>
      <View style={{ paddingHorizontal: 4, marginBottom: 12 }}>
        <Text style={T.eyebrow}>Fixas do mês</Text>
        <Text style={{ marginTop: 3, fontSize: 12.5, color: th(INK.soft) }}>O que entra e sai todo mês</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Tile
          label="Receitas fixas"
          total={totalReceitasFixas}
          count={receitasFixas.length}
          tone={GREEN}
          icon={ArrowDownLeft}
          onAdd={() => add("receita")}
        />
        <Tile
          label="Despesas fixas"
          total={totalDespesas}
          count={despesas.length}
          tone={RED}
          icon={ArrowUpRight}
          onAdd={() => add("despesa")}
        />
      </View>

      {list.length > 0 && (
        <Surface radius={22} style={{ marginTop: 10, paddingHorizontal: 16 }}>
          {list.slice(0, SHOWN).map((item, i) => (
            <Row key={`${item.txType}-${item.sourceId}`} item={item} first={i === 0} onPress={() => router.push(`/manual?editar=${item.id}` as never)} />
          ))}
          {list.length > SHOWN && (
            <Pressable
              onPress={() => router.push("/(tabs)/transacoes" as never)}
              style={({ pressed }) => ({
                height: 46,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderTopWidth: 1,
                borderTopColor: th("rgba(255,255,255,0.06)", "line"),
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: th(INK.soft) }}>Ver as {list.length} em Transações</Text>
              <ChevronRight size={14} color={th(INK.soft)} />
            </Pressable>
          )}
        </Surface>
      )}
    </Animated.View>
  );
}

function Tile({
  label,
  total,
  count,
  tone,
  icon: Icon,
  onAdd,
}: {
  label: string;
  total: number;
  count: number;
  tone: string;
  icon: typeof Plus;
  onAdd: () => void;
}) {
  return (
    <Surface radius={22} onPress={onAdd} style={{ flex: 1, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th(tone === GREEN ? "rgba(103,205,103,0.16)" : "rgba(248,113,113,0.16)", "bg") }}>
          <Icon size={18} color={th(tone)} strokeWidth={2.4} />
        </View>
        <View
          accessibilityLabel={`Adicionar ${label.toLowerCase()}`}
          style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}
        >
          <Plus size={16} color={th("#0B0B0B")} strokeWidth={2.8} />
        </View>
      </View>
      <Text numberOfLines={1} style={{ marginTop: 14, fontSize: 13, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 3, fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>
        {money(total)}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: th(INK.softer) }}>
        {count === 0 ? "Toque para adicionar" : `${count} ${count === 1 ? "lançamento" : "lançamentos"} por mês`}
      </Text>
    </Surface>
  );
}

function Row({ item, first, onPress }: { item: RecurringItem; first: boolean; onPress: () => void }) {
  const income = item.txType === "receita";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 58,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: th("rgba(255,255,255,0.06)", "line"),
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(income ? GREEN : RED, "bg") }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: th(INK.softer) }}>
          Todo dia {item.dueDay}
          {item.isPaidThisMonth ? (income ? " · recebida" : " · paga") : ""}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: th(income ? GREEN : "#fff") }}>
        {income ? "+" : "−"}
        {money(item.amount)}
      </Text>
    </Pressable>
  );
}
