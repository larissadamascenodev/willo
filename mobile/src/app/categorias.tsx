import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import {
  createCustomCategory,
  deleteCustomCategory,
  getCustomCategories,
  hideDefaultCategory,
  updateCustomCategory,
  type CustomCategory,
} from "@/services/categoryService";
import { DEFAULT_CATEGORY_HEX, DEFAULT_CATEGORY_TYPE } from "@/lib/categoryData";
import { DEFAULT_CATEGORY_ICON_SLUG, normalizeCategoryName } from "@/lib/categoryPalette";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface, { Hairline } from "~/components/Surface";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import CategorySheet from "~/components/categorias/CategorySheet";
import { categoryIcon } from "~/lib/categoryIcon";
import { Pencil, Plus, Tag, Trash2 } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The categories, as one list.
 *
 * The app ships a set and you can add your own, but that distinction is the app's
 * problem and not yours — so they are shown as a single alphabetical list with a
 * quiet line saying where each came from, and the same two actions on every one of
 * them. Hiding one of the app's own is how it gets "deleted": the transactions
 * already filed under it keep their name, and only the list of choices changes.
 */

interface UnifiedCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "despesa" | "receita";
  isDefault: boolean;
  customId?: string;
}

export default function Categorias() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<"despesa" | "receita">("despesa");
  const [customCats, setCustomCats] = useState<CustomCategory[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UnifiedCategory | null>(null);
  const [acting, setActing] = useState<UnifiedCategory | null>(null);
  const [confirming, setConfirming] = useState<UnifiedCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setCustomCats([]);
      return;
    }
    try {
      setCustomCats(await getCustomCategories());
    } catch {
      setCustomCats([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  /* One list, the app's own and yours together, with a name claimed by a custom
     category winning over the default of the same name. */
  const categories = useMemo<UnifiedCategory[]>(() => {
    const cats = customCats ?? [];

    const hidden = new Set(
      cats.filter((c) => c.type === tab && c.is_hidden_default).map((c) => normalizeCategoryName(c.name)),
    );

    const defaults: UnifiedCategory[] = Object.entries(DEFAULT_CATEGORY_TYPE)
      .filter(([, type]) => type === tab)
      .filter(([name]) => !hidden.has(normalizeCategoryName(name)))
      .map(([name]) => ({
        id: `default-${name}`,
        name,
        icon: "",
        color: DEFAULT_CATEGORY_HEX[name] ?? "#64748b",
        type: tab,
        isDefault: true,
      }));

    const mine: UnifiedCategory[] = cats
      .filter((c) => c.type === tab && !c.is_hidden_default)
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        type: c.type as "despesa" | "receita",
        isDefault: false,
        customId: c.id,
      }));

    const byName = new Map<string, UnifiedCategory>();
    [...defaults, ...mine].forEach((category) => {
      const key = normalizeCategoryName(category.name);
      const existing = byName.get(key);
      if (!existing || (!category.isDefault && existing.isDefault)) byName.set(key, category);
    });

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [customCats, tab]);

  const names = categories.map((c) => c.name);
  const colors = categories.map((c) => c.color).filter(Boolean);

  const create = async (data: { name: string; icon: string; color: string }) => {
    if (!user) return;
    try {
      await createCustomCategory(user.id, { ...data, type: tab });
      setCreating(false);
      setError(null);
      await load();
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a categoria.");
    }
  };

  /* Editing one of the app's own cannot change the app's own, so it is hidden and
     yours takes its place — which is what "editar" has always meant here. */
  const update = async (data: { name: string; icon: string; color: string }) => {
    if (!editing || !user) return;
    try {
      if (editing.isDefault) {
        await hideDefaultCategory(user.id, editing.name, tab);
        await createCustomCategory(user.id, { ...data, type: tab });
      } else {
        await updateCustomCategory(editing.customId!, data);
      }
      setEditing(null);
      setError(null);
      await load();
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a categoria.");
    }
  };

  const remove = async (cat: UnifiedCategory) => {
    if (!user) return;
    try {
      if (cat.isDefault) await hideDefaultCategory(user.id, cat.name, tab);
      else await deleteCustomCategory(cat.customId!);
      setConfirming(null);
      setError(null);
      await load();
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    } catch {
      setError("Não foi possível remover a categoria.");
    }
  };

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton />
          <Pressable
            onPress={() => setCreating(true)}
            style={({ pressed }) => ({
              height: 36,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              backgroundColor: "#fff",
              paddingHorizontal: 14,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Plus size={16} color="#0B0B0B" strokeWidth={2.6} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0B0B0B" }}>Nova</Text>
          </Pressable>
        </View>

        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Categorias</Text>

        <View style={{ marginTop: 18 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: "despesa" as const, label: "Despesas" },
              { key: "receita" as const, label: "Receitas" },
            ]}
          />
        </View>

        <View
          style={{
            marginTop: 22,
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
            {tab === "despesa" ? "De despesa" : "De receita"}
          </Text>
          <Text style={{ fontSize: 13, color: INK.soft }}>
            {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
          </Text>
        </View>

        {customCats === null ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ height: 60, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </View>
        ) : categories.length === 0 ? (
          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "rgba(255,255,255,0.10)",
              paddingHorizontal: 24,
              paddingVertical: 40,
              alignItems: "center",
            }}
          >
            <Tag size={28} color={INK.faint} />
            <Text style={{ marginTop: 10, fontSize: 14, color: INK.soft }}>Nenhuma categoria por aqui</Text>
            <Pressable
              onPress={() => setCreating(true)}
              style={({ pressed }) => ({
                marginTop: 16,
                borderRadius: 999,
                backgroundColor: "#fff",
                paddingHorizontal: 16,
                paddingVertical: 9,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#0B0B0B" }}>Criar a primeira</Text>
            </Pressable>
          </View>
        ) : (
          <Animated.View layout={LinearTransition.springify().damping(26).stiffness(220)}>
            <Surface radius={22}>
              {categories.map((cat, i) => {
                const Icon = categoryIcon(cat.name, customCats ?? undefined);
                return (
                  <Animated.View key={cat.id} entering={FadeIn.duration(200)}>
                    {i > 0 && <Hairline />}
                    <Pressable
                      onPress={() => setActing(cat)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        backgroundColor: pressed ? "rgba(255,255,255,0.04)" : "transparent",
                      })}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: `${cat.color}1F`,
                        }}
                      >
                        <Icon size={18} color={cat.color} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                          {cat.name}
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>
                          {cat.isDefault ? "Padrão do Willo" : "Criada por você"}
                        </Text>
                      </View>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </Surface>
          </Animated.View>
        )}

        <Text style={{ marginTop: 12, paddingHorizontal: 4, fontSize: 12, lineHeight: 18, color: INK.soft }}>
          Cada categoria tem nome e cor próprios, para que seus gráficos fiquem fáceis de ler. Toque em
          uma para editar ou excluir.
        </Text>

        {error && (
          <Text style={{ marginTop: 12, paddingHorizontal: 4, fontSize: 13, color: RED }}>{error}</Text>
        )}
      </ScrollView>

      {/* ── What you can do to one ── */}
      <BottomSheet open={!!acting} onClose={() => setActing(null)}>
        {acting && (
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 20,
                paddingBottom: 14,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${acting.color}1F`,
                }}
              >
                {(() => {
                  const Icon = categoryIcon(acting.name, customCats ?? undefined);
                  return <Icon size={18} color={acting.color} strokeWidth={2} />;
                })()}
              </View>
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: "600", color: "#fff" }}>
                {acting.name}
              </Text>
            </View>

            <Hairline />
            <Pressable
              onPress={() => {
                const cat = acting;
                setActing(null);
                setEditing(cat);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 20,
                paddingVertical: 15,
                backgroundColor: pressed ? "rgba(255,255,255,0.05)" : "transparent",
              })}
            >
              <Pencil size={18} color="rgba(255,255,255,0.74)" />
              <Text style={{ fontSize: 15, color: "#fff" }}>Editar nome, ícone e cor</Text>
            </Pressable>

            <Hairline />
            <Pressable
              onPress={() => {
                const cat = acting;
                setActing(null);
                setConfirming(cat);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 20,
                paddingVertical: 15,
                backgroundColor: pressed ? "rgba(255,255,255,0.05)" : "transparent",
              })}
            >
              <Trash2 size={18} color={RED} />
              <Text style={{ fontSize: 15, color: RED }}>Excluir categoria</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>

      {/* ── Removing one ── */}
      <BottomSheet open={!!confirming} onClose={() => setConfirming(null)}>
        {confirming && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
              Excluir “{confirming.name}”?
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: INK.soft }}>
              Transações antigas continuam salvas, mas essa categoria deixa de aparecer nas opções.
            </Text>
            <Pressable
              onPress={() => void remove(confirming)}
              style={({ pressed }) => ({
                marginTop: 22,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(248,113,113,0.16)",
                borderWidth: 1,
                borderColor: "rgba(248,113,113,0.30)",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: RED }}>Excluir</Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirming(null)}
              style={({ pressed }) => ({
                marginTop: 10,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Cancelar</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>

      {/* ── Making a new one, and changing one ── */}
      <CategorySheet
        open={creating}
        onClose={() => setCreating(false)}
        onSave={create}
        title="Nova categoria"
        existingNames={names}
        usedColors={colors}
      />

      <CategorySheet
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={update}
        title="Editar categoria"
        initialName={editing?.name ?? ""}
        initialIcon={editing?.icon || DEFAULT_CATEGORY_ICON_SLUG}
        initialColor={editing?.color}
        existingNames={names.filter((n) => n !== editing?.name)}
        usedColors={colors.filter((c) => c !== editing?.color)}
      />
    </Room>
  );
}
