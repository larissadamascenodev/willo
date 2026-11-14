import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import type { AnalyticsTransaction, CategoryAnalytics } from "@/services/categoryAnalytics";
import { supabase } from "~/supabase/client";
import CenterModal from "~/components/CenterModal";
import { CreditCard } from "~/components/icons";
import { appGroupOf } from "~/lib/taxonomy";
import { categoryHex } from "@/lib/categoryData";
import { MONTH_NAMES } from "@/lib/projectionRows";
import BottomSheet from "~/components/BottomSheet";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import type { IconCmp } from "~/lib/categoryIconSlugs";
import { INK, RED } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * Where one subject's money went, in a pane of glass over the page.
 *
 * A category, or a group and everything in it: its glyph and name, what it took this
 * month in large, the group it belongs to, six months of it as bars with this month lit,
 * and then every charge. Opened from the list in place, rather than as a page of its own,
 * so the month stays where it was underneath.
 */

export interface SpendSubject {
  name: string;
  hex: string;
  icon: IconCmp;
  /** The categories it covers: one for a category, all of a group's. */
  categories: string[];
  /** For a category, the group it is in. */
  group?: { name: string; hex: string };
}

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const TRACK = 120;

/** The group a category is in, when it is in one. */
export const groupOf = appGroupOf;

export default function SpendModal({
  subject,
  data,
  month,
  year,
  onClose,
}: {
  subject: SpendSubject | null;
  data: CategoryAnalytics | null;
  month: number;
  year: number;
  onClose: () => void;
}) {
  const inSubject = useMemo(() => new Set((subject?.categories ?? []).map((c) => c.toLowerCase())), [subject]);

  /* Six months, the categories added together, oldest first and ending on this one. */
  const history = useMemo(() => {
    if (!subject || !data) return [];
    const out: { month: number; year: number; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      let amount = 0;
      for (const [cat, entries] of Object.entries(data.historical)) {
        if (!inSubject.has(cat.toLowerCase())) continue;
        amount += entries.find((e) => e.month === m && e.year === y)?.amount ?? 0;
      }
      out.push({ month: m, year: y, amount });
    }
    return out;
  }, [subject, data, inSubject, month, year]);

  const charges = useMemo(
    () =>
      (data?.transactions ?? [])
        .filter((t) => t.type === "despesa" && inSubject.has(t.category.toLowerCase()))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data, inSubject],
  );
  const total = charges.reduce((s, t) => s + Number(t.amount), 0);
  const max = Math.max(...history.map((h) => h.amount), 1);

  /* For a group, what each of its categories took — the parts of the figure. */
  const parts = useMemo(() => {
    if (!subject || subject.categories.length < 2) return [];
    const by = new Map<string, number>();
    charges.forEach((t) => by.set(t.category, (by.get(t.category) ?? 0) + Number(t.amount)));
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [subject, charges]);

  const Icon = subject?.icon;

  /* Where each charge was paid from: the card or the account, by name. */
  const [names, setNames] = useState<{ accounts: Record<string, string>; cards: Record<string, { name: string; due: number }> }>({ accounts: {}, cards: {} });
  useEffect(() => {
    if (!subject) return;
    let alive = true;
    void Promise.all([
      supabase.from("accounts").select("id, name"),
      supabase.from("credit_cards").select("id, name, due_day"),
    ]).then(([a, c]) => {
      if (!alive) return;
      setNames({
        accounts: Object.fromEntries(((a.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])),
        cards: Object.fromEntries(((c.data ?? []) as { id: string; name: string; due_day: number }[]).map((r) => [r.id, { name: r.name, due: r.due_day }])),
      });
    });
    return () => {
      alive = false;
    };
  }, [subject]);
  const [open, setOpen] = useState<AnalyticsTransaction | null>(null);
  const onCard = (t: AnalyticsTransaction) => t.payment_method === "cartao" && !!t.credit_card_id;
  const paidWith = (t: AnalyticsTransaction) => {
    if (onCard(t)) return `Cartão ${names.cards[t.credit_card_id!]?.name ?? ""}`.trim();
    const acc = (t as AnalyticsTransaction & { account_id?: string | null }).account_id;
    return (acc && names.accounts[acc]) || "Conta";
  };

  return (
    <BottomSheet open={!!subject} onClose={onClose} full>
      {subject && Icon && (
        <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
          {/* ══ What it is ══ */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
              <Icon size={24} color={th(subject.hex)} strokeWidth={2} />
            </View>
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>{subject.name}</Text>
          </View>

          {/* ══ What it took ══ */}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 18, fontSize: 44, fontWeight: "800", letterSpacing: -1.8, color: th("#fff") }]}>
            {money(total)}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 15, color: th(INK.soft) }}>
            Gastos em {MONTH_NAMES[month]} {year}
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row" }}>
            <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: th(subject.group?.hex ?? subject.hex, "bg") }} />
              <Text style={{ fontSize: 14, color: th("#fff") }}>
                {subject.group ? subject.group.name : `${subject.categories.length > 1 ? `${parts.length} ${parts.length === 1 ? "categoria" : "categorias"}` : "Categoria"}`}
              </Text>
            </View>
          </View>

          {/* ══ Six months of it, this one lit ══ */}
          <View style={{ marginTop: 28, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            {history.map((h, i) => {
              const now = i === history.length - 1;
              const height = h.amount > 0 ? Math.max(18, (h.amount / max) * TRACK) : 0;
              return (
                <View key={`${h.year}-${h.month}`} style={{ flex: 1, alignItems: "center", gap: 10 }}>
                  <View style={{ height: TRACK, width: "100%", alignItems: "center", justifyContent: "flex-end" }}>
                    {height > 0 ? (
                      <View style={{ width: "100%", maxWidth: 40, height, borderRadius: 20, backgroundColor: th(now ? subject.hex : "rgba(255,255,255,0.07)", "bg") }} />
                    ) : (
                      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderStyle: "dashed", borderColor: th("rgba(255,255,255,0.18)", "line") }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: now ? "700" : "500", letterSpacing: 0.4, color: th(now ? "#fff" : INK.soft) }}>{SHORT[h.month]}</Text>
                </View>
              );
            })}
          </View>

          {/* ══ For a group, its parts ══ */}
          {parts.length > 1 && (
            <View style={{ marginTop: 26, gap: 2 }}>
              {parts.map(([cat, amount]) => (
                <View key={cat} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(categoryHex(cat, data?.customCats), "bg") }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: th("rgba(255,255,255,0.86)") }}>{cat}</Text>
                  <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: th("#fff") }]}>{money(amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ══ Every charge ══ */}
          <View style={{ marginTop: 22 }}>
            {charges.length === 0 ? (
              <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 14, color: th(INK.softer) }}>Nada gasto aqui neste mês.</Text>
            ) : (
              charges.map((t) => {
                const CatIcon = categoryIcon(t.category, data?.customCats);
                const hex = categoryHex(t.category, data?.customCats);
                const card = onCard(t);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setOpen(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name}, ${money(Number(t.amount))}, ver detalhes`}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
                      <CatIcon size={20} color={th(chipInk(hex))} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {card && <CreditCard size={14} color={th(INK.soft)} strokeWidth={2.2} />}
                        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>{t.name}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
                        {t.category} · {paidWith(t)}
                        {t.installments && t.installments > 1 && t.installment_current ? ` · ${t.installment_current}/${t.installments}` : ""}
                      </Text>
                    </View>
                    <Text style={[nums, { fontSize: 15.5, fontWeight: "700", color: th(RED) }]}>−{money(Number(t.amount))}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      )}
      <ChargeDetails
        tx={open}
        onClose={() => setOpen(null)}
        paidWith={open ? paidWith(open) : ""}
        due={open && onCard(open) ? names.cards[open.credit_card_id!]?.due ?? null : null}
        month={month}
        year={year}
      />
    </BottomSheet>
  );
}

const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/**
 * One charge, whole: what it was, how it was paid, when it was bought and when the money
 * actually leaves. On a card those are two dates: a purchase of October can be paid in
 * November's invoice, which is why it is counted there.
 */
function ChargeDetails({
  tx,
  onClose,
  paidWith,
  due,
  month,
  year,
}: {
  tx: AnalyticsTransaction | null;
  onClose: () => void;
  paidWith: string;
  /** The card's due day, for a charge on a card. */
  due: number | null;
  month: number;
  year: number;
}) {
  /* Kept through the way out, so the pane does not empty as it leaves. */
  const [last, setLast] = useState<AnalyticsTransaction | null>(tx);
  useEffect(() => {
    if (tx) setLast(tx);
  }, [tx]);
  const t = tx ?? last;
  if (!t) return null;

  const card = t.payment_method === "cartao" && !!t.credit_card_id;
  const amount = Number(t.amount);
  const parts = t.installments && t.installments > 1 ? t.installments : 0;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dueIso = due ? `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(due, lastDay)).padStart(2, "0")}` : null;
  const cardName = paidWith.replace(/^Cartão\s*/, "");

  const rows: [string, string][] = [
    ["Categoria", t.category],
    ["Pago com", card ? `Cartão de crédito${cardName ? ` · ${cardName}` : ""}` : paidWith],
    [card ? "Data da compra" : "Data", longDay(t.date)],
  ];
  if (card) rows.push(["Pagamento", `Fatura de ${MONTH_NAMES[month].toLowerCase()}${dueIso ? `, vence ${longDay(dueIso)}` : ""}`]);
  else rows.push(["Situação", t.status === "pago" ? "Pago" : "A pagar"]);
  if (parts) {
    rows.push(["Parcela", `${t.installment_current ?? 1} de ${parts}`]);
    rows.push(["Total da compra", money(amount * parts)]);
  }
  if (t.recurrence_type === "fixa") rows.push(["Repete", "Todo mês"]);
  const note = (t as AnalyticsTransaction & { observation?: string | null }).observation?.trim();

  return (
    <CenterModal open={!!tx} onClose={onClose} title={t.name} subtitle={card ? "No cartão de crédito" : undefined}>
      <Text style={[nums, { fontSize: 34, fontWeight: "800", letterSpacing: -1.2, color: th(RED) }]}>−{money(amount)}</Text>
      {parts ? <Text style={{ marginTop: 2, fontSize: 13.5, color: th(INK.soft) }}>por parcela</Text> : null}
      <View style={{ marginTop: 14 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.08)", "line") }}>
            <Text style={{ fontSize: 14.5, color: th(INK.soft) }}>{label}</Text>
            <Text style={[nums, { flexShrink: 1, textAlign: "right", fontSize: 14.5, fontWeight: "600", color: th("#fff") }]}>{value}</Text>
          </View>
        ))}
        {note ? (
          <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.08)", "line") }}>
            <Text style={{ fontSize: 14.5, color: th(INK.soft) }}>Observação</Text>
            <Text style={{ marginTop: 4, fontSize: 14.5, color: th("#fff") }}>{note}</Text>
          </View>
        ) : null}
      </View>
    </CenterModal>
  );
}
