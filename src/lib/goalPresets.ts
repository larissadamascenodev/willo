import { RESERVE_NAME, isReserveGoal } from "@/services/goalService";

/**
 * The goals people are actually saving for.
 *
 * A new goal starts from one of these rather than from an empty form, and the one
 * it started from is recovered later by its name — which is why the list has to be
 * the same list on both apps: a goal called "Carro Novo" wears the same glyph and
 * the same colour in the browser and on the phone, with nobody storing the choice.
 *
 * The glyph is named, not drawn, because the two lucide packages ship different
 * files. Each app turns a name into a drawing its own way.
 */

export interface GoalPresetData {
  id: string;
  name: string;
  /** A key into each app's own glyph table. */
  icon: string;
  hex: string;
  subtitle: string;
}

export const GOAL_PRESET_DATA: GoalPresetData[] = [
  { id: "casa", name: "Casa Própria", icon: "Home", hex: "#60A5FA", subtitle: "Conquistar o lar dos seus sonhos" },
  { id: "carro", name: "Carro Novo", icon: "Car", hex: "#F59E0B", subtitle: "Dirigir o carro que você sempre quis" },
  { id: "viagem", name: "Viagem dos Sonhos", icon: "Plane", hex: "#22D3EE", subtitle: "Conhecer o mundo e criar memórias" },
  { id: "liberdade", name: "Liberdade Financeira", icon: "TrendingUp", hex: "#C8F36D", subtitle: "Viver sem depender de salário" },
  { id: "educacao", name: "Educação", icon: "GraduationCap", hex: "#A78BFA", subtitle: "Investir no seu futuro profissional" },
  { id: "aposentadoria", name: "Aposentadoria Tranquila", icon: "Palmtree", hex: "#FB923C", subtitle: "Curtir a vida com tranquilidade" },
  { id: "reserva", name: RESERVE_NAME, icon: "ShieldCheck", hex: "#C8F36D", subtitle: "Proteção para imprevistos da vida" },
  { id: "negocio", name: "Negócio Próprio", icon: "Rocket", hex: "#F87171", subtitle: "Empreender e ser dono do seu tempo" },
];

/** What a goal that matches none of them looks like. */
export const CUSTOM_GOAL_PRESET = {
  id: "custom",
  icon: "PiggyBank",
  hex: "#7DD3FC",
  subtitle: "Sua meta personalizada",
};

const BY_NAME = new Map(GOAL_PRESET_DATA.map((p) => [p.name.toLocaleLowerCase("pt-BR"), p]));

/** The preset a goal came from, recovered from its name. */
export function getGoalPresetData(goal: { name: string }): GoalPresetData {
  if (isReserveGoal(goal)) return GOAL_PRESET_DATA.find((p) => p.id === "reserva")!;
  return (
    BY_NAME.get(goal.name.trim().toLocaleLowerCase("pt-BR")) ?? {
      ...CUSTOM_GOAL_PRESET,
      name: goal.name,
    }
  );
}

/**
 * How a goal stands.
 *
 * The same four numbers are read off a goal on the list, on its own page and in the
 * tile on the dashboard, and getting one of them slightly different in one place is
 * how two screens start disagreeing about the same goal.
 */
export function goalProgress(goal: { current_amount: number; target_amount: number }) {
  const progress = goal.target_amount > 0 ? Math.min(1, goal.current_amount / goal.target_amount) : 0;
  return {
    progress,
    percent: Math.round(progress * 100),
    remaining: Math.max(goal.target_amount - goal.current_amount, 0),
    isComplete: progress >= 1,
  };
}
