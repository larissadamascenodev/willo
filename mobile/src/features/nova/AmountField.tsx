import { useEffect, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { currencySymbol } from "@/lib/currency";
import { Text, colors, white } from "~/ui";
import { formatCents } from "./format";

const MAX_CENTS = 99_999_999;

/**
 * O valor, digitado de trás para frente como numa maquininha: cada dígito entra pela direita,
 * em centavos. Um campo invisível guarda o teclado numérico; o número grande é só a vitrine.
 */
export function AmountField({ cents, onChange, income, autoFocus }: { cents: number; onChange: (cents: number) => void; income: boolean; autoFocus?: boolean }) {
  const input = useRef<TextInput>(null);
  const accent = income ? colors.green : colors.red;

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [autoFocus]);

  return (
    <Pressable onPress={() => input.current?.focus()} style={{ alignItems: "center", paddingTop: 24, paddingBottom: 28 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {income ? <TrendingUp size={16} color={accent} /> : <TrendingDown size={16} color={accent} />}
        <Text size={14} color={white(0.66)}>{income ? "Valor da receita" : "Valor da despesa"}</Text>
      </View>

      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text size={24} weight="bold" color={white(0.56)}>{currencySymbol()}</Text>
        <Text weight="extrabold" size={52} tabular color={cents === 0 ? white(0.45) : "#fff"} style={{ letterSpacing: -1.5 }}>
          {formatCents(cents)}
        </Text>
      </View>
      <View style={{ marginTop: 12, width: 40, height: 4, borderRadius: 2, backgroundColor: accent }} />

      <TextInput
        ref={input}
        value=""
        keyboardType="number-pad"
        accessibilityLabel="Valor da transação"
        caretHidden
        onChangeText={(text) => {
          const digit = text.replace(/\D/g, "").slice(-1);
          if (digit) {
            const next = cents * 10 + Number(digit);
            if (next <= MAX_CENTS) onChange(next);
          }
        }}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === "Backspace") onChange(Math.floor(cents / 10));
        }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  );
}
