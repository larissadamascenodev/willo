import { supabase } from "@/integrations/supabase/client";

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
  is_hidden_default: boolean;
  created_at: string;
  updated_at: string;
}

// Module-level cache for custom categories
let cachedCategories: CustomCategory[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30s

export function invalidateCustomCategoryCache() {
  cachedCategories = null;
  cacheTimestamp = 0;
}

// Listen for changes to invalidate cache
if (typeof window !== "undefined") {
  window.addEventListener("finance-data-changed", invalidateCustomCategoryCache);
}

export async function getCustomCategories(type?: "receita" | "despesa") {
  // Use cache if fresh and no type filter
  if (!type && cachedCategories && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedCategories;
  }

  let query = supabase
    .from("custom_categories" as any)
    .select("*")
    .order("name", { ascending: true });

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) throw error;
  const result = (data ?? []) as unknown as CustomCategory[];

  if (!type) {
    cachedCategories = result;
    cacheTimestamp = Date.now();
  }

  return result;
}

const normalizeName = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Names that would make the app useless for analysis. */
const FORBIDDEN_NAMES = ["outros", "outro", "diversos", "geral", "varios", "sem categoria"];

/** Every category name and color must be unique, so nothing gets confused later. */
export async function assertCategoryIsUnique(
  name: string,
  color: string,
  type: string,
  ignoreId?: string,
) {
  const clean = normalizeName(name);
  if (!clean) throw new Error("Dê um nome para a categoria");
  if (FORBIDDEN_NAMES.includes(clean)) {
    throw new Error("Escolha um nome específico: “Outros” não ajuda a entender seus gastos");
  }

  const { DEFAULT_CATEGORY_TYPE, DEFAULT_CATEGORY_HEX } = await import("@/lib/categoryIcons");
  const defaults = Object.keys(DEFAULT_CATEGORY_TYPE).filter((n) => DEFAULT_CATEGORY_TYPE[n] === type);
  if (defaults.some((n) => normalizeName(n) === clean)) throw new Error(`Já existe a categoria “${name.trim()}”`);
  if (Object.values(DEFAULT_CATEGORY_HEX).some((hex) => hex.toLowerCase() === color.toLowerCase())) {
    throw new Error("Essa cor já é usada por outra categoria. Escolha outra.");
  }

  const existing = await getCustomCategories();
  const clash = existing.filter((c) => c.id !== ignoreId);
  if (clash.some((c) => normalizeName(c.name) === clean)) throw new Error(`Já existe a categoria “${name.trim()}”`);
  if (clash.some((c) => (c.color ?? "").toLowerCase() === color.toLowerCase())) {
    throw new Error("Essa cor já é usada por outra categoria. Escolha outra.");
  }
}

export async function createCustomCategory(
  userId: string,
  input: { name: string; icon: string; color: string; type: string }
) {
  await assertCategoryIsUnique(input.name, input.color, input.type);
  const { data, error } = await supabase
    .from("custom_categories" as any)
    .insert({
      user_id: userId,
      name: input.name.trim(),
      icon: input.icon,
      color: input.color,
      type: input.type,
    })
    .select()
    .single();

  if (error) throw error;
  invalidateCustomCategoryCache();
  return data as unknown as CustomCategory;
}

export async function updateCustomCategory(
  id: string,
  updates: { name?: string; icon?: string; color?: string; type?: string }
) {
  if (updates.name || updates.color) {
    const all = await getCustomCategories();
    const current = all.find((c) => c.id === id);
    await assertCategoryIsUnique(
      updates.name ?? current?.name ?? "",
      updates.color ?? current?.color ?? "",
      updates.type ?? current?.type ?? "despesa",
      id,
    );
  }
  const { data, error } = await supabase
    .from("custom_categories" as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  invalidateCustomCategoryCache();
  return data as unknown as CustomCategory;
}

export async function deleteCustomCategory(id: string) {
  const { error } = await supabase
    .from("custom_categories" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
  invalidateCustomCategoryCache();
}

export async function hideDefaultCategory(
  userId: string,
  name: string,
  type: string
) {
  const { error } = await supabase
    .from("custom_categories" as any)
    .insert({
      user_id: userId,
      name,
      icon: "📋",
      color: "#888888",
      type,
      is_hidden_default: true,
    });

  if (error) throw error;
}

export async function unhideDefaultCategory(userId: string, name: string, type: string) {
  const { error } = await supabase
    .from("custom_categories" as any)
    .delete()
    .eq("name", name)
    .eq("type", type)
    .eq("is_hidden_default", true);

  if (error) throw error;
}
