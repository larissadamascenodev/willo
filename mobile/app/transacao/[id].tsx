import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Check, CreditCard, Layers, Pencil, StickyNote, Tag, Trash2, Wallet } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/lib/categoryIconOptions";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { removeRecurringFromMonthOnward, removeRecurringThisMonth } from "@/services/recurringDelete";
import { deleteTransaction, getAccounts, getCreditCards, getTransactionById, updateTransactionStatus } from "@/services/transactionService";
import { useMoney } from "@/components/projecoes/shared";
import { Button, Glass, PageHeader, Screen, Text, colors, toast, white } from "~/ui";
import { tint } from "~/lib/color";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
};

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: white(0.06), alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color={white(0.74)} />
      </View>
      <Text size={14} color={white(0.62)}>{label}</Text>
      <Text size={14.5} weight="medium" align="right" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

/** O que foi um lançamento, e o que dá para fazer com ele: pagar, editar ou excluir. */
export default function TransacaoDetalhe() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTransactionById(id).then(setTx).catch(() => { toast.error("Lançamento não encontrado"); router.back(); });
    getAccounts().then((a) => setAccounts(a as any[])).catch(() => {});
    getCreditCards().then((c) => setCards(c as any[])).catch(() => {});
    getCustomCategories().then(setCustom).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!tx) {
    return (
      <Screen>
        <PageHeader title="Lançamento" />
      </Screen>
    );
  }

  const income = tx.type === "receita";
  const pending = tx.status !== "pago";
  const onCard = tx.payment_method === "cartao";
  const customCat = custom.find((c) => c.name === tx.category && c.type === tx.type);
  const CatIcon: any = customCat ? getIconComponent(customCat.icon) : getDefaultCategoryIcon(tx.category);
  const hex = getCategoryHexColor(tx.category, custom);
  const where = onCard ? cards.find((c) => c.id === tx.credit_card_id)?.name ?? "Cartão" : accounts.find((a) => a.id === tx.account_id)?.name ?? "Conta";
  const isFixa = tx.recurrence_type === "fixa";
  const [y, m] = tx.date.split("-").map(Number);

  const run = async (work: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(ok);
      router.back();
    } catch {
      toast.error("Não foi possível concluir");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader title="Lançamento" />

      <View style={{ marginTop: 24, alignItems: "center" }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.13) }}>
          <CatIcon size={28} color={hex} />
        </View>
        <Text weight="semibold" size={18} align="center" style={{ marginTop: 12 }}>{tx.name}</Text>
        <Text weight="extrabold" size={36} tabular color={income ? colors.green : "#fff"} style={{ marginTop: 4, letterSpacing: -1 }}>
          {income ? "+" : "−"}{fmt(Number(tx.amount))}
        </Text>
        <Text size={12.5} color={pending ? colors.amber : white(0.56)} style={{ marginTop: 2 }}>
          {pending ? (income ? "A receber" : "Pendente") : income ? "Recebido" : "Pago"}
        </Text>
      </View>

      <Glass radius={22} style={{ marginTop: 24, paddingHorizontal: 16 }}>
        <Detail icon={Tag} label="Categoria" value={tx.category} />
        <Detail icon={Calendar} label="Data" value={`${longDate(tx.date)}${tx.time ? ` · ${tx.time}` : ""}`} />
        <Detail icon={onCard ? CreditCard : Wallet} label={onCard ? "Cartão" : "Conta"} value={where} />
        {tx.installments > 1 && <Detail icon={Layers} label="Parcela" value={`${tx.installment_current ?? 1} de ${tx.installments}`} />}
        {isFixa && <Detail icon={Layers} label="Repete" value="Todo mês" />}
        {!!tx.observation && !tx.observation.startsWith("paid_installments") && <Detail icon={StickyNote} label="Observação" value={tx.observation} />}
      </Glass>

      <View style={{ marginTop: 24, gap: 10 }}>
        {pending && !onCard && (
          <Button
            label={income ? "Marcar como recebida" : "Marcar como paga"}
            icon={<Check size={16} color="#0B0B0B" strokeWidth={3} />}
            loading={busy}
            onPress={() => run(async () => { await updateTransactionStatus(tx.id, "pago"); }, income ? "Marcado como recebido" : "Marcado como pago")}
          />
        )}
        <Button label="Editar lançamento" variant="glass" icon={<Pencil size={16} color="#fff" />} onPress={() => router.replace({ pathname: "/nova", params: { edit: tx.id } })} />

        {!confirming ? (
          <Button label="Excluir" variant="danger" icon={<Trash2 size={16} color={colors.red} />} onPress={() => setConfirming(true)} />
        ) : (
          <Glass radius={22} style={{ padding: 16, gap: 10, borderColor: "rgba(248,113,113,0.35)" }}>
            <Text weight="semibold" size={15}>{isFixa ? "Excluir esta conta fixa?" : "Excluir este lançamento?"}</Text>
            <Text size={13} color={white(0.62)}>{isFixa ? "Escolha até quando ela deixa de existir." : "Essa ação não pode ser desfeita."}</Text>
            {isFixa ? (
              <>
                <Button label="Só neste mês" variant="glass" height={46} loading={busy} onPress={() => run(async () => { if (user) await removeRecurringThisMonth({ id: tx.id, date: tx.date }, m - 1, y, user.id); }, "Removido deste mês")} />
                <Button label="Neste mês e nos próximos" variant="danger" height={46} loading={busy} onPress={() => run(async () => { if (user) await removeRecurringFromMonthOnward({ id: tx.id, date: tx.date }, m - 1, y, user.id); }, "Removido deste mês e dos próximos")} />
              </>
            ) : (
              <Button label="Sim, excluir" variant="danger" height={46} loading={busy} onPress={() => run(async () => { await deleteTransaction(tx.id); }, "Lançamento excluído")} />
            )}
            <Button label="Cancelar" variant="glass" height={46} onPress={() => setConfirming(false)} />
          </Glass>
        )}
      </View>
    </Screen>
  );
}
