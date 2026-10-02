import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarCheck, CalendarClock, Camera, Check, CreditCard, FileText, Image as ImageIcon, MoreVertical, Pencil, Plus, Trash2, Undo2, Wallet } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { colorFor } from "@/lib/banks";
import { anchorPurchaseDate, invoicePeriodIndex } from "@/lib/installments";
import { getCategoryColor, getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { getInvoiceItems, getInvoices, payInvoice, undoInvoicePayment, type Invoice } from "@/services/invoiceService";
import { createTransaction, deleteCreditCard, deleteTransaction, getAccounts, getCreditCards, getTransactionById } from "@/services/transactionService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { CardCreateSheet, type EditableCard } from "~/features/wallet/CardCreateSheet";
import { PaySheet, type PayAccount, type PaymentDetails } from "~/features/fatura/PaySheet";
import { EntrySheet, type CardEntry } from "~/features/fatura/EntrySheet";
import { ImportReviewSheet, type ExtractedItem } from "~/features/fatura/ImportReviewSheet";
import { pickDocument, pickFromCamera, pickFromLibrary, processScanFile, type ScanFile } from "~/lib/scan";
import { BottomSheet, Button, Glass, PageHeader, ProgressBar, Screen, Segmented, Text, colors, toast, white } from "~/ui";
import { hsl, tint } from "~/lib/color";

interface EnrichedItem {
  id: string;
  invoice_id: string;
  transaction_id: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  transaction_name: string;
  transaction_category: string;
  transaction_date: string;
  transaction_recurrence_type: string;
  transaction_parent_id: string | null;
}

const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const shortDate = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** A fatura de um cartão: o total do mês, o limite, o histórico, as compras e o pagamento. */
export default function Fatura() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { cardId, month: monthParam, year: yearParam } = useLocalSearchParams<{ cardId: string; month?: string; year?: string }>();

  const now = new Date();
  const [month, setMonth] = useState(monthParam ? Number(monthParam) : now.getMonth() + 1);
  const [year, setYear] = useState(yearParam ? Number(yearParam) : now.getFullYear());
  const [card, setCard] = useState<EditableCard | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [accounts, setAccounts] = useState<PayAccount[]>([]);
  const [payAccountId, setPayAccountId] = useState("");
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"geral" | "parcelados">("geral");

  const [showPay, setShowPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [entry, setEntry] = useState<CardEntry | null>(null);
  const [menu, setMenu] = useState(false);
  const [importMenu, setImportMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<{ items: ExtractedItem[]; message: string; declared: number | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const picked = useRef(false);

  const currentInvoice = useMemo(() => invoices.find((i) => i.month === month && i.year === year), [invoices, month, year]);

  const loadCard = useCallback(async () => {
    const cards = (await getCreditCards()) as unknown as EditableCard[];
    setCard(cards.find((c) => c.id === cardId) ?? null);
  }, [cardId]);

  const loadAll = useCallback(async () => {
    if (!user || !cardId) return;
    try {
      const [cards, accs, inv] = await Promise.all([getCreditCards(), getAccounts(), getInvoices(cardId)]);
      const found = (cards as unknown as EditableCard[]).find((c) => c.id === cardId) ?? null;
      setCard(found);
      const accList = accs as unknown as (PayAccount & { is_default?: boolean })[];
      setAccounts(accList);
      setPayAccountId((cur) => cur || accList.find((a) => a.is_default)?.id || accList[0]?.id || "");
      setInvoices(inv);

      // abre na fatura que ainda pede atenção: a mais antiga em aberto, ou o ciclo em andamento
      if (!picked.current && found) {
        picked.current = true;
        if (!monthParam) {
          const unpaid = inv.filter((i) => !i.is_paid && Number(i.total_amount) > 0).sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))[0];
          if (unpaid) { setMonth(unpaid.month); setYear(unpaid.year); }
          else {
            const period = invoicePeriodIndex(new Date().toISOString().slice(0, 10), found.closing_day);
            setMonth((period % 12) + 1); setYear(Math.floor(period / 12));
          }
        }
      }
    } catch {
      toast.error("Erro ao carregar fatura");
    } finally {
      setLoading(false);
    }
  }, [user, cardId, monthParam]);

  const loadItems = useCallback(async () => {
    if (!currentInvoice) { setItems([]); return; }
    try {
      setItems((await getInvoiceItems(currentInvoice.id)) as EnrichedItem[]);
    } catch { /* mantém o que já estava */ }
  }, [currentInvoice]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { getCustomCategories().then(setCustom).catch(() => {}); }, []);

  // editar uma compra ou lançar uma nova pela tela de lançamento volta com tudo certo
  useEffect(() => {
    const w = window as any;
    const reload = () => { loadAll(); };
    w.addEventListener("finance-data-changed", reload);
    return () => w.removeEventListener("finance-data-changed", reload);
  }, [loadAll]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => ((b.transaction_date ?? "").localeCompare(a.transaction_date ?? "")) || (b.id ?? "").localeCompare(a.id ?? "")),
    [items],
  );
  const shown = tab === "parcelados" ? sorted.filter((i) => i.total_installments > 1) : sorted;

  const total = currentInvoice ? Number(currentInvoice.total_amount) : 0;
  const paidAmount = currentInvoice ? Number(currentInvoice.paid_amount ?? 0) : 0;
  const outstanding = Math.max(0, total - paidAmount);
  const limitTotal = card ? Number(card.limit) : 0;
  const usedLimit = card ? Number((card as any).used_limit ?? 0) : 0;
  const usedPct = limitTotal > 0 ? Math.min((usedLimit / limitTotal) * 100, 100) : 0;
  const overLimit = usedLimit > limitTotal;
  const hex = colorFor(card?.name ?? "", card?.color, "#3A3A3F");

  const dueInfo = useMemo(() => {
    if (!card) return null;
    const due = new Date(year, month - 1, card.due_day); due.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (diff < 0) return { text: `Venceu há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}`, overdue: true };
    if (diff === 0) return { text: "Vence hoje", overdue: true };
    return { text: `Vence em ${diff} ${diff === 1 ? "dia" : "dias"}`, overdue: false };
  }, [card, month, year]);

  const status = useMemo(() => {
    if (!currentInvoice) return null;
    if (currentInvoice.is_paid && outstanding <= 0) return { label: "Paga", hex: colors.green };
    if (card && new Date() > new Date(year, month - 1, card.closing_day)) return { label: "Fechada", hex: colors.amber };
    return { label: "Aberta", hex: "#FFFFFF" };
  }, [currentInvoice, card, month, year, outstanding]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.transaction_category || "Outros", (map.get(it.transaction_category || "Outros") ?? 0) + Number(it.amount));
    return [...map.entries()].map(([category, value]) => ({ category, value, pct: total > 0 ? (value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);
  }, [items, total]);

  /** Os meses para escolher: do primeiro ao último com fatura, mais o atual. */
  const months = useMemo(() => {
    const idx = invoices.map((i) => i.year * 12 + (i.month - 1));
    const cur = now.getFullYear() * 12 + now.getMonth();
    const from = Math.min(cur - 2, ...idx);
    const to = Math.max(cur + 3, ...idx);
    return Array.from({ length: to - from + 1 }, (_, k) => {
      const key = from + k;
      const m = (key % 12) + 1;
      const y = Math.floor(key / 12);
      const inv = invoices.find((i) => i.month === m && i.year === y);
      return { key, month: m, year: y, amount: inv ? Number(inv.total_amount) : 0, paid: !!inv?.is_paid && Number(inv.total_amount) - Number(inv.paid_amount ?? 0) <= 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);
  const monthsRef = useRef<ScrollView>(null);
  useEffect(() => {
    const i = months.findIndex((m) => m.month === month && m.year === year);
    if (i >= 0) monthsRef.current?.scrollTo({ x: Math.max(i * 68 - 120, 0), animated: true });
  }, [months, month, year]);

  const handlePay = async (d: PaymentDetails) => {
    if (!currentInvoice || !payAccountId) return;
    setPaying(true);
    try {
      await payInvoice(currentInvoice.id, payAccountId, { mode: d.mode, amount_paid: d.amountPaid, installments: d.installments, entry_amount: d.entryAmount });
      toast.success(`Fatura paga ${d.mode === "total" ? "integralmente" : d.mode === "minimo" ? "parcialmente" : "parcelada"}!`);
      setShowPay(false);
      (window as any).dispatchEvent(new CustomEvent("finance-data-changed"));
      await loadAll();
      await loadItems();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao pagar fatura");
    } finally {
      setPaying(false);
    }
  };

  const undoPayment = async () => {
    if (!currentInvoice) return;
    try {
      await undoInvoicePayment(currentInvoice.id);
      toast.success("Pagamento desfeito");
      (window as any).dispatchEvent(new CustomEvent("finance-data-changed"));
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao desfazer pagamento");
    }
  };

  const openEntry = (it: EnrichedItem) => setEntry({
    transactionId: it.transaction_id, name: it.transaction_name, category: it.transaction_category,
    amount: Number(it.amount), date: it.transaction_date, installmentNumber: it.installment_number, totalInstallments: it.total_installments,
  });

  const editEntry = async (id: string) => {
    setEntry(null);
    try {
      let tx = await getTransactionById(id);
      if (tx.parent_transaction_id) tx = await getTransactionById(tx.parent_transaction_id);
      router.push({ pathname: "/nova", params: { edit: tx.id } });
    } catch {
      toast.error("Erro ao carregar transação");
    }
  };

  const removeEntry = (id: string) => {
    const it = items.find((i) => i.transaction_id === id);
    setEntry(null);
    const removeAll = async () => {
      try {
        const tx = await getTransactionById(id);
        await deleteTransaction(tx.parent_transaction_id || id);
        toast.success("Lançamento excluído");
        await loadAll(); await loadItems();
      } catch { toast.error("Erro ao excluir lançamento"); }
    };
    const removeThisMonth = async () => {
      try {
        const tx = await getTransactionById(id);
        await supabase.from("recurring_exclusions").insert({ transaction_id: tx.parent_transaction_id || id, user_id: user!.id, month: month - 1, year } as any);
        if (it) {
          await supabase.from("invoice_items").delete().eq("id", it.id);
          if (currentInvoice) await supabase.rpc("recalc_invoice_total", { p_invoice_id: currentInvoice.id });
        }
        toast.success("Removida só deste mês");
        await loadAll(); await loadItems();
      } catch { toast.error("Erro ao excluir lançamento"); }
    };
    if (it && it.transaction_recurrence_type === "fixa") {
      Alert.alert("Excluir assinatura", "Remover só desta fatura ou de todas?", [
        { text: "Só deste mês", onPress: removeThisMonth },
        { text: "Todas", style: "destructive", onPress: removeAll },
        { text: "Cancelar", style: "cancel" },
      ]);
    } else {
      Alert.alert("Excluir lançamento", "Essa compra será removida da fatura.", [
        { text: "Excluir", style: "destructive", onPress: removeAll },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  };

  const readFile = async (file: ScanFile | null) => {
    if (!file) return;
    setReading(true);
    try {
      const data = await processScanFile(file, "invoice");
      const found: ExtractedItem[] = (data.items || []).map((i: any) => ({ ...i, selected: true }));
      if (found.length === 0) { toast.error("Nenhuma compra encontrada nessa fatura."); return; }
      setReview({ items: found, message: data.message || "Lançamentos encontrados!", declared: data.declared_total ?? null });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao processar fatura");
    } finally {
      setReading(false);
    }
  };

  const startImport = async (pick: () => Promise<ScanFile | null>) => {
    setImportMenu(false);
    try { await readFile(await pick()); } catch (e: any) { toast.error(e?.message ?? "Não foi possível abrir"); }
  };

  const confirmImport = async (chosen: ExtractedItem[]) => {
    if (!user || !card) return;
    setConfirming(true);
    try {
      const period = year * 12 + (month - 1);
      for (const item of chosen) {
        const refund = item.amount < 0;
        const parcelado = !refund && !!(item.installment_current && item.installment_total && item.installment_total > 1);
        // "4/10": três parcelas já foram cobradas em faturas anteriores
        const alreadyPaid = parcelado ? item.installment_current! - 1 : 0;
        const purchaseDate = anchorPurchaseDate(item as any, period, alreadyPaid, card.closing_day);
        const note = parcelado && item.date && item.date !== purchaseDate ? `compra em ${item.date}` : "";
        await createTransaction(
          {
            name: item.description, type: "despesa", amount: item.amount, category: item.category || "Outros", date: purchaseDate,
            status: "pago", payment_method: "cartao", credit_card_id: cardId,
            recurrence_type: parcelado ? "parcelado" : "unica",
            installments: parcelado ? item.installment_total : null,
            installment_current: parcelado ? item.installment_current : null,
            observation: alreadyPaid > 0 ? `paid_installments:${alreadyPaid}${note ? ` | ${note}` : ""}` : null,
          } as any,
          user.id,
        );
      }
      toast.success(`${chosen.length} ${chosen.length === 1 ? "lançamento importado" : "lançamentos importados"}!`);
      setReview(null);
      await loadAll(); await loadItems();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar lançamentos");
    } finally {
      setConfirming(false);
    }
  };

  const removeCard = () => {
    setMenu(false);
    Alert.alert("Excluir cartão", "O cartão, as faturas e as compras dele serão apagados. Isso não pode ser desfeito.", [
      { text: "Excluir cartão", style: "destructive", onPress: async () => {
        try { await deleteCreditCard(cardId); toast.success("Cartão excluído"); router.back(); } catch { toast.error("Não foi possível excluir o cartão"); }
      } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <PageHeader title="Fatura" />
        <View style={{ marginTop: 24, height: 300, borderRadius: 26, backgroundColor: white(0.06) }} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={async () => { await loadAll(); await loadItems(); }}>
      <PageHeader
        title={card?.name ?? "Cartão"}
        subtitle={card?.last_four_digits ? `•••• ${card.last_four_digits}` : undefined}
        action={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => setImportMenu(true)} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.08) }}>
              <Plus size={14} color="#fff" />
              <Text weight="semibold" size={13}>Lançamento</Text>
            </Pressable>
            <Pressable onPress={() => setMenu(true)} accessibilityLabel="Opções do cartão" style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
              <MoreVertical size={16} color={white(0.82)} />
            </Pressable>
          </View>
        }
      />

      <Glass radius={26} style={{ marginTop: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
              <CreditCard size={18} color={hex} />
            </View>
            <Text size={13} color={white(0.62)}>Fatura de {MONTH_NAMES[month - 1]}</Text>
          </View>
          {status && (
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: tint(status.hex, 0.12) }}>
              <Text weight="bold" size={11} color={status.hex}>{status.label}</Text>
            </View>
          )}
        </View>

        <Text weight="extrabold" size={36} tabular style={{ marginTop: 16, letterSpacing: -1 }}>{fmt(paidAmount > 0 && outstanding > 0 ? outstanding : total)}</Text>
        {total > 0 && outstanding <= 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Check size={14} color={colors.green} strokeWidth={3} />
            <Text weight="medium" size={13} color={colors.green}>Paga</Text>
          </View>
        ) : dueInfo && outstanding > 0 ? (
          <Text size={13} color={dueInfo.overdue ? colors.red : white(0.62)}>{dueInfo.text}</Text>
        ) : null}

        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CalendarClock size={16} color={white(0.5)} />
            <Text size={12.5} color={white(0.66)}>Fecha dia <Text size={12.5} weight="semibold">{card?.closing_day}</Text></Text>
          </View>
          <View style={{ width: 1, height: 12, backgroundColor: white(0.1) }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CalendarCheck size={16} color={white(0.5)} />
            <Text size={12.5} color={white(0.66)}>Vence dia <Text size={12.5} weight="semibold">{card?.due_day}</Text></Text>
          </View>
        </View>

        <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text size={12} color={white(0.62)}>Limite usado</Text>
            <Text size={12.5} weight="semibold" tabular color={overLimit ? colors.red : white(0.82)}>{usedPct.toFixed(0)}%</Text>
          </View>
          <ProgressBar ratio={usedPct / 100} color={overLimit ? colors.red : hex} height={8} track={white(0.07)} />
          <View style={{ marginTop: 12, flexDirection: "row" }}>
            {[
              { label: "Usado", value: fmt(usedLimit), color: "#fff" },
              { label: "Disponível", value: fmt(limitTotal - usedLimit), color: overLimit ? colors.red : colors.green },
              { label: "Total", value: fmt(limitTotal), color: "#fff" },
            ].map((c, i) => (
              <View key={c.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: white(0.06) }}>
                <Text size={11.5} color={white(0.56)}>{c.label}</Text>
                <Text size={14} weight="semibold" tabular color={c.color}>{c.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {currentInvoice && outstanding > 0 && (
          <Button label={`Pagar fatura · ${fmt(outstanding)}`} icon={<Wallet size={16} color={colors.black} />} onPress={() => setShowPay(true)} style={{ marginTop: 20 }} />
        )}
      </Glass>

      <ScrollView ref={monthsRef} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {months.map((m) => {
          const on = m.month === month && m.year === year;
          return (
            <Pressable key={m.key} onPress={() => { setMonth(m.month); setYear(m.year); }} style={{ width: 60, paddingVertical: 10, borderRadius: 18, alignItems: "center", backgroundColor: on ? "#fff" : white(0.06) }}>
              <Text size={12} weight="semibold" color={on ? colors.black : white(0.74)}>{SHORT[m.month - 1]}{m.year !== now.getFullYear() ? `/${String(m.year).slice(2)}` : ""}</Text>
              <Text size={10.5} tabular color={on ? "rgba(11,11,11,0.62)" : m.amount > 0 ? (m.paid ? colors.green : white(0.56)) : white(0.3)}>{m.amount > 0 ? fmt(m.amount).replace(/\s/g, "") : "—"}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {breakdown.length > 0 && (
        <Glass radius={22} style={{ marginTop: 16, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text weight="semibold" size={12} color={white(0.5)} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>Gastos por categoria</Text>
            <Text weight="semibold" size={13} tabular>{fmt(total)}</Text>
          </View>
          <View style={{ marginTop: 12, height: 8, flexDirection: "row", gap: 2, borderRadius: 4, overflow: "hidden" }}>
            {breakdown.map((c) => <View key={c.category} style={{ width: `${Math.max(c.pct, 1)}%`, backgroundColor: hsl(getCategoryColor(c.category, custom)) }} />)}
          </View>
          <View style={{ marginTop: 16, gap: 12 }}>
            {breakdown.slice(0, 5).map((c) => {
              const Icon = getCategoryIcon(c.category, custom);
              const col = hsl(getCategoryColor(c.category, custom));
              return (
                <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: tint(col, 0.15) }}>
                    <Icon size={15} color={col} />
                  </View>
                  <Text size={14} style={{ flex: 1 }} numberOfLines={1}>{c.category}</Text>
                  <Text size={12} color={white(0.56)} tabular>{c.pct.toFixed(0)}%</Text>
                  <Text size={14} weight="semibold" tabular>{fmt(c.value)}</Text>
                </View>
              );
            })}
          </View>
        </Glass>
      )}

      <View style={{ marginTop: 20 }}>
        <Segmented<"geral" | "parcelados"> options={[{ key: "geral", label: "Geral" }, { key: "parcelados", label: "Compras parceladas" }]} value={tab} onChange={setTab} />
      </View>

      <View style={{ marginTop: 14, gap: 8 }}>
        {shown.length === 0 ? (
          <View style={{ borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.12), paddingVertical: 40, alignItems: "center" }}>
            <Text size={14} color={white(0.56)}>{tab === "parcelados" ? "Nenhuma compra parcelada nesta fatura." : "Nenhum lançamento nesta fatura."}</Text>
          </View>
        ) : (
          shown.map((it) => {
            const Icon = getCategoryIcon(it.transaction_category, custom);
            const col = getCategoryHexColor(it.transaction_category, custom);
            const parcelado = it.total_installments > 1;
            return (
              <Pressable key={it.id} onPress={() => openEntry(it)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                <Glass radius={20} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(col, 0.12) }}>
                    <Icon size={18} color={col} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="medium" size={15} numberOfLines={1}>{it.transaction_name}</Text>
                    <Text size={12} color={white(0.56)} numberOfLines={1}>{shortDate(it.transaction_date)} · {it.transaction_category}{parcelado ? ` · ${it.installment_number}/${it.total_installments}` : ""}</Text>
                  </View>
                  <Text weight="semibold" size={15} tabular color={Number(it.amount) < 0 ? colors.green : "#fff"}>{fmt(Math.abs(Number(it.amount)))}</Text>
                </Glass>
              </Pressable>
            );
          })
        )}
      </View>

      <PaySheet open={showPay} onClose={() => setShowPay(false)} outstanding={outstanding} accounts={accounts} accountId={payAccountId} onAccount={setPayAccountId} onConfirm={handlePay} paying={paying} />
      <EntrySheet entry={entry} cardName={card?.name} onClose={() => setEntry(null)} onEdit={editEntry} onDelete={removeEntry} />
      <ImportReviewSheet open={!!review} onClose={() => setReview(null)} items={review?.items ?? []} message={review?.message ?? ""} declaredTotal={review?.declared} onConfirm={confirmImport} confirming={confirming} />
      <CardCreateSheet open={showEdit} onClose={() => setShowEdit(false)} card={card} onCreated={loadCard} />

      <BottomSheet open={importMenu} onClose={() => setImportMenu(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text display weight="bold" size={20}>Novo lançamento</Text>
          <View style={{ marginTop: 8 }}>
            {[
              { label: "Digitar uma compra", sub: "Valor, categoria e data", icon: Pencil, run: () => { setImportMenu(false); router.push({ pathname: "/nova", params: { type: "despesa", payment: "cartao", card: cardId } }); } },
              { label: "Importar a fatura (PDF)", sub: "Lê todas as compras de uma vez", icon: FileText, run: () => startImport(pickDocument) },
              { label: "Fotografar a fatura", sub: "Usa a câmera", icon: Camera, run: () => startImport(pickFromCamera) },
              { label: "Foto da galeria", sub: "Print da fatura no app do banco", icon: ImageIcon, run: () => startImport(pickFromLibrary) },
            ].map((o) => (
              <Pressable key={o.label} onPress={o.run} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: white(0.06) }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: white(0.08), alignItems: "center", justifyContent: "center" }}>
                  <o.icon size={17} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight="medium" size={15.5}>{o.label}</Text>
                  <Text size={12.5} color={white(0.56)}>{o.sub}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet open={menu} onClose={() => setMenu(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text display weight="bold" size={20}>{card?.name}</Text>
          <View style={{ marginTop: 8 }}>
            <MenuRow icon={Pencil} label="Editar cartão" onPress={() => { setMenu(false); setShowEdit(true); }} />
            {currentInvoice && paidAmount > 0 && <MenuRow icon={Undo2} label="Desfazer pagamento" onPress={() => { setMenu(false); undoPayment(); }} />}
            <MenuRow icon={Trash2} label="Excluir cartão" danger onPress={removeCard} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet open={reading} onClose={() => {}}>
        <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 20 }}>
          <Text display weight="bold" size={20}>Lendo a fatura…</Text>
          <Text size={14} color={white(0.62)} align="center" style={{ marginTop: 6 }}>Pode levar alguns segundos.</Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function MenuRow({ icon: Icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: white(0.06) }}>
      <Icon size={18} color={danger ? colors.red : "#fff"} />
      <Text size={16} color={danger ? colors.red : "#fff"}>{label}</Text>
    </Pressable>
  );
}
