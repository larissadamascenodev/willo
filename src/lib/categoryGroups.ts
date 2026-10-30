/**
 * The handful of things a month's spending is really about.
 *
 * Thirty categories is an accurate answer and a useless one — nobody reads thirty
 * rows and comes away knowing where the money went. These eight are the level at
 * which a month has a shape: food, home, getting around, and so on. Which category
 * belongs to which group is a judgement about the subject, not about either app, so
 * it is written once.
 *
 * The glyph is named rather than drawn, because the two lucide packages ship
 * different files.
 */

export interface CategoryGroupDef {
  name: string;
  hex: string;
  /** A key into each app's own glyph table. */
  icon: string;
  categories: string[];
}

export const CATEGORY_GROUP_DEFS: CategoryGroupDef[] = [
  {
    name: "Alimentação",
    hex: "#F97316",
    icon: "ShoppingCart",
    categories: ["Alimentação", "Supermercado", "Bebidas", "Delivery", "Cafeteria", "Fast Food", "Restaurantes", "Padaria", "Alimentos e bebidas", "Restaurantes, bares e lanchonetes"],
  },
  {
    name: "Moradia",
    hex: "#6366F1",
    icon: "Home",
    categories: ["Moradia", "Aluguel", "Condomínio", "Casa", "Contas", "Energia", "Conta de Luz", "Conta de Água", "Conta de Gás", "Internet", "Telefone e Internet", "Serviços"],
  },
  {
    name: "Transporte",
    hex: "#3B82F6",
    icon: "Car",
    categories: ["Transporte", "Combustível", "Viagem"],
  },
  {
    name: "Saúde e bem-estar",
    hex: "#EF4444",
    icon: "HeartPulse",
    categories: ["Saúde", "Academia", "Beleza", "Pets", "Farmácia"],
  },
  {
    name: "Lazer",
    hex: "#EC4899",
    icon: "Gamepad2",
    categories: ["Lazer", "Assinaturas", "Presentes", "Streaming"],
  },
  {
    name: "Compras",
    hex: "#F59E0B",
    icon: "ShoppingBag",
    categories: ["Compras", "Vestuário", "Tecnologia", "Eletrônicos", "Compras online"],
  },
  {
    name: "Educação",
    hex: "#14B8A6",
    icon: "GraduationCap",
    categories: ["Educação", "Cursos", "Livros"],
  },
  {
    name: "Finanças",
    hex: "#22C55E",
    icon: "Landmark",
    categories: ["Impostos", "Investimentos", "Transferência", "Transferências", "Cartão de Crédito", "Seguros", "Tarifas", "Tarifas e juros", "Empréstimos", "Faturas", "Parcelamento", "Pix no crédito", "Pix Enviado", "Pix"],
  },
];

/** Everything that fits none of them, rather than being left out of the total. */
export const OTHER_GROUP_DEF: CategoryGroupDef = {
  name: "Outros",
  hex: "#64748B",
  icon: "MoreHorizontal",
  categories: [],
};

export interface GroupedCategories<T> {
  def: CategoryGroupDef;
  amount: number;
  percentage: number;
  categories: T[];
}

export function groupCategoryAmounts<T extends { name: string; amount: number }>(
  categories: T[],
): GroupedCategories<T>[] {
  const total = categories.reduce((s, c) => s + c.amount, 0);
  const byGroup = new Map<CategoryGroupDef, T[]>();

  for (const cat of categories) {
    const def =
      CATEGORY_GROUP_DEFS.find((g) =>
        g.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase()),
      ) ?? OTHER_GROUP_DEF;
    byGroup.set(def, [...(byGroup.get(def) ?? []), cat]);
  }

  return [...byGroup.entries()]
    .map(([def, cats]) => {
      const amount = cats.reduce((s, c) => s + c.amount, 0);
      return {
        def,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        categories: cats,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
