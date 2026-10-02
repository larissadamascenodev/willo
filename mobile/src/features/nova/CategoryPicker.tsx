import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Search, Settings } from "lucide-react-native";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/lib/categoryIconOptions";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import type { CustomCategory } from "@/services/categoryService";
import { BottomSheet, Text, fonts, white } from "~/ui";
import { tint } from "~/lib/color";

interface Props {
  open: boolean;
  onClose: () => void;
  type: "receita" | "despesa";
  /** As categorias disponíveis para este tipo (padrão + criadas, sem as escondidas). */
  categories: string[];
  customCategories: CustomCategory[];
  selected: string;
  onSelect: (name: string) => void;
  /** Pede para criar uma categoria nova, já com o texto da busca. */
  onCreate: (suggestedName: string) => void;
}

/** A grade de categorias: busca no topo, "Nova" no fim e o atalho para gerenciar. */
export function CategoryPicker({ open, onClose, type, categories, customCategories, selected, onSelect, onCreate }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => (search ? categories.filter((c) => c.toLowerCase().includes(search.toLowerCase())) : categories), [categories, search]);

  return (
    <BottomSheet open={open} onClose={() => { setSearch(""); onClose(); }} size="full">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text display weight="bold" size={22}>Categoria</Text>
          <Pressable
            onPress={() => {
              onClose();
              router.push("/categorias");
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Settings size={16} color={white(0.7)} />
            <Text size={13} color={white(0.7)}>Gerenciar</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 16, height: 44, borderRadius: 22, backgroundColor: white(0.06), flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Search size={16} color={white(0.5)} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar categoria"
            placeholderTextColor={white(0.45)}
            selectionColor="#fff"
            style={{ flex: 1, marginLeft: 10, color: "#fff", fontSize: 15, fontFamily: fonts.regular, padding: 0 }}
          />
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {filtered.map((cat) => {
            const custom = customCategories.find((c) => c.name === cat && c.type === type);
            const Icon: any = custom ? getIconComponent(custom.icon) : getDefaultCategoryIcon(cat);
            const hex = getCategoryHexColor(cat, customCategories);
            const on = selected === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => { setSearch(""); onSelect(cat); }}
                style={{ width: "31.6%", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? "#fff" : white(0.06), backgroundColor: on ? white(0.08) : white(0.1), paddingHorizontal: 8, paddingVertical: 14 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.13) }}>
                  <Icon size={20} color={hex} />
                </View>
                <Text size={12} color={white(0.85)} align="center" numberOfLines={2} style={{ lineHeight: 15 }}>{cat}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => onCreate(search.trim())}
            style={{ width: "31.6%", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.15), paddingHorizontal: 8, paddingVertical: 14 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
              <Plus size={20} color="#fff" />
            </View>
            <Text size={12} color={white(0.82)}>Nova</Text>
          </Pressable>
        </View>

        {filtered.length === 0 && (
          <View style={{ marginTop: 16, alignItems: "center", paddingBottom: 24 }}>
            <Text size={14} color={white(0.56)}>Nenhuma categoria encontrada</Text>
            {!!search.trim() && (
              <Pressable onPress={() => onCreate(search.trim())} style={{ marginTop: 12, borderRadius: 999, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text size={13} weight="semibold" color="#0B0B0B">Criar “{search.trim()}”</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
