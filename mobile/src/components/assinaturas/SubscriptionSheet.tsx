import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { supabase } from "@/integrations/supabase/client";
import { getTransactionById } from "@/services/transactionService";
import { deleteInSeries } from "@/services/seriesActions";
import type { RecurringItem } from "@/hooks/useRecorrentes";
import BottomSheet from "~/components/BottomSheet";
import SubLogo from "~/components/SubLogo";
import { CreditCard, Landmark, Pencil, Sparkles } from "~/components/icons";
import { chargesLeftThisYear, chargesSoFar, nextCharge } from "~/lib/subscriptionInsights";
import { knownSub } from "~/lib/subscriptionLogos";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * One subscription, over the page: what it costs, how many times it has been charged and
 * what that came to since it began, a year of it and what is left until December, the
 * next charge — and what the Willo makes of cancelling it. Editing opens the usual sheet;
 * cancelling stops it from next month on, asked first in this same sheet.
 */

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

export default function SubscriptionSheet({
  item,
  place,
  income,
  onClose,
}: {
  item: RecurringItem | null;
  place: { name: string; card: boolean } | null;
  /** Fixed income a month, for what it costs in work. */
  income: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [shown, setShown] = useState<RecurringItem | null>(item);
  const [start, setStart] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ month: number; year: number }[]>([]);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setAsking(false);
    setStart(item.startsOn ?? null);
    let alive = true;
    void Promise.all([getTransactionById(item.sourceId), supabase.from("recurring_exclusions").select("month, year").eq("transaction_id", item.sourceId)])
      .then(([tx, ex]) => {
        if (!alive) return;
        setStart((tx as unknown as { date: string }).date);
        setSkipped(((ex.data ?? []) as { month: number; year: number }[]).map((e) => ({ month: Number(e.month), year: Number(e.year) })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [item]);

  const s = shown;
  const name = s ? (knownSub(s.name)?.name ?? s.name) : "";
  const charged = s && start ? chargesSoFar(start, skipped) : null;
  const left = s && start ? chargesLeftThisYear(start) : 0;
  const next = s ? nextCharge(s.dueDay, start ?? undefined) : null;
  const begun = start ? new Date(`${start.slice(0, 10)}T12:00:00`) : null;
  const workHours = s && income > 0 ? (s.amount * 12) / (income / 220) : 0;

  const cancel = async () => {
    if (!s || !user) return;
    setBusy(true);
    try {
      /* From next month on: what was already charged stays where it is. */
      const now = new Date();
      const nextMonth = now.getMonth() === 11 ? { month: 0, year: now.getFullYear() + 1 } : { month: now.getMonth() + 1, year: now.getFullYear() };
      await deleteInSeries(s.sourceId, "all", { ...nextMonth, userId: user.id });
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      showToast(`${name} cancelada · ${money(s.amount * 12)} a menos por ano`);
      onClose();
    } catch {
      showToast("Não consegui cancelar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const edit = () => {
    if (!s) return;
    onClose();
    const d = s.startsOn ? new Date(`${s.startsOn}T12:00:00`) : new Date();
    setTimeout(() => router.push({ pathname: "/manual", params: { editar: s.id, mes: String(d.getMonth()), ano: String(d.getFullYear()) } } as never), 260);
  };

  return (
    <BottomSheet open={!!item} onClose={onClose}>
      {s && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
          {asking ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 6 }}>
              <SubLogo name={s.name} size={56} round />
              <Text style={{ marginTop: 14, fontSize: 19, fontWeight: "700", color: th("#fff"), textAlign: "center" }}>Cancelar {name}?</Text>
              <Text style={{ marginTop: 8, fontSize: 14.5, lineHeight: 21, color: th(INK.soft), textAlign: "center" }}>
                Deixa de contar a partir do mês que vem — {money(s.amount * 12)} a menos por ano. O que já foi cobrado fica no seu histórico.
              </Text>
              <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: th(INK.softer), textAlign: "center" }}>
                Lembre de cancelar também no próprio {name}: o Willo só para de contar.
              </Text>
              <View style={{ marginTop: 20, alignSelf: "stretch", flexDirection: "row", gap: 10 }}>
                <Button label="Manter" onPress={() => setAsking(false)} disabled={busy} />
                <Button label={busy ? "Cancelando…" : "Cancelar"} danger solid onPress={() => void cancel()} disabled={busy} />
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)}>
              {/* What it is and what it costs. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <SubLogo name={s.name} size={56} round />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>
                    {name}
                  </Text>
                  <View style={{ marginTop: 3, flexDirection: "row", alignItems: "center", gap: 5 }}>
                    {place ? place.card ? <CreditCard size={12} color={th(INK.softer)} strokeWidth={2} /> : <Landmark size={12} color={th(INK.softer)} strokeWidth={2} /> : null}
                    <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.soft) }}>
                      {place ? `${place.card ? "Cartão" : "Conta"} ${place.name} · ` : ""}todo dia {s.dueDay}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(s.amount)}</Text>
                  <Text style={{ fontSize: 12, color: th(INK.softer) }}>por mês</Text>
                </View>
              </View>

              {/* The figures, as one block of four. */}
              <View style={{ marginTop: 18, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.08)", "line"), backgroundColor: th("rgba(255,255,255,0.04)", "bg") }}>
                <View style={{ flexDirection: "row" }}>
                  <Cell label="Já pagas" value={charged === null ? "–" : String(charged)} note={charged === 1 ? "cobrança" : "cobranças"} />
                  <Divider />
                  <Cell label="Já gasto" value={charged === null ? "–" : money(charged * s.amount)} note={begun ? `${charged === 0 ? "começa em" : "desde"} ${MONTHS[begun.getMonth()]} ${begun.getFullYear()}` : ""} />
                </View>
                <View style={{ height: 1, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />
                <View style={{ flexDirection: "row" }}>
                  <Cell label="Em um ano" value={money(s.amount * 12)} note="12 cobranças" />
                  <Divider />
                  <Cell label="Até dezembro" value={money(left * s.amount)} note={left === 0 ? "nada mais este ano" : `${left} ${left === 1 ? "cobrança" : "cobranças"}`} />
                </View>
              </View>

              {next && (
                <Text style={{ marginTop: 10, fontSize: 13, color: th(INK.soft) }}>
                  {charged === 0 ? "Primeira" : "Próxima"} cobrança em <Text style={{ fontWeight: "700", color: th("#fff") }}>{next.getDate()} de {MONTHS[next.getMonth()].replace(".", "")}</Text>
                </Text>
              )}

              {/* What the Willo makes of it. */}
              <View style={{ marginTop: 14, flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, borderCurve: "continuous", backgroundColor: th("rgba(124,196,255,0.08)", "bg"), borderWidth: 1, borderColor: th("rgba(124,196,255,0.16)", "line") }}>
                <Sparkles size={16} color={th("#7CC4FF")} strokeWidth={2.2} />
                <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
                  Cancelando agora, sobram <Text style={{ fontWeight: "700", color: th("#fff") }}>{money(s.amount * 12)}</Text> em um ano
                  {left > 0 ? ` (${money(left * s.amount)} só até dezembro)` : ""}
                  {workHours >= 1 ? ` — são ${Math.round(workHours)} horas do seu trabalho.` : "."}
                </Text>
              </View>

              <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
                <Button label="Editar" icon onPress={edit} />
                <Button label="Cancelar assinatura" danger onPress={() => setAsking(true)} />
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </BottomSheet>
  );
}

function Cell({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Text style={{ fontSize: 12, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginTop: 3, fontSize: 19, fontWeight: "800", letterSpacing: -0.5, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11.5, color: th(INK.softer) }}>
        {note}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />;
}

function Button({ label, onPress, disabled, danger = false, solid = false, icon = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; solid?: boolean; icon?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        height: 50,
        borderRadius: 25,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: th(solid ? RED : danger ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.10)", "bg"),
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {icon && <Pencil size={16} color={th("#fff")} strokeWidth={2.2} />}
      <Text style={{ fontSize: 15, fontWeight: solid ? "700" : "600", color: solid ? "#fff" : th(danger ? RED : "#fff") }}>{label}</Text>
    </Pressable>
  );
}
