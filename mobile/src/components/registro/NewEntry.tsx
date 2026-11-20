import { useEffect, useMemo, useRef, useState, type ComponentRef, type ComponentType } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { colorFor } from "@/lib/banks";
import { categoryHex } from "@/lib/categoryData";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import BankMark from "~/components/BankMark";
import BottomSheet from "~/components/BottomSheet";
import CategoryPicker from "~/components/CategoryPicker";
import RaisedButton from "~/components/RaisedButton";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { isoOf, todayIso } from "~/components/registro/EntryForm";
import { invoiceMonthOf, MONTH_NAMES, type Account, type Card } from "~/components/registro/entryParts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Delete,
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
import { tallSheetBody } from "~/lib/sheetRoom";
import { sheetWave } from "~/lib/sheetWave";
import { playCash, preloadCash } from "~/lib/sounds";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INCOME, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * A new entry, from the "+": one sheet, nearly the whole screen, everything in one card.
 *
 * At the top, close, Despesa or Receita, and more. Then the card. At its top the account,
 * small — a tap opens "Selecionar conta", where Débito or Crédito is chosen and then the
 * account or the card — and across from it a switch for whether it is already paid. In the
 * middle the amount, big; under it what it was, typed in place, with its category found from
 * the words. Then the day in one corner and how often in the other. At the foot the app's own number keys, with no boxes
 * around them (they step aside while the phone's keyboard is up for the name). Salvar
 * leads to the check of what will be written, confirmed by sliding; then the success in the
 * same card, a wave of green light running from its check through the whole sheet, with
 * confetti and the coin.
 */

type Kind = "despesa" | "receita";
type Method = "conta" | "cartao";
type Stage = "edit" | "confirm" | "done";
type Repeat = "unica" | "fixa" | "parcelado";
type Sheet = null | "conta" | "data" | "repetir" | "nota";
type Acc = Account & { current_balance?: number | string | null };
type Option = Acc | Card;
type IconC = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const tick = () => void Haptics.selectionAsync().catch(() => undefined);
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
function centsOf(raw: string) {
  const [i, d = ""] = raw.split(",");
  return Number(i || "0") * 100 + Number(`${d}00`.slice(0, 2));
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
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<AnchorRect | null>(null);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  /** A category for the check: the words', else the Willo's guess if it answers quickly, else Outros. */
  const settleCategory = async () => {
    const t = name.trim();
    if (!t) return "Outros";
    let cat = await Promise.race([
      suggestCategory({ name: t, amount: value, type: kind }).catch(() => null),
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
    if (!category) {
      setBusy(true);
      const cat = await settleCategory();
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
    setStage("edit");
    setRaw("");
    setName("");
    setCategory(null);
    setByHand(false);
    setDate(todayIso());
    setRepeat("unica");
    setPending(false);
    setNote("");
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

  /* ── Done: the coin, the wave of light from the check, the confetti ── */
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (stage !== "done") return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    playCash();
  }, [stage]);

  const openMenu = () => {
    tick();
    moreRef.current?.measureInWindow((x, y, w, h) => setMenu({ left: x + w - 258, top: y, bottom: y + h, width: 258 }));
  };

  const hex = category ? categoryHex(category) : "#8A8F98";
  const CatIcon: IconC = category ? categoryIcon(category) : Sparkles;
  const rowH = compact ? 50 : 60;
  const repeatLabel = repeat === "fixa" ? "Todo mês" : n ? (cents > 0 ? `${n}x de ${money(value / n)}` : `${n}x`) : credit ? "À vista" : "Única";
  const paidLabel = ahead ? "Agendado" : pending ? (income ? "A receber" : "Pendente") : income ? "Recebido" : "Pago";
  /* What will be (and was) written, row by row: on the check and again on the success. */
  const details = [
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
    ...(!credit ? [{ label: "Situação", value: paidLabel }] : []),
    ...(note.trim() ? [{ label: "Observação", value: note.trim() }] : []),
  ].map((r, i, all) => (
    <DetailRow
      key={r.label}
      label={r.label}
      value={r.value}
      sub={"sub" in r ? r.sub : undefined}
      mark={"mark" in r ? (r.mark ?? null) : null}
      cat={"cat" in r ? r.cat : undefined}
      last={i === all.length - 1}
    />
  ));
  const accountNote = (o: Option) => {
    if ("limit" in o && o.limit != null) return `Disponível ${money(Number(o.limit) - (Number(o.used_limit) || 0))}`;
    if ("closing_day" in o && o.closing_day) return `Fecha dia ${o.closing_day}`;
    const b = balanceOf(o);
    return b != null ? `Saldo ${money(b)}` : "";
  };

  return (
    <Animated.View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
      style={[{ paddingHorizontal: 10, overflow: "hidden" }, heightStyle]}
    >
      {stage === "edit" && (
        <Animated.View key="edit" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ height: bodyH }}>
          <View style={{ height: 48, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <RaisedButton size={46} label="Fechar" onPress={onClose}>
              <X size={20} color={th("#fff")} strokeWidth={2.4} />
            </RaisedButton>
            {locked ? <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>Compra no cartão</Text> : <KindPill value={kind} onChange={changeKind} />}
            <View ref={moreRef} collapsable={false}>
              <RaisedButton size={46} label="Mais opções" onPress={openMenu}>
                <MoreHorizontal size={20} color={th("#fff")} strokeWidth={2.4} />
              </RaisedButton>
            </View>
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
            {/* The account, small, in the corner; whether it is paid across from it. */}
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
              {!credit && (
                <View
                  style={{
                    height: 42,
                    paddingLeft: 14,
                    paddingRight: 6,
                    borderRadius: 21,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: th("rgba(255,255,255,0.07)", "bg"),
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: th(ahead ? INK.soft : "#fff") }}>{ahead ? "Agendado" : income ? "Recebido" : "Pago"}</Text>
                  <Switch
                    value={!pending && !ahead}
                    disabled={ahead}
                    onValueChange={(on) => {
                      tick();
                      setPending(!on);
                    }}
                    accessibilityLabel={income ? "Já recebido" : "Já pago"}
                    trackColor={{ false: th("rgba(255,255,255,0.18)", "bg"), true: GREEN }}
                    ios_backgroundColor={th("rgba(255,255,255,0.18)", "bg")}
                    thumbColor="#FFFFFF"
                    style={Platform.OS === "ios" ? { transform: [{ scale: 0.82 }] } : undefined}
                  />
                </View>
              )}
            </View>

            {/* The amount, and under it what it was, with its category. */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
              <Amount raw={raw} income={income} size={typing ? 42 : compact ? 56 : 72} />
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                placeholder={income ? "De onde veio?" : "Com o que foi?"}
                placeholderTextColor={th(INK.faint)}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                textAlign="center"
                style={[
                  { alignSelf: "stretch", marginTop: typing ? 4 : 10, padding: 0, height: 34, textAlign: "center", fontSize: 20, fontWeight: "600", color: th("#fff") },
                  Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
                ]}
              />
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
            </View>

            {/* When, in one corner; how often, in the other. */}
            <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <SmallChip
                icon={CalendarDays}
                label={dayShort(date)}
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet("data");
                }}
              />
              <SmallChip
                icon={RepeatIcon}
                label={repeatLabel}
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet("repetir");
                }}
              />
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
          <View style={{ height: 48, flexDirection: "row", alignItems: "center" }}>
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
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: th("#fff") }}>Confirme</Text>
            <View style={{ width: 46 }} />
          </View>

          <View style={{ marginTop: 36, alignItems: "center" }}>
            <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
              {income ? <ArrowDownLeft size={14} color={th(INCOME)} strokeWidth={2.4} /> : <ArrowUpRight size={14} color={th(INK.soft)} strokeWidth={2.4} />}
              <Text style={{ fontSize: 13, fontWeight: "700", color: th(INK.soft) }}>{income ? "Receita" : credit ? "Despesa no crédito" : "Despesa"}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 12, fontSize: 58, fontWeight: "800", letterSpacing: -2, color: th(income ? INCOME : "#fff") }]}>
              {money(value)}
            </Text>
            {n ? <Text style={[nums, { marginTop: 2, fontSize: 14, color: th(INK.soft) }]}>{`${n}x de ${money(value / n)}`}</Text> : null}
          </View>

          <View style={{ marginTop: 24, paddingHorizontal: 16, paddingVertical: 2, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.09)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
            {details}
          </View>

          {error && <Text style={{ marginTop: 10, textAlign: "center", fontSize: 13.5, color: th(RED) }}>{error}</Text>}

          <View style={{ marginTop: 24 }}>
            <SwipeToConfirm key={tries} label="Deslize para confirmar" busy={saving} onDone={() => void register()} />
          </View>
        </Animated.View>
      )}

      {stage === "done" && (
        <Animated.View key="done" onLayout={measure} entering={FadeIn.duration(reduce ? 200 : 260)} style={{ paddingHorizontal: 10, paddingBottom: 6 }}>
          <View style={{ height: 48 }} />
          <View style={{ alignItems: "center" }}>
            <SuccessMark onPlaced={reduce ? undefined : sheetWave} />
            <Text style={{ marginTop: 6, height: 18, fontSize: 14.5, lineHeight: 18, fontWeight: "700", color: th(INK.soft) }}>{income ? "Receita registrada" : "Despesa registrada"}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 0, fontSize: 58, fontWeight: "800", letterSpacing: -2, color: th(income ? INCOME : "#fff") }]}>
              {money(value)}
            </Text>
            {n ? <Text style={[nums, { marginTop: 2, fontSize: 14, color: th(INK.soft) }]}>{`${n}x de ${money(value / n)}`}</Text> : null}
          </View>

          <View style={{ marginTop: 24, paddingHorizontal: 16, paddingVertical: 2, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.09)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
            {details}
          </View>

          <View style={{ marginTop: 24 }}>
            <Pressable onPress={onClose} style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}>
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
        type={kind}
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
        {onScan && !income && (
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

function SmallChip({ icon: Icon, iconColor, label, onPress, disabled }: { icon: IconC; iconColor?: string; label: string; onPress: () => void; disabled?: boolean }) {
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

/** "R$ 1.250,50" as typed, the cents filled in; faint only while nothing is typed. */
function Amount({ raw, income, size }: { raw: string; income: boolean; size: number }) {
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

/** The check, popping in as the wave leaves it; laid out, it says where the wave starts. */
function SuccessMark({ onPlaced }: { onPlaced?: (x: number, y: number) => void }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const sent = useRef(false);
  const s = useSharedValue(0.3);
  const o = useSharedValue(0);
  useEffect(() => {
    s.set(withDelay(240, withSpring(1, { duration: 520, dampingRatio: 0.55 })));
    o.set(withDelay(240, withTiming(1, { duration: 180 })));
  }, [s, o]);
  const pop = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => {
        if (!onPlaced || sent.current) return;
        sent.current = true;
        ref.current?.measureInWindow((x, y, w, h) => onPlaced(x + w / 2, y + h / 2));
      }}
      style={{ width: 52, height: 52 }}
    >
      <Animated.View
        style={[
          {
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: GREEN,
            shadowColor: "#67CD67",
            shadowOpacity: 0.6,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
          },
          pop,
        ]}
      >
        <Check size={28} color="#0B0B0B" strokeWidth={3.4} />
      </Animated.View>
    </View>
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
    clock.set(withDelay(420, withTiming(4, { duration: 4000, easing: Easing.linear })));
  }, [clock]);
  const bits = useMemo<Bit[]>(() => {
    let s = Math.floor(Math.random() * 1e9) >>> 0;
    const r = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    return Array.from({ length: 56 }, () => ({
      x0: w / 2 + (r() - 0.5) * 30,
      y0: 74 + (r() - 0.5) * 20,
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

