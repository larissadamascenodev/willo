import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { supabase } from "~/supabase/client";
import { useMonth } from "@/contexts/MonthContext";
import {
  buildCategorySummaries,
  loadCategoryAnalytics,
  type CategoryAnalytics,
} from "@/services/categoryAnalytics";
import { groupCategoryAmounts } from "@/lib/categoryGroups";
import { APP_GROUP_DEFS } from "~/lib/taxonomy";
import { MONTH_NAMES } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import SpendRing from "~/components/analytics/SpendRing";
import { CategoryRows, GroupCards, TopSpendRow, type OverviewCategory } from "~/components/analytics/CategoryViews";
import { categoryIcon } from "~/lib/categoryIcon";
import { groupIcon } from "~/lib/groupIcon";
import SpendModal, { groupOf, type SpendSubject } from "~/components/analytics/SpendModal";
import { ChartPie, Plus, Trash2, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Where the month went.
 *
 * The ring first, because the shape of a month — one big subject or ten small ones
 * — is read before any number is. Then the biggest single category, then the list,
 * which can be read as categories or as the handful of things those categories are
 * really about.
 *
 * Limits sit at the bottom rather than the top: a limit is something you set once
 * and then check, and what you came here for is to look.
 */

interface Limit {
  id: string;
  category: string;
  limit_amount: number;
}

/* No session is an answer, not a slow one — left null the screen sits on a
   skeleton that never resolves. */
const EMPTY: CategoryAnalytics = {
  transactions: [],
  prevTransactions: [],
  historical: {},
  installmentImpacts: {},
  customCats: [],
  userStartDate: null,
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AnalyticsCategorias() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();

  const [data, setData] = useState<CategoryAnalytics | null>(null);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [view, setView] = useState<"categorias" | "grupos">("categorias");
  const [sheet, setSheet] = useState<{ open: boolean; category: string | null }>({
    open: false,
    category: null,
  });

  const load = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      return;
    }
    setData(await loadCategoryAnalytics({ userId: user.id, month: selectedMonth, year: selectedYear }));
  }, [user, selectedMonth, selectedYear]);

  const loadLimits = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from("category_limits")
      .select("id, category, limit_amount")
      .eq("user_id", user.id);
    setLimits(
      (rows ?? []).map((r: any) => ({
        id: r.id,
        category: r.category,
        limit_amount: Number(r.limit_amount),
      })),
    );
  }, [user]);

  useEffect(() => {
    void load();
    void loadLimits();
    const onChange = () => {
      void load();
      void loadLimits();
    };
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load, loadLimits]);

  const summaries = useMemo(
    () => (data ? buildCategorySummaries(data.transactions) : []),
    [data],
  );

  /* The arithmetic is shared; the colour and the glyph are this app's. */
  const categories = useMemo<OverviewCategory[]>(
    () =>
      summaries.map((c) => ({
        name: c.name,
        amount: c.amount,
        percentage: c.percentage,
        hex: categoryHex(c.name, data?.customCats),
        icon: categoryIcon(c.name, data?.customCats),
      })),
    [summaries, data],
  );

  const groups = useMemo(() => groupCategoryAmounts(categories, APP_GROUP_DEFS), [categories]);
  const total = summaries.reduce((s, c) => s + c.amount, 0);
  const monthLabel = MONTH_NAMES[selectedMonth];

  /* A category or a group opens in a pane of glass over the page, not as a page of its own. */
  const [subject, setSubject] = useState<SpendSubject | null>(null);
  const openCategory = (name: string) => {
    const g = groupOf(name);
    setSubject({
      name,
      hex: categoryHex(name, data?.customCats),
      icon: categoryIcon(name, data?.customCats),
      categories: [name],
      group: g ? { name: g.name, hex: g.hex } : undefined,
    });
  };

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton to="/" />
        </View>

        {data === null ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 248, borderRadius: 124, alignSelf: "center", width: 248, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 80, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)" }} />
          </View>
        ) : categories.length === 0 ? (
          <Surface radius={22} style={{ marginTop: 20, paddingVertical: 40, alignItems: "center" }}>
            <ChartPie size={30} color={INK.faint} strokeWidth={1.6} />
            <Text style={{ marginTop: 12, fontSize: 14, color: INK.soft }}>
              Sem despesas em {monthLabel.toLocaleLowerCase("pt-BR")}
            </Text>
          </Surface>
        ) : (
          <>
            <Animated.View entering={FadeIn.duration(400)} style={{ marginTop: 8 }}>
              <SpendRing
                total={total}
                caption={`gastos em ${monthLabel.toLocaleLowerCase("pt-BR")}`}
                segments={
                  view === "categorias"
                    ? categories.map((c) => ({ key: c.name, hex: c.hex, amount: c.amount }))
                    : groups.map((g) => ({ key: g.def.name, hex: g.def.hex, amount: g.amount }))
                }
              />
            </Animated.View>

            {categories[0] && (
              <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: 18 }}>
                <TopSpendRow category={categories[0]} monthLabel={monthLabel} onOpen={openCategory} />
              </Animated.View>
            )}

            <View style={{ marginTop: 14 }}>
              <SegmentedTabs
                value={view}
                onChange={setView}
                height={38}
                options={[
                  { key: "categorias" as const, label: "Categorias" },
                  { key: "grupos" as const, label: "Grupos" },
                ]}
              />
            </View>

            <View style={{ marginTop: 14 }}>
              {view === "categorias" ? (
                <CategoryRows categories={categories} onOpen={openCategory} />
              ) : (
                <GroupCards
                  groups={groups}
                  onOpen={(g) =>
                    setSubject({
                      name: g.def.name,
                      hex: g.def.hex,
                      icon: groupIcon(g.def.icon),
                      categories: g.categories.map((c) => c.name),
                    })
                  }
                />
              )}
            </View>

            {/* ══ What you said you would not go past ══ */}
            <Surface radius={22} style={{ marginTop: 20, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                    Limites por categoria
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>
                    Quanto você ainda pode gastar em cada uma
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSheet({ open: true, category: null })}
                  style={({ pressed }) => ({
                    height: 34,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    paddingHorizontal: 12,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <Plus size={15} color="#0B0B0B" strokeWidth={2.6} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#0B0B0B" }}>Criar</Text>
                </Pressable>
              </View>

              {limits.length === 0 ? (
                <Text
                  style={{
                    marginTop: 16,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 13,
                    lineHeight: 18,
                    color: INK.soft,
                  }}
                >
                  Nenhum limite ainda. Crie um para acompanhar quanto falta em cada categoria.
                </Text>
              ) : (
                <View style={{ marginTop: 16, gap: 14 }}>
                  {limits.map((lim, i) => {
                    const spent = summaries.find((c) => c.name === lim.category)?.amount ?? 0;
                    const ratio = lim.limit_amount > 0 ? spent / lim.limit_amount : 0;
                    const left = lim.limit_amount - spent;
                    const Icon = categoryIcon(lim.category, data.customCats);
                    const hex = categoryHex(lim.category, data.customCats);
                    const tone = left < 0 ? RED : ratio >= 0.8 ? AMBER : "rgba(255,255,255,0.74)";
                    return (
                      <Pressable
                        key={lim.id}
                        onPress={() => setSheet({ open: true, category: lim.category })}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: `${hex}22`,
                            }}
                          >
                            <Icon size={16} color={hex} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, color: "#fff" }}>
                              {lim.category}
                            </Text>
                            <Text style={{ marginTop: 1, fontSize: 11, color: INK.soft }}>
                              {money(spent)} de {money(lim.limit_amount)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: tone }}>
                            {left < 0 ? `${money(-left)} acima` : `${money(left)} livre`}
                          </Text>
                        </View>
                        <View
                          style={{
                            marginLeft: 46,
                            marginTop: 6,
                            height: 6,
                            borderRadius: 999,
                            overflow: "hidden",
                            backgroundColor: "rgba(255,255,255,0.08)",
                          }}
                        >
                          <Bar
                            share={Math.min(ratio, 1)}
                            color={left < 0 ? RED : ratio >= 0.8 ? AMBER : "#fff"}
                            delay={0.1 + i * 0.05}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Surface>
          </>
        )}
      </ScrollView>

      <LimitSheet
        open={sheet.open}
        category={sheet.category}
        categories={summaries.map((c) => c.name)}
        current={limits.find((l) => l.category === sheet.category)?.limit_amount ?? null}
        onClose={() => setSheet({ open: false, category: null })}
        onSaved={() => {
          setSheet({ open: false, category: null });
          void loadLimits();
        }}
      />
      <SpendModal subject={subject} data={data} month={selectedMonth} year={selectedYear} onClose={() => setSubject(null)} />
    </Room>
  );
}

/**
 * Setting a limit.
 *
 * A limit with no category is a number nobody can check, so the category is picked
 * first and the amount second — and an existing one can be taken off, because a
 * limit you cannot remove is a limit you stop believing.
 */
function LimitSheet({
  open,
  category,
  categories,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: string | null;
  categories: string[];
  current: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [picked, setPicked] = useState<string | null>(category);
  const [cents, setCents] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(category);
    setCents(current ? Math.round(current * 100) : 0);
    setError(null);
    setSaving(false);
  }, [open, category, current]);

  const save = async () => {
    if (!user || !picked || cents <= 0) {
      setError("Escolha uma categoria e um valor.");
      return;
    }
    setSaving(true);
    try {
      const { data: row } = await supabase
        .from("category_limits")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", picked)
        .maybeSingle();

      if (row) {
        await supabase.from("category_limits").update({ limit_amount: cents / 100 }).eq("id", (row as any).id);
      } else {
        await supabase
          .from("category_limits")
          .insert({ user_id: user.id, category: picked, limit_amount: cents / 100 } as any);
      }
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      onSaved();
    } catch {
      setError("Não foi possível salvar o limite.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!user || !picked) return;
    setSaving(true);
    try {
      await supabase.from("category_limits").delete().eq("user_id", user.id).eq("category", picked);
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      onSaved();
    } catch {
      setError("Não foi possível remover o limite.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
            {current ? "Editar limite" : "Novo limite"}
          </Text>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={16} color={INK.soft} />
          </Pressable>
        </View>

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Categoria</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categories.map((name) => {
            const on = picked === name;
            return (
              <Pressable
                key={name}
                onPress={() => {
                  setPicked(name);
                  setError(null);
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? "#fff" : "rgba(255,255,255,0.08)",
                  backgroundColor: on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.035)",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: on ? "600" : "400", color: "#fff" }}>{name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Limite do mês</Text>
        <TextInput
          value={brl(cents)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 10);
            setCents(Math.min(Number(digits || "0"), 99999999));
            setError(null);
          }}
          keyboardType="number-pad"
          style={{
            marginTop: 8,
            minWidth: 0,
            fontSize: 34,
            fontWeight: "800",
            letterSpacing: -1.2,
            color: cents === 0 ? INK.faint : "#fff",
            padding: 0,
          }}
        />

        {error && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{error}</Text>}

        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: saving ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
            {saving ? "Salvando..." : "Salvar limite"}
          </Text>
        </Pressable>

        {current !== null && (
          <Pressable
            onPress={remove}
            disabled={saving}
            style={({ pressed }) => ({
              marginTop: 10,
              height: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Trash2 size={16} color={RED} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: RED }}>Remover limite</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}
