import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/MobilePage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import CategoryCreateModal, { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import { getDefaultCategoryIcon, DEFAULT_CATEGORY_HEX, DEFAULT_CATEGORY_TYPE } from "@/lib/categoryIcons";
import {
  getCustomCategories,
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  hideDefaultCategory,
  type CustomCategory,
} from "@/services/categoryService";

interface UnifiedCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
  isDefault: boolean;
  customId?: string;
}

export default function GerenciarCategorias() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"despesa" | "receita">("despesa");
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCat, setEditingCat] = useState<UnifiedCategory | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<UnifiedCategory | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cats = await getCustomCategories();
      setCustomCats(cats);
    } catch {
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  // Build unified list (deduplicated)
  const hiddenDefaults = new Set(
    customCats
      .filter((c) => c.type === tab && c.is_hidden_default)
      .map((c) => c.name.trim().toLocaleLowerCase("pt-BR"))
  );

  const defaultCategories: UnifiedCategory[] = Object.entries(DEFAULT_CATEGORY_TYPE)
    .filter(([, type]) => type === tab)
    .filter(([name]) => !hiddenDefaults.has(name.trim().toLocaleLowerCase("pt-BR")))
    .map(([name]) => ({
      id: `default-${name}`,
      name,
      icon: "",
      color: DEFAULT_CATEGORY_HEX[name] || "#64748b",
      type: tab,
      isDefault: true,
    }));

  const customCategoriesList = customCats
    .filter((c) => c.type === tab && !c.is_hidden_default)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
      isDefault: false,
      customId: cat.id,
    }));

  const unifiedCategories = Array.from(
    [...defaultCategories, ...customCategoriesList].reduce((map, category) => {
      const key = category.name.trim().toLocaleLowerCase("pt-BR");
      const existing = map.get(key);
      if (!existing || (!category.isDefault && existing.isDefault)) {
        map.set(key, category);
      }
      return map;
    }, new Map<string, UnifiedCategory>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const allNames = unifiedCategories.map((c) => c.name);
  // Each category keeps its own color, so the charts stay readable
  const allColors = unifiedCategories.map((c) => c.color).filter(Boolean) as string[];

  const handleCreate = async (data: { name: string; icon: string; color: string }) => {
    if (!user) return;
    try {
      await createCustomCategory(user.id, { ...data, type: tab });
      toast.success("Categoria criada!");
      setShowCreateModal(false);
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar categoria");
    }
  };

  const handleUpdate = async (data: { name: string; icon: string; color: string }) => {
    if (!editingCat) return;
    try {
      if (editingCat.isDefault) {
        await hideDefaultCategory(user!.id, editingCat.name, tab);
        await createCustomCategory(user!.id, { ...data, type: tab });
      } else {
        await updateCustomCategory(editingCat.customId!, data);
      }
      toast.success("Categoria atualizada!");
      setEditingCat(null);
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  };

  const handleDelete = async (cat: UnifiedCategory) => {
    try {
      if (cat.isDefault) {
        await hideDefaultCategory(user!.id, cat.name, tab);
      } else {
        await deleteCustomCategory(cat.customId!);
      }
      toast.success("Categoria removida");
      setConfirmDeleteCat(null);
      fetchCategories();
    } catch {
      toast.error("Erro ao remover");
    }
  };


  const actionCat = unifiedCategories.find((c) => c.id === menuOpenId) ?? null;
  const renderIcon = (cat: UnifiedCategory, size = "h-[18px] w-[18px]") => {
    const IconComp = cat.isDefault ? getDefaultCategoryIcon(cat.name) : getIconComponent(cat.icon);
    return <IconComp className={size} style={{ color: cat.color }} />;
  };

  return (
    <div className="min-h-screen px-4 pb-28">
      <PageHeader
        title="Categorias"
        subtitle="Organize como seus gastos são agrupados"
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#0B0B0B] active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nova
          </button>
        }
      />

      {/* Segmented control */}
      <div className="mt-5 flex isolate rounded-full border border-white/[0.08] willo-glass p-1">
        {(["despesa", "receita"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors",
              tab === t ? "text-[#0B0B0B]" : "text-white/70",
            )}
          >
            {tab === t && (
              <motion.span
                layoutId="cat-tab"
                className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{t === "despesa" ? "Despesas" : "Receitas"}</span>
          </button>
        ))}
      </div>

      <div className="mb-2.5 mt-6 flex items-center justify-between px-1">
        <h2 className="text-[18px] font-bold text-white">
          {tab === "despesa" ? "De despesa" : "De receita"}
        </h2>
        <span className="text-[13px] text-white/56">{unifiedCategories.length} categorias</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-[18px] bg-white/[0.04]" />
          ))}
        </div>
      ) : unifiedCategories.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/[0.1] px-6 py-10 text-center">
          <Tag className="mx-auto mb-2 h-7 w-7 text-white/38" />
          <p className="text-[14px] text-white/70">Nenhuma categoria por aqui</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0B0B0B]"
          >
            Criar a primeira
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass">
          <AnimatePresence initial={false}>
            {unifiedCategories.map((cat, i) => (
              <motion.button
                key={cat.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => setMenuOpenId(cat.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/[0.04]",
                  i > 0 && "border-t border-white/[0.05]",
                )}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${cat.color}1F` }}
                >
                  {renderIcon(cat)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-white">{cat.name}</span>
                  <span className="block text-[12px] text-white/56">
                    {cat.isDefault ? "Padrão do Willo" : "Criada por você"}
                  </span>
                </span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                <MoreHorizontal className="h-5 w-5 shrink-0 text-white/45" />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-white/50">
        Cada categoria tem nome e cor únicos, para que seus gráficos fiquem fáceis de ler. Toque em uma categoria para editar ou excluir.
      </p>

      {/* Action sheet */}
      <AnimatePresence>
        {actionCat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-end bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpenId(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full space-y-2 px-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              <div className="overflow-hidden rounded-[22px] willo-glass-inset">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${actionCat.color}1F` }}
                  >
                    {renderIcon(actionCat)}
                  </span>
                  <span className="truncate text-[16px] font-semibold text-white">{actionCat.name}</span>
                </div>
                <button
                  onClick={() => { setMenuOpenId(null); setEditingCat(actionCat); }}
                  className="flex w-full items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 text-[15px] text-white active:bg-white/[0.05]"
                >
                  <Pencil className="h-[18px] w-[18px] text-white/74" />
                  Editar nome, ícone e cor
                </button>
                <button
                  onClick={() => { setMenuOpenId(null); setConfirmDeleteCat(actionCat); }}
                  className="flex w-full items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 text-[15px] text-[#F87171] active:bg-white/[0.05]"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                  Excluir categoria
                </button>
              </div>
              <button
                onClick={() => setMenuOpenId(null)}
                className="w-full rounded-[22px] willo-glass-inset py-3.5 text-[15px] font-semibold text-white active:willo-glass-inset"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDeleteCat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-8 backdrop-blur-sm"
            onClick={() => setConfirmDeleteCat(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[300px] rounded-[22px] border border-white/[0.08] willo-glass-inset p-5 text-center"
            >
              <p className="text-[16px] font-bold text-white">Excluir “{confirmDeleteCat.name}”?</p>
              <p className="mt-1.5 text-[13px] text-white/66">
                Transações antigas continuam salvas, mas essa categoria deixa de aparecer nas opções.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setConfirmDeleteCat(null)}
                  className="flex-1 rounded-full bg-white/[0.07] py-2.5 text-[14px] font-semibold text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteCat)}
                  className="flex-1 rounded-full bg-[#F87171] py-2.5 text-[14px] font-semibold text-[#0B0B0B]"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CategoryCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        title="Nova Categoria"
        existingNames={allNames}
        usedColors={allColors}
      />

      <CategoryCreateModal
        open={!!editingCat}
        onClose={() => setEditingCat(null)}
        onSave={handleUpdate}
        initialName={editingCat?.name ?? ""}
        initialIcon={editingCat?.icon || "file-text"}
        initialColor={editingCat?.color ?? "#8b5cf6"}
        title="Editar Categoria"
        existingNames={allNames.filter((n) => n !== editingCat?.name)}
        usedColors={allColors.filter((c) => c !== editingCat?.color)}
      />
    </div>
  );
}
