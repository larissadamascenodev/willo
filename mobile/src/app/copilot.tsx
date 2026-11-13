import { useEffect, useState } from "react";
import { withPro } from "~/components/onboarding/RenewGate";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeInDown, LinearTransition, SlideOutRight, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { categoryHex, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { guessCategory } from "@/lib/quickEntry/parseLocal";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import BottomSheet from "~/components/BottomSheet";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { type EntryValues } from "~/components/registro/EntryForm";
import { Primary, type Account, type Card } from "~/components/registro/entryParts";
import ParticleOrb from "~/components/registro/ParticleOrb";
import SubLogo from "~/components/SubLogo";
import { Check, ChevronLeft, Clock, CreditCard, Landmark, Sparkles, X } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { confirmPending, discardPending, listHistory, useCopilot, type CopilotItem, type CopilotPast } from "~/lib/copilot";
import { useAuth } from "~/lib/auth";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Willo Copilot: what was caught from the bank, waiting to be confirmed.
 *
 * At the top, what is waiting in one look — how much, how many, on which cards, the most
 * recent. Then each purchase as a card of its own: the shop's real logo where it is a known
 * one, where it was paid and when, the category Willo suggests from the name, and the two
 * answers — confirm, or throw away. Confirming lays a green glass with a tick over it and
 * it leaves for the transactions, the balance and the invoice; a tap on the card opens it
 * to change first. The clock at the top keeps what came before, answered.
 */

const ALLOWED = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
const guessOf = (item: CopilotItem) => item.category ?? guessCategory(item.name, item.type, ALLOWED);
const withGuess = (item: CopilotItem): CopilotItem => ({ ...item, category: guessOf(item) });

const toValues = (item: CopilotItem): EntryValues => ({
  type: item.type,
  cents: Math.round(item.amount * 100),
  name: item.name,
  category: item.category,
  method: item.type === "receita" ? "conta" : (item.payment_method ?? "conta"),
  whereId: item.payment_method === "cartao" ? item.credit_card_id : item.account_id,
  repeat: "unica",
  parts: null,
  date: item.occurred_at.slice(0, 10),
  status: "pago",
  note: "",
});

const fromValues = (item: CopilotItem, v: EntryValues): CopilotItem => ({
  ...item,
  type: v.type,
  amount: v.cents / 100,
  name: v.name.trim() || item.name,
  category: v.category,
  payment_method: v.method,
  account_id: v.method === "cartao" ? null : v.whereId,
  credit_card_id: v.method === "cartao" ? v.whereId : null,
  occurred_at: v.date === item.occurred_at.slice(0, 10) ? item.occurred_at : `${v.date}T12:00:00`,
});

const SOURCE: Record<string, string> = { atalho: "Aproximação", notificacao: "Aviso do banco", email: "E-mail do banco", open_finance: "Open Finance" };

function CopilotScreen() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items } = useCopilot();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [editing, setEditing] = useState<CopilotItem | null>(null);
  const [values, setValues] = useState<EntryValues | null>(null);
  const [picking, setPicking] = useState(false);
  /* The ones playing their tick, about to leave for the transactions (with their delay). */
  const [leaving, setLeaving] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<CopilotPast[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    getAccounts()
      .then((l) => setAccounts((l as unknown as Account[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
    getCreditCards()
      .then((c) => setCards(c as unknown as Card[]))
      .catch(() => undefined);
  }, []);

  /* With no account named, the main one. */
  const withAccount = (item: CopilotItem): CopilotItem =>
    item.account_id || item.credit_card_id ? item : { ...item, account_id: (accounts as (Account & { is_default?: boolean })[]).find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null };

  const save = async (item: CopilotItem) => {
    if (!user) return;
    try {
      await confirmPending(withAccount(withGuess(item)), user.id);
    } catch {
      setLeaving((l) => {
        const next = { ...l };
        delete next[item.id];
        return next;
      });
      showToast("Não consegui confirmar agora. Tente de novo.");
    }
  };

  /* The tick plays first; the purchase is saved as it ends. */
  const confirm = (item: CopilotItem, delay = 0) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setLeaving((l) => ({ ...l, [item.id]: delay }));
  };

  const list = items ?? [];
  const confirmAll = () => list.forEach((item, i) => confirm(item, i * 140));
  const total = list.reduce((t, i) => t + (i.type === "receita" ? 0 : i.amount), 0);
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name ?? null;
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? null;
  const placeOf = (item: CopilotItem) =>
    item.credit_card_id ? { card: true, name: cardName(item.credit_card_id) } : item.account_id ? { card: false, name: accountName(item.account_id) } : null;
  const usedCards = [...new Set(list.map((i) => cardName(i.credit_card_id)).filter(Boolean))] as string[];

  /* By day, newest first: Hoje, Ontem, then the date. */
  const days: { label: string; rows: CopilotItem[] }[] = [];
  for (const item of list) {
    const label = dayLabel(item.occurred_at);
    const found = days.find((d) => d.label === label);
    if (found) found.rows.push(item);
    else days.push({ label, rows: [item] });
  }

  const openHistory = () => {
    setShowHistory(true);
    setHistory(null);
    void listHistory().then(setHistory);
  };

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + (list.length > 1 ? 110 : 40), paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {/* The page's name, small, beside the way back; the history on the other side. */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <RoundButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.4} />
          </RoundButton>
          <View pointerEvents="none" style={{ position: "absolute", left: 56, right: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <ParticleOrb size={22} density={60} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
              Willo Copilot
            </Text>
          </View>
          <RoundButton label="Histórico" onPress={openHistory}>
            <Clock size={18} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.2} />
          </RoundButton>
        </View>

        <Hero count={list.length} loading={items === null} total={total} cards={usedCards} latest={list[0]?.occurred_at ?? null} onSetup={() => router.push("/atalhos" as never)} />

        {days.map((d) => (
          <View key={d.label} style={{ marginTop: 22 }}>
            <Text style={[T.eyebrow, { marginBottom: 8, paddingHorizontal: 4 }]}>{d.label}</Text>
            <View style={{ gap: 10 }}>
              {d.rows.map((item, i) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 50).duration(320)} exiting={SlideOutRight.duration(260)} layout={LinearTransition.duration(240)}>
                  <PendingCard
                    item={item}
                    guess={guessOf(item)}
                    place={placeOf(item)}
                    leaving={leaving[item.id]}
                    onConfirm={() => confirm(item)}
                    onConfirmed={() => void save(item)}
                    onDiscard={() => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      void discardPending(item.id);
                    }}
                    onOpen={() => {
                      setEditing(item);
                      setValues(toValues(withAccount(withGuess(item))));
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          </View>
        ))}

        {list.length > 0 && <Text style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, color: th(INK.softer) }}>Toque numa compra para mudar nome, valor, categoria ou cartão.</Text>}
      </ScrollView>

      {list.length > 1 && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14 }}>
          <Primary label={`Confirmar todas · ${money(total)}`} onPress={confirmAll} />
        </View>
      )}

      {/* One changed before it is confirmed: the same check as any entry. */}
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} full>
        {editing && values && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Confira antes de confirmar</Text>
            {editing.raw ? (
              <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12.5, color: th(INK.softer) }}>
                Aviso do banco: {editing.raw}
              </Text>
            ) : null}
            <EntryForm values={values} onChange={(patch) => setValues((v) => (v ? { ...v, ...patch } : v))} accounts={accounts} cards={cards} onPickCategory={() => setPicking(true)} />
            <Primary
              label="Confirmar"
              disabled={values.cents <= 0 || !values.whereId}
              onPress={() => {
                const next = fromValues(editing, values);
                setEditing(null);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                void save(next);
              }}
            />
            <Pressable
              onPress={() => {
                void discardPending(editing.id);
                setEditing(null);
              }}
              style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: th(RED) }}>Descartar</Text>
            </Pressable>
            <CategoryPicker
              open={picking}
              type={values.type}
              value={values.category ?? ""}
              onPick={(c) => {
                setPicking(false);
                setValues((v) => (v ? { ...v, category: c } : v));
              }}
              onClose={() => setPicking(false)}
            />
          </View>
        )}
      </BottomSheet>

      {/* What came before. */}
      <BottomSheet open={showHistory} onClose={() => setShowHistory(false)} full>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Histórico do Copilot</Text>
          <Text style={{ marginTop: 2, fontSize: 13.5, color: th(INK.soft) }}>O que chegou e você já respondeu.</Text>
          {history === null ? (
            <ActivityIndicator color={th(INK.soft)} style={{ marginTop: 30 }} />
          ) : history.length === 0 ? (
            <Text style={{ marginTop: 30, textAlign: "center", fontSize: 14, color: th(INK.soft) }}>Nada por aqui ainda.</Text>
          ) : (
            <View style={{ marginTop: 14 }}>
              {history.map((h, i) => {
                const ok = h.status === "confirmado";
                const place = placeOf(h);
                return (
                  <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line"), opacity: ok ? 1 : 0.55 }}>
                    <SubLogo name={h.name} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff"), textDecorationLine: ok ? "none" : "line-through" }}>
                        {h.name}
                      </Text>
                      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: th(INK.softer) }}>
                        {[shortDate(h.occurred_at), place?.name, h.category].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 3 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(h.amount)}</Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: ok ? GREEN : th(INK.softer) }}>{ok ? "Confirmada" : "Descartada"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </BottomSheet>
    </Room>
  );
}

/** What is waiting, in one look: how much, how many, on which cards, the most recent. */
function Hero({ count, loading, total, cards, latest, onSetup }: { count: number; loading: boolean; total: number; cards: string[]; latest: string | null; onSetup: () => void }) {
  return (
    <View style={{ marginTop: 14, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: th("rgba(255,255,255,0.10)", "line") }}>
      <LinearGradient colors={[th("rgba(103,205,103,0.16)", "bg"), th("rgba(111,168,232,0.10)", "bg"), th("rgba(255,255,255,0.03)", "bg")]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
        {loading ? (
          <ActivityIndicator color={th(INK.soft)} />
        ) : count ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                <ParticleOrb size={56} density={120} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, color: th(INK.softer) }}>ESPERANDO VOCÊ</Text>
                <Text style={{ marginTop: 3, fontSize: 30, fontWeight: "800", letterSpacing: -1, color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(total)}</Text>
                <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>
                  em {count} {count === 1 ? "compra captada" : "compras captadas"}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {latest && <Chip icon={<Clock size={12} color={th(INK.soft)} strokeWidth={2.4} />} text={`Mais recente às ${timeOf(latest)}`} />}
              {cards.slice(0, 2).map((c) => (
                <Chip key={c} icon={<CreditCard size={12} color={th(INK.soft)} strokeWidth={2.4} />} text={c} />
              ))}
              <Chip icon={<Sparkles size={12} color={GREEN} strokeWidth={2.4} />} text="Categorias sugeridas" />
            </View>
            <Text style={{ marginTop: 12, fontSize: 12.5, lineHeight: 18, color: th(INK.softer) }}>Nada entra nas suas transações antes de você confirmar.</Text>
          </>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(103,205,103,0.16)", "bg") }}>
              <Check size={26} color={GREEN} strokeWidth={2.6} />
            </View>
            <Text style={{ marginTop: 12, fontSize: 18, fontWeight: "800", color: th("#fff") }}>Tudo em dia</Text>
            <Text style={{ marginTop: 4, fontSize: 13.5, lineHeight: 19, textAlign: "center", color: th(INK.soft) }}>
              Quando você pagar por aproximação, a compra aparece aqui para você confirmar.
            </Text>
          </View>
        )}
        <Pressable onPress={onSetup} hitSlop={6} style={({ pressed }) => ({ marginTop: 12, alignSelf: count ? "flex-start" : "center", opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: GREEN }}>Configurar compras da Carteira ›</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
      {icon}
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: th(INK.soft) }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * One purchase waiting. Confirming lays a green glass over it with a tick that springs in,
 * then it slides away to the transactions.
 */
function PendingCard({
  item,
  guess,
  place,
  leaving,
  onConfirm,
  onConfirmed,
  onDiscard,
  onOpen,
}: {
  item: CopilotItem;
  guess: string | null;
  place: { card: boolean; name: string | null } | null;
  leaving: number | undefined;
  onConfirm: () => void;
  onConfirmed: () => void;
  onDiscard: () => void;
  onOpen: () => void;
}) {
  const hex = categoryHex(guess ?? "Outros");
  const Icon = categoryIcon(guess ?? "Outros");
  const income = item.type === "receita";
  const glass = useSharedValue(0);
  const tick = useSharedValue(0);

  useEffect(() => {
    if (leaving === undefined) return;
    const start = setTimeout(() => {
      glass.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
      tick.set(withSequence(withTiming(0, { duration: 60 }), withSpring(1, { damping: 9, stiffness: 260 })));
    }, leaving);
    const done = setTimeout(onConfirmed, leaving + 620);
    return () => {
      clearTimeout(start);
      clearTimeout(done);
    };
    // Once per confirm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const veil = useAnimatedStyle(() => ({ opacity: glass.get() }));
  const mark = useAnimatedStyle(() => ({ opacity: Math.min(tick.get() * 2, 1), transform: [{ scale: 0.4 + tick.get() * 0.6 }] }));
  const busy = leaving !== undefined;

  return (
    <Pressable
      onPress={busy ? undefined : onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${money(item.amount)}. Revisar`}
      style={({ pressed }) => ({
        borderRadius: 24,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.09)", "line"),
        backgroundColor: th(pressed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)", "bg"),
      })}
    >
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View>
            <SubLogo name={item.name} size={46} />
            {/* Paid on a card, or from an account. */}
            <View style={{ position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: th("#15171C", "bg"), borderWidth: 1.5, borderColor: th("rgba(255,255,255,0.12)", "line") }}>
              {place?.card ? <CreditCard size={10} color={th("#fff")} strokeWidth={2.4} /> : <Landmark size={10} color={th("#fff")} strokeWidth={2.4} />}
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
              {[place?.name, timeOf(item.occurred_at), SOURCE[item.source] ?? null].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: th(income ? GREEN : "#fff"), fontVariant: ["tabular-nums"] }}>
            {income ? "+" : "−"}
            {money(item.amount)}
          </Text>
        </View>

        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* The category Willo suggests from the name; the card opens to change it. */}
          <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: th(`${hex}24`, "bg") }}>
            <Icon size={13} color={th(hex)} strokeWidth={2.3} />
            <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "700", color: th(guess ? "#fff" : INK.soft) }}>
              {guess ?? "Escolher categoria"}
            </Text>
            {guess && !item.category ? <Sparkles size={11} color={th(INK.softer)} strokeWidth={2.4} /> : null}
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={busy ? undefined : onDiscard}
            accessibilityLabel="Descartar"
            hitSlop={6}
            style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(248,113,113,0.12)", "bg"), opacity: pressed ? 0.6 : 1 })}
          >
            <X size={16} color={th(RED)} strokeWidth={2.6} />
          </Pressable>
          <Pressable
            onPress={busy ? undefined : onConfirm}
            accessibilityLabel="Confirmar"
            style={({ pressed }) => ({ height: 38, paddingHorizontal: 16, borderRadius: 19, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
          >
            <Check size={16} color={th("#0B0B0B")} strokeWidth={3} />
            <Text style={{ fontSize: 14, fontWeight: "800", color: th("#0B0B0B") }}>Confirmar</Text>
          </Pressable>
        </View>
      </View>

      {/* Confirmed: green glass and a tick, then away. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, backgroundColor: "rgba(103,205,103,0.92)" }, veil]}>
        <Animated.View style={[{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0B0B" }, mark]}>
          <Check size={22} color={GREEN} strokeWidth={3.2} />
        </Animated.View>
        <Animated.Text style={[{ fontSize: 16, fontWeight: "800", color: "#0B0B0B" }, mark]}>Confirmada · {money(item.amount)}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
}

export default withPro(CopilotScreen);
