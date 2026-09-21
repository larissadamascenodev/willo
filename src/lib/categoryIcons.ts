import {
  Utensils, Car, Heart, Repeat, Gamepad2, Home, GraduationCap, Shirt,
  PawPrint, Scissors, Gift, Plane, Smartphone, Receipt,
  Briefcase, TrendingUp, ShoppingBag, DollarSign, Award, Users, Wallet,
  FileText, Landmark, ShoppingCart, Zap, Droplets, Flame,
  CupSoda, Bike, Coffee, Dumbbell, Plug, Pizza, Building2,
  Banknote, Percent, Wifi, Wrench, Package, CircleEllipsis,
} from "lucide-react";

export const DEFAULT_CATEGORY_ICONS: Record<string, any> = {
  "Alimentação": Utensils,
  "Transporte": Car,
  "Saúde": Heart,
  "Assinaturas": Repeat,
  "Lazer": Gamepad2,
  "Moradia": Home,
  "Educação": GraduationCap,
  "Vestuário": Shirt,
  "Pets": PawPrint,
  "Beleza": Scissors,
  "Presentes": Gift,
  "Viagem": Plane,
  "Tecnologia": Smartphone,
  "Impostos": Receipt,
  "Supermercado": ShoppingCart,
  "Conta de Luz": Zap,
  "Conta de Água": Droplets,
  "Conta de Gás": Flame,
  "Bebidas": CupSoda,
  "Delivery": Bike,
  "Cafeteria": Coffee,
  "Academia": Dumbbell,
  "Energia": Plug,
  "Fast Food": Pizza,
  "Pix no crédito": Banknote,
  "Tarifas e juros": Percent,
  "Compras online": Package,
  "Telefone e Internet": Wifi,
  "Serviços": Wrench,
  "Outros": CircleEllipsis,
  "Salário": DollarSign,
  "Freelance": Briefcase,
  "Investimentos": TrendingUp,
  "Vendas": ShoppingBag,
  "Aluguéis": Building2,
  "Bônus": Award,
  "Comissão": Users,
  "Mesada": Wallet,
  "Saldo inicial": Landmark,
};

// HSL colors (without hsl() wrapper) — unique per category for chart differentiation
export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  // Despesas
  "Alimentação":   "25 90% 55%",
  "Transporte":    "210 70% 55%",
  "Saúde":         "350 70% 55%",
  "Assinaturas":   "270 60% 58%",
  "Lazer":         "45 85% 55%",
  "Moradia":       "160 55% 45%",
  "Educação":      "190 75% 50%",
  "Vestuário":     "300 55% 55%",
  "Pets":          "30 75% 50%",
  "Beleza":        "330 65% 60%",
  "Presentes":     "340 70% 55%",
  "Viagem":        "200 80% 55%",
  "Tecnologia":    "230 65% 58%",
  "Impostos":      "0 60% 48%",
  "Supermercado":  "150 70% 45%",
  "Conta de Luz":  "55 80% 50%",
  "Conta de Água": "195 80% 50%",
  "Conta de Gás":  "15 80% 50%",
  "Bebidas":       "320 55% 55%",
  "Delivery":      "170 60% 45%",
  "Cafeteria":     "28 65% 45%",
  "Academia":      "260 55% 55%",
  "Fast Food":     "10 75% 52%",
  "Pix no crédito":      "168 100% 42%",
  "Tarifas e juros":     "0 74% 42%",
  "Compras online":      "292 91% 73%",
  "Telefone e Internet": "199 95% 74%",
  "Serviços":            "215 20% 65%",
  "Outros":              "215 16% 47%",
  // Receitas
  "Salário":       "150 100% 45%",
  "Freelance":     "175 65% 45%",
  "Investimentos": "140 70% 50%",
  "Vendas":        "120 55% 48%",
  "Aluguéis":      "40 75% 50%",
  "Bônus":         "60 70% 50%",
  "Comissão":      "180 60% 48%",
  "Mesada":        "100 55% 50%",
};

// Hex colors — authoritative source for components that need hex values
export const DEFAULT_CATEGORY_HEX: Record<string, string> = {
  // Despesas
  "Alimentação":   "#f38400",
  "Transporte":    "#3b82f6",
  "Saúde":         "#ef4444",
  "Assinaturas":   "#8b5cf6",
  "Lazer":         "#ec4899",
  "Moradia":       "#c2b280",
  "Educação":      "#14b8a6",
  "Vestuário":     "#f99379",
  "Pets":          "#8db600",
  "Beleza":        "#f0abfc",
  "Presentes":     "#b3446c",
  "Viagem":        "#22d3ee",
  "Tecnologia":    "#a1caf1",
  "Impostos":      "#848482",
  "Supermercado":  "#22c55e",
  "Conta de Luz":  "#f3c300",
  "Conta de Água": "#0067a5",
  "Conta de Gás":  "#e25822",
  "Bebidas":       "#875692",
  "Delivery":      "#dcd300",
  "Cafeteria":     "#882d17",
  "Academia":      "#6366f1",
  "Fast Food":     "#f6a600",
  "Pix no crédito":      "#00d4aa",
  "Tarifas e juros":     "#b91c1c",
  "Compras online":      "#e879f9",
  "Telefone e Internet": "#7dd3fc",
  "Serviços":            "#94a3b8",
  "Outros":              "#64748b",
  // Receitas
  "Salário":       "#00e676",
  "Freelance":     "#38bdf8",
  "Investimentos": "#a78bfa",
  "Vendas":        "#fb923c",
  "Aluguéis":      "#fbbf24",
  "Bônus":         "#f472b6",
  "Comissão":      "#2dd4bf",
  "Mesada":        "#e5e7eb",
};

// Type mapping — authoritative source
export const DEFAULT_CATEGORY_TYPE: Record<string, "despesa" | "receita"> = {
  "Alimentação": "despesa", "Transporte": "despesa", "Saúde": "despesa",
  "Assinaturas": "despesa", "Lazer": "despesa", "Moradia": "despesa",
  "Educação": "despesa", "Vestuário": "despesa", "Pets": "despesa",
  "Beleza": "despesa", "Presentes": "despesa", "Viagem": "despesa",
  "Tecnologia": "despesa", "Impostos": "despesa", "Supermercado": "despesa",
  "Conta de Luz": "despesa", "Conta de Água": "despesa", "Conta de Gás": "despesa",
  "Bebidas": "despesa", "Delivery": "despesa", "Cafeteria": "despesa",
  "Academia": "despesa", "Fast Food": "despesa",
  "Pix no crédito": "despesa", "Tarifas e juros": "despesa",
  "Compras online": "despesa", "Telefone e Internet": "despesa",
  "Serviços": "despesa", "Outros": "despesa",
  "Salário": "receita", "Freelance": "receita", "Investimentos": "receita",
  "Vendas": "receita", "Aluguéis": "receita", "Bônus": "receita",
  "Comissão": "receita", "Mesada": "receita",
};

export const DEFAULT_EXPENSE_CATEGORIES = Object.keys(DEFAULT_CATEGORY_TYPE).filter(
  (name) => DEFAULT_CATEGORY_TYPE[name] === "despesa"
);

export const DEFAULT_INCOME_CATEGORIES = Object.keys(DEFAULT_CATEGORY_TYPE).filter(
  (name) => DEFAULT_CATEGORY_TYPE[name] === "receita"
);

export function getDefaultCategoryColor(name: string): string {
  if (DEFAULT_CATEGORY_COLORS[name]) return DEFAULT_CATEGORY_COLORS[name];
  const normalized = name.toLowerCase();
  const match = Object.keys(DEFAULT_CATEGORY_COLORS).find(k => k.toLowerCase() === normalized);
  return match ? DEFAULT_CATEGORY_COLORS[match] : "220 10% 55%";
}

export function getDefaultCategoryHex(name: string): string {
  if (DEFAULT_CATEGORY_HEX[name]) return DEFAULT_CATEGORY_HEX[name];
  const normalized = name.toLowerCase();
  const match = Object.keys(DEFAULT_CATEGORY_HEX).find(k => k.toLowerCase() === normalized);
  return match ? DEFAULT_CATEGORY_HEX[match] : "#64748b";
}

export function getDefaultCategoryIcon(name: string) {
  if (DEFAULT_CATEGORY_ICONS[name]) return DEFAULT_CATEGORY_ICONS[name];
  // Case-insensitive fallback
  const normalized = name.toLowerCase();
  const match = Object.keys(DEFAULT_CATEGORY_ICONS).find(k => k.toLowerCase() === normalized);
  return match ? DEFAULT_CATEGORY_ICONS[match] : FileText;
}
