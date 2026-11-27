import { useEffect, useState } from "react";
import { withPro } from "~/components/onboarding/RenewGate";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, LinearTransition, SlideOutRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createAccount, createTransfer, getAccounts, getCreditCards } from "@/services/transactionService";
import { categoryHex, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { guessCategory } from "@/lib/quickEntry/parseLocal";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import BottomSheet from "~/components/BottomSheet";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { type EntryValues } from "~/components/registro/EntryForm";
import { Primary, type Account, type Card } from "~/components/registro/entryParts";
import SubLogo from "~/components/SubLogo";
import { ChevronLeft, Clock, CreditCard, Landmark, Pencil } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { confirmPending, discardPending, listHistory, settlePending, useCopilot, type CopilotItem, type CopilotPast } from "~/lib/copilot";
import { allDoneLine, askLine, doneLine, moodLine, skipLine, type LineKind } from "~/lib/copilotLines";
import { isLight } from "~/theme/theme";
import { BlurView } from "expo-blur";
import { HERO_ACCENTS, useHeroAccent } from "~/lib/heroAccent";
import { useAuth } from "~/lib/auth";
import { syncDeviceNotifications } from "~/lib/deviceNotifications";
import { showToast } from "~/lib/toast";
import TransactionExperience from "~/components/pass/TransactionExperience";
import { nowTime, passRows } from "~/components/pass/passTheme";
import { bankFor, colorFor } from "@/lib/banks";
import { playConfirm, preloadConfirm } from "~/lib/sounds";
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

/* Willo's name, never the robot, until his mark is chosen. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_WHITE = require("../../assets/images/brand/willo-white.png") as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_BLACK = require("../../assets/images/brand/willo-black.png") as number;
const LOGO_RATIO = 227 / 717;
/* The app's own icon, as an iPhone notification shows it. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_ICON = require("../../assets/images/app-icon.png") as number;
function Wordmark({ height }: { height: number }) {
  return <Image source={isLight() ? LOGO_BLACK : LOGO_WHITE} style={{ width: height / LOGO_RATIO, height }} resizeMode="contain" accessibilityLabel="Willo" />;
}

/* Only in Expo Go: a list to look at the page with, never written anywhere. */
const EXAMPLES = (): CopilotItem[] => {
  const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const base = { category: null, payment_method: null, account_id: null, credit_card_id: null, source: "aviso" };
  return [
    { ...base, id: "ex-1", name: "Padaria Cleide", amount: 15.5, type: "despesa", occurred_at: at(4), raw: JSON.stringify({ card: "Nubank Débito" }) },
    { ...base, id: "ex-2", name: "H J Damasceno Empreendimentos e Bebidas", amount: 120, type: "receita", occurred_at: at(38), raw: JSON.stringify({ card: "Débito" }) },
    { ...base, id: "ex-3", name: "Transferência entre suas contas", amount: 200, type: "receita", occurred_at: at(95), raw: JSON.stringify({ transfer: true, notice: "Você depositou R$ 200 via Pix e o valor já está rendendo na sua conta." }) },
    { ...base, id: "ex-4", name: "Drogasil", amount: 42.9, type: "despesa", occurred_at: at(60 * 26), raw: JSON.stringify({ card: "Nubank Crédito" }) },
    { ...base, id: "ex-5", name: "iFood", amount: 37.8, type: "despesa", occurred_at: at(60 * 27), raw: JSON.stringify({ card: "Nubank Crédito" }) },
  ] as CopilotItem[];
};
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
  const { items: real } = useCopilot();
  const [examples, setExamples] = useState<CopilotItem[] | null>(null);
  const items = examples ?? real;
  /* What Willo just said about an answer; his line at the top reads it, then goes back. */
  const [reaction, setReaction] = useState<string | null>(null);
  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 6000);
    return () => clearTimeout(t);
  }, [reaction]);
  const leave = (id: string) => setExamples((l) => (l ? l.filter((i) => i.id !== id) : l));
  /* Written: the coin, the small notice of the app, and Willo saying it at the top. */
  const done = (said: { title: string; body: string }) => {
    playConfirm();
    showToast(`${said.title}\n${said.body}`);
    setReaction(`**${said.title}** ${said.body}`);
  };
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [editing, setEditing] = useState<CopilotItem | null>(null);
  const [values, setValues] = useState<EntryValues | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<CopilotPast[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    /* The coin ready before the first Confirmar. */
    preloadConfirm();
    getAccounts()
      .then((l) => setAccounts((l as unknown as Account[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
    getCreditCards()
      .then((c) => setCards(c as unknown as Card[]))
      .catch(() => undefined);
  }, []);

  /* With no account named, the main one. */
  const mainAccount = () => {
    /* The main account; without one marked, a current account before a cash box or savings. */
    const all = accounts as (Account & { is_default?: boolean; type?: string })[];
    return (all.find((a) => a.is_default) ?? all.find((a) => a.type === "checking") ?? all.find((a) => a.type !== "cash" && a.type !== "savings") ?? all[0])?.id ?? null;
  };

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

  /* Quiet: one of many confirmed at once, said together at the end. Resolves true once written. */
  const save = async (item: CopilotItem, quiet = false): Promise<boolean> => {
    if (examples) {
      if (quiet) {
        leave(item.id);
        return true;
      }
      const c = item.raw && /cr[eé]dito/i.test(item.raw) ? "na fatura do Nubank" : guessOf(item) ? `em ${guessOf(item)}` : null;
      const said = doneLine(item.type === "receita" ? "entrada" : "compra", { amount: money(item.amount), who: item.name, where: c });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      done(said);
      leave(item.id);
      return true;
    }
    if (!user) return false;
    if (!modeOf(item)) {
      if (!quiet) showToast(`${item.name}: escolha débito ou crédito antes de confirmar.`);
      return false;
    }
    setBusy(item.id);
    try {
      const ready = withAccount(withGuess(item));
      await confirmPending(ready, user.id);
      if (quiet) return true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      /* Said by Willo, with where it went: debit out of the account, credit onto the invoice. */
      const card = ready.credit_card_id ? cards.find((c) => c.id === ready.credit_card_id)?.name : null;
      const said = doneLine(ready.type === "receita" ? "entrada" : "compra", { amount: money(ready.amount), who: ready.name, where: card ? `na fatura do ${card}` : ready.category ? `em ${ready.category}` : null });
      done(said);
      return true;
    } catch {
      if (!quiet) showToast("Não consegui confirmar agora. Tente de novo.");
      return false;
    } finally {
      setBusy(null);
    }
  };
  /* A transfer between the person's own accounts: written as a transfer, never as spending or
     income. If the bank it went to (or came from) is not in Willo yet, Willo asks to add it: yes
     makes the account (the bank's name and colour, nothing else to fill) and moves the money into
     it; no writes it as sent out of the account Willo keeps, which is not counted as spending. */
  const [adding, setAdding] = useState<{ item: CopilotItem; bank: string } | null>(null);
  const accountOfBank = (bank: string) => accounts.find((a) => bankFor(a.name)?.name === bank || plainWords(a.name).some((w) => plainWords(bank).includes(w))) ?? null;
  const otherThan = (id: string | null) => {
    const rest = (accounts as (Account & { is_default?: boolean })[]).filter((a) => a.id !== id);
    /* The main account; without one marked, a current account before a cash box or savings. */
    const kind = (a: Account) => (a as { type?: string }).type;
    return rest.find((a) => a.is_default) ?? rest.find((a) => kind(a) === "checking") ?? rest.find((a) => kind(a) !== "cash" && kind(a) !== "savings") ?? rest[0] ?? null;
  };
  const writeTransfer = async (item: CopilotItem, there: string | null, quiet = false): Promise<boolean> => {
    if (examples) {
      if (!quiet) done(doneLine("transferencia", { amount: money(item.amount), who: item.name }));
      leave(item.id);
      return true;
    }
    if (!user) return false;
    const here = otherThan(there);
    const incoming = item.type === "receita";
    /* In: from the account Willo keeps into the bank's; out: the other way. Either end may be outside Willo. */
    const fromId = incoming ? (here?.id ?? null) : there;
    const toId = incoming ? there : (here?.id ?? null);
    if (!fromId && !toId) {
      if (!quiet) showToast("Não achei nenhuma conta sua para essa transferência. Crie uma conta primeiro.");
      return false;
    }
    setBusy(item.id);
    try {
      const tx = (await createTransfer(
        { fromId, toId, amount: item.amount, date: item.occurred_at.slice(0, 10), name: "Transferência entre contas", category: "Transferência entre contas", observation: "Willo Copilot" },
        user.id,
      )) as { id?: string } | null;
      await settlePending(item.id, tx?.id ?? null);
      if (quiet) return true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      const said = doneLine("transferencia", { amount: money(item.amount), who: item.name });
      done(said);
      return true;
    } catch {
      if (!quiet) showToast("Não consegui registrar agora. Tente de novo.");
      return false;
    } finally {
      setBusy(null);
    }
  };
  const transfer = (item: CopilotItem) => {
    const bank = bankOfNotice(item);
    if (examples) {
      if (bank && !accountOfBank(bank)) return setAdding({ item, bank });
      const said = doneLine("transferencia", { amount: money(item.amount), who: item.name });
      done(said);
      return leave(item.id);
    }
    if (!bank) return void writeTransfer(item, otherThan(null)?.id ?? null);
    const there = accountOfBank(bank);
    if (there) return void writeTransfer(item, there.id);
    setAdding({ item, bank });
  };
  const answerAdd = async (yes: boolean) => {
    if (!adding || !user) return;
    const { item, bank } = adding;
    setAdding(null);
    if (examples) {
      done(yes ? { title: `${bank} adicionado!`, body: `Já coloquei ${money(item.amount)} lá.` } : { title: "Transferência anotada", body: "Saiu da sua conta, sem contar como gasto." });
      return leave(item.id);
    }
    if (!yes) return void writeTransfer(item, null);
    try {
      const made = (await createAccount(user.id, { name: bank, color: bankFor(bank)?.hex ?? null })) as unknown as Account;
      setAccounts((l) => [...l, made]);
      await writeTransfer(item, made.id);
    } catch {
      showToast(`Não consegui adicionar o ${bank} agora. Tente de novo.`);
    }
  };

  /* One purchase confirmed: the Willo review, the slide and the Pass. */
  const [reviewing, setReviewing] = useState<CopilotItem | null>(null);
  const [writing, setWriting] = useState(false);
  const confirm = (item: CopilotItem) => {
    if (!user) return;
    if (!modeOf(item)) {
      showToast(`${item.name}: escolha débito ou crédito antes de confirmar.`);
      return;
    }
    preloadConfirm();
    setReviewing(withAccount(withGuess(item)));
  };
  const reviewBank = (item: CopilotItem) => {
    const card = item.credit_card_id ? cards.find((c) => c.id === item.credit_card_id) : null;
    const acc = !card && item.account_id ? accounts.find((a) => a.id === item.account_id) : null;
    const it = card ?? acc;
    return it ? { name: it.name, hex: colorFor(it.name, (it as { color?: string | null }).color ?? null) } : null;
  };

  const list = items ?? [];
  /* The reminders follow the list: one fewer waiting, the evening's notice says so. */
  useEffect(() => {
    if (items === null || !user) return;
    const t = setTimeout(() => void syncDeviceNotifications(user.id), 1500);
    return () => clearTimeout(t);
  }, [items?.length, user]);
  /* All at once: each written as its own entry, and one notice for all of them. Transfers whose
     bank is not in Willo yet, and purchases still waiting for debit or credit, stay to be answered. */
  const confirmAll = async () => {
    let count = 0;
    let out = 0;
    let inn = 0;
    let moves = 0;
    for (const item of list) {
      const kind = kindOf(item);
      if (kind === "transferencia") {
        const bank = bankOfNotice(item);
        const there = bank ? accountOfBank(bank) : null;
        if (bank && !there) continue;
        if (await writeTransfer(item, there?.id ?? otherThan(null)?.id ?? null, true)) {
          count++;
          moves++;
        }
        continue;
      }
      if (await save(item, true)) {
        count++;
        if (kind === "entrada") inn += item.amount;
        else out += item.amount;
      }
    }
    if (count) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      done(allDoneLine({ count, out: out ? money(out) : null, inn: inn ? money(inn) : null, moves }));
    }
    const left = list.length - count;
    if (left > 0) setTimeout(() => showToast(`Ficaram ${left === 1 ? "1 para" : `${left} para`} você conferir uma a uma.`), count ? 2600 : 0);
  };
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
            <Wordmark height={15} />
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
              Copilot
            </Text>
          </View>
          <RoundButton label="Histórico" onPress={openHistory}>
            <Clock size={18} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.2} />
          </RoundButton>
        </View>

        {/* Only in Expo Go: the card that drops on the screen, and the page with a list to see it by. */}
        {__DEV__ && (
          <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => router.push("/simulacao-aviso" as never)} style={{ flex: 1, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>Simular aviso</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setReaction(null);
                setExamples((e) => (e ? null : EXAMPLES()));
              }}
              style={{ flex: 1, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th(examples ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", "bg") }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(examples ? "#fff" : INK.soft) }}>{examples ? "Ver a fila real" : "Ver com exemplos"}</Text>
            </Pressable>
          </View>
        )}

        <Hero list={list} loading={items === null} say={reaction ?? moodLine(list.length)} />

        {days.map((d) => (
          <View key={d.label} style={{ marginTop: 22 }}>
            <Text style={[T.eyebrow, { marginBottom: 8, paddingHorizontal: 4 }]}>{d.label}</Text>
            <View style={{ gap: 10 }}>
              {d.rows.map((item, i) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 50).duration(320)} exiting={SlideOutRight.duration(260)} layout={LinearTransition.duration(240)}>
                  <PendingCard
                    item={item}
                    kind={kindOf(item)}
                    bank={kindOf(item) === "transferencia" ? bankOfNotice(item) : (placeOf(item)?.name ?? null)}
                    mode={modeOf(item)}
                    canCredit={kindOf(item) === "compra" && cards.length > 0 && (!modeOf(item) || !!modes[item.id])}
                    onMode={(m) => pickMode(item, m)}
                    busy={busy === item.id}
                    onConfirm={() => (kindOf(item) === "transferencia" ? transfer(item) : void save(item))}
                    onDiscard={() => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      setReaction(skipLine(item.id));
                      if (examples) return leave(item.id);
                      void discardPending(item.id);
                    }}
                    onReview={() => (kindOf(item) === "transferencia" || examples ? (kindOf(item) === "transferencia" ? transfer(item) : void save(item)) : confirm(item))}
                    onEdit={() => {
                      if (kindOf(item) === "transferencia") return transfer(item);
                      setEditing(item);
                      setValues(toValues(withAccount(withGuess(item))));
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          </View>
        ))}

        {/* Quietly, at the foot: nothing goes in without a yes; where the sources are set up. */}
        <View style={{ marginTop: 22, alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>Nada entra antes de você confirmar.</Text>
          <Pressable onPress={() => router.push("/atalhos" as never)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: th(INK.soft) }}>Configurar o Copilot ›</Text>
          </Pressable>
        </View>
      </ScrollView>

      {list.length > 1 && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14 }}>
          <Primary label={`Confirmar todas · ${list.length}`} busy={!!busy} onPress={() => void confirmAll()} />
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

      {/* The bank of a transfer that is not in Willo yet. */}
      <BottomSheet open={!!adding} onClose={() => setAdding(null)}>
        {adding ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th(`${bankFor(adding.bank)?.hex ?? "#8B5CF6"}33`, "bg") }}>
                <Landmark size={20} color={th(bankFor(adding.bank)?.hex ?? "#fff")} strokeWidth={2.2} />
              </View>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>Essa conta ainda não está no seu Willo</Text>
            </View>
            <Text style={{ fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>
              {adding.item.type === "receita" ? `${money(adding.item.amount)} foi pro seu ${adding.bank}` : `${money(adding.item.amount)} saiu do seu ${adding.bank}`}. Quer que eu adicione essa conta? Ela já entra com esse valor, sem precisar de cartão nem nada.
            </Text>
            <Primary label={`Sim, adicionar ${adding.bank}`} onPress={() => void answerAdd(true)} />
            <Pressable onPress={() => void answerAdd(false)} style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: th(INK.soft) }}>Não, só registrar a transferência</Text>
            </Pressable>
          </View>
        ) : null}
      </BottomSheet>

      {/* What came before. */}
      <BottomSheet open={!!reviewing} onClose={() => !writing && setReviewing(null)} full>
        {reviewing && user ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
            <TransactionExperience
              data={{
                kind: reviewing.type === "receita" ? "receita" : "despesa",
                amount: reviewing.amount,
                title: reviewing.name,
                category: reviewing.category || "Outros",
                rows: passRows({
                  kind: reviewing.type === "receita" ? "receita" : "despesa",
                  category: reviewing.category || "Outros",
                  bank: reviewBank(reviewing),
                  method: reviewing.credit_card_id ? "cartao" : "conta",
                  date: reviewing.occurred_at.slice(0, 10),
                }),
              }}
              onConfirm={async (id) => {
                const done = await confirmPending(reviewing, user.id, id);
                return { id: done.id || id, time: done.time ?? nowTime() };
              }}
              onPhase={(p) => setWriting(p === "saving" || p === "flow")}
              onDone={() => setReviewing(null)}
              links={[
                {
                  icon: "transacoes",
                  label: "Ver transações",
                  onPress: () => {
                    setReviewing(null);
                    setTimeout(() => router.push("/(tabs)/transacoes" as never), 260);
                  },
                },
              ]}
            />
          </View>
        ) : null}
      </BottomSheet>

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

/**
 * The top of the page, on its own ground as the home's is: Willo talking, large, his key words
 * lit — about what is waiting (a line for the day) or about what was just answered — and under
 * it, smaller, what goes out and comes in. No card: his words sit on the background.
 */
function Hero({ list, loading, say }: { list: CopilotItem[]; loading: boolean; say: string }) {
  const accent = useHeroAccent();
  const tone = HERO_ACCENTS.find((a) => a.key === accent)?.color ?? null;
  const out = list.filter((i) => kindOf(i) === "compra").reduce((t, i) => t + i.amount, 0);
  const inn = list.filter((i) => kindOf(i) === "entrada").reduce((t, i) => t + i.amount, 0);
  const moves = list.filter((i) => kindOf(i) === "transferencia").length;
  const figures = [
    { label: "Gastos", value: money(out), show: out > 0 },
    { label: "Entradas", value: money(inn), show: inn > 0 },
    { label: moves === 1 ? "Transferência" : "Transferências", value: String(moves), show: moves > 0 },
  ].filter((f) => f.show);
  /* "Juntei **5 coisinhas** pra você": the words between the stars are lit. */
  const parts = (loading ? "Deixa eu dar uma **olhada**…" : say).split("**").map((text, i) => ({ text, lit: i % 2 === 1 }));
  return (
    <View style={{ paddingTop: 22, paddingBottom: 8 }}>
      <Text style={{ fontSize: 15, fontWeight: "600", letterSpacing: -0.2, color: th("rgba(255,255,255,0.7)") }}>Seu copiloto financeiro</Text>
      <Animated.View key={say} entering={FadeInDown.duration(320)} style={{ marginTop: 8, minHeight: 74 }}>
        <Text style={{ fontSize: 29, lineHeight: 34, fontWeight: tone ? "800" : "400", letterSpacing: -0.9, color: th("#fff") }}>
          {parts.map((p, i) =>
            p.lit ? (
              <Text key={i} style={tone ? { color: th(tone) } : { fontWeight: "800" }}>
                {p.text}
              </Text>
            ) : (
              p.text
            ),
          )}
        </Text>
      </Animated.View>
      {/* What is waiting, at a glance: what would go out, what would come in, what only moves. */}
      {!loading && figures.length ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ marginBottom: 8, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, color: th(INK.softer) }}>ESPERANDO SEU OK</Text>
          <View style={{ flexDirection: "row" }}>
          {figures.map((f, i) => (
            <View key={f.label} style={{ flex: 1, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: th("rgba(255,255,255,0.1)", "line") }}>
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.softer) }}>
                {f.label}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 3, fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
                {f.value}
              </Text>
            </View>
          ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The glass of the notification card: blurred, dark, a fine edge. */
function Glass({ children }: { children: React.ReactNode }) {
  const light = isLight();
  return (
    <View style={{ borderRadius: 26, borderCurve: "continuous", overflow: "hidden", borderWidth: 0.5, borderColor: light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)" }}>
      <BlurView intensity={70} tint={light ? "light" : "dark"} style={{ backgroundColor: light ? "rgba(255,255,255,0.6)" : "rgba(36,36,40,0.5)" }}>
        {children}
      </BlurView>
    </View>
  );
}

/**
 * One thing waiting, in the style of the card that drops on the screen: who, Willo asking,
 * the amount large and the name beside it, Confirmar then Cancelar; the pencil in the corner.
 * A tap on the card opens the app's own confirmation.
 */
function PendingCard({
  item,
  kind,
  bank,
  busy,
  mode,
  canCredit,
  onMode,
  onConfirm,
  onDiscard,
  onReview,
  onEdit,
}: {
  item: CopilotItem;
  kind: LineKind;
  bank: string | null;
  busy: boolean;
  /** Null until chosen, when the card's name did not say. */
  mode: Mode | null;
  canCredit: boolean;
  onMode: (m: Mode) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onReview: () => void;
  onEdit: () => void;
}) {
  const income = item.type === "receita";
  const title = kind === "transferencia" ? "Transferência entre contas" : income ? "Registrar entrada" : "Registrar gasto";
  const blocked = canCredit && !mode;
  return (
    <Pressable
      onPress={busy ? undefined : onReview}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${money(item.amount)}. Conferir`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <Glass>
      <View style={{ padding: 14 }}>
        {/* As the notification: the app's icon; the title, the time and the pencil; Willo's words under. */}
        <View style={{ flexDirection: "row", gap: 11 }}>
          <Image source={APP_ICON} style={{ width: 38, height: 38, borderRadius: 9 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: th("#fff") }}>
                {title}
              </Text>
              <Text style={{ fontSize: 13, color: th(INK.softer) }}>{timeOf(item.occurred_at)}</Text>
              <Pressable
                onPress={busy ? undefined : onEdit}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Editar"
                style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: th(pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)", "bg") })}
              >
                <Pencil size={12} color={th("#fff")} strokeWidth={2.3} />
              </Pressable>
            </View>
            {/* Willo asking, a line of his own for this one. */}
            <Text style={{ marginTop: 1, fontSize: 15, lineHeight: 20, color: th("rgba(255,255,255,0.9)") }}>{askLine(kind, bank, item.id)}</Text>
          </View>
        </View>

        {/* The amount first and larger, then who or what. */}
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text style={{ color: th("#fff") }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: th(INK.softer) }}>{income ? "+ R$ " : "R$ "}</Text>
            <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{money(item.amount).replace(/^R\$\s?/, "")}</Text>
          </Text>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, lineHeight: 19, fontWeight: "500", color: th("rgba(255,255,255,0.85)") }}>
            {kind === "transferencia" ? (bank ?? "Entre suas contas") : item.name}
          </Text>
        </View>

        {/* Only when the Wallet did not say: debit out of the account, or credit onto the invoice. */}
        {canCredit && (
          <View style={{ marginTop: 12, flexDirection: "row", padding: 3, borderRadius: 16, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
            {(["conta", "cartao"] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={busy || on ? undefined : () => onMode(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{ flex: 1, height: 30, borderRadius: 13, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("rgba(255,255,255,0.16)", "bg") : "transparent" }}
                >
                  {m === "conta" ? <Landmark size={12} color={th(on ? "#fff" : INK.softer)} strokeWidth={2.4} /> : <CreditCard size={12} color={th(on ? "#fff" : INK.softer)} strokeWidth={2.4} />}
                  <Text style={{ fontSize: 12.5, fontWeight: on ? "700" : "500", color: th(on ? "#fff" : INK.softer) }}>{m === "conta" ? "Débito" : "Crédito"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Confirmar first, Cancelar after. */}
        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={busy || blocked ? undefined : onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirmar"
            style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff"), opacity: blocked ? 0.35 : pressed ? 0.85 : 1 })}
          >
            {busy ? <ActivityIndicator size="small" color={th("#0B0B0B", "bg")} /> : <Text style={{ fontSize: 14, fontWeight: "700", color: th("#0B0B0B", "bg") }}>Confirmar</Text>}
          </Pressable>
          <Pressable
            onPress={busy ? undefined : onDiscard}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th(pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)", "bg") })}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: th("#fff") }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
      </Glass>
    </Pressable>
  );
}

type Mode = "conta" | "cartao";

/** A transfer between the person's own accounts, money in, or a purchase. */
function kindOf(item: CopilotItem): LineKind {
  try {
    const raw = item.raw ? (JSON.parse(item.raw) as { transfer?: unknown }) : null;
    if (raw?.transfer === true || /^transfer[eê]ncia entre/i.test(item.name)) return "transferencia";
  } catch {
    /* As it reads. */
  }
  return item.type === "receita" ? "entrada" : "compra";
}

/** The bank a notice came from, by how each one words it, or by its name. */
function bankOfNotice(item: CopilotItem): string | null {
  try {
    const raw = item.raw ? (JSON.parse(item.raw) as { notice?: unknown; app?: unknown; card?: unknown; bank?: unknown }) : null;
    const text = [raw?.bank, raw?.app, raw?.card, raw?.notice].filter((x) => typeof x === "string").join(" ");
    const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (/recebemos sua transferencia/.test(plain)) return "Nubank";
    if (/voce depositou .* rendendo/.test(plain)) return "Mercado Pago";
    return bankFor(text)?.name ?? null;
  } catch {
    return null;
  }
}

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
