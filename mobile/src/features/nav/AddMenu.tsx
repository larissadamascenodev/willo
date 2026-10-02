import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react-native";
import { BottomSheet, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";
import { addMenu, useAddMenuOpen } from "./addMenu";

const ACTIONS: { label: string; hint: string; hex: string; Icon: LucideIcon; href: Href }[] = [
  { label: "Despesa", hint: "Um gasto ou uma conta", hex: colors.red, Icon: TrendingDown, href: { pathname: "/nova", params: { type: "despesa" } } },
  { label: "Receita", hint: "Dinheiro que entrou", hex: colors.green, Icon: TrendingUp, href: { pathname: "/nova", params: { type: "receita" } } },
];

/** O "+" do site: escolher o que lançar. */
export function AddMenu() {
  const router = useRouter();
  const open = useAddMenuOpen();

  return (
    <BottomSheet open={open} onClose={addMenu.hide}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text display weight="bold" size={20} style={{ marginBottom: 14 }}>O que você quer lançar?</Text>
        <View style={{ gap: 10 }}>
          {ACTIONS.map(({ label, hint, hex, Icon, href }) => (
            <Pressable
              key={label}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                addMenu.hide();
                router.push(href);
              }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, borderWidth: 1, borderColor: white(0.08), backgroundColor: white(pressed ? 0.1 : 0.06), padding: 14 })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
                <Icon size={22} color={hex} />
              </View>
              <View>
                <Text weight="semibold" size={16}>{label}</Text>
                <Text size={12.5} color={white(0.58)}>{hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}
