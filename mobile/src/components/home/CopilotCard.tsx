import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import type { WidgetSize } from "@/lib/homeWidgets";
import Surface from "~/components/Surface";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { ChevronRight } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { categoryHex } from "@/lib/categoryData";
import { useCopilot, type CopilotItem } from "~/lib/copilot";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";

/**
 * Willo Copilot on the home: what it caught from the bank, waiting to be confirmed.
 *
 * Small, it is the count and the latest one; whole, the latest three as the phone's own
 * notifications look, and the way in. A touch opens the list, where each can be changed
 * and confirmed — and only then is it a transaction.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

export const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
};

export default function CopilotCard({ size }: { size: WidgetSize }) {
  const router = useRouter();
  const { items } = useCopilot();
  const list = items ?? [];
  const n = list.length;
  const open = () => router.push("/copilot" as never);

  if (size === "half") {
    const last = list[0];
    return (
      <Surface onPress={open} style={{ height: 208, padding: 14 }}>
        <Head />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={[nums, { fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: th(n ? "#fff" : INK.softer) }]}>{items ? n : " "}</Text>
          <Text style={{ marginTop: -2, fontSize: 13, color: th(INK.soft) }}>{n === 1 ? "para confirmar" : n ? "para confirmar" : "Tudo confirmado"}</Text>
        </View>
        {last ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: th("#fff") }}>{last.name}</Text>
            <Text style={[nums, { fontSize: 12.5, fontWeight: "700", color: th(last.type === "receita" ? GREEN : "#fff") }]}>
              {last.type === "receita" ? "+" : ""}
              {money(last.amount)}
            </Text>
          </View>
        ) : (
          <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: th(INK.softer) }}>O que o Willo captar dos seus bancos espera aqui.</Text>
        )}
      </Surface>
    );
  }

  return (
    <Surface onPress={open} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Head />
        </View>
        {n > 0 && (
          <View style={{ height: 24, minWidth: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}>
            <Text style={[nums, { fontSize: 12.5, fontWeight: "800", color: th("#0B0B0B") }]}>{n}</Text>
          </View>
        )}
      </View>
      {n === 0 ? (
        <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
          Tudo confirmado. O que o Willo captar dos avisos dos seus bancos espera aqui pela sua confirmação.
        </Text>
      ) : (
        <View style={{ marginTop: 12, gap: 8 }}>
          {list.slice(0, 3).map((item) => (
            <Notice key={item.id} item={item} />
          ))}
          <Pressable
            onPress={open}
            style={({ pressed }) => ({ marginTop: 4, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#0B0B0B") }}>{n > 3 ? `Revisar as ${n}` : "Revisar e confirmar"}</Text>
          </Pressable>
        </View>
      )}
    </Surface>
  );
}

function Head() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <ParticleOrb size={22} density={60} />
      </View>
      <Text numberOfLines={1} style={[T.cardLabel, { flexShrink: 1, fontSize: 13 }]}>Willo Copilot</Text>
      <ChevronRight size={14} color={th(INK.faint)} />
    </View>
  );
}

/** One caught purchase, as the phone's own notifications look. */
export function Notice({ item, right }: { item: CopilotItem; right?: React.ReactNode }) {
  const Icon = categoryIcon(item.category || "Outros");
  const hex = categoryHex(item.category || "Outros");
  const income = item.type === "receita";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.09)", "line"),
        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: th(`${hex}26`, "bg") }}>
        <Icon size={18} color={th(hex)} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: th(INK.softer) }}>
          {item.category || "Sem categoria"} · {ago(item.occurred_at)}
        </Text>
      </View>
      {right ?? (
        <Text style={[nums, { fontSize: 14.5, fontWeight: "700", color: th(income ? GREEN : "#fff") }]}>
          {income ? "+" : "−"}
          {money(item.amount)}
        </Text>
      )}
    </View>
  );
}
