import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, User } from "lucide-react-native";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { useProfile } from "@/hooks/useProfile";
import { currencySymbol } from "@/lib/currency";
import { Glass, Text, white, colors } from "~/ui";
import { SectionTabs } from "./SectionTabs";
import { useGreeting } from "./useGreeting";

interface Props {
  saldoAtual: number;
  saldoPrevisto: number;
  receitas: number;
  despesas: number;
}

/**
 * O topo do início: quem está logado, os atalhos e, num cartão só, o número que responde
 * "posso gastar?" — o saldo — com o previsto para o fim do mês e o que entrou e saiu.
 */
export function BalanceHero({ saldoAtual, saldoPrevisto, receitas, despesas }: Props) {
  const router = useRouter();
  const hidden = useHiddenValues();
  const { profile } = useProfile();
  const { greeting } = useGreeting();
  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase();

  const saldo = useFormattedCounter(saldoAtual);
  const previsto = useFormattedCounter(saldoPrevisto);
  const entrou = useFormattedCounter(receitas);
  const saiu = useFormattedCounter(despesas);
  const mask = (value: string, dots = 4) => (hidden ? `${currencySymbol()} ${"•".repeat(dots)}` : value);

  const columns = [
    { key: "in", label: "Receitas", value: entrou, to: "/detalhe/receitas", Icon: ArrowDownLeft, hex: colors.green },
    { key: "out", label: "Despesas", value: saiu, to: "/detalhe/despesas", Icon: ArrowUpRight, hex: colors.red },
  ] as const;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <Pressable onPress={() => router.push("/configuracoes")} accessibilityLabel="Perfil" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: white(0.34), backgroundColor: white(0.1), alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 44, height: 44 }} contentFit="cover" />
            ) : initial ? (
              <Text weight="bold" size={15}>{initial}</Text>
            ) : (
              <User size={18} color={white(0.8)} />
            )}
          </View>
        </Pressable>
      </View>

      <View style={{ marginTop: 20 }}>
        <SectionTabs />
      </View>

      <View style={{ marginTop: 40 }}>
        <Text size={28} numberOfLines={1} style={{ letterSpacing: -0.5 }}>
          {greeting}{firstName ? `, ${firstName}` : ""}
        </Text>
        <Text size={13} color={white(0.56)} style={{ marginTop: 4 }}>Toque duas vezes na tela para lançar</Text>

        <Glass radius={24} style={{ marginTop: 16, padding: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text size={13} color={white(0.66)}>Saldo disponível</Text>
            <Pressable onPress={() => setHiddenValues(!hidden)} hitSlop={12} accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}>
              {hidden ? <EyeOff size={18} color={white(0.66)} /> : <Eye size={18} color={white(0.66)} />}
            </Pressable>
          </View>
          <Text weight="extrabold" size={34} tabular numberOfLines={1} style={{ marginTop: 8, letterSpacing: -1.2 }}>
            {mask(saldo, 6)}
          </Text>
          <Text size={13} color={white(0.6)} numberOfLines={1} style={{ marginTop: 10 }}>
            Previsto no fim do mês:{" "}
            <Text size={13} weight="semibold" color={white(0.8)} tabular>{mask(previsto)}</Text>
          </Text>

          <View style={{ marginTop: 16, flexDirection: "row", borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 16 }}>
            {columns.map(({ key, label, value, to, Icon, hex }, i) => (
              <Pressable
                key={key}
                onPress={() => router.push(to)}
                style={({ pressed }) => [{ flex: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 }, i === 1 ? { borderLeftWidth: 1, borderLeftColor: white(0.12), paddingLeft: 16 } : { paddingRight: 16 }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon size={14} color={hex} strokeWidth={2.6} />
                  <Text size={13} color={white(0.66)}>{label}</Text>
                </View>
                <Text weight="extrabold" size={19} tabular numberOfLines={1} style={{ marginTop: 6, letterSpacing: -0.4 }}>
                  {mask(value)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Glass>
      </View>
    </View>
  );
}
