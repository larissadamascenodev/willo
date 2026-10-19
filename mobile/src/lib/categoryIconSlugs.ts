import { DEFAULT_CATEGORY_ICON_SLUG } from "@/lib/categoryPalette";

import Award from "lucide-react-native/icons/award";
import Baby from "lucide-react-native/icons/baby";
import BadgeDollarSign from "lucide-react-native/icons/badge-dollar-sign";
import Banknote from "lucide-react-native/icons/banknote";
import Bike from "lucide-react-native/icons/bike";
import BookOpen from "lucide-react-native/icons/book-open";
import Briefcase from "lucide-react-native/icons/briefcase";
/* lucide 1.x renamed building-2; the slug stays as it is stored. */
import Building2 from "lucide-react-native/icons/building-complex";
import Bus from "lucide-react-native/icons/bus";
import Camera from "lucide-react-native/icons/camera";
import Car from "lucide-react-native/icons/car";
import Clapperboard from "lucide-react-native/icons/clapperboard";
import Coffee from "lucide-react-native/icons/coffee";
import Crown from "lucide-react-native/icons/crown";
import CupSoda from "lucide-react-native/icons/cup-soda";
import DollarSign from "lucide-react-native/icons/dollar-sign";
import Droplets from "lucide-react-native/icons/droplets";
import Dumbbell from "lucide-react-native/icons/dumbbell";
import FileText from "lucide-react-native/icons/file-text";
import Flame from "lucide-react-native/icons/flame";
import Fuel from "lucide-react-native/icons/fuel";
import Gamepad2 from "lucide-react-native/icons/gamepad-2";
import Gem from "lucide-react-native/icons/gem";
import Gift from "lucide-react-native/icons/gift";
import Globe from "lucide-react-native/icons/globe";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import Hammer from "lucide-react-native/icons/hammer";
import HandCoins from "lucide-react-native/icons/hand-coins";
import Headphones from "lucide-react-native/icons/headphones";
import Heart from "lucide-react-native/icons/heart";
/* The web's "home" is lucide's house. */
import Home from "lucide-react-native/icons/house";
/* lucide 1.x has no plain ice-cream; the cone is the same subject. */
import IceCream from "lucide-react-native/icons/ice-cream-cone";
import Key from "lucide-react-native/icons/key";
import Landmark from "lucide-react-native/icons/landmark";
import Leaf from "lucide-react-native/icons/leaf";
import Lightbulb from "lucide-react-native/icons/lightbulb";
import MapIcon from "lucide-react-native/icons/map";
import Monitor from "lucide-react-native/icons/monitor";
/* lucide 1.x renamed music to audio-lines. */
import Music from "lucide-react-native/icons/audio-lines";
import Package from "lucide-react-native/icons/package";
import Palette from "lucide-react-native/icons/palette";
import PawPrint from "lucide-react-native/icons/paw-print";
import Phone from "lucide-react-native/icons/phone";
import PiggyBank from "lucide-react-native/icons/piggy-bank";
import Pill from "lucide-react-native/icons/pill";
import Pizza from "lucide-react-native/icons/pizza";
import Plane from "lucide-react-native/icons/plane";
import Plug from "lucide-react-native/icons/plug";
import Popcorn from "lucide-react-native/icons/popcorn";
import Receipt from "lucide-react-native/icons/receipt";
import Repeat from "lucide-react-native/icons/repeat";
import Salad from "lucide-react-native/icons/salad";
import Scissors from "lucide-react-native/icons/scissors";
import Shield from "lucide-react-native/icons/shield";
import Shirt from "lucide-react-native/icons/shirt";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import ShoppingCart from "lucide-react-native/icons/shopping-cart";
import Smartphone from "lucide-react-native/icons/smartphone";
import Star from "lucide-react-native/icons/star";
import Stethoscope from "lucide-react-native/icons/stethoscope";
import Target from "lucide-react-native/icons/target";
import Tent from "lucide-react-native/icons/tent";
import TrendingUp from "lucide-react-native/icons/trending-up";
import Truck from "lucide-react-native/icons/truck";
import Tv from "lucide-react-native/icons/tv";
import Umbrella from "lucide-react-native/icons/umbrella";
import Users from "lucide-react-native/icons/users";
import Utensils from "lucide-react-native/icons/utensils";
import UtensilsCrossed from "lucide-react-native/icons/utensils-crossed";
import Wallet from "lucide-react-native/icons/wallet";
import Wifi from "lucide-react-native/icons/wifi";
import Wine from "lucide-react-native/icons/wine";
import Wrench from "lucide-react-native/icons/wrench";
import Zap from "lucide-react-native/icons/zap";

export type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * The phone's drawings for the glyph slugs a category can choose from.
 *
 * Which slugs exist is shared with the browser — that list is the vocabulary stored
 * in the database. This is only the other half of the translation, because the two
 * lucide packages do not ship the same filenames: a handful were renamed in the
 * native one, and those are noted where they are imported rather than anywhere else.
 */
export const CATEGORY_ICONS: Record<string, IconCmp> = {
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  car: Car,
  pill: Pill,
  home: Home,
  "book-open": BookOpen,
  shirt: Shirt,
  "paw-print": PawPrint,
  scissors: Scissors,
  "gamepad-2": Gamepad2,
  gift: Gift,
  plane: Plane,
  smartphone: Smartphone,
  "dollar-sign": DollarSign,
  briefcase: Briefcase,
  music: Music,
  coffee: Coffee,
  dumbbell: Dumbbell,
  clapperboard: Clapperboard,
  "file-text": FileText,
  wrench: Wrench,
  "shopping-bag": ShoppingBag,
  lightbulb: Lightbulb,
  target: Target,
  heart: Heart,
  repeat: Repeat,
  "graduation-cap": GraduationCap,
  "trending-up": TrendingUp,
  award: Award,
  users: Users,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  zap: Zap,
  star: Star,
  globe: Globe,
  camera: Camera,
  headphones: Headphones,
  monitor: Monitor,
  tv: Tv,
  bus: Bus,
  landmark: Landmark,
  bike: Bike,
  fuel: Fuel,
  baby: Baby,
  stethoscope: Stethoscope,
  palette: Palette,
  "utensils-crossed": UtensilsCrossed,
  wine: Wine,
  pizza: Pizza,
  hammer: Hammer,
  key: Key,
  shield: Shield,
  umbrella: Umbrella,
  tent: Tent,
  map: MapIcon,
  truck: Truck,
  leaf: Leaf,
  flame: Flame,
  gem: Gem,
  crown: Crown,
  "badge-dollar-sign": BadgeDollarSign,
  "hand-coins": HandCoins,
  receipt: Receipt,
  banknote: Banknote,
  droplets: Droplets,
  "cup-soda": CupSoda,
  package: Package,
  popcorn: Popcorn,
  salad: Salad,
  "ice-cream": IceCream,
  plug: Plug,
  wifi: Wifi,
  phone: Phone,
  "building-2": Building2,
};

/** The drawing for a stored slug, or the fallback when it is unknown. */
export function iconForSlug(slug: string | null | undefined): IconCmp {
  return (slug && CATEGORY_ICONS[slug]) || CATEGORY_ICONS[DEFAULT_CATEGORY_ICON_SLUG];
}
