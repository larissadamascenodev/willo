import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Check, ChevronRight, Clock, CreditCard, FileText, Plus, Sparkles, StickyNote, Tag, Wallet, X } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { currencySymbol } from "@/lib/currency";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { createCustomCategory, getCustomCategories, type CustomCategory } from "@/services/categoryService";
import {
  createAccount, createCreditCard, createTransaction, getAccounts, getCreditCards, getTransactionById, suggestCategory, updateTransaction,
} from "@/services/transactionService";
import { Background, Button, Chip, FormRow, Glass, Text, colors, fonts, toast, white } from "~/ui";
import { AmountField } from "./AmountField";
import { CategoryCreateSheet } from "./CategoryCreateSheet";
import { CategoryPicker } from "./CategoryPicker";
import { formatCents, fromDateKey, toDateKey } from "./format";

type TxType = "receita" | "despesa";
type Recurrence = "unica" | "parcelado" | "fixa";
type Status = "pago" | "pendente";
type Payment = "conta" | "cartao";

interface Account { id: string; name: string; type: string; is_default: boolean }
interface CardItem { id: string; name: string; closing_day: number; due_day: number; color: string | null }

export interface NovaParams {
  type?: TxType;
  /** id da transação a editar */
  edit?: string;
  /** cartão já escolhido (vindo da tela do cartão) */
  card?: string;
  payment?: Payment;
  /** preenchimento vindo da leitura de um comprovante */
  name?: string;
  amount?: string;
  category?: string;
  date?: string;
  rec?: Recurrence;
  inst?: string;
}

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ACCOUNT_DOTS = ["#8b5cf6", "#f97316", "#00e676", "#00e676", "#3b82f6", "#ec4899"];

const Label = ({ children }: { children: string }) => (
  <Text size={13} weight="semibold" color={white(0.62)} style={{ marginTop: 24, marginBottom: 8, paddingHorizontal: 4 }}>{children}</Text>
);

const inputStyle = { height: 40, borderRadius: 20, backgroundColor: white(0.06), paddingHorizontal: 16, color: "#fff", fontSize: 14, fontFamily: fonts.regular } as const;

/**
 * Nova receita, nova despesa ou edição de um lançamento: o mesmo formulário do site, com o
 * valor digitado em centavos, categoria sugerida pela IA, conta ou cartão, e parcelas.
 */
export function NovaTransacao({ params }: { params: NovaParams }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isEdit = !!params.edit;

  const [type, setType] = useState<TxType>(params.type ?? "despesa");
  const [status, setStatus] = useState<Status>("pago");
  const [description, setDescription] = useState(params.name ?? "");
  const [cents, setCents] = useState(params.amount ? Math.round(Number(params.amount) * 100) : 0);
  const [category, setCategory] = useState(params.category ?? "");
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [date, setDate] = useState<Date>(params.date ? fromDateKey(params.date) : new Date());
  const [dateMode, setDateMode] = useState<"hoje" | "ontem" | "outros">(params.date ? "outros" : "hoje");
  const [payment, setPayment] = useState<Payment>(params.payment ?? "conta");
  const [recurrence, setRecurrence] = useState<Recurrence>(params.rec ?? "unica");
  const [installments, setInstallments] = useState(params.inst ? Number(params.inst) : 2);
  const [paidInstallments, setPaidInstallments] = useState(0);
  const [paidFlags, setPaidFlags] = useState<boolean[]>([]);
  const [observation, setObservation] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [creditCards, setCreditCards] = useState<CardItem[]>([]);
  const [creditCardId, setCreditCardId] = useState("");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [card, setCard] = useState({ name: "", limit: "", closing: "10", due: "20" });
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const income = type === "receita";
  const usingCard = type === "despesa" && payment === "cartao";

  /* ───────── dados de apoio ───────── */
  useEffect(() => {
    if (!user) return;
    getAccounts()
      .then((accs) => {
        const list = (accs as Account[]).filter((a) => a.type !== "investment");
        setAccounts(list);
        const def = list.find((a) => a.is_default);
        if (def) setAccountId((cur) => cur || def.id);
      })
      .catch(() => toast.error("Erro ao carregar contas"))
      .finally(() => setLoadingAccounts(false));
    getCreditCards().then((cards) => {
      const typed = cards as unknown as CardItem[];
      setCreditCards(typed);
      setCreditCardId((cur) => cur || (params.card && typed.some((c) => c.id === params.card) ? params.card : typed[0]?.id ?? ""));
    });
    getCustomCategories().then(setCustomCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ───────── edição: carrega o lançamento ───────── */
  useEffect(() => {
    if (!params.edit) return;
    getTransactionById(params.edit)
      .then((t: any) => {
        setType(t.type);
        setStatus(t.status);
        setDescription(t.name);
        setCents(Math.round(Number(t.amount) * 100));
        setCategory(t.category);
        setDate(fromDateKey(t.date));
        setDateMode("outros");
        setPayment(t.payment_method || "conta");
        setRecurrence(t.recurrence_type || "unica");
        setInstallments(t.installments || 2);
        const paid = t.installment_current ? t.installment_current - 1 : 0;
        setPaidInstallments(paid);
        setPaidFlags(Array.from({ length: t.installments || 2 }, (_, i) => i < paid));
        setObservation(t.observation?.replace(/^paid_installments:\d+\s*(\|\s*)?/, "") || "");
        if (t.credit_card_id) setCreditCardId(t.credit_card_id);
        if (t.account_id) setAccountId(t.account_id);
      })
      .catch(() => {
        toast.error("Não foi possível abrir o lançamento");
        router.back();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.edit]);

  /* ───────── categorias disponíveis ───────── */
  const allCategories = useMemo(() => {
    const hidden = new Set(customCategories.filter((c) => c.type === type && c.is_hidden_default).map((c) => c.name.trim().toLocaleLowerCase("pt-BR")));
    const defaults = (income ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES).filter((n) => !hidden.has(n.trim().toLocaleLowerCase("pt-BR")));
    const custom = customCategories.filter((c) => c.type === type && !c.is_hidden_default).map((c) => c.name.trim()).filter(Boolean);
    return Array.from(new Set([...defaults, ...custom]));
  }, [customCategories, type, income]);
  const usedColors = useMemo(() => allCategories.map((c) => getCategoryHexColor(c, customCategories)), [allCategories, customCategories]);

  /* ───────── sugestão de categoria por IA ───────── */
  const triggerSuggest = useCallback(
    (text: string, txType: TxType) => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      if (text.trim().length < 2) {
        setSuggestedCategory(null);
        return;
      }
      suggestTimer.current = setTimeout(async () => {
        setSuggesting(true);
        const custom = customCategories.filter((c) => c.type === txType).map((c) => c.name);
        const result = await suggestCategory(text, txType, custom);
        const name = result.category;
        setSuggestedCategory(name);
        if (name && !category) {
          setCategory(name);
          const known = [...(txType === "receita" ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES), ...custom];
          if (!known.includes(name) && user) {
            try {
              const created = await createCustomCategory(user.id, { name, icon: result.icon || "file-text", color: result.color || "#8b5cf6", type: txType });
              setCustomCategories((prev) => [...prev, created]);
            } catch {
              /* a categoria pode já existir */
            }
          }
        }
        setSuggesting(false);
      }, 350);
    },
    [category, customCategories, user],
  );

  useEffect(() => {
    if (params.name && params.name.trim().length >= 2 && !params.category) triggerSuggest(params.name, params.type ?? "despesa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── parcelas no cartão: em que meses cada uma cai ───────── */
  const installmentMonths = useMemo(() => {
    if (recurrence !== "parcelado" || payment !== "cartao" || installments < 2) return [];
    const selected = creditCards.find((c) => c.id === creditCardId);
    if (!selected) return [];
    // compra depois do fechamento: a primeira parcela vai para o mês seguinte
    const afterClosing = date.getDate() > selected.closing_day;
    let m = date.getMonth() + (afterClosing ? 1 : 0);
    let y = date.getFullYear();
    const out: { month: number; year: number }[] = [];
    for (let i = 0; i < installments; i++) {
      let mm = m + i;
      let yy = y;
      while (mm > 11) { mm -= 12; yy++; }
      out.push({ month: mm, year: yy });
    }
    return out;
  }, [recurrence, payment, installments, creditCardId, creditCards, date]);

  useEffect(() => {
    if (installmentMonths.length === 0) return;
    setPaidFlags((prev) => installmentMonths.map((_, i) => prev[i] ?? false));
  }, [installmentMonths.length]);

  useEffect(() => {
    if (payment !== "cartao" || recurrence !== "parcelado" || installmentMonths.length === 0) return;
    let count = 0;
    for (const flag of paidFlags) {
      if (flag) count++;
      else break;
    }
    setPaidInstallments(count);
  }, [paidFlags, payment, recurrence, installmentMonths.length]);

  /* ───────── ações ───────── */
  const changeDateMode = (mode: "hoje" | "ontem" | "outros") => {
    setDateMode(mode);
    if (mode === "hoje") setDate(new Date());
    else if (mode === "ontem") setDate(subDays(new Date(), 1));
  };

  const createAccountNow = async () => {
    if (!user || !newAccountName.trim()) return;
    try {
      const acc = await createAccount(user.id, { name: newAccountName.trim() });
      setAccounts((prev) => [...prev, acc as Account]);
      setAccountId(acc.id);
      setShowAccountForm(false);
      setNewAccountName("");
      toast.success("Conta criada!");
    } catch {
      toast.error("Erro ao criar conta");
    }
  };

  const createCardNow = async () => {
    if (!user || !card.name.trim() || !card.limit) return;
    try {
      const created = await createCreditCard({ name: card.name.trim(), limit: parseFloat(card.limit), closing_day: parseInt(card.closing), due_day: parseInt(card.due) }, user.id);
      const typed = created as unknown as CardItem;
      setCreditCards((prev) => [...prev, typed]);
      setCreditCardId(typed.id);
      setShowCardForm(false);
      setCard({ name: "", limit: "", closing: "10", due: "20" });
      toast.success("Cartão cadastrado!");
    } catch {
      toast.error("Erro ao criar cartão");
    }
  };

  const saveNewCategory = async (data: { name: string; icon: string; color: string }) => {
    if (!user) return;
    try {
      const created = await createCustomCategory(user.id, { ...data, type });
      setCustomCategories((prev) => [...prev, created]);
      setCategory(data.name);
      setShowCreate(false);
      setShowPicker(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a categoria");
    }
  };

  const submit = async () => {
    if (!user) return;
    if (cents === 0) return toast.error("Digite um valor");
    if (!category) return toast.error("Selecione uma categoria");
    if ((payment === "conta" || income) && accounts.length === 0) return toast.error("Você precisa cadastrar uma conta antes");
    if ((payment === "conta" || income) && !accountId) return toast.error("Selecione uma conta");
    if (usingCard && !creditCardId) return toast.error("Selecione um cartão");

    const real = cents / 100;
    const isParcelado = recurrence === "parcelado" && installments > 1;
    const perInstallment = isParcelado ? Math.round((real / installments) * 100) / 100 : real;
    const current = isParcelado ? paidInstallments + 1 : null;
    const finalName = description.trim() || category;
    const note = observation.trim();
    const observationValue = isParcelado && paidInstallments > 0 ? `paid_installments:${paidInstallments}${note ? ` | ${note}` : ""}` : note || null;
    const onCard = payment === "cartao";

    const payload = {
      name: finalName,
      type,
      amount: perInstallment,
      category,
      date: toDateKey(date),
      status: (onCard ? "pendente" : status) as Status,
      payment_method: (type === "despesa" ? payment : "conta") as Payment,
      recurrence_type: recurrence,
      installments: isParcelado ? installments : null,
      installment_current: current,
      observation: observationValue,
      account_id: onCard ? null : accountId || null,
      credit_card_id: onCard ? creditCardId || null : null,
    };

    setSubmitting(true);
    try {
      if (isEdit && params.edit) {
        await updateTransaction(params.edit, payload);
        toast.success("Transação atualizada ✏️");
      } else {
        await createTransaction(payload, user.id);
        toast.success(`Transação ${status === "pago" ? (income ? "recebida" : "registrada") : "agendada"} 🎯`);
      }
      (window as any).dispatchEvent(new (globalThis as any).CustomEvent("transaction-created"));
      router.back();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar transação");
    } finally {
      setSubmitting(false);
    }
  };

  const CatIcon: any = category ? getDefaultCategoryIcon(category) : null;
  const catHex = category ? getCategoryHexColor(category, customCategories) : "#fff";
  const title = isEdit ? "Editar lançamento" : income ? "Nova receita" : "Nova despesa";
  const recurrenceOptions: { key: Recurrence; label: string }[] = income
    ? [{ key: "unica", label: "Única" }, { key: "fixa", label: "Todo mês" }]
    : [{ key: "unica", label: "Única" }, { key: "parcelado", label: "Parcelado" }, { key: "fixa", label: usingCard ? "Assinatura" : "Todo mês" }];

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1220" }}>
      <Background />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Fechar" hitSlop={12} style={{ marginLeft: -4, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <X size={24} color={white(0.82)} />
          </Pressable>
          <Text weight="semibold" size={16}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {!isEdit && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Chip label="Despesa" on={!income} onPress={() => setType("despesa")} />
              <Chip label="Receita" on={income} onPress={() => { setType("receita"); setPayment("conta"); setRecurrence((r) => (r === "parcelado" ? "unica" : r)); }} />
            </View>
          )}

          <AmountField cents={cents} onChange={setCents} income={income} autoFocus={!isEdit} />

          <Glass radius={22}>
            <FormRow icon={FileText} label="Descrição">
              <TextInput
                value={description}
                onChangeText={(v) => { setDescription(v); triggerSuggest(v, type); }}
                placeholder={income ? "Ex: Salário" : "Ex: Mercado"}
                placeholderTextColor={white(0.45)}
                maxLength={100}
                selectionColor="#fff"
                style={{ flex: 1, minWidth: 0, textAlign: "right", color: "#fff", fontSize: 15, fontFamily: fonts.regular, padding: 0 }}
              />
            </FormRow>
            <View style={{ height: 1, backgroundColor: white(0.06) }} />
            <FormRow icon={Tag} label="Categoria" onPress={() => setShowPicker(true)}>
              {suggesting && <Sparkles size={14} color={white(0.66)} />}
              {category && CatIcon ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                  <CatIcon size={16} color={catHex} />
                  <Text size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{category}</Text>
                </View>
              ) : (
                <Text size={15} color={white(0.5)}>Escolher</Text>
              )}
              {!!suggestedCategory && !suggesting && category === suggestedCategory && (
                <Text size={10} color={white(0.74)} style={{ backgroundColor: white(0.08), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>IA</Text>
              )}
              <ChevronRight size={16} color={white(0.38)} />
            </FormRow>
          </Glass>

          <Label>Data</Label>
          <Glass radius={22} style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip label="Hoje" on={dateMode === "hoje"} onPress={() => changeDateMode("hoje")} />
              <Chip label="Ontem" on={dateMode === "ontem"} onPress={() => changeDateMode("ontem")} />
              <Chip label="Outra data" on={dateMode === "outros"} onPress={() => changeDateMode("outros")} />
            </View>
            {dateMode === "outros" && (
              <View style={{ marginTop: 12 }}>
                <View style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, backgroundColor: white(0.06), paddingHorizontal: 16 }}>
                  <CalendarDays size={16} color={white(0.66)} />
                  <Text size={15}>{format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</Text>
                </View>
                <View style={{ marginTop: 8, alignItems: "center", borderRadius: 18, backgroundColor: white(0.03), padding: 4 }}>
                  <DateTimePicker value={date} mode="date" display="inline" locale="pt-BR" themeVariant="dark" accentColor="#C8F36D" onChange={(_, d) => d && setDate(d)} />
                </View>
              </View>
            )}
          </Glass>

          <Label>{income ? "Onde entrou" : "Como pagou"}</Label>
          <Glass radius={22}>
            {type === "despesa" && (
              <View style={{ flexDirection: "row", gap: 4, padding: 6 }}>
                {([["conta", "Conta", Wallet], ["cartao", "Cartão de crédito", CreditCard]] as const).map(([key, label, Icon]) => (
                  <Pressable
                    key={key}
                    onPress={() => { setPayment(key); if (key === "cartao") setStatus("pendente"); }}
                    style={{ flex: 1, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 20, backgroundColor: payment === key ? "#fff" : "transparent" }}
                  >
                    <Icon size={16} color={payment === key ? colors.black : white(0.7)} />
                    <Text size={13} weight="semibold" color={payment === key ? colors.black : white(0.7)}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={type === "despesa" ? { borderTopWidth: 1, borderTopColor: white(0.06) } : undefined}>
              {!usingCard ? (
                loadingAccounts ? (
                  <Text size={13} color={white(0.62)} align="center" style={{ padding: 16 }}>Carregando contas...</Text>
                ) : accounts.length === 0 ? (
                  <View style={{ alignItems: "center", padding: 16, gap: 12 }}>
                    <Text size={14} color={white(0.74)}>Você precisa adicionar uma conta antes</Text>
                    <Button label="Adicionar conta" height={40} onPress={() => { router.back(); router.push("/gestao"); }} />
                  </View>
                ) : (
                  <>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Wallet size={18} color={white(0.62)} />
                        <Text size={15} color={white(0.74)}>Conta</Text>
                      </View>
                      <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {accounts.map((acc, idx) => {
                          const on = acc.id === accountId;
                          return (
                            <Pressable key={acc.id} onPress={() => setAccountId(acc.id)} style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? "#fff" : white(0.12), backgroundColor: on ? "#fff" : white(0.04), paddingHorizontal: 14 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? colors.black : ACCOUNT_DOTS[idx % ACCOUNT_DOTS.length] }} />
                              <Text size={14} weight="medium" color={on ? colors.black : white(0.8)}>{acc.name}</Text>
                              {acc.is_default && <Text size={11} color={on ? "rgba(11,11,11,0.6)" : white(0.56)}>padrão</Text>}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    {!showAccountForm ? (
                      <Pressable onPress={() => setShowAccountForm(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: white(0.06), paddingHorizontal: 16, paddingVertical: 12 }}>
                        <Plus size={14} color={white(0.7)} />
                        <Text size={13} color={white(0.7)}>Criar nova conta</Text>
                      </Pressable>
                    ) : (
                      <View style={{ flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: white(0.06), padding: 12 }}>
                        <TextInput value={newAccountName} onChangeText={setNewAccountName} placeholder="Nome da conta" placeholderTextColor={white(0.45)} selectionColor="#fff" style={[inputStyle, { flex: 1 }]} />
                        <Pressable onPress={createAccountNow} disabled={!newAccountName.trim()} style={{ height: 40, justifyContent: "center", borderRadius: 20, backgroundColor: "#fff", paddingHorizontal: 16, opacity: newAccountName.trim() ? 1 : 0.4 }}>
                          <Text size={13} weight="semibold" color={colors.black}>Criar</Text>
                        </Pressable>
                        <Pressable onPress={() => { setShowAccountForm(false); setNewAccountName(""); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: white(0.06), alignItems: "center", justifyContent: "center" }}>
                          <X size={16} color={white(0.74)} />
                        </Pressable>
                      </View>
                    )}
                  </>
                )
              ) : (
                <>
                  {creditCards.length > 0 ? (
                    <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <CreditCard size={18} color={white(0.62)} />
                        <Text size={15} color={white(0.74)}>Cartão</Text>
                      </View>
                      <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {creditCards.map((c) => {
                          const on = c.id === creditCardId;
                          return (
                            <Pressable key={c.id} onPress={() => setCreditCardId(c.id)} style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? "#fff" : white(0.12), backgroundColor: on ? "#fff" : white(0.04), paddingHorizontal: 14 }}>
                              <Text size={14} weight="medium" color={on ? colors.black : white(0.8)}>{c.name}</Text>
                              <Text size={11} color={on ? "rgba(11,11,11,0.6)" : white(0.56)}>vence dia {c.due_day}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <Text size={14} color={white(0.62)} align="center" style={{ padding: 16 }}>Nenhum cartão cadastrado</Text>
                  )}
                  {!showCardForm ? (
                    <Pressable onPress={() => setShowCardForm(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: white(0.06), paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Plus size={14} color={white(0.7)} />
                      <Text size={13} color={white(0.7)}>Cadastrar cartão</Text>
                    </Pressable>
                  ) : (
                    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: white(0.06), padding: 12 }}>
                      <TextInput value={card.name} onChangeText={(v) => setCard({ ...card, name: v })} placeholder="Nome do cartão (ex: Nubank)" placeholderTextColor={white(0.45)} selectionColor="#fff" style={inputStyle} />
                      <TextInput value={card.limit} onChangeText={(v) => setCard({ ...card, limit: v })} placeholder="Limite (ex: 5000)" placeholderTextColor={white(0.45)} keyboardType="numeric" selectionColor="#fff" style={inputStyle} />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text size={11} color={white(0.62)} style={{ paddingHorizontal: 8, marginBottom: 4 }}>Fecha dia</Text>
                          <TextInput value={card.closing} onChangeText={(v) => setCard({ ...card, closing: v })} keyboardType="number-pad" selectionColor="#fff" style={inputStyle} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text size={11} color={white(0.62)} style={{ paddingHorizontal: 8, marginBottom: 4 }}>Vence dia</Text>
                          <TextInput value={card.due} onChangeText={(v) => setCard({ ...card, due: v })} keyboardType="number-pad" selectionColor="#fff" style={inputStyle} />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
                        <Pressable onPress={createCardNow} disabled={!card.name.trim() || !card.limit} style={{ flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#fff", opacity: card.name.trim() && card.limit ? 1 : 0.4 }}>
                          <Text size={13} weight="semibold" color={colors.black}>Cadastrar</Text>
                        </Pressable>
                        <Pressable onPress={() => setShowCardForm(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: white(0.06), alignItems: "center", justifyContent: "center" }}>
                          <X size={16} color={white(0.74)} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          </Glass>

          <Label>Repetição</Label>
          <Glass radius={22} style={{ padding: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recurrenceOptions.map((o) => <Chip key={o.key} label={o.label} on={recurrence === o.key} onPress={() => setRecurrence(o.key)} />)}
            </ScrollView>

            {!income && recurrence === "parcelado" && (
              <View style={{ marginTop: 12, gap: 12 }}>
                <TextInput
                  value={installments === 0 ? "" : String(installments)}
                  onChangeText={(v) => setInstallments(v === "" ? 0 : Number(v.replace(/\D/g, "")) || 0)}
                  onBlur={() => setInstallments((p) => (!p || p < 2 ? 2 : Math.min(p, 48)))}
                  placeholder="Nº de parcelas"
                  placeholderTextColor={white(0.45)}
                  keyboardType="number-pad"
                  selectionColor="#fff"
                  style={inputStyle}
                />

                {payment === "cartao" && installmentMonths.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <Text size={12} color={white(0.62)} style={{ paddingHorizontal: 4 }}>Parcelas já pagas</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                      {installmentMonths.map((im, idx) => {
                        const selected = paidFlags[idx] ?? false;
                        const isLast = idx === installmentMonths.length - 1;
                        const canToggle = !selected ? idx === 0 || (paidFlags[idx - 1] ?? false) : !paidFlags[idx + 1];
                        return (
                          <Chip
                            key={`${im.year}-${im.month}`}
                            on={selected}
                            disabled={!canToggle || isLast}
                            label={`${MONTHS_SHORT[im.month]} ${idx + 1}/${installments}`}
                            icon={selected ? <Check size={12} color={colors.black} /> : undefined}
                            onPress={() => setPaidFlags((prev) => { const next = [...prev]; next[idx] = !next[idx]; return next; })}
                          />
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <TextInput
                    value={paidInstallments === 0 ? "" : String(paidInstallments)}
                    onChangeText={(v) => setPaidInstallments(v === "" ? 0 : Number(v.replace(/\D/g, "")) || 0)}
                    onBlur={() => setPaidInstallments((p) => Math.max(0, Math.min(p, Math.max(installments - 1, 0))))}
                    placeholder="Parcelas já pagas (opcional)"
                    placeholderTextColor={white(0.45)}
                    keyboardType="number-pad"
                    selectionColor="#fff"
                    style={inputStyle}
                  />
                )}

                {cents > 0 && installments > 0 && (
                  <Text size={13} color={white(0.7)} style={{ paddingHorizontal: 4 }}>
                    {installments}x de {currencySymbol()} {formatCents(Math.round(cents / installments))}
                    {paidInstallments > 0 && ` · ${paidInstallments} já pagas`}
                  </Text>
                )}
              </View>
            )}
          </Glass>

          <Glass radius={22} style={{ marginTop: 24 }}>
            {!usingCard && (
              <>
                <FormRow icon={status === "pago" ? Check : Clock} label={status === "pago" ? (income ? "Recebido" : "Pago") : income ? "A receber" : "Pendente"}>
                  <Switch value={status === "pago"} onValueChange={(on) => setStatus(on ? "pago" : "pendente")} trackColor={{ true: colors.green, false: white(0.15) }} ios_backgroundColor={white(0.15)} />
                </FormRow>
                <View style={{ height: 1, backgroundColor: white(0.06) }} />
              </>
            )}
            <FormRow icon={StickyNote} label="Observação">
              <TextInput
                value={observation}
                onChangeText={setObservation}
                placeholder="Opcional"
                placeholderTextColor={white(0.45)}
                maxLength={200}
                selectionColor="#fff"
                style={{ flex: 1, minWidth: 0, textAlign: "right", color: "#fff", fontSize: 15, fontFamily: fonts.regular, padding: 0 }}
              />
            </FormRow>
          </Glass>
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderTopColor: white(0.06), paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 14 }}>
          <Button label={isEdit ? "Salvar alterações" : income ? "Adicionar receita" : "Adicionar despesa"} loading={submitting} disabled={cents === 0} onPress={submit} />
        </View>
      </KeyboardAvoidingView>

      <CategoryPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        type={type}
        categories={allCategories}
        customCategories={customCategories}
        selected={category}
        onSelect={(name) => { setCategory(name); setShowPicker(false); }}
        onCreate={(name) => { setCreateName(name); setShowCreate(true); }}
      />
      <CategoryCreateSheet open={showCreate} onClose={() => setShowCreate(false)} onSave={saveNewCategory} initialName={createName} existingNames={allCategories} usedColors={usedColors} />
    </View>
  );
}
