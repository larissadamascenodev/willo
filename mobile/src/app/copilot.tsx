import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import BottomSheet from "~/components/BottomSheet";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { type EntryValues } from "~/components/registro/EntryForm";
import { Primary, type Account, type Card } from "~/components/registro/entryParts";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { Notice } from "~/components/home/CopilotCard";
import { Check, ChevronLeft, Pencil, X } from "~/components/icons";
import { confirmPending, discardPending, useCopilot, type CopilotItem } from "~/lib/copilot";
import { useAuth } from "~/lib/auth";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";

import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Willo Copilot: what was caught from the bank, waiting to be confirmed.
 *
 * Each one as a notification, with a tick to confirm it as it is, a pencil to change it
 * first — name, amount, category, how it was paid, the day — and a cross to throw it away.
 * Confirmed, it is a transaction and the balance moves. "Confirmar todas" does them all.
 */

const toValues = (item: CopilotItem): EntryValues => ({
  type: item.type,
  cents: Math.round(item.amount * 100),
  name: item.name,
  category: item.category,
  method: item.type === "receita" ? "conta" : (item.payment_method ?? "conta"),
  whereId: item.payment_method === "cartao" ? item.credit_card_id : item.account_id,
  repeat: "unica",
  parts: null,
  date: item.occurred_at.slice(0, 10),
  status: "pago",
  note: "",
});

const fromValues = (item: CopilotItem, v: EntryValues): CopilotItem => ({
  ...item,
  type: v.type,
  amount: v.cents / 100,
  name: v.name.trim() || item.name,
  category: v.category,
  payment_method: v.method,
  account_id: v.method === "cartao" ? null : v.whereId,
  credit_card_id: v.method === "cartao" ? v.whereId : null,
  occurred_at: v.date === item.occurred_at.slice(0, 10) ? item.occurred_at : `${v.date}T12:00:00`,
});

export default function CopilotScreen() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items } = useCopilot();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [editing, setEditing] = useState<CopilotItem | null>(null);
  const [values, setValues] = useState<EntryValues | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getAccounts()
      .then((l) => setAccounts((l as unknown as Account[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
    getCreditCards()
      .then((c) => setCards(c as unknown as Card[]))
      .catch(() => undefined);
  }, []);

  /* With no account named, the main one. */
  const withAccount = (item: CopilotItem): CopilotItem =>
    item.account_id || item.credit_card_id ? item : { ...item, account_id: (accounts as (Account & { is_default?: boolean })[]).find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null };

  const confirm = async (item: CopilotItem) => {
    if (!user) return;
    setBusy(item.id);
    try {
      await confirmPending(withAccount(item), user.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast(`${item.type === "receita" ? "Receita" : "Gasto"} confirmado · ${item.name}, ${money(item.amount)}`);
    } catch {
      showToast("Não consegui confirmar agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const confirmAll = async () => {
    for (const item of items ?? []) await confirm(item);
  };

  const list = items ?? [];

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + (list.length > 1 ? 110 : 40), paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 44, flexDirection: "row", alignItems: "center" }}>
          <RoundButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.4} />
          </RoundButton>
        </View>

        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            <ParticleOrb size={46} density={110} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>Willo Copilot</Text>
            <Text style={{ marginTop: 1, fontSize: 13.5, color: th(INK.soft) }}>
              {items === null ? " " : list.length ? `${list.length} para confirmar` : "Tudo confirmado"}
            </Text>
          </View>
        </View>
        <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
          O que o Willo captou dos avisos dos seus bancos. Nada entra nas suas transações antes de você confirmar.
        </Text>
        <Pressable onPress={() => router.push("/atalhos" as never)} hitSlop={6} style={({ pressed }) => ({ marginTop: 8, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#67CD67") }}>Configurar compras da Carteira ›</Text>
        </Pressable>

        <View style={{ marginTop: 18, gap: 10 }}>
          {list.map((item, i) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(i * 40).duration(300)} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(220)}>
              <Notice
                item={item}
                right={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: th(item.type === "receita" ? "#67CD67" : "#fff"), marginRight: 4 }}>
                      {item.type === "receita" ? "+" : "−"}
                      {money(item.amount)}
                    </Text>
                    <Round label="Descartar" onPress={() => void discardPending(item.id)}>
                      <X size={14} color={th(RED)} strokeWidth={2.6} />
                    </Round>
                    <Round
                      label="Editar"
                      onPress={() => {
                        setEditing(item);
                        setValues(toValues(withAccount(item)));
                      }}
                    >
                      <Pencil size={14} color={th("#fff")} />
                    </Round>
                    <Round label="Confirmar" solid onPress={() => void confirm(item)}>
                      {busy === item.id ? <ActivityIndicator size="small" color={th("#0B0B0B")} /> : <Check size={15} color={th("#0B0B0B")} strokeWidth={3} />}
                    </Round>
                  </View>
                }
              />
            </Animated.View>
          ))}
        </View>

        {items !== null && list.length === 0 && (
          <View style={{ marginTop: 40, alignItems: "center" }}>
            <Check size={28} color={th(INK.soft)} />
            <Text style={{ marginTop: 10, fontSize: 15, fontWeight: "600", color: th("#fff") }}>Nada esperando</Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: th(INK.soft), textAlign: "center" }}>Quando o Willo captar uma compra, ela aparece aqui.</Text>
          </View>
        )}
      </ScrollView>

      {list.length > 1 && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14 }}>
          <Primary label={`Confirmar todas (${list.length})`} onPress={() => void confirmAll()} busy={!!busy} />
        </View>
      )}

      {/* One changed before it is confirmed: the same check as any entry. */}
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} full>
        {editing && values && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Confira antes de confirmar</Text>
            {editing.raw ? <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12.5, color: th(INK.softer) }}>Aviso do banco: {editing.raw}</Text> : null}
            <EntryForm values={values} onChange={(patch) => setValues((v) => (v ? { ...v, ...patch } : v))} accounts={accounts} cards={cards} onPickCategory={() => setPicking(true)} />
            <Primary
              label="Confirmar"
              disabled={values.cents <= 0 || !values.whereId}
              onPress={() => {
                const next = fromValues(editing, values);
                setEditing(null);
                void confirm(next);
              }}
            />
            <Pressable
              onPress={() => {
                void discardPending(editing.id);
                setEditing(null);
              }}
              style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: th(RED) }}>Descartar</Text>
            </Pressable>
            <CategoryPicker
              open={picking}
              type={values.type}
              value={values.category ?? ""}
              onPick={(c) => {
                setPicking(false);
                setValues((v) => (v ? { ...v, category: c } : v));
              }}
              onClose={() => setPicking(false)}
            />
          </View>
        )}
      </BottomSheet>
    </Room>
  );
}

function Round({ label, solid, onPress, children }: { label: string; solid?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: th(solid ? "#fff" : "rgba(255,255,255,0.08)", "bg"),
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}
