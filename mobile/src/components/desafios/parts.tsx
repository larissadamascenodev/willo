import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import {
  Bike,
  Bus,
  CalendarCheck,
  Car,
  CircleCheck,
  Coffee,
  CreditCard,
  Flag,
  Flame,
  Banknote,
  Crown,
  Eye,
  Gem,
  Layers,
  NotebookPen,
  Sunrise,
  Tag,
  TrendingDown,
  Wallet,
  Landmark,
  PenLine,
  PiggyBank,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Tv,
  Utensils,
} from "~/components/icons";
import type { Achievement, IconKey, Tier } from "~/lib/challenges";
import { th } from "~/theme/theme";
import { INK } from "~/theme/tokens";

/**
 * The pieces the challenges page is drawn with: each challenge's glyph, the ring that
 * fills as the days go by, and the medals.
 *
 * A medal is a disc with a metal rim — bronze, silver, gold — and its glyph in the
 * middle; one not yet earned is a plain grey rim with the glyph faint, and a thin arc
 * round it showing how close the next step is.
 */

type Glyph = typeof Flag;

export const CHALLENGE_ICON: Record<IconKey, Glyph> = {
  delivery: Bike,
  online: ShoppingBag,
  car: Car,
  pen: PenLine,
  calendar: CalendarCheck,
  bag: ShoppingCart,
  coffee: Coffee,
  lunch: Utensils,
  tv: Tv,
  bus: Bus,
  flag: Flag,
};

export const MEDAL_ICON: Record<Achievement["icon"], Glyph> = {
  pen: PenLine,
  flame: Flame,
  check: CircleCheck,
  card: CreditCard,
  piggy: PiggyBank,
  flag: Flag,
  sun: Sun,
  calendar: CalendarCheck,
  vault: Landmark,
  sunrise: Sunrise,
  note: NotebookPen,
  layers: Layers,
  wallet: Wallet,
  tag: Tag,
  trending: TrendingDown,
  income: Banknote,
  fire: Flame,
  bike: Bike,
  bag: ShoppingBag,
  eye: Eye,
  crown: Crown,
  gem: Gem,
};

/* Light and shade of each metal; the rim runs from one to the other. */
const METAL: Record<Exclude<Tier, 0>, [string, string, string]> = {
  1: ["#F0C9A2", "#B07A4C", "#7C5232"],
  2: ["#FFFFFF", "#C3CBD6", "#7F8896"],
  3: ["#FBE7A8", "#D2A646", "#8E6A1E"],
  4: ["#F6FBFF", "#BCD3E6", "#6E879E"],
  5: ["#EAFDFF", "#8FE3F5", "#3A86B0"],
};
export const METAL_INK: Record<Exclude<Tier, 0>, string> = { 1: "#D29A68", 2: "#D5DCE6", 3: "#E9C462", 4: "#DDEBF6", 5: "#A6EEFF" };

/** A ring that fills from the top, clockwise. */
export function Ring({ size, value, color, track, width = 4 }: { size: number; value: number; color: string; track: string; width?: number }) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={width} fill="none" />
      {v > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />}
    </Svg>
  );
}

export function MedalBadge({ a, size = 76 }: { a: Achievement; size?: number }) {
  const Icon = MEDAL_ICON[a.icon];
  const earned = a.tier > 0;
  const toNext = a.next ? Math.min(1, a.value / a.next) : 1;
  const rim = size * 0.1;
  const inner = size - rim * 2 - 8;
  const id = `metal-${a.key}-${a.tier}`;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* How close the next step is, as a thin arc outside the rim. */}
      {a.next !== null && (
        <View style={{ position: "absolute" }}>
          <Ring size={size} value={toNext} color={th("rgba(255,255,255,0.55)")} track={th("rgba(255,255,255,0.08)")} width={2.5} />
        </View>
      )}
      <View style={{ width: size - 8, height: size - 8, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size - 8} height={size - 8} style={{ position: "absolute" }}>
          <Defs>
            {earned && (
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={METAL[a.tier as Exclude<Tier, 0>][0]} />
                <Stop offset="0.55" stopColor={METAL[a.tier as Exclude<Tier, 0>][1]} />
                <Stop offset="1" stopColor={METAL[a.tier as Exclude<Tier, 0>][2]} />
              </LinearGradient>
            )}
          </Defs>
          <Circle cx={(size - 8) / 2} cy={(size - 8) / 2} r={(size - 8) / 2} fill={earned ? `url(#${id})` : th("rgba(255,255,255,0.08)", "bg")} />
          <Circle cx={(size - 8) / 2} cy={(size - 8) / 2} r={inner / 2} fill={earned ? "#14161B" : th("rgba(255,255,255,0.04)", "bg")} />
        </Svg>
        {/* Above the discs: on the web a positioned layer is painted over plain ones. */}
        <View style={{ position: "relative", zIndex: 1 }}>
          <Icon size={inner * 0.46} color={earned ? METAL_INK[a.tier as Exclude<Tier, 0>] : th(INK.faint)} strokeWidth={2} />
        </View>
      </View>
    </View>
  );
}

/** Easy, medium, hard, as a small word. */
export function DifficultyTag({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: th(INK.soft) }}>{label}</Text>
    </View>
  );
}
