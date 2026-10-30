import type { IconCmp } from "~/lib/categoryIconSlugs";
import { registerCategoryHex } from "@/lib/categoryData";
import { CATEGORY_GROUP_DEFS, type CategoryGroupDef } from "@/lib/categoryGroups";

import ShoppingCart from "lucide-react-native/icons/shopping-cart";
import Coffee from "lucide-react-native/icons/coffee";
import Utensils from "lucide-react-native/icons/utensils";
import Bike from "lucide-react-native/icons/bike";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import Globe from "lucide-react-native/icons/globe";
import Smartphone from "lucide-react-native/icons/smartphone";
import PawPrint from "lucide-react-native/icons/paw-print";
import Shirt from "lucide-react-native/icons/shirt";
import Baby from "lucide-react-native/icons/baby";
import BookOpen from "lucide-react-native/icons/book-open";
import Volleyball from "lucide-react-native/icons/volleyball";
import Notebook from "lucide-react-native/icons/notebook";
import CircleDollarSign from "lucide-react-native/icons/circle-dollar-sign";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import Heart from "lucide-react-native/icons/heart";
import Dumbbell from "lucide-react-native/icons/dumbbell";
import Trophy from "lucide-react-native/icons/trophy";
import Sparkles from "lucide-react-native/icons/sparkles";
import Pill from "lucide-react-native/icons/pill";
import Glasses from "lucide-react-native/icons/glasses";
import Hospital from "lucide-react-native/icons/hospital";
import Car from "lucide-react-native/icons/car";
import CarTaxiFront from "lucide-react-native/icons/car-taxi-front";
import Bus from "lucide-react-native/icons/bus";
import CarFront from "lucide-react-native/icons/car-front";
import Wrench from "lucide-react-native/icons/wrench";
import Fuel from "lucide-react-native/icons/fuel";
import SquareParking from "lucide-react-native/icons/square-parking";
import Receipt from "lucide-react-native/icons/receipt";
import FileText from "lucide-react-native/icons/file-text";
import BadgeAlert from "lucide-react-native/icons/badge-alert";
import House from "lucide-react-native/icons/house";
import Building from "lucide-react-native/icons/building";
import Droplets from "lucide-react-native/icons/droplets";
import Zap from "lucide-react-native/icons/zap";
import Flame from "lucide-react-native/icons/flame";
import Sofa from "lucide-react-native/icons/sofa";
import Landmark from "lucide-react-native/icons/landmark";
import Wifi from "lucide-react-native/icons/wifi";
import Tv from "lucide-react-native/icons/tv";
import TreePalm from "lucide-react-native/icons/tree-palm";
import Plane from "lucide-react-native/icons/plane";
import PlaneTakeoff from "lucide-react-native/icons/plane-takeoff";
import Bed from "lucide-react-native/icons/bed";
import Star from "lucide-react-native/icons/star";
import Ticket from "lucide-react-native/icons/ticket";
import Clapperboard from "lucide-react-native/icons/clapperboard";
import TrendingUp from "lucide-react-native/icons/trending-up";
import Banknote from "lucide-react-native/icons/banknote";
import ArrowLeftRight from "lucide-react-native/icons/arrow-left-right";
import CreditCard from "lucide-react-native/icons/credit-card";
import Percent from "lucide-react-native/icons/percent";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import Scale from "lucide-react-native/icons/scale";
import Lock from "lucide-react-native/icons/lock";
import HandCoins from "lucide-react-native/icons/hand-coins";
import Dice5 from "lucide-react-native/icons/dice-5";
import HeartHandshake from "lucide-react-native/icons/heart-handshake";
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import PiggyBank from "lucide-react-native/icons/piggy-bank";
import Wallet from "lucide-react-native/icons/wallet";
import Briefcase from "lucide-react-native/icons/briefcase";
import Gift from "lucide-react-native/icons/gift";
import Coins from "lucide-react-native/icons/coins";
import School from "lucide-react-native/icons/school";
import Pencil from "lucide-react-native/icons/pencil";
import ChartLine from "lucide-react-native/icons/chart-line";
import Repeat from "lucide-react-native/icons/repeat";
import Shield from "lucide-react-native/icons/shield";

/**
 * The app's categories: a handful of groups, each with the things inside it.
 *
 * Laid out the way an Open Finance app lays out what banks report — Alimentação holds
 * Supermercado, Restaurantes, Delivery; Transporte holds Táxi, Postos de gasolina,
 * Estacionamentos — because that is the level at which a person recognises where a
 * charge belongs, and a group is the level at which a month has a shape. Each category
 * wears its group's colour, so a list of charges reads by subject at a glance.
 *
 * This is the phone's list. The web keeps its own for now; a transaction saved here
 * carries one of these names, and the web shows it under its own nearest group.
 */

export interface TaxonomyCategory {
  name: string;
  icon: IconCmp;
}

export interface TaxonomyGroup {
  name: string;
  hex: string;
  icon: IconCmp;
  type: "despesa" | "receita";
  categories: TaxonomyCategory[];
}

const c = (name: string, icon: IconCmp): TaxonomyCategory => ({ name, icon });

export const TAXONOMY: TaxonomyGroup[] = [
  {
    name: "Alimentação",
    hex: "#F97316",
    icon: ShoppingCart,
    type: "despesa",
    categories: [
      c("Supermercado", ShoppingCart),
      c("Alimentos e bebidas", Coffee),
      c("Restaurantes, bares e lanchonetes", Utensils),
      c("Delivery de alimentos", Bike),
    ],
  },
  {
    name: "Compras",
    hex: "#EC4899",
    icon: ShoppingBag,
    type: "despesa",
    categories: [
      c("Compras", ShoppingBag),
      c("Compras online", Globe),
      c("Eletrônicos", Smartphone),
      c("Pet Shops e veterinários", PawPrint),
      c("Vestuário", Shirt),
      c("Artigos infantis", Baby),
      c("Livraria", BookOpen),
      c("Artigos esportivos", Volleyball),
      c("Papelaria", Notebook),
      c("Cashback", CircleDollarSign),
    ],
  },
  {
    name: "Saúde e bem-estar",
    hex: "#10B981",
    icon: HeartPulse,
    type: "despesa",
    categories: [
      c("Saúde", HeartPulse),
      c("Saúde e bem-estar", Heart),
      c("Academia e centros de lazer", Dumbbell),
      c("Prática de esportes", Trophy),
      c("Bem-estar", Sparkles),
      c("Dentista", HeartPulse),
      c("Farmácia", Pill),
      c("Ótica", Glasses),
      c("Hospitais, clínicas e laboratórios", Hospital),
    ],
  },
  {
    name: "Transporte",
    hex: "#F59E0B",
    icon: Car,
    type: "despesa",
    categories: [
      c("Transporte", Car),
      c("Táxi e transporte privado urbano", CarTaxiFront),
      c("Transporte público", Bus),
      c("Aluguel de veículos", CarFront),
      c("Aluguel de bicicletas", Bike),
      c("Serviços automotivos", Wrench),
      c("Postos de gasolina", Fuel),
      c("Estacionamentos", SquareParking),
      c("Pedágios e pagamentos no veículo", Receipt),
      c("Taxas e impostos sobre veículos", FileText),
      c("Manutenção de veículos", Wrench),
      c("Multas de trânsito", BadgeAlert),
    ],
  },
  {
    name: "Moradia",
    hex: "#6366F1",
    icon: House,
    type: "despesa",
    categories: [
      c("Moradia", House),
      c("Aluguel", Building),
      c("Condomínio", Building),
      c("Serviços de utilidade pública", Wrench),
      c("Água", Droplets),
      c("Eletricidade", Zap),
      c("Gás", Flame),
      c("Utensílios para casa", Sofa),
      c("Impostos sobre moradia", Landmark),
      c("Telecomunicação", Wifi),
      c("Internet", Wifi),
      c("Celular", Smartphone),
      c("TV", Tv),
    ],
  },
  {
    name: "Lazer e entretenimento",
    hex: "#3B82F6",
    icon: TreePalm,
    type: "despesa",
    categories: [
      c("Lazer", TreePalm),
      c("Viagens", Plane),
      c("Aeroportos e cias. aéreas", PlaneTakeoff),
      c("Hospedagem", Bed),
      c("Assinaturas e streaming", Repeat),
      c("Programas de milhagem", Star),
      c("Passagem de ônibus", Bus),
      c("Bilhetes", Ticket),
      c("Estádios e arenas", Trophy),
      c("Museus e pontos turísticos", Landmark),
      c("Cinema, Teatro e Concertos", Clapperboard),
    ],
  },
  {
    name: "Educação",
    hex: "#14B8A6",
    icon: GraduationCap,
    type: "despesa",
    categories: [
      c("Educação", GraduationCap),
      c("Escola e faculdade", School),
      c("Cursos", Pencil),
      c("Material escolar", Notebook),
    ],
  },
  {
    name: "Finanças",
    hex: "#22C55E",
    icon: Banknote,
    type: "despesa",
    categories: [
      c("Investimentos", TrendingUp),
      c("Investimento automático", TrendingUp),
      c("Renda fixa", ChartLine),
      c("Fundos multimercado", ChartLine),
      c("Renda variável", ChartLine),
      c("Ajuste de margem", Percent),
      c("Juros de rendimentos de dividendos", Coins),
      c("Previdência privada", PiggyBank),
      c("Pensão", HandCoins),
      c("Transferência mesma titularidade", ArrowLeftRight),
      c("Transferência mesma titularidade - Dinheiro", ArrowLeftRight),
      c("Transferência mesma titularidade - PIX", ArrowLeftRight),
      c("Transferência mesma titularidade - TED", ArrowLeftRight),
      c("Transferências", ArrowLeftRight),
      c("Transferência - Boleto bancário", Receipt),
      c("Transferência - Dinheiro", Banknote),
      c("Transferência - Cheque", FileText),
      c("Transferências - DOC", ArrowLeftRight),
      c("Transferência - Câmbio", Globe),
      c("Transferência - Mesma instituição", ArrowLeftRight),
      c("Transferência - PIX", ArrowLeftRight),
      c("Transferência - TED", ArrowLeftRight),
      c("Transferências para terceiros", ArrowLeftRight),
      c("Transferência para terceiros - Boleto bancário", Receipt),
      c("Transferência para terceiros - Débito", ArrowLeftRight),
      c("Transferência para terceiros - DOC", ArrowLeftRight),
      c("Transferência para terceiros - PIX", ArrowLeftRight),
      c("Transferência para terceiros - TED", ArrowLeftRight),
      c("Pagamento de cartão de crédito", CreditCard),
      c("Parcelamento de fatura", CreditCard),
      c("Empréstimos e financiamento", Landmark),
      c("Atraso no pagamento e custos de cheque especial", BadgeAlert),
      c("Juros cobrados", Percent),
      c("Financiamento", Landmark),
      c("Financiamento imobiliário", House),
      c("Financiamento de veículos", Car),
      c("Empréstimo estudantil", GraduationCap),
      c("Empréstimos", Landmark),
      c("Obrigações legais", Scale),
      c("Impostos", Landmark),
      c("Seguros", Shield),
      c("Tarifas bancárias", Receipt),
      c("Saldo bloqueado", Lock),
      c("Pensão alimentícia", HandCoins),
    ],
  },
  {
    name: "Apostas e jogos",
    hex: "#EF4444",
    icon: Dice5,
    type: "despesa",
    categories: [c("Apostas", Dice5), c("Loteria", Ticket), c("Apostas online", Dice5)],
  },
  {
    name: "Doações",
    hex: "#D946EF",
    icon: HeartHandshake,
    type: "despesa",
    categories: [c("Doações", HeartHandshake)],
  },
  {
    name: "Outros",
    hex: "#71717A",
    icon: CircleQuestionMark,
    type: "despesa",
    categories: [c("Outros", CircleQuestionMark), c("Serviços", Wrench), c("Estorno", RotateCcw)],
  },
  {
    name: "Receitas",
    hex: "#C8F36D",
    icon: Wallet,
    type: "receita",
    categories: [
      c("Salário", Wallet),
      c("Freelance", Briefcase),
      c("Vendas", ShoppingBag),
      c("Aluguéis", Building),
      c("Bônus", Gift),
      c("Comissão", HandCoins),
      c("Mesada", Coins),
      c("Rendimentos", TrendingUp),
      c("Investimentos", TrendingUp),
      c("Reembolso", RotateCcw),
      c("Cashback", CircleDollarSign),
      c("Transferências recebidas", ArrowLeftRight),
      c("Outras receitas", CircleQuestionMark),
    ],
  },
];

const norm = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/** Where a category name sits in the list, for either kind, or undefined for one that is not there. */
export function findCategory(name: string, type?: "despesa" | "receita") {
  const n = norm(name);
  for (const g of TAXONOMY) {
    if (type && g.type !== type) continue;
    const cat = g.categories.find((x) => norm(x.name) === n);
    if (cat) return { group: g, category: cat };
  }
  return undefined;
}

/** Every category name of one kind, for the AI to choose from. */
export const categoryNames = (type: "despesa" | "receita") =>
  TAXONOMY.filter((g) => g.type === type).flatMap((g) => g.categories.map((x) => x.name));

/** Each name with its group's colour, for the colour lookups the screens already share. */
export const TAXONOMY_HEX: Record<string, string> = Object.fromEntries(
  TAXONOMY.flatMap((g) => g.categories.map((x) => [x.name, g.hex])),
);

/* Every screen that colours a category by name now knows these. */
registerCategoryHex(TAXONOMY_HEX);

/* The old shared groups, read as the new ones they became, so a charge saved with an
   old name still lands in the right group. */
const LEGACY_GROUP: Record<string, string> = {
  "Alimentação": "Alimentação",
  Moradia: "Moradia",
  Transporte: "Transporte",
  "Saúde e bem-estar": "Saúde e bem-estar",
  Lazer: "Lazer e entretenimento",
  Compras: "Compras",
  Educação: "Educação",
  Finanças: "Finanças",
};

/** The spending groups in the shape the shared grouping takes, old names included. */
export const APP_GROUP_DEFS: CategoryGroupDef[] = TAXONOMY.filter((g) => g.type === "despesa").map((g) => ({
  name: g.name,
  hex: g.hex,
  icon: `tax:${g.name}`,
  categories: [
    ...g.categories.map((x) => x.name),
    ...CATEGORY_GROUP_DEFS.filter((old) => LEGACY_GROUP[old.name] === g.name).flatMap((old) => old.categories),
    ...(g.name === "Lazer e entretenimento" ? ["Viagem", "Assinaturas", "Streaming", "Presentes"] : []),
    ...(g.name === "Saúde e bem-estar" ? ["Beleza", "Academia", "Pets"] : []),
  ],
}));

/** The group a category is in — new name or old. */
export const appGroupOf = (category: string) =>
  APP_GROUP_DEFS.find((g) => g.categories.some((x) => norm(x) === norm(category)));
