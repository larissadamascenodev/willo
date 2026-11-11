import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { getAccounts } from "@/services/transactionService";
import { fetchGoals, type Goal } from "@/services/goalService";
import { colorFor } from "@/lib/banks";
import type { OverviewCard, OverviewInvoice } from "@/hooks/useCardsOverview";
import BankMark from "~/components/BankMark";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { isLight, th } from "~/theme/theme";

/**
 * The top of the home as a panel: a raised sheet that holds four faces, one at a time.
 *
 * The money in the accounts, large; the accounts one by one; the cards with what each
 * invoice asks for; the caixinhas with how far each has come. A sideways swipe or a dot
 * moves between them. The panel stays where it is while the page scrolls — the cards
 * below travel up over it, and it steps back a little as they do.
 *
 * It lives inside the scroller, held in place by moving it down exactly as far as the
 * page has moved up, so it still answers to the finger: a panel above the scroller
 * could not be passed over, and one below it could not be touched.
 */

/** How tall the faces are, under the row with the avatar and the bell. */
export const PANEL_BODY = 236;

const FACES = ["Saldo em contas", "Contas", "Cartões", "Caixinhas"] as const;

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

export default function PanelHero({
  top,
  scrollY,
  hidden,
  saldoPrevisto,
  receitas,
  despesas,
  cards,
  invoices,
}: {
  /** Where the faces start: under the row with the avatar and the bell. */
  top: number;
  scrollY: SharedValue<number>;
  hidden: boolean;
  saldoPrevisto: number;
  receitas: number;
  despesas: number;
  cards: OverviewCard[];
  invoices: OverviewInvoice[];
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [face, setFace] = useState(0);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const light = isLight();
  const height = top + PANEL_BODY;

  useEffect(() => {
    let alive = true;
    const load = () => {
      getAccounts()
        .then((a) => alive && setAccounts((a as unknown as Account[]).filter((x) => x.type !== "investment")))
        .catch(() => alive && setAccounts([]));
      fetchGoals()
        .then((g) => alive && setGoals(g))
        .catch(() => alive && setGoals([]));
    };
    load();
    window.addEventListener("finance-data-changed", load);
    window.addEventListener("transaction-created", load);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", load);
      window.removeEventListener("transaction-created", load);
    };
  }, []);

  const show = (v: number) => (hidden ? "R$ ••••" : money(v));
  const total = useMemo(() => (accounts ?? []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0), [accounts]);
  const rows = useMemo(
    () =>
      [...(accounts ?? [])]
        .map((a) => ({ ...a, balance: Number(a.current_balance) || 0, hex: colorFor(a.name, a.color) }))
        .sort((a, b) => b.balance - a.balance),
    [accounts],
  );

  /* Each card with the invoice it is about to ask for: the oldest one still owed. */
  const cardRows = useMemo(() => {
    const now = new Date();
    const today = now.getFullYear() * 12 + now.getMonth();
    return cards.map((c) => {
      const owed = invoices
        .filter((i) => i.cardId === c.id && !i.isPaid && i.total - i.paid > 0 && (i.year * 12 + i.month - 1) >= today - 2)
        .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))[0];
      return {
        ...c,
        hex: colorFor(c.name, c.color),
        owed: owed ? owed.total - owed.paid : 0,
        dueLabel: owed ? `vence ${String(c.dueDay).padStart(2, "0")}/${String(owed.month).padStart(2, "0")}` : "sem fatura em aberto",
        free: Math.max(0, c.limit - c.used),
      };
    });
  }, [cards, invoices]);
  const owedTotal = cardRows.reduce((s, c) => s + c.owed, 0);
  const saved = (goals ?? []).reduce((s, g) => s + (Number(g.current_amount) || 0), 0);

  /* Held in place while the page moves, and stepping back as the cards come over it. */
  const hold = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    const p = Math.min(1, y / PANEL_BODY);
    return { transform: [{ translateY: y }, { scale: 1 - p * 0.05 }], opacity: 1 - p * 0.45 };
  });

  const ground = light ? "#FFFFFF" : "#17181D";
  const tile = light ? "#F4F5F7" : "rgba(255,255,255,0.05)";
  const ink = th("#fff");
  const soft = th(INK.soft);

  return (
    <Animated.View
      style={[
        {
          height,
          marginHorizontal: -16,
          backgroundColor: ground,
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
          borderCurve: "continuous",
          paddingTop: top - 6,
          shadowColor: "#000",
          shadowOpacity: light ? 0.06 : 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          borderWidth: light ? 0 : 1,
          borderTopWidth: 0,
          borderColor: "rgba(255,255,255,0.06)",
        },
        hold,
      ]}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setFace(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flexGrow: 0, height: PANEL_BODY - 26 }}
      >
        {/* 1 · The money in the accounts */}
        <Pressable onPress={() => router.push("/gestao" as never)} style={{ width, alignItems: "center", paddingHorizontal: 20, paddingTop: 12 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "500", color: soft }}>Saldo em contas</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 10, fontSize: 46, fontWeight: "700", letterSpacing: -1.6, color: total < 0 ? th(RED) : ink }}>
            {accounts ? show(total) : " "}
          </Text>
          <Text style={{ marginTop: 12, fontSize: 13.5, color: soft }}>
            Previsto no fim do mês{" "}
            <Text style={{ fontWeight: "700", color: saldoPrevisto < 0 ? th(RED) : ink }}>{show(saldoPrevisto)}</Text>
          </Text>
          <View style={{ marginTop: 18, flexDirection: "row", gap: 8 }}>
            <Pill dot={GREEN} label={`Entrou ${show(receitas)}`} fill={tile} ink={ink} />
            <Pill dot={RED} label={`Saiu ${show(despesas)}`} fill={tile} ink={ink} />
          </View>
        </Pressable>

        {/* 2 · The accounts */}
        <Face width={width} title="Contas" figure={show(total)} soft={soft} ink={ink} more={rows.length > 3 ? `Ver as ${rows.length} contas` : "Gerenciar contas"} onMore={() => router.push("/gestao" as never)}>
          {rows.slice(0, 3).map((a) => (
            <Pressable key={a.id} onPress={() => router.push(`/conta/${a.id}` as never)} style={({ pressed }) => ({ height: 50, borderRadius: 18, backgroundColor: tile, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
              <BankMark name={a.name} hex={a.hex} size={32} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: ink }}>{a.name}</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: a.balance < 0 ? th(RED) : ink }}>{show(a.balance)}</Text>
            </Pressable>
          ))}
          {accounts && rows.length === 0 && <Empty text="Nenhuma conta ainda." soft={soft} />}
        </Face>

        {/* 3 · The cards */}
        <Face width={width} title="Cartões de crédito" figure={owedTotal > 0 ? `Faturas ${show(owedTotal)}` : ""} soft={soft} ink={ink} more={cardRows.length > 2 ? `Ver os ${cardRows.length} cartões` : "Ver cartões"} onMore={() => router.push("/cartoes" as never)}>
          {cardRows.slice(0, 2).map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/fatura/${c.id}` as never)} style={({ pressed }) => ({ borderRadius: 18, backgroundColor: tile, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
              <BankMark name={c.name} hex={c.hex} size={32} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: ink }}>
                  {c.name}
                  {c.lastFour ? <Text style={{ color: soft, fontWeight: "500" }}> •••• {c.lastFour}</Text> : null}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: soft }}>
                  {c.dueLabel} · disponível {show(c.free)}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: ink }}>{show(c.owed)}</Text>
            </Pressable>
          ))}
          {cardRows.length === 0 && <Empty text="Nenhum cartão ainda." soft={soft} />}
        </Face>

        {/* 4 · The caixinhas */}
        <Face width={width} title="Caixinhas" figure={saved > 0 ? `Guardado ${show(saved)}` : ""} soft={soft} ink={ink} more="Ver caixinhas" onMore={() => router.push("/gestao" as never)}>
          {(goals ?? []).slice(0, 2).map((g) => {
            const target = Number(g.target_amount) || 0;
            const now = Number(g.current_amount) || 0;
            const share = target > 0 ? Math.min(1, now / target) : 0;
            return (
              <Pressable key={g.id} onPress={() => router.push(`/metas/${g.id}` as never)} style={({ pressed }) => ({ borderRadius: 18, backgroundColor: tile, padding: 12, gap: 8, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: ink }}>{g.name}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: ink }}>{show(now)}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: th("rgba(255,255,255,0.08)", "bg"), overflow: "hidden" }}>
                  <View style={{ width: `${Math.round(share * 100)}%`, height: 5, borderRadius: 3, backgroundColor: th(GREEN) }} />
                </View>
                {target > 0 && <Text style={{ fontSize: 12, color: soft }}>{Math.round(share * 100)}% de {show(target)}</Text>}
              </Pressable>
            );
          })}
          {goals && goals.length === 0 && <Empty text="Nenhuma caixinha ainda." soft={soft} />}
        </Face>
      </ScrollView>

      {/* Which face is showing. */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 8 }}>
        {FACES.map((label, i) => (
          <View
            key={label}
            accessibilityLabel={label}
            style={{ width: i === face ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === face ? ink : th("rgba(255,255,255,0.22)", "bg") }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function Face({
  width,
  title,
  figure,
  soft,
  ink,
  more,
  onMore,
  children,
}: {
  width: number;
  title: string;
  figure: string;
  soft: string;
  ink: string;
  more: string;
  onMore: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ width, paddingHorizontal: 20, paddingTop: 6, gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 2, paddingBottom: 4 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "500", color: soft }}>{title}</Text>
        {!!figure && <Text style={{ fontSize: 13.5, fontWeight: "700", color: ink }}>{figure}</Text>}
      </View>
      {children}
      <Pressable onPress={onMore} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", marginTop: 4, opacity: pressed ? 0.5 : 1 })}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: soft }}>{more}</Text>
      </Pressable>
    </View>
  );
}

function Pill({ dot, label, fill, ink }: { dot: string; label: string; fill: string; ink: string }) {
  return (
    <View style={{ height: 32, paddingHorizontal: 13, borderRadius: 16, backgroundColor: fill, flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th(dot) }} />
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: ink }}>{label}</Text>
    </View>
  );
}

function Empty({ text, soft }: { text: string; soft: string }) {
  return <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 13.5, color: soft }}>{text}</Text>;
}
