import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { MoreHorizontal, Pencil, Plus, Tag, Trash2 } from "lucide-react-native";
import { Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CATEGORY_HEX, DEFAULT_CATEGORY_TYPE, getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/lib/categoryIconOptions";
import { createCustomCategory, deleteCustomCategory, getCustomCategories, hideDefaultCategory, updateCustomCategory, type CustomCategory } from "@/services/categoryService";
import { CategoryCreateSheet } from "~/features/nova/CategoryCreateSheet";
import { BottomSheet, Button, Glass, PageHeader, Screen, Segmented, Text, colors, toast, white } from "~/ui";
import { tint } from "~/lib/color";

interface Unified { id: string; name: string; icon: string; color: string; isDefault: boolean; customId?: string }

/** Categorias: as do Willo e as suas, com nome, ícone e cor que você escolhe. */
export default function Categorias() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"despesa" | "receita">("despesa");
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Unified | null>(null);
  const [menu, setMenu] = useState<Unified | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try { setCustom(await getCustomCategories()); } catch { toast.error("Erro ao carregar categorias"); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const key = (n: string) => n.trim().toLocaleLowerCase("pt-BR");
  const hidden = new Set(custom.filter((c) => c.type === tab && c.is_hidden_default).map((c) => key(c.name)));
  const defaults: Unified[] = Object.entries(DEFAULT_CATEGORY_TYPE)
    .filter(([, t]) => t === tab).filter(([n]) => !hidden.has(key(n)))
    .map(([n]) => ({ id: `default-${n}`, name: n, icon: "", color: DEFAULT_CATEGORY_HEX[n] || "#64748b", isDefault: true }));
  const own: Unified[] = custom.filter((c) => c.type === tab && !c.is_hidden_default)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, isDefault: false, customId: c.id }));

  const list = [...new Map([...defaults, ...own].reduce((m, c) => {
    const ex = m.get(key(c.name));
    if (!ex || (!c.isDefault && ex.isDefault)) m.set(key(c.name), c);
    return m;
  }, new Map<string, Unified>())).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const names = list.map((c) => c.name);
  const colorsUsed = list.map((c) => c.color).filter(Boolean);

  const create = async (d: { name: string; icon: string; color: string }) => {
    if (!user) return;
    try { await createCustomCategory(user.id, { ...d, type: tab }); toast.success("Categoria criada!"); setCreating(false); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao criar categoria"); }
  };
  const update = async (d: { name: string; icon: string; color: string }) => {
    if (!editing || !user) return;
    try {
      if (editing.isDefault) { await hideDefaultCategory(user.id, editing.name, tab); await createCustomCategory(user.id, { ...d, type: tab }); }
      else await updateCustomCategory(editing.customId!, d);
      toast.success("Categoria atualizada!"); setEditing(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao atualizar"); }
  };
  const remove = (c: Unified) => {
    setMenu(null);
    Alert.alert(`Excluir “${c.name}”?`, "Transações antigas continuam salvas, mas essa categoria deixa de aparecer nas opções.", [
      { text: "Excluir", style: "destructive", onPress: async () => {
        try { if (c.isDefault) await hideDefaultCategory(user!.id, c.name, tab); else await deleteCustomCategory(c.customId!); toast.success("Categoria removida"); load(); } catch { toast.error("Erro ao remover"); }
      } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const Icon = (c: Unified, size = 18) => { const I = c.isDefault ? getDefaultCategoryIcon(c.name) : getIconComponent(c.icon); return <I size={size} color={c.color} />; };

  return (
    <Screen onRefresh={load}>
      <PageHeader
        title="Categorias"
        subtitle="Organize como seus gastos são agrupados"
        action={
          <Pressable onPress={() => setCreating(true)} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "#fff" }}>
            <Plus size={16} color={colors.black} strokeWidth={2.5} /><Text weight="semibold" size={13} color={colors.black}>Nova</Text>
          </Pressable>
        }
      />
      <View style={{ marginTop: 20 }}>
        <Segmented<"despesa" | "receita"> options={[{ key: "despesa", label: "Despesas" }, { key: "receita", label: "Receitas" }]} value={tab} onChange={setTab} />
      </View>
      <View style={{ marginTop: 24, marginBottom: 10, paddingHorizontal: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text display weight="bold" size={18}>{tab === "despesa" ? "De despesa" : "De receita"}</Text>
        <Text size={13} color={white(0.56)}>{list.length} categorias</Text>
      </View>

      {loading ? (
        <View style={{ gap: 8 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={{ height: 60, borderRadius: 18, backgroundColor: white(0.04) }} />)}</View>
      ) : list.length === 0 ? (
        <View style={{ borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.1), paddingVertical: 40, alignItems: "center" }}>
          <Tag size={28} color={white(0.38)} />
          <Text size={14} color={white(0.7)} style={{ marginTop: 8 }}>Nenhuma categoria por aqui</Text>
          <Button label="Criar a primeira" height={40} style={{ marginTop: 16 }} onPress={() => setCreating(true)} />
        </View>
      ) : (
        <Glass radius={22}>
          {list.map((c, i) => (
            <Pressable key={c.id} onPress={() => setMenu(c)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.05), backgroundColor: pressed ? white(0.04) : "transparent" })}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(c.color, 0.12) }}>{Icon(c)}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" size={15} numberOfLines={1}>{c.name}</Text>
                <Text size={12} color={white(0.56)}>{c.isDefault ? "Padrão do Willo" : "Criada por você"}</Text>
              </View>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
              <MoreHorizontal size={20} color={white(0.45)} />
            </Pressable>
          ))}
        </Glass>
      )}
      <Text size={12} color={white(0.5)} style={{ marginTop: 12, paddingHorizontal: 4, lineHeight: 18 }}>Cada categoria tem nome e cor únicos, para que seus gráficos fiquem fáceis de ler. Toque em uma categoria para editar ou excluir.</Text>

      <BottomSheet open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(menu.color, 0.12) }}>{Icon(menu)}</View>
              <Text weight="semibold" size={16}>{menu.name}</Text>
            </View>
            <Pressable onPress={() => { setEditing(menu); setMenu(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: white(0.06) }}><Pencil size={18} color={white(0.74)} /><Text size={15}>Editar nome, ícone e cor</Text></Pressable>
            <Pressable onPress={() => remove(menu)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: white(0.06) }}><Trash2 size={18} color={colors.red} /><Text size={15} color={colors.red}>Excluir categoria</Text></Pressable>
          </View>
        )}
      </BottomSheet>

      <CategoryCreateSheet open={creating} onClose={() => setCreating(false)} onSave={create} title="Nova categoria" existingNames={names} usedColors={colorsUsed} />
      <CategoryCreateSheet open={!!editing} onClose={() => setEditing(null)} onSave={update} initialName={editing?.name ?? ""} initialIcon={editing?.icon || "file-text"} initialColor={editing?.color} title="Editar categoria" existingNames={names.filter((n) => n !== editing?.name)} usedColors={colorsUsed.filter((c) => c !== editing?.color)} />
    </Screen>
  );
}
