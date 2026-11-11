import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { getAccounts } from "@/services/transactionService";
import { fetchGoals, type Goal } from "@/services/goalService";
import { colorFor } from "@/lib/banks";
import { goalProgress } from "@/lib/goalPresets";
import { getInvoiceStatusLabel } from "@/lib/invoiceCycle";
import type { OverviewCard, OverviewInvoice } from "@/hooks/useCardsOverview";
import BankMark from "~/components/BankMark";
import Bar, { FlexBar } from "~/components/Bar";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import { ChevronRight } from "~/components/icons";
import { goalPreset } from "~/lib/goalIcon";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { isLight, th } from "~/theme/theme";

/**
 * The top of the home as a panel: the page's own top, holding four faces, one at a time.
 *
 * The money in the accounts with the month's two flows under it; the accounts one by
 * one; the cards with what each invoice asks for; the caixinhas with how far each has
 * come. They are the home's own cards — balance, flows, cards, caixinhas — moved up
 * here, so the board below leaves those four out while the panel is on.
 *
 * The panel's sheet travels with the page, so its lower edge rides just above the
 * first card. What it holds does not travel: it is moved down exactly as far as the
 * page has moved up, and the sheet's edge closes over it. That is the cards coming
 * over the balance with nothing showing through them, because by the time a card is
 * over a line the sheet has already let go of it.
 *
 * Pulled down, the sheet has more of itself above the screen, so no other ground is
 * uncovered, and what it holds gives half way.
 */

/** How tall the faces are, under the row with the avatar and the bell. */
export const PANEL_BODY = 256;

/** The home's cards the panel already shows; the board leaves them out while it is on. */
export const PANEL_COVERS = new Set(["saldo", "fluxo", "cartoes", "metas"]);

const FACES = ["Saldo em contas", "Contas", "Cartões", "Caixinhas"] as const;
const FACE_H = PANEL_BODY - 30;
const ROWS = 3;

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

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
  refreshing,
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
  /** The page is being read again: the sheet covers the system's own spinner, so it shows one. */
  refreshing?: boolean;
  saldoPrevisto: number;
  receitas: number;
  despesas: number;
  cards: OverviewCard[];
  invoices: OverviewInvoice[];
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
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
  const signed = (v: number) => (hidden ? "R$ ••••" : `${v < 0 ? "−" : ""}${money(Math.abs(v))}`);

  const rows = useMemo(
    () =>
      [...(accounts ?? [])]
        .map((a) => ({ ...a, balance: Number(a.current_balance) || 0, hex: colorFor(a.name, a.color) }))
        .sort((a, b) => b.balance - a.balance),
    [accounts],
  );
  const total = rows.reduce((s, a) => s + a.balance, 0);
  const positive = rows.reduce((s, a) => s + Math.max(a.balance, 0), 0);

  /* Each card with the invoice it is about to ask for: the oldest one still owed. */
  const cardRows = useMemo(() => {
    const now = new Date();
    const today = now.getFullYear() * 12 + now.getMonth();
    return cards.map((c) => {
      const open = invoices
        .filter((i) => i.cardId === c.id && !i.isPaid && i.total - i.paid > 0 && i.year * 12 + i.month - 1 >= today - 2)
        .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))[0];
      const status = getInvoiceStatusLabel(
        { id: c.id, name: c.name, limit: c.limit, used_limit: c.used, closing_day: c.closingDay, due_day: c.dueDay, color: c.color, last_four_digits: c.lastFour },
        open ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid } : undefined,
      );
      return {
        ...c,
        hex: colorFor(c.name, c.color, "#8B5CF6"),
        owed: open ? Math.max(open.total - open.paid, 0) : 0,
        note: open ? status.label : "Sem fatura em aberto",
        late: !!open && status.label.startsWith("Venceu"),
        free: Math.max(0, c.limit - c.used),
      };
    });
  }, [cards, invoices]);
  const owedTotal = cardRows.reduce((s, c) => s + c.owed, 0);

  /* The caixinhas still open first, the closest to done at the top. */
  const goalRows = useMemo(
    () =>
      [...(goals ?? [])]
        .map((g) => ({ goal: g, ...goalProgress({ current_amount: Number(g.current_amount) || 0, target_amount: Number(g.target_amount) || 0 }) }))
        .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || b.progress - a.progress),
    [goals],
  );
  const saved = (goals ?? []).reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
  const aimed = (goals ?? []).reduce((s, g) => s + (Number(g.target_amount) || 0), 0);

  const balanco = receitas - despesas;
  const scale = Math.max(receitas, despesas, 1);

  /* What the sheet holds stays where it is while the sheet leaves with the page. */
  const hold = useAnimatedStyle(() => {
    const y = scrollY.value;
    const p = Math.min(1, Math.max(0, y) / PANEL_BODY);
    return {
      opacity: 1 - p * 0.75,
      transform: [{ translateY: y >= 0 ? y : y * 0.5 }, { scale: 1 - p * 0.04 }],
    };
  });

  const ground = light ? "#FFFFFF" : "#17181D";
  const ink = th("#fff");
  const red = th(RED);
  const soft = th(INK.soft);
  const softer = th(INK.softer);
  const line = th("rgba(255,255,255,0.07)", "line");
  const track = th("rgba(255,255,255,0.07)", "bg");

  const go = (i: number) => {
    pager.current?.scrollTo({ x: i * width, animated: true });
    setFace(i);
  };

  return (
    <View style={{ height, marginHorizontal: -16 }}>
      {/* More of the sheet, above the screen, for when the page is pulled down. */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: -900, height: 901, backgroundColor: ground }} />

      <View
        style={{
          flex: 1,
          backgroundColor: ground,
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
          borderCurve: "continuous",
          shadowColor: "#000",
          shadowOpacity: light ? 0.07 : 0.4,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          borderWidth: light ? 0 : 1,
          borderTopWidth: 0,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <View style={{ flex: 1, overflow: "hidden", borderBottomLeftRadius: 34, borderBottomRightRadius: 34, borderCurve: "continuous" }}>
          <Animated.View style={[{ height, paddingTop: top - 4 }, hold]}>
            {refreshing && (
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: top - 46, alignItems: "center" }}>
                <ActivityIndicator color={softer} />
              </View>
            )}

            <ScrollView
              ref={pager}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={32}
              onScroll={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                if (i !== face && i >= 0 && i < FACES.length) setFace(i);
              }}
              style={{ flexGrow: 0, height: FACE_H }}
            >
              {/* 1 · The money in the accounts, and the month's two flows under it. */}
              <View style={{ width, paddingHorizontal: 22 }}>
                <Pressable onPress={() => router.push("/gestao" as never)} style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontSize: 13.5, fontWeight: "500", color: soft }}>Saldo em contas</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 6, fontSize: 46, fontWeight: "700", letterSpacing: -1.6, color: total < 0 ? red : ink }]}>
                    {accounts ? signed(total) : " "}
                  </Text>
                  <Text style={{ marginTop: 6, fontSize: 13.5, color: soft }}>
                    Previsto no fim do mês{" "}
                    <Text style={[nums, { fontWeight: "700", color: saldoPrevisto < 0 ? red : ink }]}>{signed(saldoPrevisto)}</Text>
                  </Text>
                </Pressable>

                <Pressable onPress={() => router.push("/fluxo-de-caixa" as never)} style={({ pressed }) => ({ marginTop: 20, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ flexDirection: "row", gap: 18 }}>
                    <Flow label="Entrada" figure={show(receitas)} share={receitas / scale} color={GREEN} ink={ink} soft={soft} track={track} delay={0.05} />
                    <Flow label="Saída" figure={hidden ? show(despesas) : `−${money(despesas)}`} share={despesas / scale} color={RED} ink={red} soft={soft} track={track} delay={0.12} />
                  </View>
                  <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: ink }}>Fluxo de caixa</Text>
                    <Text numberOfLines={1} style={[nums, { fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: balanco < 0 ? red : ink }]}>{signed(balanco)}</Text>
                  </View>
                </Pressable>
              </View>

              {/* 2 · The accounts: the total split by where it sits, then each one. */}
              <Face width={width} title="Contas" figure={accounts ? signed(total) : ""} soft={soft} ink={total < 0 ? red : ink} onOpen={() => router.push("/gestao" as never)}>
                <View style={{ flexDirection: "row", gap: 3, height: 7 }}>
                  {positive > 0 ? (
                    rows.filter((a) => a.balance > 0).map((a, i) => <FlexBar key={a.id} share={a.balance / positive} color={a.hex} delay={0.04 * i} />)
                  ) : (
                    <View style={{ flex: 1, borderRadius: 999, backgroundColor: track }} />
                  )}
                </View>
                <View style={{ marginTop: 6 }}>
                  {rows.slice(0, ROWS).map((a, i) => (
                    <Row key={a.id} first={i === 0} line={line} onPress={() => router.push(`/conta/${a.id}` as never)}>
                      <BankMark name={a.name} hex={a.hex} size={34} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: ink }}>{a.name}</Text>
                      <Text style={[nums, { fontSize: 15, fontWeight: "700", color: a.balance < 0 ? red : ink }]}>{signed(a.balance)}</Text>
                    </Row>
                  ))}
                  {accounts && rows.length === 0 && <Empty text="Nenhuma conta ainda. Toque no título para criar a primeira." soft={soft} />}
                </View>
              </Face>

              {/* 3 · The cards: what the invoices ask for, split by card, then each one. */}
              <Face width={width} title="Cartões · faturas abertas" figure={show(owedTotal)} soft={soft} ink={ink} onOpen={() => router.push("/cartoes" as never)}>
                <View style={{ flexDirection: "row", gap: 3, height: 7 }}>
                  {owedTotal > 0 ? (
                    cardRows.filter((c) => c.owed > 0).map((c, i) => <FlexBar key={c.id} share={c.owed / owedTotal} color={c.hex} delay={0.04 * i} />)
                  ) : (
                    <View style={{ flex: 1, borderRadius: 999, backgroundColor: track }} />
                  )}
                </View>
                <View style={{ marginTop: 6 }}>
                  {cardRows.slice(0, ROWS).map((c, i) => (
                    <Row key={c.id} first={i === 0} line={line} onPress={() => router.push(`/fatura/${c.id}` as never)}>
                      <BankMark name={c.name} hex={c.hex} size={34} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: ink }}>{c.name}</Text>
                        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: c.late ? red : softer }}>{c.note}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[nums, { fontSize: 15, fontWeight: "700", color: c.owed === 0 ? softer : ink }]}>{show(c.owed)}</Text>
                        <Text style={[nums, { marginTop: 1, fontSize: 12, color: softer }]}>{show(c.free)} livres</Text>
                      </View>
                    </Row>
                  ))}
                  {cardRows.length === 0 && <Empty text="Nenhum cartão ainda. Toque no título para adicionar." soft={soft} />}
                </View>
              </Face>

              {/* 4 · The caixinhas: what is put away, how far along, then each one. */}
              <Face width={width} title="Caixinhas · guardado" figure={goals ? show(saved) : ""} soft={soft} ink={ink} onOpen={() => router.push("/gestao" as never)}>
                <View style={{ height: 7, borderRadius: 999, overflow: "hidden", backgroundColor: track }}>
                  <Bar share={aimed > 0 ? Math.min(saved / aimed, 1) : 0} color={GREEN} delay={0.05} />
                </View>
                <View style={{ marginTop: 6 }}>
                  {goalRows.slice(0, ROWS).map(({ goal, progress, percent, isComplete }, i) => {
                    const aim = Number(goal.target_amount) || 0;
                    return (
                      <Row key={goal.id} first={i === 0} line={line} onPress={() => router.push(`/metas/${goal.id}` as never)}>
                        <CaixinhaCover goal={goal} width={36} height={36} radius={11} glyph={19} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: ink }}>{goal.name}</Text>
                            <Text style={[nums, { fontSize: 15, fontWeight: "700", color: ink }]}>{show(Number(goal.current_amount) || 0)}</Text>
                          </View>
                          {aim > 0 ? (
                            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <View style={{ flex: 1, height: 4, borderRadius: 999, overflow: "hidden", backgroundColor: track }}>
                                <Bar share={progress} color={isComplete ? GREEN : goalPreset(goal).hex} delay={0.05 * i} />
                              </View>
                              <Text style={[nums, { fontSize: 12, color: isComplete ? th(GREEN) : softer }]}>{percent}%</Text>
                            </View>
                          ) : (
                            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: softer }}>sem valor definido</Text>
                          )}
                        </View>
                      </Row>
                    );
                  })}
                  {goals && goals.length === 0 && <Empty text="Nenhuma caixinha ainda. Toque no título para criar a primeira." soft={soft} />}
                </View>
              </Face>
            </ScrollView>

            {/* Which face is showing; a touch goes to it. */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 6 }}>
              {FACES.map((label, i) => (
                <Pressable key={label} accessibilityLabel={label} onPress={() => go(i)} hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}>
                  <View style={{ width: i === face ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === face ? ink : th("rgba(255,255,255,0.22)", "bg") }} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

/** One face that is a list: what it is and what it adds up to, then its rows. The heading is the way in. */
function Face({
  width,
  title,
  figure,
  soft,
  ink,
  onOpen,
  children,
}: {
  width: number;
  title: string;
  figure: string;
  soft: string;
  ink: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ width, paddingHorizontal: 22 }}>
      <Pressable onPress={onOpen} style={({ pressed }) => ({ height: 30, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13.5, fontWeight: "500", color: soft }}>{title}</Text>
          <ChevronRight size={14} color={soft} />
        </View>
        <Text numberOfLines={1} style={[nums, { fontSize: 21, fontWeight: "700", letterSpacing: -0.6, color: ink }]}>{figure}</Text>
      </Pressable>
      {children}
    </View>
  );
}

/** One line of a list face. */
function Row({ first, line, onPress, children }: { first: boolean; line: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ height: 54, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: line, opacity: pressed ? 0.6 : 1 })}
    >
      {children}
    </Pressable>
  );
}

/** One of the month's two flows: its name and figure, and a bar on the scale both share. */
function Flow({ label, figure, share, color, ink, soft, track, delay }: { label: string; figure: string; share: number; color: string; ink: string; soft: string; track: string; delay: number }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "500", color: soft }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[nums, { flexShrink: 1, fontSize: 14.5, fontWeight: "700", letterSpacing: -0.2, color: ink }]}>{figure}</Text>
      </View>
      <View style={{ marginTop: 8, height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: track }}>
        <Bar share={Math.max(share, share > 0 ? 0.04 : 0)} color={color} delay={delay} />
      </View>
    </View>
  );
}

function Empty({ text, soft }: { text: string; soft: string }) {
  return <Text style={{ paddingVertical: 28, textAlign: "center", fontSize: 13.5, color: soft }}>{text}</Text>;
}
