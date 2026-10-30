import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, SectionList, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CustomCategory } from "@/services/categoryService";
import { categoryHex } from "@/lib/categoryData";
import { TAXONOMY } from "~/lib/taxonomy";
import { categoryIcon } from "~/lib/categoryIcon";
import { Search, Sparkles, Tag, X } from "~/components/icons";
import type { IconCmp } from "~/lib/categoryIconSlugs";
import { INK } from "~/theme/tokens";

/**
 * Choosing a category, from the whole list.
 *
 * A sheet of glass the height of the screen: a search at the top, and the groups one
 * after another, each group's name and colour held at the top while its categories scroll
 * under it, each category a row with its glyph and a ring to mark it — the way a bank app
 * lists what Open Finance reports. The person's own categories come first. What Willo
 * suggested is marked, so taking it is one tap.
 */

interface Section {
  title: string;
  hex: string;
  icon: IconCmp;
  data: { name: string; icon: IconCmp; hex: string }[];
}

const plain = (s: string) =>
  s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export default function CategoryPicker({
  open,
  type,
  value,
  suggested,
  customCats = [],
  onPick,
  onClose,
  onManage,
}: {
  open: boolean;
  type: "despesa" | "receita";
  value: string;
  /** What Willo suggested, marked in the list. */
  suggested?: string | null;
  customCats?: CustomCategory[];
  onPick: (name: string) => void;
  onClose: () => void;
  onManage?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const sections = useMemo<Section[]>(() => {
    const own = customCats.filter((c) => c.type === type && !c.is_hidden_default);
    const all: Section[] = [
      ...(own.length
        ? [
            {
              title: "Suas categorias",
              hex: "#A1A1AA",
              icon: Tag,
              data: own.map((c) => ({ name: c.name, icon: categoryIcon(c.name, customCats), hex: categoryHex(c.name, customCats) })),
            },
          ]
        : []),
      ...TAXONOMY.filter((g) => g.type === type).map((g) => ({
        title: g.name,
        hex: g.hex,
        icon: g.icon,
        data: g.categories.map((x) => ({ name: x.name, icon: x.icon, hex: g.hex })),
      })),
    ];
    const q = plain(query.trim());
    if (!q) return all;
    return all
      .map((s) => ({ ...s, data: s.data.filter((d) => plain(d.name).includes(q) || plain(s.title).includes(q)) }))
      .filter((s) => s.data.length > 0);
  }, [type, customCats, query]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, marginTop: insets.top + 8, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(255,255,255,0.14)" }}>
        <BlurView intensity={70} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(12,13,16,0.72)" }} />

        {/* ══ Title, out, and the search ══ */}
        <View style={{ paddingTop: 16, paddingHorizontal: 20 }}>
          <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 19, fontWeight: "800", color: "#fff" }}>Categorias</Text>
            {onManage && (
              <Pressable onPress={onManage} hitSlop={8} style={({ pressed }) => ({ position: "absolute", left: 0, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: INK.soft }}>Gerenciar</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityLabel="Fechar"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => ({
                position: "absolute",
                right: 0,
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.14)",
                backgroundColor: "rgba(255,255,255,0.08)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={18} color="#fff" strokeWidth={2.3} />
            </Pressable>
          </View>
          <View style={{ marginTop: 14, marginBottom: 10, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" }}>
            <Search size={18} color={INK.soft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar"
              placeholderTextColor={INK.faint}
              autoCorrect={false}
              style={{ flex: 1, minWidth: 0, padding: 0, fontSize: 16, color: "#fff" }}
            />
          </View>
        </View>

        {/* ══ The groups, each name held at the top while its categories pass ══ */}
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.name}-${i}`}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderSectionHeader={({ section }) => {
            const Icon = section.icon;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "rgba(28,29,33,0.97)" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: section.hex }}>
                  <Icon size={18} color="#fff" strokeWidth={2.2} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>{section.title}</Text>
              </View>
            );
          }}
          renderSectionFooter={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const Icon = item.icon;
            const on = item.name === value;
            const isSuggestion = !!suggested && item.name === suggested;
            return (
              <Pressable onPress={() => onPick(item.name)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" }}>
                  <Icon size={19} color={item.hex} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, color: "#fff" }}>{item.name}</Text>
                  {isSuggestion && (
                    <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Sparkles size={11} color="#C8F36D" />
                      <Text style={{ fontSize: 12, color: "#C8F36D" }}>Sugestão do Willo</Text>
                    </View>
                  )}
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: on ? 2 : 1.5,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" }} />}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ paddingTop: 40, textAlign: "center", fontSize: 14, color: INK.soft }}>Nenhuma categoria com esse nome.</Text>}
        />
      </View>
    </Modal>
  );
}
