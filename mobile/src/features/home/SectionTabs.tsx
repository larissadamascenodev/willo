import { Pressable, ScrollView } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Glass, Text, colors, white } from "~/ui";

const TABS: { label: string; href: Href }[] = [
  { label: "Contas", href: "/gestao" },
  { label: "Cartões", href: "/cartoes" },
  { label: "Parcelamentos", href: "/parcelamentos" },
  { label: "Projeções", href: "/projecoes" },
  { label: "Raio-X", href: "/raio-x" },
];

/** Os atalhos do início: contas, cartões, parcelamentos, projeções e Raio-X. */
export function SectionTabs({ active }: { active?: string }) {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
      {TABS.map((tab) => {
        const on = active === tab.label;
        return (
          <Pressable key={tab.label} onPress={() => router.push(tab.href)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            {on ? (
              <Pill bg="#fff" label={tab.label} fg={colors.black} />
            ) : (
              <Glass radius={999} style={{ borderColor: white(0.2) }}>
                <Pill label={tab.label} fg={white(0.9)} />
              </Glass>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Pill({ label, fg, bg }: { label: string; fg: string; bg?: string }) {
  return (
    <Text weight="semibold" size={14.5} color={fg} style={{ height: 40, lineHeight: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: bg, overflow: "hidden", letterSpacing: -0.2 }}>
      {label}
    </Text>
  );
}
