import {
  Utensils, Car, Heart, Repeat, Gamepad2, Home, GraduationCap, Shirt,
  PawPrint, Scissors, Gift, Plane, Smartphone, Receipt,
  Briefcase, TrendingUp, ShoppingBag, DollarSign, Award, Users, Wallet,
  FileText, Landmark, ShoppingCart, Zap, Droplets, Flame,
  CupSoda, Bike, Coffee, Dumbbell, Plug, Pizza, Building2,
  Banknote, Percent, Wifi, Wrench, Package, CircleEllipsis,
} from "lucide-react";
import { CATEGORY_ICON_NAMES, FALLBACK_ICON_NAME, iconNameFor } from "@/lib/categoryIconNames";

/* Which glyph goes with which category is decided once, by name, in
   categoryIconNames — the phone app reads the same list and looks the names up in
   its own icon set. This is only the browser's half of that lookup. */
const LUCIDE: Record<string, any> = {
  Utensils, Car, Heart, Repeat, Gamepad2, Home, GraduationCap, Shirt,
  PawPrint, Scissors, Gift, Plane, Smartphone, Receipt,
  Briefcase, TrendingUp, ShoppingBag, DollarSign, Award, Users, Wallet,
  FileText, Landmark, ShoppingCart, Zap, Droplets, Flame,
  CupSoda, Bike, Coffee, Dumbbell, Plug, Pizza, Building2,
  Banknote, Percent, Wifi, Wrench, Package, CircleEllipsis,
};

export const DEFAULT_CATEGORY_ICONS: Record<string, any> = Object.fromEntries(
  Object.entries(CATEGORY_ICON_NAMES).map(([category, name]) => [category, LUCIDE[name]]),
);

// HSL colors (without hsl() wrapper) — unique per category for chart differentiation
/* The data moved out so that wanting a colour no longer drags in an icon set;
   re-exported here because plenty already asks this module for it. */
export {
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_HEX,
  DEFAULT_CATEGORY_TYPE,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  getDefaultCategoryColor,
  getDefaultCategoryHex,
} from "@/lib/categoryData";

export function getDefaultCategoryIcon(name: string) {
  return LUCIDE[iconNameFor(name)] ?? LUCIDE[FALLBACK_ICON_NAME];
}
