/**
 * Which glyph belongs to which category — by name, not by component.
 *
 * The choice itself (groceries get a trolley, salary gets a dollar sign) is the
 * app's, and it should be made once. The component that draws it is not: the browser
 * imports from lucide-react and the phone from lucide-react-native, and the two are
 * different packages holding the same drawings. So the decision lives here as names,
 * and each app looks the name up in its own set.
 *
 * Anything not listed falls back to a plain document.
 */
export const CATEGORY_ICON_NAMES: Record<string, string> = {
  "Alimentação": "Utensils",
  "Transporte": "Car",
  "Saúde": "Heart",
  "Assinaturas": "Repeat",
  "Lazer": "Gamepad2",
  "Moradia": "Home",
  "Educação": "GraduationCap",
  "Vestuário": "Shirt",
  "Pets": "PawPrint",
  "Beleza": "Scissors",
  "Presentes": "Gift",
  "Viagem": "Plane",
  "Tecnologia": "Smartphone",
  "Impostos": "Receipt",
  "Supermercado": "ShoppingCart",
  "Conta de Luz": "Zap",
  "Conta de Água": "Droplets",
  "Conta de Gás": "Flame",
  "Bebidas": "CupSoda",
  "Delivery": "Bike",
  "Cafeteria": "Coffee",
  "Academia": "Dumbbell",
  "Energia": "Plug",
  "Fast Food": "Pizza",
  "Pix no crédito": "Banknote",
  "Tarifas e juros": "Percent",
  "Compras online": "Package",
  "Telefone e Internet": "Wifi",
  "Serviços": "Wrench",
  "Outros": "CircleEllipsis",
  "Salário": "DollarSign",
  "Freelance": "Briefcase",
  "Investimentos": "TrendingUp",
  "Vendas": "ShoppingBag",
  "Aluguéis": "Building2",
  "Bônus": "Award",
  "Comissão": "Users",
  "Mesada": "Wallet",
  "Saldo inicial": "Landmark",
};

/** What a category falls back to when it is not in the list. */
export const FALLBACK_ICON_NAME = "FileText";

/** The glyph a category should wear, by name. */
export function iconNameFor(category: string): string {
  if (CATEGORY_ICON_NAMES[category]) return CATEGORY_ICON_NAMES[category];
  const normalized = category.trim().toLowerCase();
  const match = Object.keys(CATEGORY_ICON_NAMES).find((k) => k.toLowerCase() === normalized);
  return match ? CATEGORY_ICON_NAMES[match] : FALLBACK_ICON_NAME;
}
