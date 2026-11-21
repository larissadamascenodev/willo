import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createTransfer, getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import AccountSelect from "~/components/AccountSelect";
import BottomSheet from "~/components/BottomSheet";
import BankMark from "~/components/BankMark";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { isAhead, isoOf, todayIso } from "~/components/registro/EntryForm";
import { Chip, dayLabel } from "~/components/registro/entryParts";
import { ArrowDownUp, ChevronLeft, ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Moving money between the person's own accounts.
 *
 * How much, from which account to which (the two can be swapped with one touch), and when —
 * today, yesterday or a day on the calendar; a day ahead is scheduled and moves nothing until
 * it happens. Under them, what each account will hold afterwards. It is neither spending nor
 * income: the money only changes place.
 */

interface Account {
  id: string;
  name: string;
  color: string | null;
  current_balance: number;
  is_default?: boolean;
}

export default function TransferSheet({ open, onClose, fromId: startFrom }: { open: boolean; onClose: () => void; /** The account it starts from, when opened from one. */ fromId?: string }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(todayIso());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fresh each time it opens: the balances as they are now, the main account first. */
  useEffect(() => {
    if (!open) return;
    setCents(0);
    setDate(todayIso());
    setCalendarOpen(false);
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

  const source = accounts.find((a) => a.id === from) ?? null;
  const target = accounts.find((a) => a.id === to) ?? null;
  const ahead = isAhead(date);
  const value = cents / 100;
  const ready = !!source && !!target && source.id !== target.id && cents > 0 && !sending && !!user;

  /* Choosing as the origin the account that was the destination swaps them. */
  const pickFrom = (id: string) => {
    if (id === to) setTo(from);
    setFrom(id);
    setError(null);
  };
  const swap = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setFrom(to);
    setTo(from);
  };

  const options = useMemo(() => accounts.map((a) => ({ id: a.id, name: a.name, color: a.color, note: money(Number(a.current_balance)) })), [accounts]);

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

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: th("#fff") }}>Transferir</Text>
        <Text style={{ marginTop: 4, fontSize: 13.5, color: th(INK.soft) }}>Entre as suas contas. Não conta como gasto nem como receita.</Text>

        {accounts.length < 2 && accounts.length > 0 ? (
          <Text style={{ marginTop: 22, fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>Para transferir, cadastre pelo menos duas contas.</Text>
        ) : (
          <>
            {/* How much. */}
            <Text style={{ marginTop: 20, fontSize: 12.5, color: th(INK.soft) }}>Valor</Text>
            <TextInput
              value={money(value)}
              onChangeText={(t) => {
                setCents(Math.min(Number(t.replace(/\D/g, "").slice(0, 11) || "0"), 999999999));
                setError(null);
              }}
              keyboardType="number-pad"
              accessibilityLabel="Valor da transferência"
              style={{ marginTop: 4, padding: 0, fontSize: 36, fontWeight: "800", letterSpacing: -1.3, color: th(cents === 0 ? INK.faint : "#fff") }}
            />

            {/* From where, and to where. */}
            <Text style={{ marginTop: 20, fontSize: 12.5, color: th(INK.soft) }}>De</Text>
            <View style={{ marginTop: 8 }}>
              <AccountSelect options={options} value={from} onChange={pickFrom} title="Sai de qual conta?" />
            </View>

            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>Para</Text>
              <Pressable
                onPress={swap}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Inverter contas"
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 5, opacity: pressed ? 0.55 : 1 })}
              >
                <ArrowDownUp size={14} color={th(INK.soft)} strokeWidth={2.2} />
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>Inverter</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 8 }}>
              <AccountSelect options={options.filter((o) => o.id !== from)} value={to} onChange={setTo} title="Entra em qual conta?" />
            </View>

            {/* When. */}
            <Text style={{ marginTop: 20, fontSize: 12.5, color: th(INK.soft) }}>Quando</Text>
            <View style={{ marginTop: 8 }}>
              <WhenPick date={date} onChange={setDate} calendarOpen={calendarOpen} onCalendar={setCalendarOpen} />
            </View>
            {ahead && !calendarOpen && <Text style={{ marginTop: 10, fontSize: 12.5, color: th(INK.soft) }}>Fica agendada para {dayLabel(date).toLowerCase()}. O saldo só muda quando ela acontecer.</Text>}

            {/* What each account will hold afterwards — out of the way while the calendar is open. */}
            {!calendarOpen && source && target && cents > 0 && (
              <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16, borderRadius: 18, borderCurve: "continuous", backgroundColor: th("rgba(255,255,255,0.05)", "bg"), paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: th(INK.softer) }}>{ahead ? "Quando acontecer" : "Depois da transferência"}</Text>
                <After account={source} next={Number(source.current_balance) - value} />
                <After account={target} next={Number(target.current_balance) + value} />
              </Animated.View>
            )}

            {error && <Text style={{ marginTop: 10, fontSize: 13, color: th(RED) }}>{error}</Text>}

            <Pressable
              onPress={() => void send()}
              disabled={!ready}
              style={({ pressed }) => ({
                marginTop: 22,
                height: 54,
                borderRadius: 27,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("#fff", "bg"),
                opacity: !ready ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16.5, fontWeight: "700", color: th("#0B0B0B") }}>
                {sending ? "Transferindo…" : cents > 0 ? `${ahead ? "Agendar" : "Transferir"} ${money(value)}` : "Transferir"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

/** One account, before and after. */
function After({ account, next }: { account: Account; next: number }) {
  const now = Number(account.current_balance);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <BankMark name={account.name} hex={colorFor(account.name, account.color)} size={28} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: th("#fff") }}>
        {account.name}
      </Text>
      <Text style={{ fontSize: 13, color: th(INK.soft) }}>{money(now)}</Text>
      <ChevronRight size={14} color={th(INK.softer)} strokeWidth={2.2} />
      <Text style={{ fontSize: 14, fontWeight: "700", color: th(next < 0 ? RED : "#fff") }}>{money(next)}</Text>
    </View>
  );
}

/** The day: today, yesterday or one from the calendar, which opens in place. */
function WhenPick({ date, onChange, calendarOpen, onCalendar }: { date: string; onChange: (iso: string) => void; calendarOpen: boolean; onCalendar: (open: boolean) => void }) {
  const today = todayIso();
  const yesterday = isoOf(new Date(Date.now() - 86_400_000));
  const custom = date !== today && date !== yesterday;
  const [cal, setCal] = useState(() => {
    const d = new Date(`${date}T12:00:00`);
    return { m: d.getMonth(), y: d.getFullYear() };
  });
  const pick = (iso: string) => {
    onChange(iso);
    onCalendar(false);
  };
  const shown = new Date(`${date}T12:00:00`);

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip height={40} label="Hoje" on={date === today} onPress={() => pick(today)} />
        <Chip height={40} label="Ontem" on={date === yesterday} onPress={() => pick(yesterday)} />
        <Chip height={40} label={custom ? dayLabel(date) : "Outra data"} on={custom} onPress={() => onCalendar(!calendarOpen)} />
      </View>
      {calendarOpen && (
        <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Pressable accessibilityLabel="Mês anterior" hitSlop={8} onPress={() => setCal(({ m, y }) => (m === 0 ? { m: 11, y: y - 1 } : { m: m - 1, y }))} style={{ padding: 6 }}>
              <ChevronLeft size={18} color={th("#fff")} />
            </Pressable>
            <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff"), textTransform: "capitalize" }}>{new Date(cal.y, cal.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
            <Pressable accessibilityLabel="Próximo mês" hitSlop={8} onPress={() => setCal(({ m, y }) => (m === 11 ? { m: 0, y: y + 1 } : { m: m + 1, y }))} style={{ padding: 6 }}>
              <ChevronRight size={18} color={th("#fff")} />
            </Pressable>
          </View>
          <MonthCalendar
            month={cal.m}
            year={cal.y}
            events={[]}
            selectedDay={shown.getMonth() === cal.m && shown.getFullYear() === cal.y ? shown.getDate() : null}
            onSelectDay={(day) => {
              if (day) pick(isoOf(new Date(cal.y, cal.m, day)));
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}
