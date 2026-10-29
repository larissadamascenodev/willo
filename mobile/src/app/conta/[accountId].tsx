import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  deleteAccount,
  getAccounts,
  getTransactions,
  updateAccount,
} from "@/services/transactionService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { useMonth } from "@/contexts/MonthContext";
import MonthStrip from "~/components/MonthStrip";
import { categoryHex } from "@/lib/categoryData";
import { colorFor } from "@/lib/banks";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface, { Hairline } from "~/components/Surface";
import BankMark from "~/components/BankMark";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import { FlexBar } from "~/components/Bar";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, MoreVertical, Pencil, Trash2, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One account, on its own.
 *
 * The wallet answers which account; this answers what is in it and what went
 * through it. The balance leads, because that is the thing you came to look at, and
 * under it the month: what came in, what went out, which categories took it, and
 * then every movement that touched this account and nothing else.
 *
 * Editing and deleting live behind the ⋮, the same place the cards keep them, rather
 * than as two buttons in the corner of every account you open.
 */

const TYPE_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/* The eight the web offers when a bank's own colour is not wanted. */
const COLOR_OPTIONS: { value: string; hex: string }[] = [
  { value: "violet", hex: "#8B5CF6" },
  { value: "emerald", hex: "#10B981" },
  { value: "sky", hex: "#0EA5E9" },
  { value: "amber", hex: "#F59E0B" },
  { value: "rose", hex: "#F43F5E" },
  { value: "cyan", hex: "#06B6D4" },
  { value: "fuchsia", hex: "#D946EF" },
  { value: "lime", hex: "#84CC16" },
];

interface Account {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  current_balance: number;
  initial_balance: number;
  color: string | null;
}

interface Movement {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: string;
  status: string;
  account_id: string | null;
}

export default function ContaDetalhe() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedMonth, selectedYear, setMonth } = useMonth();

  const [account, setAccount] = useState<Account | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState(false);

  const dots = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<AnchorRect | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("checking");
  const [editColor, setEditColor] = useState("violet");

  const load = useCallback(async () => {
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    try {
      const [accs, cats] = await Promise.all([getAccounts(), getCustomCategories()]);
      const acc = (accs as unknown as Account[]).find((a) => a.id === accountId);
      if (!acc) {
        router.replace("/gestao");
        return;
      }
      setAccount(acc);
      setEditName(acc.name);
      setEditType(acc.type);
      setEditColor(acc.color ?? "violet");
      setCustomCats(cats);

      const txs = await getTransactions({ month: selectedMonth, year: selectedYear });
      setMovements((txs as unknown as Movement[]).filter((t) => t.account_id === accountId));
    } finally {
      setLoading(false);
    }
  }, [user, accountId, selectedMonth, selectedYear, router]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  /* Only what has actually left the account counts as spent; what is still pending
     has not touched the balance above. */
  const categoryData = useMemo(() => {
    const byCategory = new Map<string, number>();
    movements
      .filter((t) => t.type === "despesa" && t.status === "pago")
      .forEach((t) => {
        byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Number(t.amount));
      });
    return Array.from(byCategory.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [movements]);

  const totalDespesas = categoryData.reduce((s, c) => s + c.amount, 0);
  const totalReceitas = movements
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((s, t) => s + Number(t.amount), 0);

  const ordered = useMemo(
    () => [...movements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [movements],
  );

  /* The month in weeks: what came in and what went out in each, so the shape of the
     month shows before any figure is read. Only what has really moved counts. */
  const weeks = useMemo(() => {
    const last = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const count = Math.ceil(last / 7);
    const rows = Array.from({ length: count }, (_, i) => ({
      label: `${i * 7 + 1}–${Math.min((i + 1) * 7, last)}`,
      income: 0,
      expense: 0,
    }));
    movements
      .filter((t) => t.status === "pago")
      .forEach((t) => {
        const day = Number(t.date.slice(8, 10));
        const w = rows[Math.min(Math.floor((day - 1) / 7), count - 1)];
        if (t.type === "receita") w.income += Number(t.amount);
        else if (t.type === "despesa") w.expense += Number(t.amount);
      });
    return rows;
  }, [movements, selectedMonth, selectedYear]);
  const peak = Math.max(...weeks.map((w) => Math.max(w.income, w.expense)), 1);

  const byDay = useMemo(() => {
    const groups: { day: string; items: Movement[] }[] = [];
    ordered.forEach((t) => {
      const day = t.date.slice(0, 10);
      const g = groups[groups.length - 1];
      if (g && g.day === day) g.items.push(t);
      else groups.push({ day, items: [t] });
    });
    return groups;
  }, [ordered]);

  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const today = new Date();
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return "Hoje";
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (same(d, yesterday)) return "Ontem";
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  };

  const openMenu = () => {
    dots.current?.measureInWindow((x, y, w, h) => {
      setMenu({ top: y, bottom: y + h, left: x, width: w });
    });
  };

  const save = async () => {
    if (!accountId || !editName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateAccount(accountId, {
        name: editName.trim(),
        type: editType,
        color: editColor,
      });
      setEditing(false);
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    } catch {
      setError("Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!accountId || saving) return;
    setSaving(true);
    try {
      await deleteAccount(accountId);
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      router.replace("/gestao");
    } catch {
      setError("Não foi possível excluir a conta.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const hex = account ? colorFor(account.name, account.color, "#6B7280") : "#6B7280";
  const balance = Number(account?.current_balance ?? 0);

  return (
    <Room lit>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/gestao" />
          <Pressable
            ref={dots}
            accessibilityLabel="Ações da conta"
            onPress={openMenu}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <MoreVertical size={20} color={INK.full} />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 150, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 96, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
          </View>
        ) : !account ? null : (
          <>
            {/* ══ Whose account, and what is in it ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4, paddingTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <BankMark name={account.name} hex={hex} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, fontWeight: "700", color: "#fff" }}>
                      {account.name}
                    </Text>
                    {account.is_default && (
                      <Text
                        style={{
                          overflow: "hidden",
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          fontSize: 10,
                          fontWeight: "700",
                          backgroundColor: "rgba(255,255,255,0.08)",
                          color: INK.soft,
                        }}
                      >
                        Principal
                      </Text>
                    )}
                  </View>
                  <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.softer }}>
                    {TYPE_LABEL[account.type] ?? TYPE_LABEL.checking}
                  </Text>
                </View>
              </View>

              <Text style={{ marginTop: 22, fontSize: 13.5, color: INK.soft }}>Saldo disponível</Text>
              <Text
                numberOfLines={1}
                style={[T.figureBig, { marginTop: 2, color: balance < 0 ? RED : "#fff" }]}
              >
                {money(balance)}
              </Text>
              <Text style={{ marginTop: 6, fontSize: 12.5, color: INK.softer }}>
                Saldo inicial {money(Number(account.initial_balance) || 0)}
              </Text>
            </Animated.View>

            {/* ══ The month, and how this account moved through it ══ */}
            <Animated.View entering={FadeInDown.delay(60).duration(420)} style={{ marginTop: 26 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
                <Text style={T.eyebrow}>Fluxo de caixa</Text>
                <MonthStrip month={selectedMonth} year={selectedYear} onChange={setMonth} />
              </View>

              <Surface radius={26} style={{ marginTop: 12, padding: 18 }}>
                <Text style={{ fontSize: 12.5, color: INK.soft }}>
                  Resultado de {MONTH_NAMES[selectedMonth].toLowerCase()}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[T.figure, { marginTop: 4, color: totalReceitas - totalDespesas < 0 ? RED : "#fff" }]}
                >
                  {totalReceitas - totalDespesas > 0 ? "+" : ""}
                  {money(totalReceitas - totalDespesas)}
                </Text>

                {/* In against out, as shares of everything that moved. */}
                <View style={{ marginTop: 14, flexDirection: "row", height: 6, gap: 3 }}>
                  {totalReceitas + totalDespesas > 0 ? (
                    <>
                      {totalReceitas > 0 && <FlexBar share={totalReceitas / (totalReceitas + totalDespesas)} color={GREEN} delay={0.05} />}
                      {totalDespesas > 0 && <FlexBar share={totalDespesas / (totalReceitas + totalDespesas)} color={RED} delay={0.1} />}
                    </>
                  ) : (
                    <View style={{ flex: 1, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" }} />
                  )}
                </View>

                <View style={{ marginTop: 16, flexDirection: "row", gap: 16 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <ArrowDownLeft size={13} color={GREEN} strokeWidth={2.6} />
                      <Text style={{ fontSize: 12, color: INK.soft }}>Entrou</Text>
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>
                      {money(totalReceitas)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <ArrowUpRight size={13} color={RED} strokeWidth={2.6} />
                      <Text style={{ fontSize: 12, color: INK.soft }}>Saiu</Text>
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>
                      {money(totalDespesas)}
                    </Text>
                  </View>
                </View>

                {/* The month in weeks. */}
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "flex-end", gap: 10, height: 112 }}>
                  {weeks.map((w, i) => (
                    <View key={w.label} style={{ flex: 1, alignItems: "center" }}>
                      <View style={{ height: 70, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                        <Animated.View
                          entering={FadeInDown.delay(180 + i * 60).duration(400)}
                          style={{ width: 9, height: Math.max((w.income / peak) * 70, w.income > 0 ? 4 : 2), borderRadius: 5, backgroundColor: w.income > 0 ? GREEN : "rgba(255,255,255,0.08)" }}
                        />
                        <Animated.View
                          entering={FadeInDown.delay(210 + i * 60).duration(400)}
                          style={{ width: 9, height: Math.max((w.expense / peak) * 70, w.expense > 0 ? 4 : 2), borderRadius: 5, backgroundColor: w.expense > 0 ? RED : "rgba(255,255,255,0.08)" }}
                        />
                      </View>
                      <Text style={{ marginTop: 8, fontSize: 10.5, color: INK.softer }}>{w.label}</Text>
                    </View>
                  ))}
                </View>
              </Surface>
            </Animated.View>

            {/* ══ What took it ══ */}
            {categoryData.length > 0 && (
              <Animated.View entering={FadeInDown.delay(110).duration(420)} style={{ marginTop: 28 }}>
                <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Onde mais saiu</Text>

                <View style={{ marginTop: 12, flexDirection: "row", height: 8, gap: 3, paddingHorizontal: 4 }}>
                  {categoryData.slice(0, 6).map((cat, i) => (
                    <FlexBar key={cat.name} share={cat.amount / totalDespesas} color={categoryHex(cat.name, customCats)} delay={0.05 * i} />
                  ))}
                </View>

                {(allCategories ? categoryData : categoryData.slice(0, 4)).map((cat, i) => {
                  const Icon = categoryIcon(cat.name, customCats);
                  const catHex = categoryHex(cat.name, customCats);
                  const share = totalDespesas > 0 ? cat.amount / totalDespesas : 0;
                  return (
                    <View
                      key={cat.name}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 4,
                        paddingVertical: 14,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(catHex) }}>
                        <Icon size={16} color={chipInk(catHex)} strokeWidth={2} />
                      </View>
                      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600", color: "#fff" }}>
                        {cat.name}
                      </Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{money(cat.amount)}</Text>
                        <Text style={{ marginTop: 2, fontSize: 12, color: catHex }}>{Math.round(share * 100)}%</Text>
                      </View>
                    </View>
                  );
                })}

                {categoryData.length > 4 && (
                  <Pressable
                    onPress={() => setAllCategories((v) => !v)}
                    hitSlop={8}
                    style={({ pressed }) => ({ marginTop: 4, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>
                      {allCategories ? "Mostrar menos" : `Ver as ${categoryData.length} categorias`}
                    </Text>
                    <View style={{ transform: [{ rotate: allCategories ? "180deg" : "0deg" }] }}>
                      <ChevronDown size={15} color={INK.soft} />
                    </View>
                  </Pressable>
                )}
              </Animated.View>
            )}

            {/* ══ Every movement that touched it, by day ══ */}
            <Animated.View entering={FadeInDown.delay(160).duration(420)} style={{ marginTop: 28 }}>
              <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Movimentações · {ordered.length}</Text>
              {ordered.length === 0 ? (
                <Surface radius={22} style={{ marginTop: 12, paddingVertical: 28, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: INK.softer }}>Nenhuma movimentação neste mês</Text>
                </Surface>
              ) : (
                byDay.map((group) => (
                  <View key={group.day} style={{ marginTop: 16 }}>
                    <Text style={{ paddingHorizontal: 4, fontSize: 12.5, fontWeight: "600", color: INK.softer }}>{dayLabel(group.day)}</Text>
                    <Surface radius={22} style={{ marginTop: 8 }}>
                      {group.items.map((tx, i) => {
                        const Icon = categoryIcon(tx.category, customCats);
                        const catHex = categoryHex(tx.category, customCats);
                        const isReceita = tx.type === "receita";
                        return (
                          <View key={tx.id}>
                            {i > 0 && <Hairline />}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(catHex) }}>
                                <Icon size={16} color={chipInk(catHex)} strokeWidth={2} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>{tx.name}</Text>
                                <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11.5, color: INK.softer }}>
                                  {tx.category}
                                  {tx.status !== "pago" ? " · pendente" : ""}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 14.5, fontWeight: "700", color: isReceita ? GREEN : "#fff" }}>
                                {isReceita ? "+" : "−"}
                                {money(Number(tx.amount))}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </Surface>
                  </View>
                ))
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* ── What you can do to the account ── */}
      <AnchoredMenu open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
        <MenuHeader title={account?.name ?? "Conta"} subtitle={money(balance)} />
        <MenuRow
          icon={Pencil}
          label="Editar conta"
          onPress={() => {
            setMenu(null);
            setEditing(true);
          }}
        />
        <MenuRow
          icon={Trash2}
          label="Excluir conta"
          danger
          last
          onPress={() => {
            setMenu(null);
            setConfirming(true);
          }}
        />
      </AnchoredMenu>

      {/* ── Editing it ── */}
      <BottomSheet open={editing} onClose={() => setEditing(false)}>
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Editar conta</Text>
            <Pressable
              accessibilityLabel="Fechar"
              onPress={() => setEditing(false)}
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

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Nome</Text>
          <TextInput
            value={editName}
            onChangeText={(t) => {
              setEditName(t);
              setError(null);
            }}
            placeholder="Nome da conta"
            placeholderTextColor={INK.faint}
            maxLength={60}
            style={{
              marginTop: 8,
              height: 48,
              minWidth: 0,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: INK.edge,
              backgroundColor: "rgba(255,255,255,0.05)",
              paddingHorizontal: 16,
              fontSize: 15.5,
              color: "#fff",
            }}
          />

          <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Tipo</Text>
          <View style={{ marginTop: 8 }}>
            <SegmentedTabs
              value={editType}
              onChange={setEditType}
              options={[
                { key: "checking", label: "Corrente" },
                { key: "savings", label: "Poupança" },
                { key: "cash", label: "Dinheiro" },
              ]}
            />
          </View>

          <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Cor</Text>
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {COLOR_OPTIONS.map((c) => {
              const on = editColor === c.value;
              return (
                <Pressable
                  key={c.value}
                  accessibilityLabel={`Cor ${c.value}`}
                  onPress={() => setEditColor(c.value)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.hex,
                    opacity: on ? 1 : 0.55,
                    borderWidth: on ? 2 : 0,
                    borderColor: "#fff",
                    transform: [{ scale: on ? 1.08 : 1 }],
                  }}
                >
                  {on && <Check size={16} color="#0B0B0B" strokeWidth={3} />}
                </Pressable>
              );
            })}
          </View>

          {error && <Text style={{ marginTop: 16, fontSize: 13, color: RED }}>{error}</Text>}

          <Pressable
            onPress={save}
            disabled={!editName.trim() || saving}
            style={({ pressed }) => ({
              marginTop: 24,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: !editName.trim() || saving ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
              {saving ? "Salvando..." : "Salvar"}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* ── Deleting it ── */}
      <BottomSheet open={confirming} onClose={() => setConfirming(false)}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Excluir conta</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: INK.soft }}>
            Tem certeza que deseja excluir {account?.name ?? "esta conta"}? As transações já lançadas nela
            não serão excluídas.
          </Text>
          {error && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{error}</Text>}
          <Pressable
            onPress={remove}
            disabled={saving}
            style={({ pressed }) => ({
              marginTop: 22,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(248,113,113,0.16)",
              borderWidth: 1,
              borderColor: "rgba(248,113,113,0.30)",
              opacity: saving ? 0.6 : pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: RED }}>
              {saving ? "Excluindo..." : "Excluir conta"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirming(false)}
            style={({ pressed }) => ({
              marginTop: 10,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Cancelar</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Room>
  );
}
