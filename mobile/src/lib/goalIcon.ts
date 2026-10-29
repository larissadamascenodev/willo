import { GOAL_PRESET_DATA, getGoalPresetData, type GoalPresetData } from "@/lib/goalPresets";
import type { IconCmp } from "~/lib/categoryIconSlugs";

import Car from "lucide-react-native/icons/car";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import Home from "lucide-react-native/icons/house";
/* lucide 1.x renamed palmtree to tree-palm; the key stays Palmtree to match the
   shared preset list. */
import Palmtree from "lucide-react-native/icons/tree-palm";
import PiggyBank from "lucide-react-native/icons/piggy-bank";
import Plane from "lucide-react-native/icons/plane";
import Rocket from "lucide-react-native/icons/rocket";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import TrendingUp from "lucide-react-native/icons/trending-up";

/**
 * The phone's drawings for the goal presets.
 *
 * Which goals exist and what each one is called and coloured is shared with the
 * browser; this is only the other half of the translation.
 */

const ICONS: Record<string, IconCmp> = {
  Home, Car, Plane, TrendingUp, GraduationCap, Palmtree, ShieldCheck, Rocket, PiggyBank,
};

export interface GoalPreset extends Omit<GoalPresetData, "icon"> {
  icon: IconCmp;
}

const draw = (preset: GoalPresetData): GoalPreset => ({
  ...preset,
  icon: ICONS[preset.icon] ?? PiggyBank,
});

/* A goal the person named in their own words still says what it is for: a trip to
   Japan is a trip. Only read on the phone, and only when the name is none of the
   presets', so a preset's own name keeps meaning exactly what it does on the web. */
const WORDS: [RegExp, string][] = [
  [/viag|viaj|ferias|férias|passagem|intercambio|intercâmbio|cruzeiro|lua de mel/, "viagem"],
  [/carro|moto|veiculo|veículo|automovel|automóvel/, "carro"],
  [/casa|apartamento|apto|imovel|imóvel|reforma|mudanca|mudança|financiamento/, "casa"],
  [/faculdade|curso|estudo|mba|pos-?gradua|escola/, "educacao"],
  [/aposent/, "aposentadoria"],
  [/negocio|negócio|empresa|startup/, "negocio"],
  [/liberdade|investir|investimento/, "liberdade"],
];

/** The preset a goal came from, with its glyph drawn. */
export function goalPreset(goal: { name: string }): GoalPreset {
  const found = getGoalPresetData(goal);
  if (found.id !== "custom") return draw(found);
  const name = goal.name.toLocaleLowerCase("pt-BR");
  const hit = WORDS.find(([re]) => re.test(name));
  const kin = hit ? GOAL_PRESET_DATA.find((p) => p.id === hit[1]) : undefined;
  return draw(kin ? { ...kin, name: goal.name } : found);
}

export { GOAL_PRESET_DATA } from "@/lib/goalPresets";
export const goalPresetIcon = (iconName: string): IconCmp => ICONS[iconName] ?? PiggyBank;
