import {
  Home, Car, Plane, TrendingUp, GraduationCap, Palmtree, ShieldCheck, Rocket, PiggyBank,
  type LucideIcon,
} from "lucide-react";
import { RESERVE_NAME, isReserveGoal } from "@/services/goalService";

export interface GoalPreset {
  id: string;
  name: string;
  icon: LucideIcon;
  hex: string;
  subtitle: string;
}

/** Starting points for a new goal — an icon and color instead of an AI-generated photo. */
export const GOAL_PRESETS: GoalPreset[] = [
  { id: "casa", name: "Casa Própria", icon: Home, hex: "#60A5FA", subtitle: "Conquistar o lar dos seus sonhos" },
  { id: "carro", name: "Carro Novo", icon: Car, hex: "#F59E0B", subtitle: "Dirigir o carro que você sempre quis" },
  { id: "viagem", name: "Viagem dos Sonhos", icon: Plane, hex: "#22D3EE", subtitle: "Conhecer o mundo e criar memórias" },
  { id: "liberdade", name: "Liberdade Financeira", icon: TrendingUp, hex: "#C8F36D", subtitle: "Viver sem depender de salário" },
  { id: "educacao", name: "Educação", icon: GraduationCap, hex: "#A78BFA", subtitle: "Investir no seu futuro profissional" },
  { id: "aposentadoria", name: "Aposentadoria Tranquila", icon: Palmtree, hex: "#FB923C", subtitle: "Curtir a vida com tranquilidade" },
  { id: "reserva", name: RESERVE_NAME, icon: ShieldCheck, hex: "#C8F36D", subtitle: "Proteção para imprevistos da vida" },
  { id: "negocio", name: "Negócio Próprio", icon: Rocket, hex: "#F87171", subtitle: "Empreender e ser dono do seu tempo" },
];

const NAME_ICON = new Map(GOAL_PRESETS.map((p) => [p.name.toLocaleLowerCase("pt-BR"), p]));

/** Maps a goal's name back to the preset it likely came from, for a consistent icon everywhere. */
export function getGoalPreset(goal: { name: string }): GoalPreset {
  if (isReserveGoal(goal)) return GOAL_PRESETS.find((p) => p.id === "reserva")!;
  return NAME_ICON.get(goal.name.trim().toLocaleLowerCase("pt-BR")) ?? {
    id: "custom",
    name: goal.name,
    icon: PiggyBank,
    hex: "#7DD3FC",
    subtitle: "Sua meta personalizada",
  };
}
