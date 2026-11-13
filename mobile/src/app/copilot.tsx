import { useEffect, useState } from "react";
import { withPro } from "~/components/onboarding/RenewGate";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, LinearTransition, SlideOutRight } from "react-native-reanimated";
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
import { syncDeviceNotifications } from "~/lib/deviceNotifications";
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
  const [busy, setBusy] = useState<string | null>(null);
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
  const mainAccount = () => (accounts as (Account & { is_default?: boolean })[]).find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null;

  /* Debit or credit. The Wallet does not say which; the card's name sometimes does
     ("Débito", "Crédito") and then Willo decides. Otherwise nothing is chosen and the
     person picks before confirming. Either way it can be changed on the card. */
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const modeOf = (item: CopilotItem): Mode | null => {
    if (item.type === "receita") return "conta";
    if (modes[item.id]) return modes[item.id];
    const text = walletCard(item);
    if (/d[eé]bito|debit/i.test(text)) return "conta";
    if (/cr[eé]dito|credit/i.test(text)) return "cartao";
    /* Without a card of the person's own there is nothing to choose between. */
    if (!cards.length) return "conta";
    return null;
  };
  /* The account the same bank's debit takes from, by name, or the main one. */
  const accountFor = (item: CopilotItem) => {
    const words = [...plainWords(walletCard(item)), ...plainWords(cards.find((c) => c.id === item.credit_card_id)?.name ?? "")];
    const hit = accounts.find((a) => words.some((w) => plainWords(a.name).includes(w)));
    return item.account_id ?? hit?.id ?? mainAccount();
  };
  const cardFor = (item: CopilotItem) => {
    if (item.credit_card_id) return item.credit_card_id;
    const words = plainWords(walletCard(item));
    return cards.find((c) => words.some((w) => plainWords(c.name).includes(w)))?.id ?? cards[0]?.id ?? null;
  };
  const resolve = (item: CopilotItem): CopilotItem =>
    item.type === "receita" || modeOf(item) === "conta"
      ? { ...item, payment_method: "conta", account_id: accountFor(item), credit_card_id: null }
      : { ...item, payment_method: "cartao", credit_card_id: cardFor(item), account_id: null };
  const withAccount = resolve;
  const pickMode = (item: CopilotItem, mode: Mode) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setModes((m) => ({ ...m, [item.id]: mode }));
  };

  const save = async (item: CopilotItem) => {
    if (!user) return;
    if (!modeOf(item)) {
      showToast(`${item.name}: escolha débito ou crédito antes de confirmar.`);
      return;
    }
    setBusy(item.id);
    try {
      const ready = withAccount(withGuess(item));
      await confirmPending(ready, user.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      /* Said where it went: debit out of the account now, credit onto the open invoice. */
      const card = ready.credit_card_id ? cards.find((c) => c.id === ready.credit_card_id)?.name : null;
      const account = ready.account_id ? accounts.find((a) => a.id === ready.account_id)?.name : null;
      showToast(card ? `${ready.name}, ${money(ready.amount)} · na fatura do ${card}` : `${ready.name}, ${money(ready.amount)} · saiu da conta${account ? ` ${account}` : ""}`);
    } catch {
      showToast("Não consegui confirmar agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };
  const confirm = (item: CopilotItem) => void save(item);

  const list = items ?? [];
  /* The reminders follow the list: one fewer waiting, the evening's notice says so. */
  useEffect(() => {
    if (items === null || !user) return;
    const t = setTimeout(() => void syncDeviceNotifications(user.id), 1500);
    return () => clearTimeout(t);
  }, [items?.length, user]);
  const confirmAll = async () => {
    const open = list.filter((i) => !modeOf(i));
    for (const item of list) if (modeOf(item)) await save(item);
    if (open.length) showToast(`Escolha débito ou crédito em ${open.length === 1 ? "1 compra" : `${open.length} compras`} para confirmar.`);
  };
  const total = list.reduce((t, i) => t + (i.type === "receita" ? 0 : i.amount), 0);
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name ?? null;
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? null;
  const placeOf = (raw: CopilotItem) => {
    const item = resolve(raw);
    return item.credit_card_id ? { card: true, name: cardName(item.credit_card_id) } : item.account_id ? { card: false, name: accountName(item.account_id) } : null;
  };

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

        <Hero count={list.length} loading={items === null} total={total} latest={list[0]?.occurred_at ?? null} onSetup={() => router.push("/atalhos" as never)} />

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
                    mode={modeOf(item)}
                    canCredit={item.type !== "receita" && cards.length > 0}
                    onMode={(m) => pickMode(item, m)}
                    busy={busy === item.id}
                    onConfirm={() => confirm(item)}
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
          <Primary label={`Confirmar todas · ${money(total)}`} busy={!!busy} onPress={() => void confirmAll()} />
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

/** What is waiting, in one line of glass: how much, how many. */
function Hero({ count, loading, total, latest, onSetup }: { count: number; loading: boolean; total: number; latest: string | null; onSetup: () => void }) {
  return (
    <View style={{ marginTop: 14, padding: 14, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.09)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
      {loading ? (
        <ActivityIndicator color={th(INK.soft)} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            <ParticleOrb size={40} density={90} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {count ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(total)}</Text>
                <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, color: th(INK.soft) }}>
                  {count} {count === 1 ? "compra esperando" : "compras esperando"}
                  {latest ? ` · mais recente às ${timeOf(latest)}` : ""}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>Tudo em dia</Text>
                <Text numberOfLines={2} style={{ marginTop: 1, fontSize: 13, color: th(INK.soft) }}>
                  Novas compras por aproximação aparecem aqui.
                </Text>
              </>
            )}
          </View>
        </View>
      )}
      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: th(INK.softer) }}>
          Nada entra antes de você confirmar.
        </Text>
        <Pressable onPress={onSetup} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: th(INK.soft) }}>Configurar ›</Text>
        </Pressable>
      </View>
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
  busy,
  mode,
  canCredit,
  onMode,
  onConfirm,
  onDiscard,
  onOpen,
}: {
  item: CopilotItem;
  guess: string | null;
  place: { card: boolean; name: string | null } | null;
  busy: boolean;
  /** Null until chosen, when the card's name did not say. */
  mode: Mode | null;
  canCredit: boolean;
  onMode: (m: Mode) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onOpen: () => void;
}) {
  const hex = categoryHex(guess ?? "Outros");
  const Icon = categoryIcon(guess ?? "Outros");
  const income = item.type === "receita";
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

        {/* Debit straight out of the account, or credit onto the invoice. */}
        {canCredit && !mode && <Text style={{ marginTop: 12, fontSize: 12.5, fontWeight: "600", color: th("#F5C26B") }}>Foi no débito ou no crédito?</Text>}
        {canCredit && (
          <View style={{ marginTop: 12, flexDirection: "row", padding: 3, borderRadius: 14, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
            {(["conta", "cartao"] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={busy || on ? undefined : () => onMode(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{ flex: 1, height: 30, borderRadius: 11, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("rgba(255,255,255,0.14)", "bg") : "transparent" }}
                >
                  {m === "conta" ? <Landmark size={12} color={th(on ? "#fff" : INK.softer)} strokeWidth={2.4} /> : <CreditCard size={12} color={th(on ? "#fff" : INK.softer)} strokeWidth={2.4} />}
                  <Text style={{ fontSize: 12.5, fontWeight: on ? "700" : "500", color: th(on ? "#fff" : INK.softer) }}>{m === "conta" ? "Débito · sai da conta" : "Crédito · vai para a fatura"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
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
            style={({ pressed }) => ({ height: 38, paddingHorizontal: 16, borderRadius: 19, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: !mode ? 0.4 : pressed ? 0.85 : 1 })}
          >
            {busy ? <ActivityIndicator size="small" color={th("#0B0B0B")} /> : <Check size={16} color={th("#0B0B0B")} strokeWidth={3} />}
            <Text style={{ fontSize: 14, fontWeight: "800", color: th("#0B0B0B") }}>Confirmar</Text>
          </Pressable>
        </View>
      </View>

    </Pressable>
  );
}

type Mode = "conta" | "cartao";

/** The card's name as the Wallet gave it ("Nubank", "Itaú Débito"…), from the purchase as it arrived. */
function walletCard(item: CopilotItem): string {
  try {
    const raw = item.raw ? (JSON.parse(item.raw) as { card?: unknown }) : null;
    return typeof raw?.card === "string" ? raw.card : "";
  } catch {
    return "";
  }
}
const plainWords = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["debito", "credito", "cartao", "mastercard", "visa", "elo", "black", "platinum", "gold"].includes(w));
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
