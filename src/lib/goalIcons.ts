import {
  Home, Car, Plane, TrendingUp, GraduationCap, Palmtree, ShieldCheck, Rocket, PiggyBank,
  type LucideIcon,
} from "lucide-react";
import {
  GOAL_PRESET_DATA,
  getGoalPresetData,
  type GoalPresetData,
} from "@/lib/goalPresets";

/**
 * The browser's drawings for the goal presets.
 *
 * Which goals exist, what they are called and what colour each one is lives in the
 * shared list; this only turns its glyph names into the components this package
 * ships, so the phone can do the same with its own.
 */

const ICONS: Record<string, LucideIcon> = {
  Home, Car, Plane, TrendingUp, GraduationCap, Palmtree, ShieldCheck, Rocket, PiggyBank,
};

export interface GoalPreset extends Omit<GoalPresetData, "icon"> {
  icon: LucideIcon;
}

const draw = (preset: GoalPresetData): GoalPreset => ({
  ...preset,
  icon: ICONS[preset.icon] ?? PiggyBank,
});

/** Starting points for a new goal — an icon and color instead of an AI-generated photo. */
export const GOAL_PRESETS: GoalPreset[] = GOAL_PRESET_DATA.map(draw);

/** Maps a goal's name back to the preset it likely came from, for a consistent icon everywhere. */
export function getGoalPreset(goal: { name: string }): GoalPreset {
  return draw(getGoalPresetData(goal));
}
