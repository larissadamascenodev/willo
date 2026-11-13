import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { daysUntil, type RecurringItem } from "@/hooks/useRecorrentes";
import BottomSheet from "~/components/BottomSheet";
import SubLogo from "~/components/SubLogo";
import { Check, CreditCard, Landmark, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { AMBER, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Every subscription, in one sheet: what they cost a month and a year, which is charged
 * next, and for each one its real logo, its day, how soon, and where it is paid — the
 * card or the account by name. A tap opens it to change or cancel; a new one is added
 * from here too.
 */

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

function when(s: RecurringItem) {
  if (s.startsOn) return `Começa em ${s.dueDay} ${MONTHS[Number(s.startsOn.slice(5, 7)) - 1]}`;
  if (s.isPaidThisMonth) return `Cobrada este mês · dia ${s.dueDay}`;
  const n = daysUntil(s.dueDay);
  return `${n === 0 ? "Cobra hoje" : n === 1 ? "Cobra amanhã" : `Cobra em ${n} dias`} · dia ${s.dueDay}`;
}

export default function SubscriptionsSheet({
  open,
  onClose,
  items,
  total,
  onAdd,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  items: RecurringItem[];
  total: number;
  onAdd: () => void;
  onEdit: (item: RecurringItem) => void;
}) {
  const { height } = useWindowDimensions();
  const [names, setNames] = useState<Record<string, { name: string; card: boolean }>>({});

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all([getAccounts(), getCreditCards()])
      .then(([accs, cards]) => {
        if (!alive) return;
        const out: Record<string, { name: string; card: boolean }> = {};
        for (const a of accs as unknown as { id: string; name: string }[]) out[a.id] = { name: a.name, card: false };
        for (const c of cards as unknown as { id: string; name: string }[]) out[c.id] = { name: c.name, card: true };
        setNames(out);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  const ordered = [...items].sort((a, b) => Number(a.isPaidThisMonth) - Number(b.isPaidThisMonth) || daysUntil(a.dueDay) - daysUntil(b.dueDay));
  const next = ordered.find((s) => !s.isPaidThisMonth && !s.startsOn);
  const n = items.length;

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>Assinaturas</Text>
        <Text style={{ marginTop: 2, fontSize: 13.5, color: th(INK.soft) }}>{n === 0 ? "Nenhuma ativa" : `${n} ${n === 1 ? "ativa" : "ativas"}`}</Text>

        {/* What they cost, and what comes next. */}
        {n > 0 && (
          <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
            <Stat label="Por mês" value={money(total)} />
            <Stat label="Por ano" value={money(total * 12)} />
          </View>
        )}
        {next && (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 18, borderCurve: "continuous", backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
            <SubLogo name={next.name} size={32} />
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 13.5, lineHeight: 18, color: th(INK.soft) }}>
              Próxima cobrança: <Text style={{ fontWeight: "700", color: th("#fff") }}>{next.name}</Text>, {when(next).split(" · ")[0].toLowerCase().replace("cobra ", "")}, {money(next.amount)}
              {next.cardId && names[next.cardId] ? ` no ${names[next.cardId].name}` : ""}.
            </Text>
          </View>
        )}

        {/* Each one. */}
        <ScrollView style={{ marginTop: 14, maxHeight: height * 0.46 }} showsVerticalScrollIndicator={false}>
          {n === 0 ? (
            <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
              Streaming, música, nuvem, academia: adicione as suas e veja quanto custam por mês e por ano.
            </Text>
          ) : (
            ordered.map((s, i) => {
              const place = (s.cardId && names[s.cardId]) || (s.accountId && names[s.accountId]) || null;
              const soon = !s.isPaidThisMonth && !s.startsOn && daysUntil(s.dueDay) <= 2;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onEdit(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}, ${money(s.amount)}. Editar`}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line"), opacity: pressed ? 0.6 : 1 })}
                >
                  <SubLogo name={s.name} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>
                      {s.name}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, fontWeight: soon ? "600" : "400", color: th(soon ? AMBER : INK.soft) }}>
                      {when(s)}
                    </Text>
                    {place && (
                      <View style={{ marginTop: 3, flexDirection: "row", alignItems: "center", gap: 5 }}>
                        {place.card ? <CreditCard size={12} color={th(INK.softer)} strokeWidth={2} /> : <Landmark size={12} color={th(INK.softer)} strokeWidth={2} />}
                        <Text numberOfLines={1} style={{ fontSize: 12, color: th(INK.softer) }}>
                          {place.card ? `Cartão ${place.name}` : `Conta ${place.name}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff"), fontVariant: ["tabular-nums"] }}>{money(s.amount)}</Text>
                    {s.isPaidThisMonth && (
                      <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}>
                        <Check size={10} color={th("#0B0B0B")} strokeWidth={3} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={({ pressed }) => ({ marginTop: 14, height: 52, borderRadius: 26, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
        >
          <Plus size={18} color={th("#0B0B0B")} strokeWidth={2.4} />
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>Nova assinatura</Text>
        </Pressable>
        {n > 0 && <Text style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: th(INK.softer) }}>Toque numa assinatura para editar ou cancelar.</Text>}
      </View>
    </BottomSheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 18, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.08)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
      <Text style={{ fontSize: 12, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 3, fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}
