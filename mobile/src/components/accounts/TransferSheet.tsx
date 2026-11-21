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
import { AccountSheet, Amount, DateSheet, Keypad, SmallChip, centsOf, dayShort, typeKey } from "~/components/registro/NewEntry";
import { ArrowDown, CalendarDays, ChevronDown, X } from "~/components/icons";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { tallSheetBody } from "~/lib/sheetRoom";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Moving money between the person's own accounts, drawn as the "+" entry is drawn.
 *
 * At the top the two accounts, one over the other, with an arrow between them saying which way
 * the money goes: touching an account chooses another, touching the arrow turns it around. Each
 * shows what it holds and, once there is an amount, what it will hold afterwards. Under them the
 * amount, large, on the app's own number keys, with the day in the corner — a day ahead is
 * scheduled and moves nothing until it comes. Then the one button that does it.
 *
 * It is neither spending nor income: the money only changes place.
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

  const fieldH = compact ? 64 : 72;
  const ARROW = 36;

  return (
    <BottomSheet open={open} onClose={onClose} full nearlyFull>
      <View style={{ height: bodyH, paddingHorizontal: 10 }}>
        {/* The top row: closing, and the name. */}
        <View style={{ height: 48, paddingHorizontal: 6, flexDirection: "row", alignItems: "center" }}>
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
            {/* From, the arrow, to. */}
            <View style={{ marginTop: 12, gap: 8 }}>
              <AccountField caption="De" account={source} after={source ? Number(source.current_balance) - value : 0} showAfter={cents > 0} height={fieldH} onPress={() => setSheet("from")} />
              <AccountField caption="Para" account={target} after={target ? Number(target.current_balance) + value : 0} showAfter={cents > 0} height={fieldH} onPress={() => setSheet("to")} />
              {/* Between the two banks' marks, the way the money goes; a touch turns it around. */}
              <Pressable
                onPress={swap}
                accessibilityRole="button"
                accessibilityLabel="Inverter as contas"
                hitSlop={6}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: 14 + 21 - ARROW / 2,
                  top: fieldH + 4 - ARROW / 2,
                  width: ARROW,
                  height: ARROW,
                  borderRadius: ARROW / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: th("rgba(255,255,255,0.16)", "line"),
                  backgroundColor: th("#1C1E23", "bg"),
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                })}
              >
                <Animated.View style={arrowStyle}>
                  <ArrowDown size={17} color={th("#fff")} strokeWidth={2.4} />
                </Animated.View>
              </Pressable>
            </View>

            {/* The amount, on the app's keys, with the day in the corner. */}
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
              <View style={{ height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ paddingLeft: 6, fontSize: 14, fontWeight: "600", color: th(INK.soft) }}>Valor</Text>
                <SmallChip icon={CalendarDays} label={dayShort(date)} onPress={() => setSheet("date")} />
              </View>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                <Amount raw={raw} income={false} size={compact ? 50 : 64} />
                <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 13, color: th(error ? RED : INK.soft) }}>
                  {error ?? (ahead ? `Agendada para ${dayShort(date)} · o saldo muda nesse dia` : "Não conta como gasto nem como receita")}
                </Text>
              </View>
              <Keypad rowH={compact ? 44 : 54} onKey={press} />
            </View>

            {/* The one button. */}
            <Pressable
              onPress={() => void send()}
              disabled={!ready}
              style={({ pressed }) => ({
                marginTop: 12,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("#fff", "bg"),
                opacity: !ready ? 0.35 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: th("#0B0B0B") }}>
                {sending ? "Transferindo…" : cents > 0 ? `${ahead ? "Agendar" : "Confirmar"} ${money(value)}` : "Confirmar transferência"}
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

/** One side of the transfer: the bank, its name, and what it holds — now, and after. */
function AccountField({ caption, account, after, showAfter, height, onPress }: { caption: string; account: Account | null; after: number; showAfter: boolean; height: number; onPress: () => void }) {
  const now = account ? Number(account.current_balance) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${account?.name ?? "escolher conta"}. Trocar`}
      style={({ pressed }) => ({
        height,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: 14,
        paddingRight: 12,
        borderRadius: 24,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.09)", "line"),
        backgroundColor: th(pressed ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)", "bg"),
      })}
    >
      {account ? <BankMark name={account.name} hex={colorFor(account.name, account.color)} size={42} /> : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>{caption}</Text>
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 16.5, fontWeight: "700", color: th(account ? "#fff" : INK.soft) }}>
          {account?.name ?? "Escolher conta"}
        </Text>
      </View>
      {account ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[nums, { fontSize: 12.5, color: th(INK.soft) }]}>{showAfter ? `Saldo ${money(now)}` : "Saldo"}</Text>
          <Text style={[nums, { marginTop: 1, fontSize: 15.5, fontWeight: "700", color: th((showAfter ? after : now) < 0 ? RED : "#fff") }]}>
            {showAfter ? <Text style={{ fontWeight: "500", color: th(INK.soft) }}>fica </Text> : null}
            {money(showAfter ? after : now)}
          </Text>
        </View>
      ) : null}
      <ChevronDown size={16} color={th(INK.softer)} strokeWidth={2.2} />
    </Pressable>
  );
}
