import { useEffect, useMemo, useRef, useState, type ComponentRef, type ComponentType } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { createTransaction, createTransfer, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, readEntry, type ParsedEntry } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { colorFor } from "@/lib/banks";
import { categoryHex } from "@/lib/categoryData";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import BankMark from "~/components/BankMark";
import BottomSheet from "~/components/BottomSheet";
import { tallSheetBody } from "~/lib/sheetRoom";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CategoryPicker from "~/components/CategoryPicker";
import RaisedButton from "~/components/RaisedButton";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { PaidGlow } from "~/components/registro/AmountFirstFlow";
import { isoOf, todayIso } from "~/components/registro/EntryForm";
import { invoiceMonthOf, MONTH_NAMES, type Account, type Card } from "~/components/registro/entryParts";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Clock,
  CreditCard,
  Delete,
  Landmark,
  Mic,
  MoreHorizontal,
  PenLine,
  Receipt,
  Repeat as RepeatIcon,
  ScanLine,
  Sparkles,
  Wallet,
  X,
} from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { suggestCategory } from "~/lib/categorize";
import { money } from "~/lib/money";
import { playCash, preloadCash } from "~/lib/sounds";
import { loudnessOf, MicrophoneDenied, useVoice } from "~/lib/voice";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INCOME, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * A new entry, from the "+".
 *
 * One tall sheet that does not scroll. At the top: close, what it is — Despesa, Receita or
 * Transferência between the person's own accounts — and more options. Then one card holding
 * everything about it: the account in its corner (a tap opens "Selecionar conta", with
 * Débito and Crédito for a purchase), the scanner across from it, the amount, what it was
 * with its category found from the words, the day, how often, and the microphone. Under
 * the card the app's own number keys, drawn straight on the sheet with no boxes around
 * them. Salvar leads to the check of what will be written, confirmed by sliding; then the
 * ring of light, and the success — with confetti and the coin — in the same sheet.
 *
 * Spoken instead ("mercado 45 no Nubank"), the Willo fills it all in and goes straight to
 * the check.
 */

type Kind = "despesa" | "receita" | "transferencia";
type Method = "conta" | "cartao";
type Stage = "amount" | "details" | "confirm" | "done";
type Repeat = "unica" | "fixa" | "parcelado";
type Sheet = null | "conta" | "de" | "para" | "data" | "repetir" | "nota";
type Listen = "off" | "on" | "reading";
type Acc = Account & { current_balance?: number | string | null };
type Option = Acc | Card;
type IconC = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const tick = () => void Haptics.selectionAsync().catch(() => undefined);
const yesterdayIso = () => isoOf(new Date(Date.now() - 86_400_000));
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const KINDS: { k: Kind; label: string; Icon: IconC }[] = [
  { k: "despesa", label: "Despesa", Icon: ArrowUpRight },
  { k: "receita", label: "Receita", Icon: ArrowDownLeft },
  { k: "transferencia", label: "Transferência", Icon: ArrowLeftRight },
];
const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [",", "0", "del"],
];
/* Knowing when someone has stopped talking, as Registro rápido does. */
const QUIET_MS = 900;
const NOTHING_MS = 9000;
const LONGEST_MS = 30_000;
const ABOVE_FLOOR = 13;

/** "1250,5" → 125050. */
function centsOf(raw: string) {
  const [i, d = ""] = raw.split(",");
  return Number(i || "0") * 100 + Number(`${d}00`.slice(0, 2));
}
/** 125050 → "1250,5", the way it would have been typed. */
function rawOf(cents: number) {
  const i = Math.floor(cents / 100);
  const d = cents % 100;
  return d === 0 ? String(i) : `${i},${String(d).padStart(2, "0").replace(/0$/, "")}`;
}
const grouped = (i: string) => i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const capital = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

function dayShort(iso: string) {
  if (iso === todayIso()) return "Hoje";
  if (iso === yesterdayIso()) return "Ontem";
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${SHORT[d.getMonth()]}`;
}
function dayLong(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const head = iso === todayIso() ? "Hoje" : iso === yesterdayIso() ? "Ontem" : capital(WEEK[d.getDay()]);
  return `${head}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}
const balanceOf = (o: Option | null) => (o && "current_balance" in o && o.current_balance != null ? Number(o.current_balance) : null);

export default function NewEntry({
  cardId,
  onScan,
  onClose,
  onSeeTransactions,
  dryRun,
}: {
  /** For looking at the flow only: nothing is written. */
  dryRun?: boolean;
  /** Started inside a card: a purchase on it. */
  cardId?: string | null;
  /** Reads a receipt with the camera instead. */
  onScan?: () => void;
  onClose: () => void;
  onSeeTransactions: () => void;
}) {
  const { user } = useAuth();
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) => setKb(Math.max(0, e.endCoordinates.height)));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  /* Exactly the sheet's room, so it fills the screen and never scrolls. */
  const bodyH = tallSheetBody(screenH, insets.top, insets.bottom, kb);
  const compact = screenH < 740;
  const reduce = useReducedMotion();
  const locked = !!cardId;

  const [stage, setStage] = useState<Stage>("amount");
  const [kind, setKind] = useState<Kind>("despesa");
  const [raw, setRaw] = useState("");
  const [method, setMethod] = useState<Method>(locked ? "cartao" : "conta");
  const [whereId, setWhereId] = useState<string | null>(cardId ?? null);
  const [toId, setToId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [repeat, setRepeat] = useState<Repeat>("unica");
  const [parts, setParts] = useState(2);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<AnchorRect | null>(null);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const history = useRef<Record<string, string>>({});
  const moreRef = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    preloadCash();
    getAccounts()
      .then((list) => setAccounts((list as unknown as Acc[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
    getCreditCards()
      .then((c) => setCards(c as unknown as Card[]))
      .catch(() => undefined);
    allowedCategories().then(setCategories).catch(() => undefined);
    getRecentTransactions(120)
      .then((rows) => {
        for (const r of rows as { name: string; category: string }[]) if (r.name && r.category && r.category !== "Outros") history.current[r.name.toLowerCase()] ??= r.category;
      })
      .catch(() => undefined);
  }, []);

  /* ── What is being written, worked out from the choices ── */
  const cents = centsOf(raw);
  const value = cents / 100;
  const income = kind === "receita";
  const transfer = kind === "transferencia";
  const how: Method = income || transfer ? "conta" : method;
  const credit = how === "cartao";
  const list: Option[] = credit ? cards : accounts;
  /* The default account (they come default first) or the first card, until another is chosen. */
  const where = whereId && list.some((o) => o.id === whereId) ? whereId : (list[0]?.id ?? null);
  const picked = list.find((o) => o.id === where) ?? null;
  const toAcc = transfer ? (accounts.find((a) => a.id === toId && a.id !== where) ?? accounts.find((a) => a.id !== where) ?? null) : null;
  const today = todayIso();
  const ahead = date > today;
  const status: "pago" | "pendente" = credit || ahead || pending ? "pendente" : "pago";
  const n = credit && repeat === "parcelado" && parts > 1 ? parts : null;
  const canSave = cents > 0 && !!picked && (!transfer || !!toAcc);
  const title = capital(
    name.trim() ||
      (transfer ? `Transferência para ${toAcc?.name ?? "outra conta"}` : category && category !== "Outros" ? category : income ? "Receita" : "Despesa"),
  );

  /* ── The amount, on the app's keys ── */
  const press = (key: string) => {
    tick();
    setError(null);
    setRaw((r) => {
      if (key === "clear") return "";
      if (key === "del") return r.slice(0, -1);
      if (key === ",") return r.includes(",") ? r : r === "" ? "0," : `${r},`;
      const [i, d] = r.split(",");
      if (d !== undefined) return d.length >= 2 ? r : r + key;
      if (i === "0" || i === "") return key === "0" && i === "0" ? r : key;
      return i.length >= 9 ? r : r + key;
    });
  };

  /* ── What it was: the category from the words, as they are typed ── */
  useEffect(() => {
    if (byHand || transfer) return;
    const t = name.trim();
    if (!t) return setCategory(null);
    const known = history.current[t.toLowerCase()];
    if (known) return setCategory(known);
    const local = parseLocal(`${t} ${Math.max(1, Math.round(cents / 100))}`, { today: todayIso(), categories, history: history.current })?.[0]?.category ?? null;
    setCategory(local && local !== "Outros" ? local : null);
  }, [name, categories, cents, byHand, transfer]);

  const changeKind = (k: Kind) => {
    if (k === kind) return;
    tick();
    setKind(k);
    setError(null);
    setCategory(null);
    setByHand(false);
    if (k !== "despesa") setMethod("conta");
    if (k !== "despesa" && repeat === "parcelado") setRepeat("unica");
    if (k === "transferencia") setRepeat("unica");
  };

  /** A category for the check: the words', else the Willo's guess if it answers quickly, else Outros. */
  const settleCategory = async (words: string, amount: number, type: "despesa" | "receita") => {
    const t = words.trim();
    if (!t) return "Outros";
    const known = history.current[t.toLowerCase()];
    if (known) return known;
    let cat = await Promise.race([
      suggestCategory({ name: t, amount, type }).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (cat && !categories.includes(cat)) cat = null;
    return cat ?? "Outros";
  };

  const goConfirm = async () => {
    if (!canSave || busy) return;
    Keyboard.dismiss();
    setError(null);
    if (credit) {
      const card = cards.find((c) => c.id === where);
      const room = card?.limit != null ? Number(card.limit) - (Number(card.used_limit) || 0) : null;
      if (room !== null && value > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível.`);
        return;
      }
    }
    if (!transfer && !category) {
      setBusy(true);
      const cat = await settleCategory(name, value, income ? "receita" : "despesa");
      setBusy(false);
      setCategory(cat);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStage("confirm");
  };

  const register = async () => {
    if ((!user && !dryRun) || saving || !picked) return;
    setSaving(true);
    setError(null);
    try {
      if (!dryRun && user) {
        if (transfer && toAcc) {
          await createTransfer({ fromId: picked.id, toId: toAcc.id, amount: value, date, name: title, observation: note.trim() || null, status }, user.id);
        } else {
          await createTransaction(
            {
              name: title,
              type: kind,
              /* In instalments the purchase carries one instalment's value; the instalments repeat it. */
              amount: n ? Math.round(cents / n) / 100 : value,
              category: category ?? "Outros",
              date,
              status,
              payment_method: how,
              account_id: credit ? null : picked.id,
              credit_card_id: credit ? picked.id : null,
              recurrence_type: n ? "parcelado" : repeat === "fixa" ? "fixa" : "unica",
              installments: n,
              installment_current: n ? 1 : null,
              observation: note.trim() || null,
            } as never,
            user.id,
          );
        }
        window.dispatchEvent(new CustomEvent("transaction-created"));
      }
      setStage("done");
    } catch {
      setError("Não consegui salvar agora. Tente de novo.");
      setTries((t) => t + 1);
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setStage("amount");
    setRaw("");
    setName("");
    setCategory(null);
    setByHand(false);
    setDate(todayIso());
    setRepeat("unica");
    setPending(false);
    setNote("");
    setHeard(null);
    setError(null);
  };

  /* ── Spoken: the Willo fills it in and goes to the check ── */
  const voice = useVoice();
  const [listen, setListenState] = useState<Listen>("off");
  const listenRef = useRef<Listen>("off");
  const setListen = (v: Listen) => {
    listenRef.current = v;
    setListenState(v);
  };
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });
  useEffect(
    () => () => {
      if (listenRef.current === "on") void voiceRef.current.cancel();
    },
    [],
  );
  const calm = useRef({ floor: 0, seen: false, spoke: false, quietSince: 0, began: 0 });

  const startVoice = async () => {
    if (listenRef.current === "on") return void finishVoice();
    if (listenRef.current !== "off") return;
    Keyboard.dismiss();
    setError(null);
    try {
      await voice.start();
      calm.current = { floor: 0, seen: false, spoke: false, quietSince: 0, began: Date.now() };
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      setListen("on");
    } catch (err) {
      setError(err instanceof MicrophoneDenied ? "O microfone está bloqueado. Libere o Willo em Ajustes › Willo › Microfone." : "Não consegui acessar o microfone agora.");
    }
  };

  const applyHeard = async (e: ParsedEntry, transcript: string | null) => {
    const said = `${transcript ?? ""} ${e.name ?? ""}`.toLowerCase();
    const k: Kind = locked ? "despesa" : e.type === "receita" ? "receita" : "despesa";
    const m: Method = locked ? "cartao" : k === "receita" ? "conta" : e.paymentMethod ?? method;
    const pool: Option[] = m === "cartao" ? cards : accounts;
    const named = locked ? null : pool.find((o) => o.name && said.includes(o.name.toLowerCase()));
    const words = e.name ? capital(e.name) : "";
    const cat = e.category && e.category !== "Outros" && categories.includes(e.category) ? e.category : await settleCategory(words, e.amount, k === "receita" ? "receita" : "despesa");
    setKind(k);
    setMethod(m);
    if (named) setWhereId(named.id);
    setRaw(rawOf(Math.round(e.amount * 100)));
    setName(words);
    setCategory(cat);
    setByHand(true);
    if (e.date) setDate(e.date);
    setPending(e.settled === false && m === "conta");
    if (m !== "cartao" && repeat === "parcelado") setRepeat("unica");
    setHeard(transcript);
    setListen("off");
    if (pool.length === 0) {
      setSheet("conta");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStage("confirm");
  };

  const finishVoice = async () => {
    if (listenRef.current !== "on") return;
    setListen("reading");
    try {
      const clip = await voice.stop();
      if (!clip || clip.seconds < 0.4) {
        setListen("off");
        setError("Não ouvi nada. Toque no microfone e fale de novo.");
        return;
      }
      const { entries, transcript } = await readEntry({ audio: { data: clip.data, mimeType: clip.mimeType }, categories });
      const first = entries[0];
      if (!first || !(first.amount > 0)) {
        setListen("off");
        setError(transcript ? `Ouvi “${transcript}”, mas não achei o valor. Tente de novo.` : "Não entendi. Tente de novo.");
        return;
      }
      await applyHeard(first, transcript);
    } catch {
      setListen("off");
      setError("Não consegui ler agora. Tente de novo.");
    }
  };

  /* A short silence after speaking ends the listening; a tap does too. */
  useEffect(() => {
    if (listen !== "on") return;
    const c = calm.current;
    const now = Date.now();
    if (now - c.began > LONGEST_MS) {
      void finishVoice();
      return;
    }
    const level = voice.level;
    if (typeof level !== "number") return;
    c.floor = c.seen ? Math.min(c.floor + 0.05, level) : level;
    c.seen = true;
    const loud = level > Math.max(-42, c.floor + ABOVE_FLOOR);
    if (loud) {
      c.spoke = true;
      c.quietSince = 0;
    } else if (c.spoke) {
      if (c.quietSince === 0) c.quietSince = now;
      else if (now - c.quietSince > QUIET_MS) void finishVoice();
    } else if (now - c.began > NOTHING_MS) {
      void voice.cancel();
      setListen("off");
      setError("Não ouvi nada. Toque no microfone e fale de novo.");
    }
    // finishVoice and voice change every render; the level is what drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen, voice.level]);

  /* ── Done: the coin, the light, the confetti ── */
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [glowing, setGlowing] = useState(false);
  useEffect(() => {
    if (stage !== "done") return;
    setGlowing(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    playCash();
    const t = setTimeout(() => setGlowing(false), 2200);
    return () => clearTimeout(t);
  }, [stage]);

  const openMenu = () => {
    tick();
    moreRef.current?.measureInWindow((x, y, w, h) => setMenu({ left: x + w - 258, top: y, bottom: y + h, width: 258 }));
  };

  const hex = transfer ? "#8A8F98" : category ? categoryHex(category) : "#8A8F98";
  const CatIcon: IconC = transfer ? ArrowLeftRight : category ? categoryIcon(category) : Sparkles;
  const rowH = compact ? 54 : 64;
  const custom = date !== today && date !== yesterdayIso();
  const payLine = transfer
    ? `${picked?.name ?? ""} → ${toAcc?.name ?? ""}`
    : `${credit ? "Crédito" : income ? "Em" : "Débito"} · ${picked?.name ?? ""}${n ? ` · ${n}x` : ""}`;
  const secondLine = (o: Option | null) => {
    if (!o) return "";
    if (credit && "limit" in o && o.limit != null) return `Disponível ${money(Number(o.limit) - (Number(o.used_limit) || 0))}`;
    if (credit) return "Crédito";
    const b = balanceOf(o);
    return b != null ? money(b) : "";
  };
  const next = () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStage("details");
  };
  const moreButton = (
    <View ref={moreRef} collapsable={false}>
      <RaisedButton size={46} label="Mais opções" onPress={openMenu}>
        <MoreHorizontal size={20} color={th("#fff")} strokeWidth={2.4} />
      </RaisedButton>
    </View>
  );
  const cardStyle = {
    flex: 1,
    marginTop: 12,
    borderRadius: 34,
    borderCurve: "continuous" as const,
    borderWidth: 1,
    borderColor: th("rgba(255,255,255,0.08)", "line"),
    backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
  };
  const repeatLabel = repeat === "fixa" ? "Todo mês" : n ? (cents > 0 ? `${n}x de ${money(value / n)}` : `${n}x`) : "Única";
  const accountNote = (o: Option) => {
    if ("limit" in o && o.limit != null) return `Disponível ${money(Number(o.limit) - (Number(o.used_limit) || 0))}`;
    if ("closing_day" in o && o.closing_day) return `Fecha dia ${o.closing_day}`;
    const b = balanceOf(o);
    return b != null ? `Saldo ${money(b)}` : "";
  };

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
      style={{ height: bodyH, paddingHorizontal: 10 }}
    >
      {/* ── 1 · How much, from where, and what kind ── */}
      {stage === "amount" && (
        <Animated.View key="amount" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <View style={{ height: 48, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <RaisedButton size={46} label="Fechar" onPress={onClose}>
              <X size={20} color={th("#fff")} strokeWidth={2.4} />
            </RaisedButton>
            {locked ? (
              <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>Compra no cartão</Text>
            ) : (
              <KindPill value={kind} onChange={changeKind} />
            )}
            {moreButton}
          </View>

          <View style={[cardStyle, { padding: 12 }]}>
            {/* Where the money is: the account in the corner, the scanner across. */}
            <View style={{ height: 58, flexDirection: "row", alignItems: "center", gap: 8 }}>
              {transfer ? (
                accounts.length < 2 ? (
                  <Text numberOfLines={2} style={{ flex: 1, paddingHorizontal: 8, fontSize: 14, color: th(INK.soft) }}>
                    Para transferir, cadastre outra conta.
                  </Text>
                ) : (
                  <>
                    <AccountChip grow option={picked} line={secondLine(picked)} label="De" placeholder="Conta" onPress={() => setSheet("de")} />
                    <Pressable
                      onPress={() => {
                        if (!picked || !toAcc) return;
                        tick();
                        setWhereId(toAcc.id);
                        setToId(picked.id);
                      }}
                      accessibilityLabel="Inverter as contas"
                      hitSlop={6}
                      style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: th(GREEN, "bg"), opacity: pressed ? 0.6 : 1 })}
                    >
                      <ArrowRight size={16} color="#0B0B0B" strokeWidth={2.8} />
                    </Pressable>
                    <AccountChip grow option={toAcc} line={secondLine(toAcc)} label="Para" placeholder="Conta" onPress={() => setSheet("para")} />
                  </>
                )
              ) : (
                <>
                  <AccountChip
                    option={picked}
                    line={secondLine(picked)}
                    label={credit ? "Cartão" : "Conta"}
                    placeholder={credit ? "Escolher cartão" : "Escolher conta"}
                    disabled={locked}
                    onPress={() => setSheet("conta")}
                  />
                  <View style={{ flex: 1 }} />
                  {onScan && !income && (
                    <Pressable
                      onPress={onScan}
                      accessibilityLabel="Ler comprovante com a câmera"
                      hitSlop={4}
                      style={({ pressed }) => ({
                        height: 58,
                        paddingHorizontal: 18,
                        borderRadius: 29,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        borderWidth: 1,
                        borderColor: th("rgba(255,255,255,0.08)", "line"),
                        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <ScanLine size={20} color={th("#fff")} strokeWidth={2.2} />
                    </Pressable>
                  )}
                </>
              )}
            </View>

            {/* The amount, big, in the middle of the card. */}
            <View accessible accessibilityLabel={`Valor: ${money(value)}`} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
              <Amount raw={raw} income={income} size={compact ? 62 : 78} />
            </View>

            {/* How it was paid, and the microphone. */}
            <View style={{ height: 50, flexDirection: "row", alignItems: "center", gap: 8 }}>
              {listen !== "off" ? (
                <VoiceBar state={listen} loudness={loudnessOf(voice.level)} onStop={() => void finishVoice()} />
              ) : (
                <>
                  {kind === "despesa" && !locked && (
                    <SmallChip
                      tall
                      icon={credit ? CreditCard : Landmark}
                      label={credit ? "Crédito" : "Débito"}
                      onPress={() => {
                        tick();
                        setMethod(credit ? "conta" : "cartao");
                        setWhereId(null);
                        if (credit && repeat === "parcelado") setRepeat("unica");
                      }}
                    />
                  )}
                  <View style={{ flex: 1 }} />
                  <Pressable
                    onPress={() => void startVoice()}
                    accessibilityLabel="Falar o lançamento"
                    hitSlop={4}
                    style={({ pressed }) => ({
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: th("rgba(103,205,103,0.35)", "line"),
                      backgroundColor: th("rgba(103,205,103,0.14)", "bg"),
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Mic size={21} color={th(GREEN)} strokeWidth={2.3} />
                  </Pressable>
                </>
              )}
            </View>

            <Keypad rowH={rowH} onKey={press} />
          </View>

          {error && <Text style={{ marginTop: 8, textAlign: "center", fontSize: 13.5, color: th(RED) }}>{error}</Text>}

          <Pressable
            onPress={next}
            disabled={!canSave}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 12,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: th("#fff", "bg"),
              opacity: !canSave ? 0.35 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>Continuar</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── 2 · What it was, when, how often ── */}
      {stage === "details" && (
        <Animated.View key="details" entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <View style={{ height: 48, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <RaisedButton
              size={46}
              label="Voltar"
              onPress={() => {
                Keyboard.dismiss();
                setError(null);
                setStage("amount");
              }}
            >
              <ChevronLeft size={21} color={th("#fff")} strokeWidth={2.4} />
            </RaisedButton>
            <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
              <Text numberOfLines={1} style={[nums, { fontSize: 19, fontWeight: "800", color: th(income ? INCOME : "#fff") }]}>
                {money(value)}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
                {payLine}
              </Text>
            </View>
            {moreButton}
          </View>

          <View style={[cardStyle, { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 }]}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: th(INK.soft) }}>{transfer ? "Descrição" : income ? "De onde veio?" : "Com o que foi?"}</Text>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(null);
              }}
              autoFocus={!name}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              placeholder={transfer ? "Opcional" : income ? "Salário, freela, Pix…" : "Mercado, Uber, aluguel…"}
              placeholderTextColor={th(INK.faint)}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={[{ marginTop: 4, padding: 0, height: 40, fontSize: 28, fontWeight: "700", letterSpacing: -0.6, color: th("#fff") }, Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null]}
            />

            {/* The category found in the words; a tap changes it. */}
            {!transfer && (
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setPicking(true);
                }}
                accessibilityLabel={`Categoria: ${category ?? "automática"}. Trocar`}
                style={({ pressed }) => ({
                  marginTop: 12,
                  alignSelf: "flex-start",
                  height: 42,
                  paddingLeft: 4,
                  paddingRight: 14,
                  borderRadius: 21,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: th(category ? chipFill(hex) : "rgba(255,255,255,0.07)", "bg"),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
                  <CatIcon size={16} color={th(chipInk(hex))} strokeWidth={2.3} />
                </View>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, fontWeight: "700", color: category ? th(chipInk(hex)) : th(INK.soft) }}>
                  {category ?? "Categoria automática"}
                </Text>
                <ChevronDown size={14} color={th(INK.soft)} strokeWidth={2.4} />
              </Pressable>
            )}

            <View style={{ marginTop: 18, height: 1, backgroundColor: th("rgba(255,255,255,0.07)", "line") }} />

            <Section title="Quando">
              <Choice label="Hoje" on={date === today} onPress={() => setDate(today)} />
              <Choice label="Ontem" on={date === yesterdayIso()} onPress={() => setDate(yesterdayIso())} />
              <Choice
                icon={CalendarDays}
                label={custom ? dayShort(date) : "Outra data"}
                on={custom}
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet("data");
                }}
              />
            </Section>

            {!typing && !transfer && (
              <Section title="Repetição">
                <Choice label="Única" on={repeat === "unica"} onPress={() => setRepeat("unica")} />
                <Choice label="Todo mês" on={repeat === "fixa"} onPress={() => setRepeat("fixa")} />
                {credit && <Choice label={n ? `${n}x de ${money(value / n)}` : "Parcelado"} on={repeat === "parcelado"} onPress={() => setSheet("repetir")} />}
              </Section>
            )}

            {!typing && !credit && !ahead && (
              <Section title="Situação">
                <Choice label={transfer ? "Feita" : income ? "Recebido" : "Pago"} on={!pending} onPress={() => setPending(false)} />
                <Choice label={income ? "A receber" : "Pendente"} on={pending} onPress={() => setPending(true)} />
              </Section>
            )}

            {/* A detail to remember, at the foot of the card. */}
            {!typing && (
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet("nota");
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  marginTop: "auto",
                  height: 54,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <PenLine size={17} color={th(INK.soft)} strokeWidth={2.2} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: note.trim() ? "600" : "500", color: th(note.trim() ? "#fff" : INK.soft) }}>
                  {note.trim() || "Adicionar observação"}
                </Text>
                <ChevronRight size={16} color={th(INK.softer)} strokeWidth={2.2} />
              </Pressable>
            )}
          </View>

          {error && <Text style={{ marginTop: 8, textAlign: "center", fontSize: 13.5, color: th(RED) }}>{error}</Text>}

          <Pressable
            onPress={() => void goConfirm()}
            disabled={!canSave || busy}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 12,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: th("#fff", "bg"),
              opacity: !canSave ? 0.35 : pressed || busy ? 0.85 : 1,
            })}
          >
            {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>Revisar</Text>}
          </Pressable>
        </Animated.View>
      )}

      {stage === "confirm" && (
        <Animated.View key="confirm" entering={FadeIn.duration(220)} exiting={FadeOut.duration(400)} style={{ flex: 1, paddingHorizontal: 10 }}>
          <View style={{ height: 40, flexDirection: "row", alignItems: "center" }}>
            <RaisedButton
              size={40}
              label="Voltar"
              onPress={() => {
                if (saving) return;
                setError(null);
                setStage("details");
              }}
            >
              <ChevronLeft size={19} color={th("#fff")} strokeWidth={2.4} />
            </RaisedButton>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: th("#fff") }}>Confirme</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ marginTop: 28, alignItems: "center" }}>
            <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
              {transfer ? (
                <ArrowLeftRight size={13} color={th(INK.soft)} strokeWidth={2.4} />
              ) : income ? (
                <ArrowDownLeft size={14} color={th(INCOME)} strokeWidth={2.4} />
              ) : (
                <ArrowUpRight size={14} color={th(INK.soft)} strokeWidth={2.4} />
              )}
              <Text style={{ fontSize: 13, fontWeight: "700", color: th(INK.soft) }}>{transfer ? "Transferência" : income ? "Receita" : credit ? "Despesa no crédito" : "Despesa"}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 12, fontSize: 58, fontWeight: "800", letterSpacing: -2, color: th(income ? INCOME : "#fff") }]}>
              {money(value)}
            </Text>
            {n ? <Text style={[nums, { marginTop: 2, fontSize: 14, color: th(INK.soft) }]}>{`${n}x de ${money(value / n)}`}</Text> : null}
            {heard ? (
              <Text numberOfLines={2} style={{ marginTop: 8, paddingHorizontal: 12, textAlign: "center", fontSize: 13.5, fontStyle: "italic", color: th(INK.soft) }}>
                “{heard}”
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: 24, paddingHorizontal: 16, paddingVertical: 2, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.09)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
            {(transfer
              ? [
                  {
                    label: "De",
                    value: picked?.name ?? "—",
                    mark: picked,
                    sub: status === "pago" && balanceOf(picked) != null ? `Fica com ${money(balanceOf(picked)! - value)}` : undefined,
                    warn: status === "pago" && balanceOf(picked) != null && balanceOf(picked)! - value < 0,
                  },
                  { label: "Para", value: toAcc?.name ?? "—", mark: toAcc, sub: status === "pago" && balanceOf(toAcc) != null ? `Fica com ${money(balanceOf(toAcc)! + value)}` : undefined },
                  { label: "Data", value: dayLong(date), sub: status === "pendente" ? (ahead ? "Agendada" : "Pendente") : undefined },
                  ...(name.trim() ? [{ label: "Descrição", value: title }] : []),
                  ...(note.trim() ? [{ label: "Observação", value: note.trim() }] : []),
                ]
              : [
                  { label: "Descrição", value: title },
                  { label: "Categoria", value: category ?? "Outros", cat: category ?? "Outros" },
                  {
                    label: credit ? "Cartão" : income ? "Entra em" : "Conta",
                    value: picked?.name ?? "—",
                    mark: picked,
                    sub: credit && picked ? `Fatura de ${invoiceMonthOf(date, (picked as Card).closing_day).label}` : undefined,
                  },
                  { label: "Data", value: dayLong(date) },
                  ...(repeat === "fixa" ? [{ label: "Repetição", value: "Todo mês" }] : n ? [{ label: "Parcelas", value: `${n}x de ${money(value / n)}` }] : []),
                  ...(!credit ? [{ label: "Situação", value: ahead ? "Agendado" : status === "pago" ? (income ? "Recebido" : "Pago") : income ? "A receber" : "Pendente" }] : []),
                  ...(note.trim() ? [{ label: "Observação", value: note.trim() }] : []),
                ]
            ).map((r, i, all) => (
              <DetailRow key={r.label} label={r.label} value={r.value} sub={"sub" in r ? r.sub : undefined} warn={"warn" in r ? r.warn : false} mark={"mark" in r ? (r.mark ?? null) : null} cat={"cat" in r ? r.cat : undefined} last={i === all.length - 1} />
            ))}
          </View>

          {error && <Text style={{ marginTop: 10, textAlign: "center", fontSize: 13.5, color: th(RED) }}>{error}</Text>}

          <View style={{ marginTop: "auto", paddingTop: 16 }}>
            <SwipeToConfirm key={tries} label={transfer ? "Deslize para transferir" : "Deslize para confirmar"} busy={saving} onDone={() => void register()} />
          </View>
        </Animated.View>
      )}

      {stage === "done" && (
        <Animated.View key="done" entering={reduce ? FadeIn.duration(200) : FadeIn.delay(460).duration(420)} style={{ flex: 1, alignItems: "center", paddingTop: 26, paddingHorizontal: 10 }}>
          <SuccessMark />
          <Text style={{ marginTop: 20, fontSize: 24, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>
            {transfer ? (status === "pago" ? "Transferência feita" : "Transferência agendada") : income ? "Receita registrada" : "Despesa registrada"}
          </Text>
          <Text numberOfLines={2} style={{ marginTop: 6, paddingHorizontal: 12, textAlign: "center", fontSize: 15, color: th(INK.soft) }}>
            {transfer ? `${picked?.name ?? ""} → ${toAcc?.name ?? ""}` : `${title} · ${credit ? "Crédito" : income ? "em" : "Débito"} ${picked?.name ?? ""}`}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 18, fontSize: 44, fontWeight: "800", letterSpacing: -1.6, color: th(income ? INCOME : "#fff") }]}>
            {income ? "+" : transfer ? "" : "−"}
            {money(value)}
          </Text>
          {n ? <Text style={[nums, { marginTop: 2, fontSize: 14, color: th(INK.soft) }]}>{`${n}x de ${money(value / n)}`}</Text> : null}
          <Text style={{ marginTop: 6, fontSize: 13.5, color: th(INK.softer) }}>{dayLong(date)}</Text>

          <View style={{ marginTop: "auto", alignSelf: "stretch", paddingTop: 20 }}>
            <Pressable onPress={onClose} style={({ pressed }) => ({ height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>Concluir</Text>
            </Pressable>
            <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "center", gap: 28 }}>
              <Pressable onPress={again} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14.5, fontWeight: "600", color: th(INK.soft) }}>Registrar outra</Text>
              </Pressable>
              <Pressable onPress={onSeeTransactions} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14.5, fontWeight: "600", color: th(INK.soft) }}>Ver transações</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {glowing && !reduce && box.w > 0 && <PaidGlow w={box.w} h={box.h} />}
      {stage === "done" && !reduce && box.w > 0 && <Confetti w={box.w} h={box.h} />}

      {/* ── The smaller sheets ── */}
      <AccountSheet
        open={sheet === "conta"}
        title={income ? "Onde entrou?" : "Selecionar conta"}
        method={income ? null : how}
        onMethod={(m) => {
          tick();
          setMethod(m);
          setWhereId(null);
          if (m === "conta" && repeat === "parcelado") setRepeat("unica");
        }}
        options={list}
        value={where}
        note={accountNote}
        empty={credit ? "Nenhum cartão cadastrado ainda." : "Nenhuma conta cadastrada ainda."}
        onPick={(id) => {
          tick();
          setWhereId(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <AccountSheet
        open={sheet === "de" || sheet === "para"}
        title={sheet === "para" ? "Transferir para" : "Transferir de"}
        method={null}
        options={sheet === "para" ? accounts.filter((a) => a.id !== where) : accounts.filter((a) => a.id !== toAcc?.id)}
        value={sheet === "para" ? (toAcc?.id ?? null) : where}
        note={accountNote}
        empty="Nenhuma conta cadastrada ainda."
        onPick={(id) => {
          tick();
          if (sheet === "para") setToId(id);
          else setWhereId(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        open={sheet === "data"}
        value={date}
        onPick={(d) => {
          tick();
          setDate(d);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <RepeatSheet
        open={sheet === "repetir"}
        value={repeat}
        parts={parts}
        credit={credit}
        cents={cents}
        onPick={(r, p) => {
          tick();
          setRepeat(r);
          if (p) setParts(p);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <NoteSheet
        open={sheet === "nota"}
        value={note}
        onSave={(t) => {
          setNote(t);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <CategoryPicker
        open={picking}
        value={category ?? ""}
        type={income ? "receita" : "despesa"}
        onClose={() => setPicking(false)}
        onPick={(c: string) => {
          setCategory(c);
          setByHand(true);
          setPicking(false);
        }}
      />
      <AnchoredMenu open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
        <MenuRow
          icon={PenLine}
          label={note.trim() ? "Editar observação" : "Adicionar observação"}
          onPress={() => {
            setMenu(null);
            setSheet("nota");
          }}
        />
        {!credit && (
          <MenuRow
            icon={Clock}
            label={pending ? (income ? "Marcar como recebida" : transfer ? "Marcar como feita" : "Marcar como paga") : "Marcar como pendente"}
            onPress={() => {
              setMenu(null);
              setPending((p) => !p);
            }}
          />
        )}
        {onScan && !income && !transfer && (
          <MenuRow
            icon={ScanLine}
            label="Ler comprovante"
            onPress={() => {
              setMenu(null);
              onScan();
            }}
          />
        )}
        <MenuRow
          icon={Receipt}
          label="Ver transações"
          onPress={() => {
            setMenu(null);
            onSeeTransactions();
          }}
          last
        />
      </AnchoredMenu>
    </View>
  );
}

/* ───────────────────────────── Pieces of the card ───────────────────────────── */

/** Despesa, Receita, Transferência: the chosen one shows its name, the others only their mark. */
function KindPill({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <View
      style={{
        height: 50,
        flexShrink: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        padding: 4,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
      }}
    >
      {KINDS.map(({ k, label, Icon }) => {
        const on = value === k;
        return (
          <Animated.View key={k} layout={LinearTransition.duration(240)} style={{ flexShrink: on ? 1 : 0 }}>
            <Pressable
              onPress={() => onChange(k)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              hitSlop={4}
              style={{
                height: 42,
                minWidth: 42,
                paddingLeft: on ? 7 : 0,
                paddingRight: on ? 16 : 0,
                borderRadius: 21,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                backgroundColor: on ? th("rgba(255,255,255,0.12)", "bg") : "transparent",
              }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("#fff", "bg") : th("rgba(255,255,255,0.28)", "bg") }}>
                <Icon size={15} color={th("#0B0B0B")} strokeWidth={2.8} />
              </View>
              {on && (
                <Animated.Text entering={FadeIn.duration(200)} numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, fontWeight: "600", color: th("#fff") }}>
                  {label}
                </Animated.Text>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** "R$ 1.250,5" as typed, the cents still to come drawn faint. */
function Amount({ raw, income, size }: { raw: string; income: boolean; size: number }) {
  const [i, d] = raw.split(",");
  const empty = raw === "";
  const ink = th(empty ? "rgba(255,255,255,0.32)" : income ? INCOME : "#fff");
  const faint = th("rgba(255,255,255,0.28)");
  const rest = d === undefined ? ",00" : "00".slice(d.length);
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", maxWidth: "100%" }}>
      <Text style={{ fontSize: Math.round(size * 0.42), fontWeight: "700", color: th(INK.soft), marginRight: 6 }}>R$</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[nums, { flexShrink: 1, fontSize: size, fontWeight: "800", letterSpacing: -size * 0.035, color: ink }]}>
        {grouped(empty ? "0" : i || "0")}
        {d !== undefined ? `,${d}` : ""}
        <Text style={{ color: faint }}>{d !== undefined && d.length === 0 ? "00" : rest}</Text>
      </Text>
    </View>
  );
}

function AccountChip({
  option,
  line,
  label,
  placeholder,
  onPress,
  grow,
  disabled,
}: {
  option: Option | null;
  /** Under the name: the balance, or what is left on the card. */
  line: string;
  /** Read aloud with the name: Conta, Cartão, De, Para. */
  label: string;
  placeholder: string;
  onPress: () => void;
  grow?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${option?.name ?? placeholder}. Trocar`}
      style={({ pressed }) => ({
        height: 58,
        flexGrow: grow ? 1 : 0,
        flexBasis: grow ? 0 : "auto",
        flexShrink: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: grow ? 8 : 10,
        paddingLeft: 7,
        paddingRight: grow ? 10 : 18,
        borderRadius: 29,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {option ? (
        <BankMark name={option.name} hex={colorFor(option.name, option.color)} size={grow ? 36 : 44} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
          <Wallet size={18} color={th(INK.soft)} strokeWidth={2.2} />
        </View>
      )}
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: grow ? 14.5 : 17, fontWeight: "700", color: th("#fff") }}>
          {option?.name ?? placeholder}
        </Text>
        {line ? (
          <Text numberOfLines={1} style={[nums, { marginTop: 1, fontSize: grow ? 12.5 : 14, color: th(INK.soft) }]}>
            {line}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SmallChip({ icon: Icon, label, onPress, tall }: { icon: IconC; label: string; onPress: () => void; tall?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ height: tall ? 50 : 34, flexShrink: 1, paddingHorizontal: tall ? 18 : 12, borderRadius: tall ? 25 : 17, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: pressed ? 0.7 : 1 })}
    >
      <Icon size={tall ? 18 : 15} color={th(INK.soft)} strokeWidth={2.2} />
      <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: tall ? 16 : 13.5, fontWeight: tall ? "600" : "700", color: th("#fff") }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Listening: a dot that swells with the voice, and a stop that reads at once. */
function VoiceBar({ state, loudness, onStop }: { state: Listen; loudness?: number; onStop: () => void }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(withTiming(1 + (loudness ?? 0) * 0.9, { duration: 120 }));
  }, [loudness, s]);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={{
        flex: 1,
        height: 36,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 14,
        paddingRight: 4,
        borderWidth: 1,
        borderColor: th("rgba(103,205,103,0.3)", "line"),
        backgroundColor: th("rgba(103,205,103,0.12)", "bg"),
      }}
    >
      {state === "reading" ? <ActivityIndicator size="small" color={GREEN} /> : <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN }, dot]} />}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>
        {state === "reading" ? "Lendo o que você disse…" : "Ouvindo… diga o valor e onde"}
      </Text>
      {state === "on" && (
        <Pressable onPress={onStop} accessibilityLabel="Parar e ler" hitSlop={6} style={({ pressed }) => ({ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: GREEN, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#0B0B0B" }} />
        </Pressable>
      )}
    </Animated.View>
  );
}

/** The numbers on the sheet itself: no boxes; a soft light under a key only while pressed. */
function Keypad({ rowH, onKey }: { rowH: number; onKey: (k: string) => void }) {
  const ink = th("#fff");
  const pressFill = th("rgba(255,255,255,0.09)", "bg");
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ marginTop: 6 }}>
      {KEYS.map((row) => (
        <View key={row.join()} style={{ flexDirection: "row" }}>
          {row.map((k) => (
            <Pressable
              key={k}
              onPress={() => onKey(k)}
              onLongPress={k === "del" ? () => onKey("clear") : undefined}
              accessibilityRole="button"
              accessibilityLabel={k === "del" ? "Apagar" : k === "," ? "Vírgula" : k}
              style={{ flex: 1, height: rowH, alignItems: "center", justifyContent: "center" }}
            >
              {({ pressed }) => (
                <>
                  <View style={{ position: "absolute", width: rowH + 30, height: rowH - 6, borderRadius: (rowH - 6) / 2, backgroundColor: pressed ? pressFill : "transparent" }} />
                  {k === "del" ? (
                    <Delete size={28} color={ink} strokeWidth={1.9} />
                  ) : (
                    <Text style={[nums, { fontSize: k === "," ? 38 : 34, fontWeight: "500", color: ink, marginTop: k === "," ? -12 : 0 }]}>{k}</Text>
                  )}
                </>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ marginBottom: 8, fontSize: 13, fontWeight: "600", color: th(INK.soft) }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

function Choice({ label, on, onPress, icon: Icon }: { label: string; on: boolean; onPress: () => void; icon?: IconC }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: th(on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)", "line"),
        backgroundColor: th(on ? "rgba(255,255,255,0.14)" : "transparent", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {Icon ? <Icon size={15} color={th(on ? "#fff" : INK.soft)} strokeWidth={2.2} /> : null}
      <Text numberOfLines={1} style={[nums, { fontSize: 14.5, fontWeight: "700", color: th(on ? "#fff" : INK.soft) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ───────────────────────────── The check ───────────────────────────── */

function DetailRow({ label, value, sub, warn, mark, cat, last }: { label: string; value: string; sub?: string; warn?: boolean; mark: Option | null; cat?: string; last: boolean }) {
  const hex = cat ? categoryHex(cat) : null;
  const Icon = cat ? categoryIcon(cat) : null;
  return (
    <View style={{ minHeight: 46, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: th("rgba(255,255,255,0.07)", "line") }}>
      <Text style={{ width: 90, fontSize: 14.5, color: th(INK.soft) }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {mark ? <BankMark name={mark.name} hex={colorFor(mark.name, mark.color)} size={24} /> : null}
        {hex && Icon ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
            <Icon size={13} color={th(chipInk(hex))} strokeWidth={2.4} />
          </View>
        ) : null}
        <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
          <Text numberOfLines={1} style={[nums, { fontSize: 15, fontWeight: "700", color: th("#fff") }]}>
            {value}
          </Text>
          {sub ? (
            <Text numberOfLines={1} style={[nums, { marginTop: 1, fontSize: 12.5, color: th(warn ? AMBER : INK.soft) }]}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Slide the green knob to the end to confirm; let go before it and it springs back. */
function SwipeToConfirm({ label, busy, onDone }: { label: string; busy: boolean; onDone: () => void }) {
  const KNOB = 56;
  const PAD = 4;
  const [w, setW] = useState(0);
  const max = Math.max(0, w - KNOB - PAD * 2);
  const x = useSharedValue(0);
  const shine = useSharedValue(0);
  const fired = useRef(false);

  useEffect(() => {
    shine.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(shine);
  }, [shine]);

  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onDone();
  };

  const pan = Gesture.Pan()
    .enabled(!busy && max > 0)
    .activeOffsetX([-4, 4])
    .failOffsetY([-26, 26])
    .onUpdate((e) => {
      x.set(Math.min(max, Math.max(0, e.translationX)));
    })
    .onEnd(() => {
      if (x.get() >= max * 0.85) {
        x.set(withTiming(max, { duration: 120 }));
        runOnJS(fire)();
      } else {
        x.set(withSpring(0, { duration: 420, dampingRatio: 0.82 }));
      }
    });

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const fill = useAnimatedStyle(() => ({ width: x.get() + KNOB + PAD * 2 }));
  const hint = useAnimatedStyle(() => ({ opacity: max > 0 ? Math.max(0, 1 - (x.get() / max) * 1.6) : 1 }));
  const chevrons = useAnimatedStyle(() => ({ opacity: 0.35 + shine.get() * 0.65, transform: [{ translateX: shine.get() * 4 }] }));

  const H = KNOB + PAD * 2;
  const a11y = Platform.OS === "web" ? {} : { accessibilityActions: [{ name: "activate" as const }], onAccessibilityAction: () => fire() };
  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        {...a11y}
        style={{ height: H, borderRadius: H / 2, overflow: "hidden", borderWidth: 1, borderColor: th("rgba(255,255,255,0.12)", "line"), backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}
      >
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: H / 2, backgroundColor: "rgba(103,205,103,0.22)" }, fill]} />
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, paddingLeft: KNOB, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, hint]}>
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>{label}</Text>
          <Animated.View style={chevrons}>
            <ChevronsRight size={18} color={th(INK.soft)} strokeWidth={2.4} />
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: PAD,
              top: PAD,
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: GREEN,
              shadowColor: "#67CD67",
              shadowOpacity: 0.5,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            },
            knob,
          ]}
        >
          {busy ? <ActivityIndicator color="#0B0B0B" /> : <ChevronRight size={26} color="#0B0B0B" strokeWidth={2.8} />}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/* ───────────────────────────── Done ───────────────────────────── */

function SuccessMark() {
  const s = useSharedValue(0.4);
  const o = useSharedValue(0);
  useEffect(() => {
    s.set(withDelay(480, withSpring(1, { duration: 560, dampingRatio: 0.55 })));
    o.set(withDelay(480, withTiming(1, { duration: 200 })));
  }, [s, o]);
  const pop = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  return (
    <Animated.View style={[{ width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(103,205,103,0.16)" }, pop]}>
      <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}>
        <Check size={36} color="#0B0B0B" strokeWidth={3.2} />
      </View>
    </Animated.View>
  );
}

interface Bit {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  spin: number;
  flip: number;
  phase: number;
  delay: number;
  life: number;
}

const CONFETTI = ["#67CD67", "#67CD67", "#FFFFFF", "#BFF3BF", "#FFE08A", "#E9FFE9"];

/** Thrown out from the check as it lands, fluttering down through the sheet. */
function Confetti({ w, h }: { w: number; h: number }) {
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.set(withDelay(520, withTiming(4, { duration: 4000, easing: Easing.linear })));
  }, [clock]);
  const bits = useMemo<Bit[]>(() => {
    let s = Math.floor(Math.random() * 1e9) >>> 0;
    const r = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    return Array.from({ length: 56 }, () => ({
      x0: w / 2 + (r() - 0.5) * 30,
      y0: 70 + (r() - 0.5) * 20,
      vx: (r() - 0.5) * 760,
      vy: -(140 + r() * 420),
      w: 5 + r() * 4,
      h: 9 + r() * 6,
      color: CONFETTI[Math.floor(r() * CONFETTI.length)],
      spin: (r() - 0.5) * 900,
      flip: 6 + r() * 8,
      phase: r() * Math.PI * 2,
      delay: r() * 0.12,
      life: 2.8 + r() * 1.1,
    }));
  }, [w]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: w, height: h, overflow: "hidden" }}>
      {bits.map((b, i) => (
        <ConfettiBit key={i} b={b} clock={clock} />
      ))}
    </View>
  );
}

function ConfettiBit({ b, clock }: { b: Bit; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = clock.get() - b.delay;
    if (t <= 0 || t >= b.life) return { opacity: 0 };
    const drag = 1.7;
    const e = Math.exp(-drag * t);
    const x = b.x0 + (b.vx * (1 - e)) / drag + Math.sin(t * 3 + b.phase) * 9;
    const y = b.y0 + (b.vy * (1 - e)) / drag + (330 / drag) * (t - (1 - e) / drag);
    const fade = Math.min(1, (b.life - t) / (b.life * 0.3));
    return {
      opacity: Math.min(1, t / 0.06) * fade,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${b.spin * t}deg` }, { scaleX: Math.cos(t * b.flip + b.phase) }],
    };
  });
  return <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: b.w, height: b.h, borderRadius: 1.5, backgroundColor: b.color }, style]} />;
}

/* ───────────────────────────── The smaller sheets ───────────────────────────── */

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={{ height: 40, flexDirection: "row", alignItems: "center" }}>
      <RaisedButton size={38} label="Fechar" onPress={onClose}>
        <X size={17} color={th("#fff")} strokeWidth={2.4} />
      </RaisedButton>
      <Text style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: th("#fff") }}>{title}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={{ marginTop: 14, height: 42, flexDirection: "row", padding: 3, borderRadius: 21, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("rgba(255,255,255,0.16)", "bg") : "transparent" }}
          >
            <Text style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: th(on ? "#fff" : INK.soft) }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CheckDot({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: on ? 0 : 1.5,
        borderColor: th("rgba(255,255,255,0.28)", "line"),
        backgroundColor: on ? th(GREEN, "bg") : "transparent",
      }}
    >
      {on && <Check size={14} color="#0B0B0B" strokeWidth={3.2} />}
    </View>
  );
}

/** "Selecionar conta": Débito or Crédito for a purchase, then the accounts or the cards. */
function AccountSheet({
  open,
  title,
  method,
  onMethod,
  options,
  value,
  note,
  empty,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  /** Null hides Débito / Crédito. */
  method: Method | null;
  onMethod?: (m: Method) => void;
  options: Option[];
  value: string | null;
  note: (o: Option) => string;
  empty: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <SheetHead title={title} onClose={onClose} />
        {method && onMethod ? (
          <Segmented
            value={method}
            options={[
              ["conta", "Débito"],
              ["cartao", "Crédito"],
            ]}
            onChange={onMethod}
          />
        ) : null}
        <View style={{ marginTop: 10 }}>
          {options.length === 0 ? (
            <Text style={{ paddingVertical: 22, textAlign: "center", fontSize: 14.5, color: th(INK.soft) }}>{empty}</Text>
          ) : (
            options.map((o, i) => (
              <Pressable
                key={o.id}
                onPress={() => onPick(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: o.id === value }}
                style={({ pressed }) => ({
                  height: 66,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 4,
                  borderBottomWidth: i === options.length - 1 ? 0 : 1,
                  borderBottomColor: th("rgba(255,255,255,0.07)", "line"),
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <BankMark name={o.name} hex={colorFor(o.name, o.color)} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>
                    {o.name}
                  </Text>
                  {note(o) ? (
                    <Text numberOfLines={1} style={[nums, { marginTop: 2, fontSize: 13, color: th(INK.soft) }]}>
                      {note(o)}
                    </Text>
                  ) : null}
                </View>
                <CheckDot on={o.id === value} />
              </Pressable>
            ))
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

function DateSheet({ open, value, onPick, onClose }: { open: boolean; value: string; onPick: (iso: string) => void; onClose: () => void }) {
  const [cal, setCal] = useState(() => {
    const d = new Date(`${value}T12:00:00`);
    return { m: d.getMonth(), y: d.getFullYear() };
  });
  const today = todayIso();
  const yesterday = yesterdayIso();
  const picked = new Date(`${value}T12:00:00`);
  const chip = (iso: string, label: string) => {
    const on = value === iso;
    return (
      <Pressable
        key={iso}
        onPress={() => onPick(iso)}
        style={({ pressed }) => ({
          flex: 1,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: th(on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)", "line"),
          backgroundColor: th(on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", "bg"),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 14.5, fontWeight: "700", color: th(on ? "#fff" : INK.soft) }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <SheetHead title="Data" onClose={onClose} />
        <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
          {chip(today, "Hoje")}
          {chip(yesterday, "Ontem")}
        </View>
        <View style={{ marginTop: 14, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityLabel="Mês anterior" hitSlop={8} onPress={() => setCal(({ m, y }) => (m === 0 ? { m: 11, y: y - 1 } : { m: m - 1, y }))} style={{ padding: 6 }}>
            <ChevronLeft size={18} color={th("#fff")} />
          </Pressable>
          <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>{`${capital(MONTH_NAMES[cal.m])} de ${cal.y}`}</Text>
          <Pressable accessibilityLabel="Próximo mês" hitSlop={8} onPress={() => setCal(({ m, y }) => (m === 11 ? { m: 0, y: y + 1 } : { m: m + 1, y }))} style={{ padding: 6 }}>
            <ChevronRight size={18} color={th("#fff")} />
          </Pressable>
        </View>
        <MonthCalendar
          month={cal.m}
          year={cal.y}
          events={[]}
          selectedDay={picked.getMonth() === cal.m && picked.getFullYear() === cal.y ? picked.getDate() : null}
          onSelectDay={(day) => {
            if (day) onPick(isoOf(new Date(cal.y, cal.m, day)));
          }}
        />
      </View>
    </BottomSheet>
  );
}

function RepeatSheet({
  open,
  value,
  parts,
  credit,
  cents,
  onPick,
  onClose,
}: {
  open: boolean;
  value: Repeat;
  parts: number;
  credit: boolean;
  cents: number;
  onPick: (r: Repeat, parts?: number) => void;
  onClose: () => void;
}) {
  const [split, setSplit] = useState(value === "parcelado");
  const rows: { r: Repeat; title: string; sub: string }[] = [
    { r: "unica", title: "Só desta vez", sub: "Uma vez, nesta data" },
    { r: "fixa", title: "Todo mês", sub: "Repete até você cancelar" },
    ...(credit ? [{ r: "parcelado" as Repeat, title: "Parcelado", sub: "Dividido nas faturas do cartão" }] : []),
  ];
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <SheetHead title="Repetição" onClose={onClose} />
        <View style={{ marginTop: 8 }}>
          {rows.map((row, i) => {
            const on = row.r === "parcelado" ? split || value === "parcelado" : !split && value === row.r;
            return (
              <Pressable
                key={row.r}
                onPress={() => {
                  if (row.r === "parcelado") setSplit(true);
                  else {
                    setSplit(false);
                    onPick(row.r);
                  }
                }}
                style={({ pressed }) => ({
                  height: 62,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 4,
                  borderBottomWidth: i === rows.length - 1 ? 0 : 1,
                  borderBottomColor: th("rgba(255,255,255,0.07)", "line"),
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>{row.title}</Text>
                  <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>{row.sub}</Text>
                </View>
                <CheckDot on={on} />
              </Pressable>
            );
          })}
        </View>
        {credit && split && (
          <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {Array.from({ length: 11 }, (_, i) => i + 2).map((p) => {
                const on = value === "parcelado" && p === parts;
                return (
                  <Pressable
                    key={p}
                    onPress={() => onPick("parcelado", p)}
                    style={({ pressed }) => ({
                      height: 56,
                      minWidth: 72,
                      paddingHorizontal: 12,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: th(on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)", "line"),
                      backgroundColor: th(on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", "bg"),
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800", color: th("#fff") }}>{`${p}x`}</Text>
                    {cents > 0 ? <Text style={[nums, { fontSize: 11.5, color: th(INK.soft) }]}>{money(cents / 100 / p)}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

function NoteSheet({ open, value, onSave, onClose }: { open: boolean; value: string; onSave: (t: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <SheetHead title="Observação" onClose={onClose} />
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          multiline
          placeholder="Um detalhe para lembrar depois"
          placeholderTextColor={th(INK.softer)}
          style={[
            {
              marginTop: 14,
              height: 100,
              padding: 14,
              borderRadius: 18,
              fontSize: 16,
              textAlignVertical: "top",
              color: th("#fff"),
              backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
            },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
          ]}
        />
        <Pressable
          onPress={() => onSave(text.trim())}
          style={({ pressed }) => ({ marginTop: 12, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}>Salvar</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

