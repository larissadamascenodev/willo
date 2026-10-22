import type { IconCmp } from "~/lib/categoryIconSlugs";

import Car from "lucide-react-native/icons/car";
import Gamepad2 from "lucide-react-native/icons/gamepad-2";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import Home from "lucide-react-native/icons/house";
import Landmark from "lucide-react-native/icons/landmark";
/* lucide 1.x renamed more-horizontal to ellipsis; the key stays MoreHorizontal to
   match the shared group list. */
import MoreHorizontal from "lucide-react-native/icons/ellipsis";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import ShoppingCart from "lucide-react-native/icons/shopping-cart";

/**
 * The phone's drawings for the eight spending groups.
 *
 * Which groups exist and what falls into each is decided once in categoryGroups —
 * the browser reads the same list. This is only the other half of the glyph lookup.
 */
const GROUP_ICONS: Record<string, IconCmp> = {
  ShoppingCart, Home, Car, HeartPulse, Gamepad2, ShoppingBag, GraduationCap, Landmark, MoreHorizontal,
};

export const groupIcon = (name: string): IconCmp => GROUP_ICONS[name] ?? MoreHorizontal;
