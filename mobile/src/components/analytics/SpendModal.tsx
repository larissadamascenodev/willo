import { useMemo } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import type { CategoryAnalytics } from "@/services/categoryAnalytics";
import { appGroupOf } from "~/lib/taxonomy";
import { categoryHex } from "@/lib/categoryData";
import { MONTH_NAMES } from "@/lib/projectionRows";
import BottomSheet from "~/components/BottomSheet";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import type { IconCmp } from "~/lib/categoryIconSlugs";
import { INK, RED } from "~/theme/tokens";

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

  return (
    <BottomSheet open={!!subject} onClose={onClose} full>
      {subject && Icon && (
        <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
          {/* ══ What it is ══ */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Icon size={24} color={subject.hex} strokeWidth={2} />
            </View>
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{subject.name}</Text>
          </View>

          {/* ══ What it took ══ */}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 18, fontSize: 44, fontWeight: "800", letterSpacing: -1.8, color: "#fff" }]}>
            {money(total)}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 15, color: INK.soft }}>
            Gastos em {MONTH_NAMES[month]} {year}
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row" }}>
            <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.07)" }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subject.group?.hex ?? subject.hex }} />
              <Text style={{ fontSize: 14, color: "#fff" }}>
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
                      <View style={{ width: "100%", maxWidth: 40, height, borderRadius: 20, backgroundColor: now ? subject.hex : "rgba(255,255,255,0.07)" }} />
                    ) : (
                      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.18)" }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: now ? "700" : "500", letterSpacing: 0.4, color: now ? "#fff" : INK.soft }}>{SHORT[h.month]}</Text>
                </View>
              );
            })}
          </View>

          {/* ══ For a group, its parts ══ */}
          {parts.length > 1 && (
            <View style={{ marginTop: 26, gap: 2 }}>
              {parts.map(([cat, amount]) => (
                <View key={cat} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: categoryHex(cat, data?.customCats) }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: "rgba(255,255,255,0.86)" }}>{cat}</Text>
                  <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ══ Every charge ══ */}
          <View style={{ marginTop: 22 }}>
            {charges.length === 0 ? (
              <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 14, color: INK.softer }}>Nada gasto aqui neste mês.</Text>
            ) : (
              charges.map((t) => {
                const CatIcon = categoryIcon(t.category, data?.customCats);
                const hex = categoryHex(t.category, data?.customCats);
                const day = new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
                return (
                  <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
                      <CatIcon size={20} color={chipInk(hex)} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{t.name}</Text>
                      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.soft }}>
                        {day} · {t.category}
                        {t.installments && t.installment_current ? ` · ${t.installment_current}/${t.installments}` : ""}
                      </Text>
                    </View>
                    <Text style={[nums, { fontSize: 15.5, fontWeight: "700", color: RED }]}>−{money(Number(t.amount))}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

