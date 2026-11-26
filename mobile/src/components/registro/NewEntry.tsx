import { useEffect, useRef, useState, type ComponentType } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, readEntry, type ParsedEntry } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { colorFor } from "@/lib/banks";
import { categoryHex } from "@/lib/categoryData";
import BankMark from "~/components/BankMark";
import BottomSheet from "~/components/BottomSheet";
import CategoryPicker from "~/components/CategoryPicker";
import Glass from "~/components/Glass";
import RaisedButton from "~/components/RaisedButton";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { isoOf, todayIso } from "~/components/registro/EntryForm";
import { MONTH_NAMES, type Account, type Card } from "~/components/registro/entryParts";
import {
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Delete,
  Mic,
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
import { tallSheetBody } from "~/lib/sheetRoom";
import TransactionExperience from "~/components/pass/TransactionExperience";
import { nowTime, passRows } from "~/components/pass/passTheme";
import { preloadCash, preloadConfirm } from "~/lib/sounds";
import { loudnessOf, MicrophoneDenied, useVoice } from "~/lib/voice";
import { useAuth } from "~/lib/auth";
import { GREEN, INCOME, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * A new entry, from the "+": one sheet, nearly the whole screen, everything in one card.
 *
 * At the top, close, Despesa or Receita, and the scanner for a receipt. Then the card. At its top the account,
 * small — a tap opens "Selecionar conta", where Débito or Crédito is chosen and then the
 * account or the card — and across from it the day. Over the amount, how often and a small
 * tag with its own switch for whether it is already paid; the amount, big; under it what it
 * was, typed in place, with its category found from the words. At the foot the app's own number keys, with no boxes
 * around them (they step aside while the phone's keyboard is up for the name). Salvar
 * leads to the check — "Confira antes de salvar" — where every line still opens what changes
 * it (Despesa or Receita is changed back on the entry); it is confirmed by sliding. Then the
 * success: a disc of glass whose check draws itself, how much, what it was, and the rest in
 * one quiet card. The check is saved by sliding its knob across; let go at the end, a soft
 * glow comes up at the sheet's foot and stays a moment while it is saved, then rises through
 * the sheet and out of its top — the money leaving the phone — and the success comes in behind
 * it, with a little confetti and the coin.
 *
 * The microphone after the name: spoken instead ("vinte reais na padaria"), the Willo fills in
 * what it heard and goes to the check; what was not said is filled there.
 */

type Kind = "despesa" | "receita";
type Method = "conta" | "cartao";
type Stage = "edit" | "confirm";
type Repeat = "unica" | "fixa" | "parcelado";
type Sheet = null | "conta" | "data" | "repetir" | "nome";
type Listen = "off" | "on" | "reading";
type Acc = Account & { current_balance?: number | string | null };
type Option = Acc | Card;
type IconC = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const tick = () => void Haptics.selectionAsync().catch(() => undefined);
const NOOP = () => undefined;
const yesterdayIso = () => isoOf(new Date(Date.now() - 86_400_000));
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const KINDS: { k: Kind; label: string }[] = [
  { k: "despesa", label: "Despesa" },
  { k: "receita", label: "Receita" },
];
const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [",", "0", "del"],
];

/** "1250,5" → 125050. */
export function centsOf(raw: string) {
  const [i, d = ""] = raw.split(",");
  return Number(i || "0") * 100 + Number(`${d}00`.slice(0, 2));
}
/** 125050 → "1250,5", the way it would have been typed. */
function rawOf(cents: number) {
  const i = Math.floor(cents / 100);
  const d = cents % 100;
  return d === 0 ? String(i) : `${i},${String(d).padStart(2, "0").replace(/0$/, "")}`;
}
/* Knowing when someone has stopped talking, as Registro rápido does. */
const QUIET_MS = 900;
const NOTHING_MS = 9000;
const LONGEST_MS = 30_000;
const ABOVE_FLOOR = 13;
const grouped = (i: string) => i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const capital = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function dayShort(iso: string) {
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

  const [stage, setStage] = useState<Stage>("edit");
  const [kind, setKind] = useState<Kind>("despesa");
  const [raw, setRaw] = useState("");
  const [method, setMethod] = useState<Method>(locked ? "cartao" : "conta");
  const [whereId, setWhereId] = useState<string | null>(cardId ?? null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [repeat, setRepeat] = useState<Repeat>("unica");
  const [parts, setParts] = useState(2);
  const [pending, setPending] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [picking, setPicking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  /* Continuing with nothing said about what it was: the field shows it is missing. */
  const [missing, setMissing] = useState(false);

  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const history = useRef<Record<string, string>>({});

  useEffect(() => {
    preloadCash();
    preloadConfirm();
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
  const how: Method = income ? "conta" : method;
  const credit = how === "cartao";
  const list: Option[] = credit ? cards : accounts;
  /* The default account (they come default first) or the first card, until another is chosen. */
  const where = whereId && list.some((o) => o.id === whereId) ? whereId : (list[0]?.id ?? null);
  const picked = list.find((o) => o.id === where) ?? null;
  const today = todayIso();
  const ahead = date > today;
  const status: "pago" | "pendente" = credit || ahead || pending ? "pendente" : "pago";
  const n = credit && repeat === "parcelado" && parts > 1 ? parts : null;
  const canSave = cents > 0 && !!picked;
  const title = capital(name.trim() || (category && category !== "Outros" ? category : income ? "Receita" : "Despesa"));

  /* ── The amount, on the app's keys ── */
  const press = (key: string) => {
    tick();
    setError(null);
    setRaw((r) => typeKey(r, key));
  };

  /* ── What it was: the category from the words, as they are typed ── */
  useEffect(() => {
    if (byHand) return;
    const t = name.trim();
    if (!t) return setCategory(null);
    const known = history.current[t.toLowerCase()];
    if (known) return setCategory(known);
    const local = parseLocal(`${t} ${Math.max(1, Math.round(cents / 100))}`, { today: todayIso(), categories, history: history.current })?.[0]?.category ?? null;
    setCategory(local && local !== "Outros" ? local : null);
  }, [name, categories, cents, byHand]);

  const changeKind = (k: Kind) => {
    if (k === kind) return;
    tick();
    setKind(k);
    setError(null);
    setCategory(null);
    setByHand(false);
    if (k === "receita") {
      setMethod("conta");
      if (repeat === "parcelado") setRepeat("unica");
    }
  };

  /**
   * A category for the check: the person's own past choice for these words, else the
   * words' own, else the Willo's guess if it answers quickly, else Outros.
   */
  const settleCategory = async (words: string = name, type: Kind = kind) => {
    const t = words.trim();
    if (!t) return "Outros";
    const known = history.current[t.toLowerCase()];
    if (known) return known;
    const local = parseLocal(`${t} ${Math.max(1, Math.round(cents / 100))}`, { today: todayIso(), categories, history: history.current })?.[0]?.category ?? null;
    if (local && local !== "Outros") return local;
    let cat = await Promise.race([
      suggestCategory({ name: t, amount: value, type }).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (cat && !categories.includes(cat)) cat = null;
    return cat ?? "Outros";
  };

  const goConfirm = async () => {
    if (!canSave || busy) return;
    Keyboard.dismiss();
    setError(null);
    /* What it was, before anything else: the category is worked out from it. */
    if (!name.trim() && !category) {
      setMissing(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    if (credit) {
      const card = cards.find((c) => c.id === where);
      const room = card?.limit != null ? Number(card.limit) - (Number(card.used_limit) || 0) : null;
      if (room !== null && value > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível.`);
        return;
      }
    }
    if (!category) {
      setBusy(true);
      const cat = await settleCategory();
      setBusy(false);
      setCategory(cat);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStage("confirm");
  };

  /**
   * Writes the entry under the review's own id (so a repeat finds it instead of writing a
   * second) and resolves only once the database has it; the Pass plays after that.
   */
  const register = async (id: string) => {
    if (!picked) throw new Error("no account");
    if (dryRun || !user) return { id, time: nowTime() };
    const tx = (await createTransaction(
      {
        id,
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
        observation: null,
      } as never,
      user.id,
    )) as { id: string; time?: string | null };
    window.dispatchEvent(new CustomEvent("transaction-created"));
    return { id: tx.id, time: tx.time ? String(tx.time).slice(0, 5) : nowTime() };
  };

  /* ── Spoken instead: the Willo fills in what it heard and goes to the check; what was not
     said stays as it was, to be filled there. ── */
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

  const cancelVoice = async () => {
    if (listenRef.current !== "on") return;
    setListen("off");
    await voice.cancel();
  };

  const applyHeard = async (e: ParsedEntry, transcript: string | null) => {
    const said = `${transcript ?? ""} ${e.name ?? ""}`.toLowerCase();
    const k: Kind = locked ? "despesa" : e.type === "receita" ? "receita" : "despesa";
    const m: Method = locked ? "cartao" : k === "receita" ? "conta" : (e.paymentMethod ?? method);
    const pool: Option[] = m === "cartao" ? cards : accounts;
    const named = locked ? null : pool.find((o) => o.name && said.includes(o.name.toLowerCase()));
    const words = e.name ? capital(e.name) : name;
    const heard = e.amount > 0 ? Math.round(e.amount * 100) : 0;
    const total = heard || cents;
    const cat = e.category && e.category !== "Outros" && categories.includes(e.category) ? e.category : words.trim() ? await settleCategory(words, k) : null;
    setKind(k);
    setMethod(m);
    if (named) setWhereId(named.id);
    if (heard) setRaw(rawOf(heard));
    setName(words);
    if (cat) {
      setCategory(cat);
      setByHand(true);
    }
    if (e.date) setDate(e.date);
    if (e.settled === false && m === "conta") setPending(true);
    if (m !== "cartao" && repeat === "parcelado") setRepeat("unica");
    setListen("off");
    if (total <= 0) {
      setError("Faltou o valor: diga de novo ou digite nos números.");
      return;
    }
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
      if (!first) {
        setListen("off");
        setError(transcript ? `Ouvi “${transcript}”, mas não entendi. Tente de novo.` : "Não entendi. Tente de novo.");
        return;
      }
      await applyHeard(first, transcript);
    } catch {
      setListen("off");
      setError("Não consegui entender agora. Tente de novo.");
    }
  };

  /* However the phone reports the volume (or does not), the listening never runs past its
     longest: it is read then, as if the button had been pressed. */
  useEffect(() => {
    if (listen !== "on") return;
    const t = setTimeout(() => void finishVoice(), LONGEST_MS);
    return () => clearTimeout(t);
    // finishVoice changes every render; only the listening starting matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen]);

  /* A short silence after speaking ends the listening; the button ends it too. */
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

  const [nameW, setNameW] = useState(0);

  /** Another one: the entry again, empty, today. */
  const again = () => {
    setStage("edit");
    setRaw("");
    setName("");
    setCategory(null);
    setByHand(false);
    setDate(todayIso());
    setRepeat("unica");
    setPending(false);
    setError(null);
  };

  /* ── The sheet's height: nearly the whole screen for the entry (riding the keyboard at
     once), and on the check and the success only what they hold, the sheet easing down to
     it and back up when the entry is opened again. ── */
  const [natural, setNatural] = useState(0);
  const sheetH = useSharedValue(bodyH);
  const lastStage = useRef<Stage>(stage);
  useEffect(() => {
    const target = stage === "edit" ? bodyH : natural || bodyH;
    const moved = lastStage.current !== stage;
    lastStage.current = stage;
    if (stage === "edit" && !moved) sheetH.set(target);
    else sheetH.set(withTiming(target, { duration: reduce ? 0 : 420, easing: Easing.out(Easing.cubic) }));
  }, [stage, bodyH, natural, reduce, sheetH]);
  const heightStyle = useAnimatedStyle(() => ({ height: sheetH.get() }));
  const measure = (e: { nativeEvent: { layout: { height: number } } }) => setNatural(Math.ceil(e.nativeEvent.layout.height));



  const hex = category ? categoryHex(category) : "#8A8F98";
  const CatIcon: IconC = category ? categoryIcon(category) : Sparkles;
  const rowH = compact ? 50 : 60;
  const repeatLabel = repeat === "fixa" ? "Todo mês" : n ? (cents > 0 ? `${n}x de ${money(value / n)}` : `${n}x`) : credit ? "À vista" : "Única";
  const paidLabel = ahead ? "Agendado" : pending ? (income ? "A receber" : "Pendente") : income ? "Recebido" : "Pago";
  const accountNote = (o: Option) => {
    if ("limit" in o && o.limit != null) return `Disponível ${money(Number(o.limit) - (Number(o.used_limit) || 0))}`;
    if ("closing_day" in o && o.closing_day) return `Fecha dia ${o.closing_day}`;
    const b = balanceOf(o);
    return b != null ? `Saldo ${money(b)}` : "";
  };

  return (
    <Animated.View style={[{ paddingHorizontal: 10, overflow: "hidden" }, heightStyle]}>
      {stage === "edit" && (
        <Animated.View key="edit" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ height: bodyH }}>
          <View style={{ height: 48, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <RaisedButton size={46} label="Fechar" onPress={onClose}>
              <X size={20} color={th("#fff")} strokeWidth={2.4} />
            </RaisedButton>
            {locked ? <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>Compra no cartão</Text> : <KindPill value={kind} onChange={changeKind} />}
            {onScan ? (
              <RaisedButton size={46} label="Ler comprovante com a câmera" onPress={onScan}>
                <ScanLine size={20} color={th("#fff")} strokeWidth={2.2} />
              </RaisedButton>
            ) : (
              <View style={{ width: 46 }} />
            )}
          </View>

          {/* Everything about it, in one card. */}
          <View
            style={{
              flex: 1,
              marginTop: 12,
              padding: 12,
              borderRadius: 34,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: th("rgba(255,255,255,0.08)", "line"),
              backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
            }}
          >
            {/* The account, small, in the corner; the day across from it. */}
            <View style={{ height: 42, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AccountChip
                option={picked}
                caption={credit ? "Crédito" : income ? "Recebe em" : "Débito"}
                placeholder={credit ? "Escolher cartão" : "Escolher conta"}
                disabled={locked}
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet("conta");
                }}
              />
              <View style={{ flex: 1 }} />
              <SmallChip
                icon={CalendarDays}
                label={dayShort(date)}
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet("data");
                }}
              />
            </View>

            {/* Over the amount, how often and whether it is paid; under it, what it was and its category. */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
              <View style={{ marginBottom: typing ? 2 : 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MiniChip
                  icon={RepeatIcon}
                  label={repeatLabel}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSheet("repetir");
                  }}
                />
                {!credit && (
                  <PaidTag
                    on={!pending && !ahead}
                    disabled={ahead}
                    label={ahead ? "Agendado" : pending ? (income ? "A receber" : "Pendente") : income ? "Recebido" : "Pago"}
                    onToggle={() => {
                      tick();
                      setPending((p) => !p);
                    }}
                  />
                )}
              </View>
              <Amount raw={raw} income={income} size={typing ? 42 : compact ? 56 : 72} />
              {listen !== "off" ? (
                <Recorder state={listen} loudness={loudnessOf(voice.level)} seconds={voice.seconds} onCancel={() => void cancelVoice()} onStop={() => void finishVoice()} />
              ) : (
                <>
                  {/* The name sized to its words, so the microphone sits right after them. */}
                  <View style={{ alignSelf: "stretch", alignItems: "center", marginTop: typing ? 4 : 10 }}>
                    <Text
                      numberOfLines={1}
                      onLayout={(e) => setNameW(Math.ceil(e.nativeEvent.layout.width))}
                      style={{ position: "absolute", opacity: 0, fontSize: 20, fontWeight: "600" }}
                    >
                      {name || (income ? "De onde veio?" : "Com o que foi?")}
                    </Text>
                    <View style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TextInput
                        value={name}
                        onChangeText={(t) => {
                          setName(t);
                          setError(null);
                          if (t.trim()) setMissing(false);
                        }}
                        onFocus={() => setTyping(true)}
                        onBlur={() => setTyping(false)}
                        placeholder={income ? "De onde veio?" : "Com o que foi?"}
                        placeholderTextColor={th(missing ? RED : INK.faint)}
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        textAlign="center"
                        style={[
                          { width: Math.min(Math.max(nameW + 8, 60), 250), height: 36, padding: 0, textAlign: "center", fontSize: 20, fontWeight: "600", color: th("#fff") },
                          Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
                        ]}
                      />
                      {missing && !name.trim() ? <CircleAlert size={18} color={th(RED)} strokeWidth={2.4} /> : null}
                      <Pressable
                        onPressIn={() => void startVoice()}
                        onPress={NOOP}
                        accessibilityLabel="Falar em vez de digitar"
                        hitSlop={8}
                        style={({ pressed }) => ({
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: th("rgba(255,255,255,0.12)", "line"),
                          backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Mic size={15} color={th("#fff")} strokeWidth={2.3} />
                      </Pressable>
                    </View>
                    {missing && !name.trim() ? (
                      <Text style={{ marginTop: 2, fontSize: 12.5, fontWeight: "600", color: th(RED) }}>{income ? "Informe de onde veio o dinheiro" : "Informe com o que você gastou"}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setPicking(true);
                    }}
                    accessibilityLabel={`Categoria: ${category ?? "automática"}. Trocar`}
                    hitSlop={6}
                    style={({ pressed }) => ({
                      marginTop: 8,
                      height: 32,
                      paddingLeft: 4,
                      paddingRight: 12,
                      borderRadius: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      backgroundColor: th(category ? chipFill(hex) : "rgba(255,255,255,0.06)", "bg"),
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
                      <CatIcon size={13} color={th(chipInk(hex))} strokeWidth={2.4} />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: category ? th(chipInk(hex)) : th(INK.soft) }}>
                      {category ?? "Categoria automática"}
                    </Text>
                    <ChevronDown size={13} color={th(INK.soft)} strokeWidth={2.4} />
                  </Pressable>
                </>
              )}
            </View>

            {/* The number keys, straight on the card; aside while the phone's keyboard is up. */}
            {!typing && <Keypad rowH={rowH} onKey={press} />}
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
            {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>Salvar</Text>}
          </Pressable>
        </Animated.View>
      )}

      {stage === "confirm" && (
        <Animated.View key="confirm" onLayout={measure} entering={FadeIn.duration(220)} exiting={FadeOut.duration(220)} style={{ paddingHorizontal: 10, paddingBottom: 6 }}>
          <TransactionExperience
            data={{
              kind: income ? "receita" : "despesa",
              amount: value,
              title,
              category: category ?? "Outros",
              rows: passRows({
                kind: income ? "receita" : "despesa",
                category: category ?? "Outros",
                bank: picked ? { name: picked.name, hex: colorFor(picked.name, picked.color) } : null,
                method: how,
                installments: n,
                date,
              }),
            }}
            onConfirm={register}
            onPhase={(p) => setSaving(p === "saving" || p === "flow")}
            onDone={onClose}
            links={[
              { icon: "novo", label: income ? "Registrar outra" : "Registrar outro", onPress: again },
              { icon: "transacoes", label: "Ver transações", onPress: onSeeTransactions },
            ]}
            left={
              <RaisedButton
                size={46}
                label="Voltar"
                onPress={() => {
                  if (saving) return;
                  setError(null);
                  setStage("edit");
                }}
              >
                <ChevronLeft size={21} color={th("#fff")} strokeWidth={2.4} />
              </RaisedButton>
            }
          />
        </Animated.View>
      )}

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
      <NameSheet
        open={sheet === "nome"}
        value={name}
        placeholder={income ? "De onde veio?" : "Com o que foi?"}
        onSave={(t) => {
          setName(t);
          setSheet(null);
          if (!byHand && t.trim()) void settleCategory(t).then(setCategory);
        }}
        onClose={() => setSheet(null)}
      />
      <CategoryPicker
        open={picking}
        value={category ?? ""}
        type={kind}
        onClose={() => setPicking(false)}
        onPick={(c: string) => {
          setCategory(c);
          setByHand(true);
          setPicking(false);
        }}
      />
    </Animated.View>
  );
}

/* ───────────────────────────── Pieces of the card ───────────────────────────── */

/** Despesa or Receita — the light slides to the one chosen. */
function KindPill({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  const [spots, setSpots] = useState<Partial<Record<Kind, { x: number; w: number }>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const spot = spots[value];
  useEffect(() => {
    if (!spot) return;
    if (w.get() === 0) {
      x.set(spot.x);
      w.set(spot.w);
      return;
    }
    x.set(withTiming(spot.x, { duration: 260, easing: Easing.out(Easing.cubic) }));
    w.set(withTiming(spot.w, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [spot, x, w]);
  const slide = useAnimatedStyle(() => ({ left: x.get(), width: w.get(), opacity: w.get() > 0 ? 1 : 0 }));
  const fill = th("rgba(255,255,255,0.15)", "bg");

  return (
    <View style={{ height: 46, flexDirection: "row", padding: 3, borderRadius: 23, borderWidth: 1, borderColor: th("rgba(255,255,255,0.08)", "line"), backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
      <Animated.View style={[{ position: "absolute", top: 3, bottom: 3, borderRadius: 19, backgroundColor: fill }, slide]} />
      {KINDS.map(({ k, label }) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onLayout={(e) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setSpots((s) => (s[k]?.x === lx && s[k]?.w === width ? s : { ...s, [k]: { x: lx, w: width } }));
            }}
            onPress={() => onChange(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ height: 38, paddingHorizontal: 18, borderRadius: 19, alignItems: "center", justifyContent: "center" }}
          >
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: on ? "700" : "600", color: th(on ? "#fff" : INK.soft) }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The account, small: its mark, its name, and Débito / Crédito under it. */
function AccountChip({ option, caption, placeholder, onPress, disabled }: { option: Option | null; caption: string; placeholder: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${option?.name ?? placeholder}. Trocar`}
      style={({ pressed }) => ({
        height: 42,
        flexShrink: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 5,
        paddingRight: 12,
        borderRadius: 21,
        backgroundColor: th("rgba(255,255,255,0.07)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {option ? (
        <BankMark name={option.name} hex={colorFor(option.name, option.color)} size={32} />
      ) : (
        <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
          <Wallet size={15} color={th(INK.soft)} strokeWidth={2.2} />
        </View>
      )}
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: th("#fff") }}>
          {option?.name ?? placeholder}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: "600", color: th(INK.soft) }}>
          {caption}
        </Text>
      </View>
      {!disabled && <ChevronDown size={13} color={th(INK.soft)} strokeWidth={2.4} />}
    </Pressable>
  );
}

export function SmallChip({ icon: Icon, iconColor, label, onPress, disabled }: { icon: IconC; iconColor?: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        height: 38,
        flexShrink: 1,
        paddingHorizontal: 14,
        borderRadius: 19,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={16} color={th(iconColor ?? INK.soft)} strokeWidth={2.2} />
      <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 14, fontWeight: "700", color: th("#fff") }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Over the amount: how often, small. */
function MiniChip({ icon: Icon, label, onPress }: { icon: IconC; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Repetição: ${label}. Trocar`}
      hitSlop={6}
      style={({ pressed }) => ({
        height: 32,
        paddingLeft: 11,
        paddingRight: 9,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={14} color={th(INK.soft)} strokeWidth={2.3} />
      <Text numberOfLines={1} style={[nums, { fontSize: 13, fontWeight: "700", color: th("#fff") }]}>
        {label}
      </Text>
      <ChevronDown size={12} color={th(INK.soft)} strokeWidth={2.4} />
    </Pressable>
  );
}

/** Over the amount: whether it is paid, a small tag with its own switch; the whole tag flips it. */
/** A small switch, green when on; it only shows, the row or tag around it does the flipping. */
function MiniSwitch({ on }: { on: boolean }) {
  const x = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    x.set(withTiming(on ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) }));
  }, [on, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * 12 }] }));
  const lit = useAnimatedStyle(() => ({ opacity: x.get() }));
  return (
    <View style={{ width: 30, height: 18, borderRadius: 9, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.2)", "bg") }}>
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: GREEN }, lit]} />
      <Animated.View style={[{ position: "absolute", top: 2, left: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF" }, knob]} />
    </View>
  );
}

function PaidTag({ on, label, disabled, onToggle }: { on: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        height: 32,
        paddingLeft: 11,
        paddingRight: 7,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
        opacity: disabled ? 0.6 : pressed ? 0.7 : 1,
      })}
    >
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: th("#fff") }}>
        {label}
      </Text>
      <MiniSwitch on={on} />
    </Pressable>
  );
}

/** "R$ 1.250,50" as typed, the cents filled in; faint only while nothing is typed. */
/** One key of the app's number keys, applied to what has been typed so far ("1250,5"). */
export function typeKey(r: string, key: string) {
  if (key === "clear") return "";
  if (key === "del") return r.slice(0, -1);
  if (key === ",") return r.includes(",") ? r : r === "" ? "0," : `${r},`;
  const [i, d] = r.split(",");
  if (d !== undefined) return d.length >= 2 ? r : r + key;
  if (i === "0" || i === "") return key === "0" && i === "0" ? r : key;
  return i.length >= 9 ? r : r + key;
}

export function Amount({ raw, income, size }: { raw: string; income: boolean; size: number }) {
  const [i, d] = raw.split(",");
  const empty = raw === "";
  const ink = th(empty ? "rgba(255,255,255,0.32)" : income ? INCOME : "#fff");
  const rest = d === undefined ? ",00" : "00".slice(d.length);
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", maxWidth: "100%" }}>
      <Text style={{ fontSize: Math.round(size * 0.42), fontWeight: "700", color: th(INK.soft), marginRight: 6 }}>R$</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[nums, { flexShrink: 1, fontSize: size, fontWeight: "800", letterSpacing: -size * 0.035, color: ink }]}>
        {grouped(empty ? "0" : i || "0")}
        {d !== undefined ? `,${d}` : ""}
        {d !== undefined && d.length === 0 ? "00" : rest}
      </Text>
    </View>
  );
}

/** The numbers on the sheet itself: no boxes; a soft light under a key only while pressed. */
export function Keypad({ rowH, onKey }: { rowH: number; onKey: (k: string) => void }) {
  const ink = th("#fff");
  const pressFill = th("rgba(255,255,255,0.09)", "bg");
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ marginTop: 6 }}>
      {KEYS.map((row) => (
        <View key={row.join()} style={{ flexDirection: "row" }}>
          {row.map((k) => (
            <Pressable
              key={k}
              /* On the touch itself, not its lifting: the sheet's own gesture could take a touch
                 over before it lifted, and the first press of a key went unheard. */
              onPressIn={() => onKey(k)}
              /* Kept so the key is always taken as a button; the figure moved on the touch. */
              onPress={NOOP}
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

/* ───────────────────────────── The check ───────────────────────────── */

/* ───────────────────────────── Done ───────────────────────────── */

/** Recording, the way a voice message is: cancel, the time, the voice's own bars, and send. */
function Recorder({ state, loudness, seconds, onCancel, onStop }: { state: Listen; loudness?: number; seconds: number; onCancel: () => void; onStop: () => void }) {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 26 }, () => 0.05));
  useEffect(() => {
    if (state !== "on") return;
    setBars((b) => [...b.slice(1), Math.max(0.05, loudness ?? 0)]);
  }, [loudness, state]);
  const dot = useSharedValue(1);
  useEffect(() => {
    dot.set(withRepeat(withTiming(0.3, { duration: 620 }), -1, true));
    return () => cancelAnimation(dot);
  }, [dot]);
  const blink = useAnimatedStyle(() => ({ opacity: dot.get() }));
  const ink = th("rgba(255,255,255,0.85)");
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={{ alignSelf: "stretch", marginTop: 12, height: 52, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: th("rgba(255,255,255,0.12)", "line") }}
    >
      <Glass radius={26} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 5 }}>
        {state === "reading" ? (
          <>
            <ActivityIndicator style={{ marginLeft: 12 }} color={th("#fff")} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
              Entendendo o que você disse…
            </Text>
          </>
        ) : (
          <>
            <Pressable
              onPress={onCancel}
              accessibilityLabel="Cancelar gravação"
              hitSlop={4}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: pressed ? 0.6 : 1 })}
            >
              <X size={17} color={th("#fff")} strokeWidth={2.4} />
            </Pressable>
            <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: RED }, blink]} />
            <Text style={[nums, { width: 34, fontSize: 14, fontWeight: "700", color: th("#fff") }]}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</Text>
            <View style={{ flex: 1, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2.5, overflow: "hidden" }}>
              {bars.map((v, i) => (
                <View key={i} style={{ width: 3, height: 3 + v * 26, borderRadius: 1.5, backgroundColor: ink }} />
              ))}
            </View>
            <Pressable
              onPress={onStop}
              accessibilityLabel="Parar e preencher"
              hitSlop={4}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.8 : 1 })}
            >
              <ArrowUp size={19} color={th("#0B0B0B")} strokeWidth={2.6} />
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
  );
}

/** The check, in a disc of glass with a soft green light inside; it pops in and draws itself. */
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
export function AccountSheet({
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

export function DateSheet({ open, value, onPick, onClose }: { open: boolean; value: string; onPick: (iso: string) => void; onClose: () => void }) {
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

/** The name, changed from the check. */
function NameSheet({ open, value, placeholder, onSave, onClose }: { open: boolean; value: string; placeholder: string; onSave: (t: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (open) setText(value);
  }, [open, value]);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <SheetHead title="Descrição" onClose={onClose} />
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder={placeholder}
          placeholderTextColor={th(INK.softer)}
          returnKeyType="done"
          onSubmitEditing={() => onSave(text.trim())}
          style={[
            { marginTop: 14, height: 56, paddingHorizontal: 16, borderRadius: 18, fontSize: 18, fontWeight: "600", color: th("#fff"), backgroundColor: th("rgba(255,255,255,0.06)", "bg") },
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
