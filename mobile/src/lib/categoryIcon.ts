import { iconNameFor, FALLBACK_ICON_NAME } from "@/lib/categoryIconNames";
import type { CustomCategory } from "@/services/categoryService";

import Award from "lucide-react-native/icons/award";
import Banknote from "lucide-react-native/icons/banknote";
import Bike from "lucide-react-native/icons/bike";
import Briefcase from "lucide-react-native/icons/briefcase";
/* lucide 1.x renamed building-2; the key stays Building2 to match the shared
   name list. */
import Building2 from "lucide-react-native/icons/building-complex";
import Car from "lucide-react-native/icons/car";
import CircleEllipsis from "lucide-react-native/icons/circle-ellipsis";
import Coffee from "lucide-react-native/icons/coffee";
import CupSoda from "lucide-react-native/icons/cup-soda";
import DollarSign from "lucide-react-native/icons/dollar-sign";
import Droplets from "lucide-react-native/icons/droplets";
import Dumbbell from "lucide-react-native/icons/dumbbell";
import FileText from "lucide-react-native/icons/file-text";
import Flame from "lucide-react-native/icons/flame";
import Gamepad2 from "lucide-react-native/icons/gamepad-2";
import Gift from "lucide-react-native/icons/gift";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import Heart from "lucide-react-native/icons/heart";
import Home from "lucide-react-native/icons/house";
import Landmark from "lucide-react-native/icons/landmark";
import Package from "lucide-react-native/icons/package";
import PawPrint from "lucide-react-native/icons/paw-print";
import Percent from "lucide-react-native/icons/percent";
import Pizza from "lucide-react-native/icons/pizza";
import Plane from "lucide-react-native/icons/plane";
import Plug from "lucide-react-native/icons/plug";
import Receipt from "lucide-react-native/icons/receipt";
import Repeat from "lucide-react-native/icons/repeat";
import Scissors from "lucide-react-native/icons/scissors";
import Shirt from "lucide-react-native/icons/shirt";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import ShoppingCart from "lucide-react-native/icons/shopping-cart";
import Smartphone from "lucide-react-native/icons/smartphone";
import TrendingUp from "lucide-react-native/icons/trending-up";
import Users from "lucide-react-native/icons/users";
import Utensils from "lucide-react-native/icons/utensils";
import Wallet from "lucide-react-native/icons/wallet";
import Wifi from "lucide-react-native/icons/wifi";
import Wrench from "lucide-react-native/icons/wrench";
import Zap from "lucide-react-native/icons/zap";

/**
 * The phone's half of the category lookup.
 *
 * Which glyph belongs to a category is decided once, by name, in the shared
 * categoryIconNames. This only turns those names into the drawings this package
 * ships, so a category wears the same glyph in the browser and on the phone without
 * the choice being written down twice.
 */

export type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const LUCIDE: Record<string, IconCmp> = {
  Award, Banknote, Bike, Briefcase, Building2, Car, CircleEllipsis, Coffee,
  CupSoda, DollarSign, Droplets, Dumbbell, FileText, Flame, Gamepad2, Gift,
  GraduationCap, Heart, Home, Landmark, Package, PawPrint, Percent, Pizza,
  Plane, Plug, Receipt, Repeat, Scissors, Shirt, ShoppingBag, ShoppingCart,
  Smartphone, TrendingUp, Users, Utensils, Wallet, Wifi, Wrench, Zap,
};

/** A custom category keeps whichever glyph it was given, if we have it. */
export function categoryIcon(category: string, customCats?: CustomCategory[]): IconCmp {
  const custom = customCats?.find((c) => c.name === category && !c.is_hidden_default);
  if (custom?.icon && LUCIDE[custom.icon]) return LUCIDE[custom.icon];
  return LUCIDE[iconNameFor(category)] ?? LUCIDE[FALLBACK_ICON_NAME];
}
