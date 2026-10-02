import { useRef, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Check, Pencil } from "lucide-react-native";
import { BANKS, PALETTE, type Bank } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { Glass, Text, colors, fonts, white } from "~/ui";

/** O rótulo cinza pequeno acima de cada bloco de uma folha. */
export const SectionLabel = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <View style={{ marginTop: 24, marginBottom: 8, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <Text size={13} weight="semibold" color={white(0.62)}>{children}</Text>
    {right}
  </View>
);

/** Campo de texto arredondado das folhas da carteira. */
export function PillInput(props: React.ComponentPropsWithRef<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={white(0.45)}
      selectionColor="#fff"
      {...props}
      style={[{ height: 48, borderRadius: 24, borderWidth: 1, borderColor: white(0.06), backgroundColor: white(0.1), paddingHorizontal: 16, color: "#fff", fontSize: 15, fontFamily: fonts.regular }, props.style]}
    />
  );
}

/** Bancos comuns a um toque: preenche nome e cor. "Outro" limpa. */
export function BankChips({ selectedId, onPick, onOther }: { selectedId: string | null; onPick: (b: Bank) => void; onOther: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 4 }}>
      {BANKS.map((b) => {
        const on = selectedId === b.id;
        return (
          <Pressable key={b.id} onPress={() => onPick(b)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? "#fff" : white(0.12), backgroundColor: on ? white(0.1) : white(0.08), paddingVertical: 6, paddingLeft: 6, paddingRight: 14 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: b.hex, borderWidth: 1, borderColor: white(0.15) }} />
            <Text size={13} weight="medium" color={on ? "#fff" : white(0.82)}>{b.name}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onOther} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.15), paddingHorizontal: 14, paddingVertical: 6 }}>
        <Pencil size={14} color={white(0.74)} />
        <Text size={13} color={white(0.74)}>Outro</Text>
      </Pressable>
    </ScrollView>
  );
}

/** As cores da paleta. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
      {PALETTE.map((c) => {
        const on = value === c.value;
        return (
          <Pressable key={c.value} onPress={() => onChange(c.value)} accessibilityLabel={c.value} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.hex, alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0.7, transform: [{ scale: on ? 1.1 : 1 }], borderWidth: on ? 2 : 0, borderColor: "#fff" }}>
            {on && <Check size={16} color="#fff" strokeWidth={3} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const MAX = 9_999_999_999;
const fmtShort = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")} mil` : v.toLocaleString("pt-BR"));

/** Um valor grande, digitado em centavos, com atalhos opcionais. */
export function MoneyField({ cents, onChange, chips, negative = false, children }: {
  cents: number;
  onChange: (cents: number) => void;
  chips?: number[];
  negative?: boolean;
  children?: ReactNode;
}) {
  const input = useRef<TextInput>(null);
  return (
    <Glass radius={22} style={{ padding: 20 }}>
      <Pressable onPress={() => input.current?.focus()} style={{ alignSelf: "center", flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text size={20} weight="bold" color={white(0.56)}>{negative ? `−${currencySymbol()}` : currencySymbol()}</Text>
        <Text weight="extrabold" size={40} tabular color={cents === 0 ? white(0.45) : negative ? colors.red : "#fff"} style={{ letterSpacing: -1 }}>
          {(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </Pressable>
      <TextInput
        ref={input}
        value=""
        keyboardType="number-pad"
        accessibilityLabel="Valor"
        caretHidden
        onChangeText={(t) => {
          const d = t.replace(/\D/g, "").slice(-1);
          if (d) {
            const next = cents * 10 + Number(d);
            if (next <= MAX) onChange(next);
          }
        }}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === "Backspace") onChange(Math.floor(cents / 10));
        }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
      {chips && (
        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
          {chips.map((v) => (
            <Pressable key={v} onPress={() => onChange(v * 100)} style={{ borderRadius: 999, backgroundColor: cents === v * 100 ? "#fff" : white(0.06), paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text size={13} weight="semibold" color={cents === v * 100 ? colors.black : white(0.74)}>{fmtShort(v)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {children}
    </Glass>
  );
}

/** Grade 1–31 para escolher um dia do mês. */
export function DayGrid({ value, onChange, mark }: { value: number; onChange: (d: number) => void; mark?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6 }}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
        const on = d === value;
        return (
          <Pressable key={d} onPress={() => onChange(d)} style={{ width: `${100 / 7}%`, alignItems: "center" }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fff" : "transparent" }}>
              <Text size={14} weight="semibold" tabular color={on ? colors.black : white(0.82)}>{d}</Text>
              {mark === d && !on && <View style={{ position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: white(0.4) }} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
