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
import { categoryHex } from "@/lib/categoryData";
import { colorFor } from "@/lib/banks";
import { isWallet } from "~/lib/ensureWallet";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface, { Hairline } from "~/components/Surface";
import BankMark from "~/components/BankMark";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import GastosPorCategoria from "~/components/home/GastosPorCategoria";
import CenterModal from "~/components/CenterModal";
import FluxoPanel from "~/components/financeiro/FluxoPanel";
import SpendRing from "~/components/analytics/SpendRing";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { Check, ChevronRight, MoreVertical, Pencil, Trash2, X } from "~/components/icons";
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
  const { selectedMonth, selectedYear } = useMonth();

  const [account, setAccount] = useState<Account | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  /* The two things that open over the page: every category as a ring, and every
     movement the account has ever had. */
  const [ringOpen, setRingOpen] = useState(false);
  const [movesOpen, setMovesOpen] = useState(false);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [shownCount, setShownCount] = useState(80);

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
  const overview = useMemo(
    () =>
      categoryData.map((c) => ({
        name: c.name,
        amount: c.amount,
        percentage: totalDespesas > 0 ? Math.round((c.amount / totalDespesas) * 100) : 0,
        hex: categoryHex(c.name, customCats),
        icon: categoryIcon(c.name, customCats),
      })),
    [categoryData, totalDespesas, customCats],
  );

  const ordered = useMemo(
    () => [...movements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [movements],
  );

  /* Everything this account has ever moved, read only when someone asks for it. */
  useEffect(() => {
    if (!movesOpen || history || !accountId) return;
    let alive = true;
    void getTransactions()
      .then((txs) => {
        if (!alive) return;
        const mine = (txs as unknown as Movement[]).filter((t) => t.account_id === accountId);
        setHistory(mine.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
      })
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [movesOpen, history, accountId]);

  /* New money moving makes what was read stale. */
  useEffect(() => {
    setHistory(null);
  }, [movements]);

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
    <Room lit sky>
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
          {account && isWallet(account.name) ? <View style={{ width: 40, height: 40 }} /> : <Pressable
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
          </Pressable>}
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
            </Animated.View>

            {/* ══ What moved through it: the same reading as the main cash flow, for this account alone ══ */}
            <Animated.View entering={FadeInDown.delay(60).duration(420)} style={{ marginTop: 26 }}>
              <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Fluxo de caixa</Text>
              <View style={{ marginTop: 18 }}>
                <FluxoPanel accountId={accountId} embedded />
              </View>
            </Animated.View>

            {/* ══ What took it: the biggest, called out, and the four after it ══ */}
            <Animated.View entering={FadeInDown.delay(110).duration(420)} style={{ marginTop: 34 }}>
              <View style={{ marginTop: 12 }}>
                <GastosPorCategoria
                  month={selectedMonth}
                  categories={categoryData.map((c) => ({ name: c.name, amount: c.amount, color: "", icon: "" }))}
                  onAnalysis={() => setRingOpen(true)}
                />
              </View>
            </Animated.View>

            {/* ══ The latest few, as on the main cash flow; the button opens the rest ══ */}
            <Animated.View entering={FadeInDown.delay(160).duration(420)} style={{ marginTop: 34 }}>
              <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Últimos lançamentos</Text>
              {ordered.length === 0 ? (
                <Text style={{ paddingVertical: 32, textAlign: "center", fontSize: 14, color: INK.soft }}>
                  Nada por aqui neste mês
                </Text>
              ) : (
                <View style={{ marginTop: 6 }}>
                  {ordered.slice(0, 5).map((tx) => (
                    <MovementRow key={tx.id} tx={tx} customCats={customCats} />
                  ))}
                </View>
              )}
              {ordered.length > 0 && (
                <Pressable
                  onPress={() => setMovesOpen(true)}
                  style={({ pressed }) => ({
                    marginTop: 16,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "500", color: "#fff" }}>Ver todos os lançamentos</Text>
                </Pressable>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* ── Where the month went, as a ring ── */}
      <CenterModal
        open={ringOpen}
        onClose={() => setRingOpen(false)}
        title="Para onde foi"
        subtitle={`${account?.name ?? "Conta"} · ${MONTH_NAMES[selectedMonth]}`}
      >
        <View style={{ marginTop: 6 }}>
          <SpendRing
            total={totalDespesas}
            caption={`saiu em ${MONTH_NAMES[selectedMonth].toLowerCase()}`}
            segments={categoryData.map((c) => ({ key: c.name, hex: categoryHex(c.name, customCats), amount: c.amount }))}
          />
        </View>
        <View style={{ marginTop: 18 }}>
          {overview.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <View
                key={cat.name}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 11,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(cat.hex) }}>
                  <Icon size={17} color={chipInk(cat.hex)} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{cat.name}</Text>
                  <Text style={{ marginTop: 1, fontSize: 12, color: cat.hex }}>{cat.percentage}%</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{money(cat.amount)}</Text>
              </View>
            );
          })}
        </View>
      </CenterModal>

      {/* ── Everything that has gone through it ── */}
      <CenterModal
        open={movesOpen}
        onClose={() => {
          setMovesOpen(false);
          setShownCount(80);
        }}
        title="Movimentações"
        subtitle={account ? `${account.name}${history ? ` · ${history.length} ${history.length === 1 ? "lançamento" : "lançamentos"}` : ""}` : undefined}
      >
        {history === null ? (
          <Text style={{ paddingVertical: 36, textAlign: "center", fontSize: 14, color: INK.softer }}>Carregando…</Text>
        ) : history.length === 0 ? (
          <Text style={{ paddingVertical: 36, textAlign: "center", fontSize: 14, color: INK.softer }}>Esta conta ainda não teve movimentações</Text>
        ) : (
          <>
            {history.slice(0, shownCount).map((tx) => (
              <MovementRow key={tx.id} tx={tx} customCats={customCats} />
            ))}
            {history.length > shownCount && (
              <Pressable
                onPress={() => setShownCount((n) => n + 80)}
                style={({ pressed }) => ({ marginTop: 16, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Mostrar mais</Text>
              </Pressable>
            )}
          </>
        )}
      </CenterModal>

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

/** One movement, drawn as the main cash flow draws its entries. */
function MovementRow({ tx, customCats }: { tx: Movement; customCats: CustomCategory[] }) {
  const Icon = categoryIcon(tx.category, customCats);
  const catHex = categoryHex(tx.category, customCats);
  const isReceita = tx.type === "receita";
  const day = new Date(`${tx.date.slice(0, 10)}T12:00:00`);
  const sameYear = day.getFullYear() === new Date().getFullYear();
  const date = day.toLocaleDateString("pt-BR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(catHex) }}>
        <Icon size={20} color={chipInk(catHex)} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{tx.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
          {date} · {tx.category}
          {tx.status !== "pago" ? " · pendente" : ""}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "600", color: isReceita ? GREEN : RED }}>
        {isReceita ? "+" : "−"}
        {money(Number(tx.amount))}
      </Text>
    </View>
  );
}
