import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { Check, ChevronRight, CreditCard, Receipt, Repeat, User, Wallet, type LucideIcon } from "lucide-react-native";
import type { Profile } from "@/hooks/useProfile";
import { BottomSheet, Button, Glass, Text, colors, white } from "~/ui";
import { PillInput } from "../wallet/sheetParts";

const RING = 2 * Math.PI * 17;

/** "Complete sua conta": os primeiros passos, com o próximo em destaque. Some quando tudo está feito. */
export function OnboardingCard({ profile, onUpdateName }: { profile: Profile; onUpdateName: (name: string) => Promise<void> }) {
  const router = useRouter();
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [saving, setSaving] = useState(false);

  const steps: { id: string; label: string; icon: LucideIcon; done: boolean; action: () => void }[] = [
    { id: "name", label: "Adicionar nome", icon: User, done: profile.has_completed_profile, action: () => setNameOpen(true) },
    { id: "account", label: "Criar conta", icon: Wallet, done: profile.has_account, action: () => router.push({ pathname: "/gestao", params: { abrir: "conta" } }) },
    { id: "transaction", label: "Adicionar transação", icon: Receipt, done: profile.has_transactions, action: () => router.push({ pathname: "/nova", params: { type: "despesa" } }) },
    { id: "card", label: "Adicionar cartão", icon: CreditCard, done: profile.has_card, action: () => router.push({ pathname: "/cartoes", params: { novo: "1" } }) },
    { id: "fixed", label: "Cadastrar gastos fixos", icon: Repeat, done: profile.has_fixed_expenses, action: () => router.push({ pathname: "/nova", params: { type: "despesa", rec: "fixa" } }) },
  ];
  const sorted = [...steps].sort((a, b) => Number(a.done) - Number(b.done));
  const completed = sorted.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (completed === sorted.length || !next) return null;

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onUpdateName(name.trim()); setNameOpen(false); } finally { setSaving(false); }
  };

  const remaining = sorted.length - completed;
  return (
    <>
      <Glass radius={26} style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Svg viewBox="0 0 40 40" width={44} height={44} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={20} cy={20} r={17} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3.5} />
              <Circle cx={20} cy={20} r={17} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${(completed / sorted.length) * RING} ${RING}`} />
            </Svg>
            <Text size={11} weight="bold" tabular>{completed}/{sorted.length}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="bold" size={15}>Complete sua conta</Text>
            <Text size={12} color={white(0.62)}>Faltam {remaining} {remaining === 1 ? "etapa" : "etapas"} para aproveitar tudo</Text>
          </View>
        </View>

        <Pressable onPress={next.action} style={({ pressed }) => ({ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, backgroundColor: "#fff", padding: 6, paddingRight: 16, opacity: pressed ? 0.9 : 1 })}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.black }}><next.icon size={16} color="#fff" /></View>
          <Text weight="bold" size={14} color={colors.black} style={{ flex: 1 }}>{next.label}</Text>
          <ChevronRight size={16} color={colors.black} strokeWidth={2.5} />
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {sorted.filter((s) => s.id !== next.id).map((s) => (
            <Pressable key={s.id} disabled={s.done} onPress={s.action} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: s.done ? white(0.05) : white(0.12), backgroundColor: s.done ? "transparent" : white(0.05), paddingLeft: 4, paddingRight: 12, paddingVertical: 4 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: s.done ? "rgba(200,243,109,0.15)" : white(0.08) }}>
                {s.done ? <Check size={12} color={colors.green} strokeWidth={3} /> : <s.icon size={12} color={white(0.82)} />}
              </View>
              <Text size={12} weight="medium" color={s.done ? white(0.5) : white(0.8)} style={s.done ? { textDecorationLine: "line-through" } : undefined}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Glass>

      <BottomSheet open={nameOpen} onClose={() => setNameOpen(false)} footer={<Button label={saving ? "Salvando…" : "Salvar"} disabled={!name.trim()} loading={saving} onPress={saveName} />}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text display weight="bold" size={22}>Seu nome</Text>
          <Text size={14} color={white(0.62)} style={{ marginBottom: 16 }}>Como você gostaria de ser chamado?</Text>
          <PillInput value={name} onChangeText={setName} placeholder="Seu nome completo" autoFocus maxLength={40} onSubmitEditing={saveName} />
        </View>
      </BottomSheet>
    </>
  );
}
