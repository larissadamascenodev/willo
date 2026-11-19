import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent, type TextStyle } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { colorFor } from "@/lib/banks";
import { categoryHex } from "@/lib/categoryData";
import BankMark from "~/components/BankMark";
import AccountSelect from "~/components/AccountSelect";
import CategoryPicker from "~/components/CategoryPicker";
import { todayIso, isoOf } from "~/components/registro/EntryForm";
import { invoiceMonthOf, MONTH_NAMES, type Account, type Card } from "~/components/registro/entryParts";
import { Check, ChevronLeft, CreditCard, Delete, Landmark, ScanLine, X } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { suggestCategory } from "~/lib/categorize";
import { money } from "~/lib/money";
import { playCash, preloadCash } from "~/lib/sounds";
import { useAuth } from "~/lib/auth";
import { GREEN, INCOME, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * A new entry, amount first.
 *
 * It opens on the amount, typed on the app's own keys — no phone keyboard over half the
 * sheet — with, above the keys, how it was paid: Débito or Crédito. Choosing one replaces
 * the pill with the accounts (or the cards) to pick from, side by side when there are a
 * couple, in a list that opens upward when there are more; picked, the row becomes one
 * pill saying where the money came from, tap it to change. Then the name, with the
 * category found from the words as they are typed. Confirmar, and a ring of light runs
 * through the sheet — whatever its height — leaving the receipt in its place: what was
 * registered, the amount, when, from where.
 */

type Kind = "despesa" | "receita";
type Method = "conta" | "cartao";
type Stage = "amount" | "name" | "done";

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const tick = () => void Haptics.selectionAsync().catch(() => undefined);
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoOf(d);
};
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SHORT_MONTH = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export default function AmountFirstFlow({
  cardId,
  onScan,
  onClose,
  onSeeTransactions,
  dryRun,
}: {
  /** For looking at the flow only: nothing is written. */
  dryRun?: boolean;
  /** Started inside a card: a purchase on it, neither asked. */
  cardId?: string | null;
  /** Reads a receipt with the camera instead. */
  onScan?: () => void;
  onClose: () => void;
  onSeeTransactions: () => void;
}) {
  const { user } = useAuth();
  const locked = !!cardId;
  const [stage, setStage] = useState<Stage>("amount");
  const [kind, setKind] = useState<Kind>("despesa");
  const [cents, setCents] = useState(0);
  const [method, setMethod] = useState<Method | null>(locked ? "cartao" : null);
  const [whereId, setWhereId] = useState<string | null>(cardId ?? null);
  const [parts, setParts] = useState(1);
  const [choosingParts, setChoosingParts] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [categoryByHand, setCategoryByHand] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const history = useRef<Record<string, string>>({});

  useEffect(() => {
    preloadCash();
    getAccounts()
      .then((list) => setAccounts((list as unknown as Account[]).filter((a) => a.type !== "investment")))
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

  const income = kind === "receita";
  const how: Method | null = income ? "conta" : method;
  const list: (Account | Card)[] = how === "cartao" ? cards : how === "conta" ? accounts : [];
  /* One account (or one card) is the answer by itself. */
  const where = whereId && list.some((o) => o.id === whereId) ? whereId : list.length === 1 ? list[0].id : null;
  const picked = list.find((o) => o.id === where) ?? null;
  const credit = how === "cartao";

  /* ── The amount, on the app's keys: digits push in from the right, cents first. ── */
  const press = (key: string) => {
    tick();
    setError(null);
    if (key === "del") return setCents((c) => Math.floor(c / 10));
    if (key === "00") return setCents((c) => (c * 100 > 99_999_999_99 ? c : c * 100));
    setCents((c) => {
      const next = c * 10 + Number(key);
      return next > 99_999_999_99 ? c : next;
    });
  };

  /* ── What it was: the category from the words, as they are typed. ── */
  useEffect(() => {
    if (categoryByHand) return;
    const t = name.trim();
    if (!t) return setCategory(null);
    const known = history.current[t.toLowerCase()];
    if (known) return setCategory(known);
    const local = parseLocal(`${t} ${Math.max(1, Math.round(cents / 100))}`, { today: todayIso(), categories, history: history.current })?.[0]?.category ?? null;
    setCategory(local && local !== "Outros" ? local : null);
  }, [name, categories, cents, categoryByHand]);

  const canGoOn = cents > 0 && !!how && !!where;

  const register = async () => {
    if (!user || !how || !where || cents <= 0 || !name.trim() || saving) return;
    Keyboard.dismiss();
    const n = credit && parts > 1 ? parts : null;
    if (credit) {
      const card = cards.find((c) => c.id === where);
      const room = card?.limit != null ? Number(card.limit) - (Number(card.used_limit) || 0) : null;
      if (room !== null && cents / 100 > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    let cat = category;
    if (!cat) {
      /* Nothing in the words: Willo's guess, if it answers quickly; else Outros. */
      cat = await Promise.race([
        suggestCategory({ name: name.trim(), amount: cents / 100, type: kind }).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 2500)),
      ]);
      if (cat && !categories.includes(cat)) cat = null;
      setCategory(cat ?? "Outros");
    }
    try {
      if (dryRun) {
        setStage("done");
        return;
      }
      await createTransaction(
        {
          name: name.trim().replace(/^./, (c) => c.toUpperCase()),
          type: kind,
          amount: n ? Math.round(cents / n) / 100 : cents / 100,
          category: cat ?? "Outros",
          date,
          status: credit || date > todayIso() ? "pendente" : "pago",
          payment_method: how,
          account_id: how === "conta" ? where : null,
          credit_card_id: credit ? where : null,
          recurrence_type: n ? "parcelado" : "unica",
          installments: n,
          installment_current: n ? 1 : null,
          observation: null,
        } as never,
        user.id,
      );
      window.dispatchEvent(new CustomEvent("transaction-created"));
      setStage("done");
    } catch {
      setError("Não consegui salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  /* ── The light that runs through the sheet when it is paid ── */
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const [glowing, setGlowing] = useState(false);
  useEffect(() => {
    if (stage !== "done") return;
    setGlowing(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    playCash();
    const t = setTimeout(() => setGlowing(false), 2200);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <View onLayout={onLayout} style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 6 }}>
      {stage === "amount" && (
        <Animated.View key="amount" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <AmountStage
            kind={kind}
            onKind={(k) => {
              tick();
              setKind(k);
              setMethod(locked ? "cartao" : null);
              setWhereId(cardId ?? null);
              setParts(1);
              setChoosingParts(false);
            }}
            locked={locked}
            cents={cents}
            onKey={press}
            how={how}
            list={list}
            where={where}
            picked={picked}
            parts={parts}
            choosingParts={choosingParts}
            onMethod={(m) => {
              tick();
              setMethod(m);
              setWhereId(null);
              setParts(1);
            }}
            onWhere={(id) => setWhereId(id)}
            onChange={() => {
              tick();
              if (!locked && !income) setMethod(null);
              setWhereId(locked ? (cardId ?? null) : null);
              setChoosingParts(false);
            }}
            onPartsOpen={() => {
              tick();
              setChoosingParts(true);
            }}
            onParts={(n) => {
              tick();
              setParts(n);
              setChoosingParts(false);
            }}
            onScan={onScan}
            onNext={() => {
              if (!canGoOn) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setStage("name");
            }}
            canGoOn={canGoOn}
          />
        </Animated.View>
      )}

      {stage === "name" && (
        <Animated.View key="name" entering={FadeIn.duration(220)} exiting={FadeOut.duration(420)}>
          <NameStage
            income={income}
            cents={cents}
            parts={credit ? parts : 1}
            payLabel={payLabel(income, credit, picked)}
            name={name}
            onName={(t) => {
              setName(t);
              setError(null);
            }}
            category={category}
            onPickCategory={() => {
              Keyboard.dismiss();
              setPicking(true);
            }}
            date={date}
            onDate={(d) => {
              tick();
              setDate(d);
            }}
            onBack={() => {
              Keyboard.dismiss();
              setStage("amount");
            }}
            onConfirm={() => void register()}
            saving={saving}
            error={error}
          />
        </Animated.View>
      )}

      {stage === "done" && (
        <Receipt
          income={income}
          cents={cents}
          parts={credit && parts > 1 ? parts : 0}
          name={name.trim().replace(/^./, (c) => c.toUpperCase())}
          category={category ?? "Outros"}
          date={date}
          credit={credit}
          picked={picked}
          closingDay={credit ? ((picked as Card | null)?.closing_day ?? null) : null}
          onDone={onClose}
          onSeeTransactions={onSeeTransactions}
        />
      )}

      {error && stage === "amount" && <Text style={{ marginTop: 8, textAlign: "center", fontSize: 13.5, color: th(RED) }}>{error}</Text>}

      {glowing && box.w > 0 && <PaidGlow w={box.w} h={box.h} />}

      <CategoryPicker
        open={picking}
        value={category ?? ""}
        type={kind}
        onClose={() => setPicking(false)}
        onPick={(c: string) => {
          setCategory(c);
          setCategoryByHand(true);
          setPicking(false);
        }}
      />
    </View>
  );
}

function payLabel(income: boolean, credit: boolean, picked: Account | Card | null) {
  if (!picked) return "";
  if (income) return `Entra em ${picked.name}`;
  return `${credit ? "Crédito" : "Débito"} · ${picked.name}`;
}

/* ───────────────────────────── 1 · The amount ───────────────────────────── */

function AmountStage({
  kind,
  onKind,
  locked,
  cents,
  onKey,
  how,
  list,
  where,
  picked,
  parts,
  choosingParts,
  onMethod,
  onWhere,
  onChange,
  onPartsOpen,
  onParts,
  onScan,
  onNext,
  canGoOn,
}: {
  kind: Kind;
  onKind: (k: Kind) => void;
  locked: boolean;
  cents: number;
  onKey: (k: string) => void;
  how: Method | null;
  list: (Account | Card)[];
  where: string | null;
  picked: Account | Card | null;
  parts: number;
  choosingParts: boolean;
  onMethod: (m: Method) => void;
  onWhere: (id: string) => void;
  onChange: () => void;
  onPartsOpen: () => void;
  onParts: (n: number) => void;
  onScan?: () => void;
  onNext: () => void;
  canGoOn: boolean;
}) {
  const income = kind === "receita";
  const credit = how === "cartao";
  const value = cents / 100;

  return (
    <View>
      {/* Gasto or Entrada, small, and the camera for a receipt. */}
      <View style={{ height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {!locked && (
          <View style={{ flexDirection: "row", padding: 3, borderRadius: 18, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
            {(["despesa", "receita"] as Kind[]).map((k) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => onKind(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ height: 30, paddingHorizontal: 16, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("rgba(255,255,255,0.16)", "bg") : "transparent" }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: th(on ? "#fff" : INK.soft) }}>{k === "despesa" ? "Gasto" : "Entrada"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {locked && <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: th("rgba(255,255,255,0.72)") }}>NO CARTÃO</Text>}
        {onScan && (
          <Pressable onPress={onScan} accessibilityLabel="Ler comprovante com a câmera" hitSlop={8} style={({ pressed }) => ({ position: "absolute", right: 0, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: pressed ? 0.6 : 1 })}>
            <ScanLine size={18} color={th("rgba(255,255,255,0.8)")} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      {/* The amount itself. */}
      <View style={{ marginTop: 18, alignItems: "center" }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[nums, { fontSize: 56, fontWeight: "800", letterSpacing: -2, color: th(cents === 0 ? "rgba(255,255,255,0.32)" : income ? INCOME : "#fff") }]}
        >
          {money(value)}
        </Text>
        {credit && parts > 1 && cents > 0 && <Text style={[nums, { marginTop: 2, fontSize: 14, color: th(INK.soft) }]}>{`${parts}x de ${money(value / parts)}`}</Text>}
      </View>

      {/* How it was paid: one row that changes in place. */}
      <View style={{ marginTop: 16, minHeight: 52, justifyContent: "center" }}>
        {!how ? (
          <Animated.View key="method" entering={FadeIn.duration(180)} style={{ flexDirection: "row", gap: 10 }}>
            <MethodPill icon={<Landmark size={17} color={th("#fff")} strokeWidth={2.2} />} label="Débito" onPress={() => onMethod("conta")} />
            <MethodPill icon={<CreditCard size={17} color={th("#fff")} strokeWidth={2.2} />} label="Crédito" onPress={() => onMethod("cartao")} />
          </Animated.View>
        ) : choosingParts ? (
          <Animated.View key="parts" entering={FadeIn.duration(180)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => onParts(n)}
                  style={({ pressed }) => ({ height: 48, minWidth: 64, paddingHorizontal: 14, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th(n === parts ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.12)", "line"), backgroundColor: th(n === parts ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", "bg"), opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>{n === 1 ? "À vista" : `${n}x`}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : !where ? (
          <Animated.View key="where" entering={FadeIn.duration(180)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!locked && !income && (
              <Pressable onPress={onChange} accessibilityLabel="Trocar entre débito e crédito" hitSlop={6} style={({ pressed }) => ({ width: 44, height: 48, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.06)", "bg"), opacity: pressed ? 0.6 : 1 })}>
                <ChevronLeft size={18} color={th("#fff")} strokeWidth={2.4} />
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              {list.length === 0 ? (
                <Text style={{ fontSize: 14, color: th(INK.soft) }}>{credit ? "Nenhum cartão cadastrado ainda." : "Nenhuma conta cadastrada ainda."}</Text>
              ) : (
                <AccountSelect
                  options={list.map((o) => ({ id: o.id, name: o.name, color: colorFor(o.name, o.color) }))}
                  value={where}
                  onChange={onWhere}
                  title={credit ? "Em qual cartão?" : income ? "Em qual conta entrou?" : "De qual conta saiu?"}
                  placeholder={credit ? "Escolher cartão" : "Escolher conta"}
                />
              )}
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="picked" entering={FadeIn.duration(180)} style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onChange}
              accessibilityLabel="Trocar a conta ou o cartão"
              style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: 26, paddingLeft: 6, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: th("rgba(255,255,255,0.14)", "line"), backgroundColor: th("rgba(255,255,255,0.07)", "bg"), opacity: pressed ? 0.7 : 1 })}
            >
              {picked && <BankMark name={picked.name} hex={colorFor(picked.name, picked.color)} size={40} />}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "700", color: th("#fff") }}>
                {payLabel(income, credit, picked)}
              </Text>
              <X size={15} color={th(INK.soft)} strokeWidth={2.4} />
            </Pressable>
            {credit && (
              <Pressable
                onPress={onPartsOpen}
                accessibilityLabel="Parcelas"
                style={({ pressed }) => ({ height: 52, paddingHorizontal: 18, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th("rgba(255,255,255,0.14)", "line"), backgroundColor: th("rgba(255,255,255,0.07)", "bg"), opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>{parts > 1 ? `${parts}x` : "À vista"}</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
      </View>

      {/* The app's own keys. */}
      <View style={{ marginTop: 16, gap: 8 }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["00", "0", "del"],
        ].map((row) => (
          <View key={row.join()} style={{ flexDirection: "row", gap: 8 }}>
            {row.map((k) => (
              <Pressable
                key={k}
                onPress={() => onKey(k)}
                onLongPress={k === "del" ? () => { for (let i = 0; i < 12; i++) onKey("del"); } : undefined}
                accessibilityLabel={k === "del" ? "Apagar" : k}
                style={({ pressed }) => ({ flex: 1, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: th(pressed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", "bg") })}
              >
                {k === "del" ? (
                  <Delete size={24} color={th("#fff")} strokeWidth={2} />
                ) : (
                  <Text style={[nums, { fontSize: 26, fontWeight: "600", color: th("#fff") }]}>{k}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onNext}
        disabled={!canGoOn}
        style={({ pressed }) => ({ marginTop: 14, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: !canGoOn ? 0.35 : pressed ? 0.85 : 1 })}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>Continuar</Text>
      </Pressable>
    </View>
  );
}

function MethodPill({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: th("rgba(255,255,255,0.14)", "line"), backgroundColor: th("rgba(255,255,255,0.07)", "bg"), opacity: pressed ? 0.7 : 1 })}
    >
      {icon}
      <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>{label}</Text>
    </Pressable>
  );
}

/* ───────────────────────────── 2 · What it was ───────────────────────────── */

function NameStage({
  income,
  cents,
  parts,
  payLabel: pay,
  name,
  onName,
  category,
  onPickCategory,
  date,
  onDate,
  onBack,
  onConfirm,
  saving,
  error,
}: {
  income: boolean;
  cents: number;
  parts: number;
  payLabel: string;
  name: string;
  onName: (t: string) => void;
  category: string | null;
  onPickCategory: () => void;
  date: string;
  onDate: (d: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
  error: string | null;
}) {
  const hex = category ? categoryHex(category) : "#8A8F98";
  const Icon = categoryIcon(category ?? "Outros");
  const today = todayIso();
  const ontem = yesterday();
  return (
    <View>
      <View style={{ height: 40, justifyContent: "center" }}>
        <Pressable onPress={onBack} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ position: "absolute", left: 0, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: pressed ? 0.6 : 1 })}>
          <ChevronLeft size={18} color={th("#fff")} strokeWidth={2.4} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={[nums, { fontSize: 17, fontWeight: "800", color: th(income ? INCOME : "#fff") }]}>{money(cents / 100)}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.soft) }}>{pay}{parts > 1 ? ` · ${parts}x` : ""}</Text>
        </View>
      </View>

      <Text style={{ marginTop: 22, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>{income ? "De onde veio?" : "Com o que foi?"}</Text>
      <TextInput
        value={name}
        onChangeText={onName}
        autoFocus
        placeholder={income ? "Ex.: salário, freela, Pix da Ana" : "Ex.: padaria, Uber, mercado"}
        placeholderTextColor={th("rgba(255,255,255,0.32)")}
        returnKeyType="done"
        onSubmitEditing={() => name.trim() && onConfirm()}
        style={{ marginTop: 12, height: 56, borderRadius: 18, paddingHorizontal: 18, fontSize: 18, color: th("#fff"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.14)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}
      />

      {/* The category found in the words; a tap changes it. */}
      <Pressable
        onPress={onPickCategory}
        accessibilityLabel={`Categoria: ${category ?? "escolher"}`}
        style={({ pressed }) => ({ marginTop: 12, height: 52, borderRadius: 26, paddingLeft: 6, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", backgroundColor: th("rgba(255,255,255,0.06)", "bg"), opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
          <Icon size={18} color={th(chipInk(hex))} strokeWidth={2.2} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: "700", color: th(category ? "#fff" : INK.soft) }}>{category ?? "Categoria automática"}</Text>
      </Pressable>

      {/* When. */}
      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
        {[
          [today, "Hoje"],
          [ontem, "Ontem"],
        ].map(([d, l]) => {
          const on = date === d;
          return (
            <Pressable
              key={d}
              onPress={() => onDate(d)}
              style={({ pressed }) => ({ height: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th(on ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.12)", "line"), backgroundColor: th(on ? "rgba(255,255,255,0.14)" : "transparent", "bg"), opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: th(on ? "#fff" : INK.soft) }}>{l}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={{ marginTop: 12, fontSize: 13.5, color: th(RED) }}>{error}</Text>}

      <Pressable
        onPress={onConfirm}
        disabled={!name.trim() || saving}
        style={({ pressed }) => ({ marginTop: 18, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: !name.trim() ? 0.35 : pressed || saving ? 0.85 : 1 })}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>{saving ? "Registrando…" : "Confirmar"}</Text>
      </Pressable>
    </View>
  );
}

/* ───────────────────────────── 3 · The receipt ───────────────────────────── */

function Receipt({
  income,
  cents,
  parts,
  name,
  category,
  date,
  credit,
  picked,
  closingDay,
  onDone,
  onSeeTransactions,
}: {
  income: boolean;
  cents: number;
  parts: number;
  name: string;
  category: string;
  date: string;
  credit: boolean;
  picked: Account | Card | null;
  closingDay: number | null;
  onDone: () => void;
  onSeeTransactions: () => void;
}) {
  const d = new Date(`${date}T12:00:00`);
  const hex = categoryHex(category);
  const Icon = categoryIcon(category);
  const invoice = credit ? invoiceMonthOf(date, closingDay) : null;
  /* The receipt arrives as the ring passes the middle. */
  const rows: { label: string; value: string; sub?: string; mark: React.ReactNode }[] = [
    {
      label: income ? "De" : "O quê",
      value: name,
      sub: category,
      mark: (
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
          <Icon size={20} color={th(chipInk(hex))} strokeWidth={2.2} />
        </View>
      ),
    },
    {
      label: "Quando",
      value: `${WEEK[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`,
      sub: String(d.getFullYear()),
      mark: (
        <View style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", backgroundColor: th("#0B0B0B", "bg") }}>
          <View style={{ height: 15, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.22)", "bg") }}>
            <Text style={{ fontSize: 9.5, fontWeight: "800", color: th("#fff") }}>{SHORT_MONTH[d.getMonth()]}</Text>
          </View>
          <Text style={[nums, { textAlign: "center", fontSize: 19, fontWeight: "800", lineHeight: 28, color: th("#fff") }]}>{d.getDate()}</Text>
        </View>
      ),
    },
    {
      label: income ? "Entrou em" : "Pago com",
      value: picked ? (income ? picked.name : `${credit ? "Crédito" : "Débito"} · ${picked.name}`) : "—",
      sub: invoice ? `Fatura de ${invoice.label}${parts > 1 ? ` · ${parts}x de ${money(cents / 100 / parts)}` : ""}` : undefined,
      mark: picked ? <BankMark name={picked.name} hex={colorFor(picked.name, picked.color)} size={44} /> : <View />,
    },
  ];
  return (
    <Animated.View entering={FadeIn.delay(520).duration(420)}>
      <View style={{ alignItems: "center", paddingTop: 10 }}>
        <View style={{ height: 40, paddingLeft: 5, paddingRight: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: th(GREEN, "bg") }}>
            <Check size={17} color="#0B0B0B" strokeWidth={3} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: th(INK.soft) }}>{income ? "Entrada registrada" : "Gasto registrado"}</Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 16, fontSize: 50, fontWeight: "800", letterSpacing: -1.8, color: th(income ? INCOME : "#fff") }]}>
          {income ? "+" : "−"}
          {money(cents / 100)}
        </Text>
      </View>

      <View style={{ marginTop: 20, marginBottom: 6, height: 1, borderStyle: "dashed", borderWidth: 1, borderColor: th("rgba(255,255,255,0.18)", "line") }} />

      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
          <Text style={{ width: 86, fontSize: 14.5, color: th(INK.soft) }}>{r.label}</Text>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>{r.value}</Text>
            {r.sub ? <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>{r.sub}</Text> : null}
          </View>
          {r.mark}
        </View>
      ))}

      <Pressable onPress={onDone} style={({ pressed }) => ({ marginTop: 14, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>Concluir</Text>
      </Pressable>
      <Pressable onPress={onSeeTransactions} hitSlop={6} style={({ pressed }) => ({ marginTop: 12, alignSelf: "center", opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: th(INK.soft) }}>Ver transações</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────────────────────── The light ───────────────────────────── */

/**
 * A ring of light rising from the button through the whole sheet, short or tall, and a
 * glow along its edges that lingers and fades — the two-phones-touching light, in Willo's
 * green. Only numbers cross into the animated styles (no theme calls inside them).
 */
export function PaidGlow({ w, h }: { w: number; h: number }) {
  const p = useSharedValue(0);
  const edge = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 1150, easing: Easing.out(Easing.cubic) }));
    edge.set(withSequence(withDelay(260, withTiming(1, { duration: 380 })), withTiming(0, { duration: 1300, easing: Easing.in(Easing.quad) })));
  }, [p, edge]);

  /* From the foot of the sheet, big enough to pass its far corners. */
  const R = Math.sqrt((w / 2) ** 2 + h ** 2) + 60;
  const D = R * 2;
  const ring = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.75 ? 1 : Math.max(0, 1 - (v - 0.75) / 0.25),
      transform: [{ scale: 0.04 + v * 0.96 }],
    };
  });
  const inner = useAnimatedStyle(() => {
    const v = Math.max(0, p.get() - 0.12) / 0.88;
    return {
      opacity: v <= 0 ? 0 : v < 0.7 ? 0.85 : Math.max(0, 0.85 - (v - 0.7) / 0.3),
      transform: [{ scale: 0.04 + v * 0.9 }],
    };
  });
  const rim = useAnimatedStyle(() => ({ opacity: edge.get() }));

  const left = w / 2 - R;
  const top = h - R;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: -20, right: -20, top: -12, bottom: -40, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 20, top: 12, width: w, height: h }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left,
              top,
              width: D,
              height: D,
              borderRadius: R,
              borderWidth: 34,
              borderColor: "rgba(103,205,103,0.55)",
              shadowColor: "#67CD67",
              shadowOpacity: 1,
              shadowRadius: 36,
              shadowOffset: { width: 0, height: 0 },
            },
            ring,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              left,
              top,
              width: D,
              height: D,
              borderRadius: R,
              borderWidth: 6,
              borderColor: "rgba(214,255,214,0.9)",
              shadowColor: "#9BFF9B",
              shadowOpacity: 1,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            },
            inner,
          ]}
        />
      </View>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 30,
            borderWidth: 3,
            borderColor: "rgba(103,205,103,0.9)",
            shadowColor: "#67CD67",
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
          },
          rim,
        ]}
      />
    </View>
  );
}
