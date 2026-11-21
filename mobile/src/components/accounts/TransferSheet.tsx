import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { createTransfer, getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import BottomSheet from "~/components/BottomSheet";
import BankMark from "~/components/BankMark";
import RaisedButton from "~/components/RaisedButton";
import { isAhead, todayIso } from "~/components/registro/EntryForm";
import { AccountSheet, Amount, DateSheet, Keypad, centsOf, dayShort, typeKey } from "~/components/registro/NewEntry";
import { ArrowRight, CalendarDays, ChevronDown, ChevronRight, Clock, X } from "~/components/icons";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { tallSheetBody } from "~/lib/sheetRoom";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Moving money between the person's own accounts, after Larissa's reference.
 *
 * The amount first, large, on the app's own number keys. Under it the two accounts side by side
 * as cards with a dashed edge — where it leaves, where it goes (lit in green) — with an arrow
 * between them: a touch on a card chooses another account, a touch on the arrow turns it
 * around; each shows what it holds and, once there is an amount, what it will hold after. Then
 * the details (the day — a day ahead is scheduled and moves nothing until it comes) and the one
 * button that does it. It is neither spending nor income: the money only changes place.
 */

interface Account {
  id: string;
  name: string;
  color: string | null;
  type?: string;
  current_balance: number;
  is_default?: boolean;
}

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const tick = () => void Haptics.selectionAsync().catch(() => undefined);

export default function TransferSheet({ open, onClose, fromId: startFrom }: { open: boolean; onClose: () => void; /** The account it starts from, when opened from one. */ fromId?: string }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const bodyH = tallSheetBody(screenH, insets.top, insets.bottom, 0);
  const compact = screenH < 740;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [date, setDate] = useState(todayIso());
  const [sheet, setSheet] = useState<null | "from" | "to" | "date">(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fresh each time it opens: the balances as they are now, the main account first. */
  useEffect(() => {
    if (!open) return;
    setRaw("");
    setDate(todayIso());
    setSheet(null);
    setError(null);
    getAccounts()
      .then((list) => {
        const all = list as unknown as Account[];
        setAccounts(all);
        const first = all.find((a) => a.id === startFrom) ?? all.find((a) => a.is_default) ?? [...all].sort((a, b) => Number(b.current_balance) - Number(a.current_balance))[0];
        setFrom(first?.id ?? null);
        setTo(all.find((a) => a.id !== first?.id)?.id ?? null);
      })
      .catch(() => undefined);
  }, [open, startFrom]);

  const cents = centsOf(raw);
  const value = cents / 100;
  const source = accounts.find((a) => a.id === from) ?? null;
  const target = accounts.find((a) => a.id === to) ?? null;
  const ahead = isAhead(date);
  const ready = !!source && !!target && source.id !== target.id && cents > 0 && !sending && !!user;

  /* The arrow spins a whole turn when the accounts trade places, and still points from De to Para. */
  const turn = useSharedValue(0);
  useEffect(() => {
    if (open) turn.set(0);
  }, [open, turn]);
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  const swap = () => {
    tick();
    setFrom(to);
    setTo(from);
    turn.set(withTiming(turn.get() + 360, { duration: 420, easing: Easing.out(Easing.cubic) }));
  };

  /* Choosing for one side the account on the other side swaps them. */
  const pick = (side: "from" | "to", id: string) => {
    tick();
    if (side === "from") {
      if (id === to) setTo(from);
      setFrom(id);
    } else {
      if (id === from) setFrom(to);
      setTo(id);
    }
    setSheet(null);
    setError(null);
  };

  const press = (key: string) => {
    tick();
    setError(null);
    setRaw((r) => typeKey(r, key));
  };

  const send = async () => {
    if (!ready || !source || !target || !user) return;
    setSending(true);
    setError(null);
    try {
      await createTransfer({ fromId: source.id, toId: target.id, amount: value, date, name: `Transferência para ${target.name}`, status: ahead ? "pendente" : "pago" }, user.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onClose();
      showToast(ahead ? `Transferência agendada · ${money(value)}` : `${money(value)} transferidos para ${target.name}`);
    } catch {
      setError("Não foi possível transferir. Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  const ARROW = 40;

  return (
    <BottomSheet open={open} onClose={onClose} full nearlyFull>
      <View style={{ height: bodyH, paddingHorizontal: 12 }}>
        {/* The top row: closing, and the name. */}
        <View style={{ height: 48, paddingHorizontal: 4, flexDirection: "row", alignItems: "center" }}>
          <RaisedButton size={46} label="Fechar" onPress={onClose}>
            <X size={20} color={th("#fff")} strokeWidth={2.4} />
          </RaisedButton>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: th("#fff") }}>Transferir</Text>
          <View style={{ width: 46 }} />
        </View>

        {accounts.length > 0 && accounts.length < 2 ? (
          <Text style={{ marginTop: 40, paddingHorizontal: 20, textAlign: "center", fontSize: 15, lineHeight: 21, color: th(INK.soft) }}>Para transferir, cadastre pelo menos duas contas.</Text>
        ) : (
          <>
            {/* The amount first, large. */}
            <View style={{ marginTop: compact ? 4 : 10, alignItems: "center" }}>
              <Amount raw={raw} income={false} size={compact ? 46 : 58} />
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: th(error ? RED : INK.soft) }}>
                {error ?? "Não conta como gasto nem como receita"}
              </Text>
            </View>

            {/* The two accounts side by side, the way the money goes between them. */}
            <View style={{ marginTop: compact ? 12 : 18, flexDirection: "row", alignItems: "center" }}>
              <AccountCard caption="Sai de" account={source} after={source ? Number(source.current_balance) - value : 0} showAfter={cents > 0} compact={compact} onPress={() => setSheet("from")} />
              <View style={{ width: 12 }} />
              <AccountCard caption="Entra em" account={target} after={target ? Number(target.current_balance) + value : 0} showAfter={cents > 0} compact={compact} onPress={() => setSheet("to")} lit />
              {/* Between them, the arrow; a touch turns it around. */}
              <Pressable
                onPress={swap}
                accessibilityRole="button"
                accessibilityLabel="Inverter as contas"
                hitSlop={6}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: "50%",
                  marginLeft: -ARROW / 2,
                  width: ARROW,
                  height: ARROW,
                  borderRadius: ARROW / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: th("rgba(255,255,255,0.18)", "line"),
                  backgroundColor: th("#1C1E23", "bg"),
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                })}
              >
                <Animated.View style={arrowStyle}>
                  <ArrowRight size={18} color={th("#fff")} strokeWidth={2.4} />
                </Animated.View>
              </Pressable>
            </View>

            {/* The details. */}
            <View style={{ marginTop: compact ? 8 : 12, paddingHorizontal: 6 }}>
              <Pressable onPress={() => setSheet("date")} accessibilityRole="button" style={({ pressed }) => ({ height: compact ? 38 : 42, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.6 : 1 })}>
                <CalendarDays size={17} color={th(INK.soft)} strokeWidth={2} />
                <Text style={{ fontSize: 15, color: th(INK.soft) }}>Data</Text>
                <Text style={{ marginLeft: "auto", fontSize: 15, fontWeight: "600", color: th("#fff") }}>{dayShort(date)}</Text>
                <ChevronRight size={16} color={th(INK.softer)} strokeWidth={2.2} />
              </Pressable>
              <View style={{ height: compact ? 38 : 42, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Clock size={17} color={th(INK.soft)} strokeWidth={2} />
                <Text style={{ fontSize: 15, color: th(INK.soft) }}>Quando cai</Text>
                <Text numberOfLines={1} style={{ marginLeft: "auto", flexShrink: 1, fontSize: 15, fontWeight: "600", color: th("#fff") }}>{ahead ? "No dia agendado" : "Na hora"}</Text>
              </View>
            </View>

            {/* The app's keys. */}
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <Keypad rowH={compact ? 42 : 52} onKey={press} />
            </View>

            {/* The one button. */}
            <Pressable
              onPress={() => void send()}
              disabled={!ready}
              style={({ pressed }) => ({
                marginTop: 10,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("#fff", "bg"),
                opacity: !ready ? 0.35 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>
                {sending ? "Transferindo…" : cents > 0 ? `${ahead ? "Agendar" : "Transferir"} ${money(value)}` : "Transferir"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ── The smaller sheets: an account for either side, and the day ── */}
      <AccountSheet
        open={sheet === "from" || sheet === "to"}
        title={sheet === "to" ? "Entra em qual conta?" : "Sai de qual conta?"}
        method={null}
        options={accounts}
        value={sheet === "to" ? to : from}
        note={(o) => ("current_balance" in o && o.current_balance != null ? `Saldo ${money(Number(o.current_balance))}` : "")}
        empty="Nenhuma conta cadastrada ainda."
        onPick={(id) => pick(sheet === "to" ? "to" : "from", id)}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        open={sheet === "date"}
        value={date}
        onPick={(d) => {
          tick();
          setDate(d);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </BottomSheet>
  );
}

/**
 * One side of the transfer, as a card with a dashed edge (the side the money goes to lit in
 * green): the bank's mark, its name, and what it holds — now, or what it will hold after.
 * A touch chooses another account.
 */
function AccountCard({ caption, account, after, showAfter, compact, onPress, lit }: { caption: string; account: Account | null; after: number; showAfter: boolean; compact: boolean; onPress: () => void; lit?: boolean }) {
  const now = account ? Number(account.current_balance) : 0;
  const shown = showAfter ? after : now;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${account?.name ?? "escolher conta"}. Trocar`}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        alignItems: "center",
        paddingVertical: compact ? 12 : 16,
        paddingHorizontal: 10,
        borderRadius: 22,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: th(lit ? "rgba(103,205,103,0.55)" : "rgba(255,255,255,0.22)", "line"),
        backgroundColor: th(pressed ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)", "bg"),
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: th(INK.soft) }}>{caption}</Text>
      <View style={{ marginTop: 8 }}>
        {account ? <BankMark name={account.name} hex={colorFor(account.name, account.color)} size={compact ? 36 : 42} /> : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />}
      </View>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 3, maxWidth: "100%" }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: "700", color: th(account ? "#fff" : INK.soft) }}>
          {account?.name ?? "Escolher"}
        </Text>
        <ChevronDown size={14} color={th(INK.softer)} strokeWidth={2.2} />
      </View>
      {account ? (
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[nums, { marginTop: 3, fontSize: 12.5, color: th(shown < 0 ? RED : INK.soft) }]}>
          {showAfter ? "fica " : "saldo "}
          {money(shown)}
        </Text>
      ) : null}
    </Pressable>
  );
}
