import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import type { CustomCategory } from "@/services/categoryService";

/**
 * Resolve the icon component for a category — checks custom first, then defaults.
 */
export function getCategoryIcon(category: string, customCats?: CustomCategory[]) {
  const custom = customCats?.find((c) => c.name === category && !c.is_hidden_default);
  if (custom) return getIconComponent(custom.icon);
  return getDefaultCategoryIcon(category);
}

/* The HSL lookup is data, so it lives with the data — where a chart can reach it
   without pulling an icon set in behind it. */
export { getCategoryColor } from "@/lib/categoryData";


/**
 * Resolve hex color for a category — checks custom first, then defaults.
 */
/* The lookup itself is data, so it lives with the data — where anything that only
   wants a colour can reach it without pulling an icon set in behind it. */
export { categoryHex as getCategoryHexColor } from "@/lib/categoryData";
