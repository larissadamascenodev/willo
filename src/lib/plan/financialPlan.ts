/**
 * Meu Plano Financeiro — the arithmetic.
 *
 * Alura's part of Willo, done in code: what the last months say about the person's
 * money, each budgeting method laid over those real numbers, and which method fits. The
 * AI may explain a plan in words; the figures always come from here. Pure functions, so
 * both apps and the assistant get the same answer and it can be tested.
 */

export type MethodId = "50-30-20" | "base-zero" | "pague-se-primeiro" | "envelopes" | "reorganizacao" | "renda-variavel";

export interface PlanMonth {
  /** yyyy-mm */
  month: string;
  income: number;
  /** What left, by category. */
  spending: Record<string, number>;
  /** Of that, what was fixed (recurring) and what was instalments. */
  fixed: number;
  installments: number;
}

export interface PlanInputs {
  months: PlanMonth[];
  /** What is already put aside: reserves and goals. */
  saved: number;
}

export type Bucket = "necessidades" | "desejos" | "guardar" | "dividas";

/** Categories that keep a life running; anything else is a choice. */
const ESSENTIAL = [
  "moradia", "aluguel", "condominio", "casa", "contas", "energia", "luz", "agua", "gas", "internet", "telefon", "celular",
  "supermercado", "mercado", "alimentacao", "feira", "hortifruti", "padaria",
  "saude", "farmacia", "plano de saude", "medic", "dentista", "terapia",
  "transporte", "combustivel", "onibus", "metro", "estacionamento", "pedagio", "manutencao",
  "educacao", "escola", "faculdade", "curso", "material escolar",
  "seguro", "imposto", "iptu", "ipva", "pets", "creche",
];
const SAVING = ["investimento", "reserva", "poupanca", "aplicacao", "previdencia", "caixinha"];
const DEBT = ["emprestimo", "financiamento", "juros", "rotativo", "parcelamento", "pix no credito", "tarifa"];

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function bucketOf(category: string): Bucket {
  const c = plain(category);
  if (SAVING.some((w) => c.includes(w))) return "guardar";
  if (DEBT.some((w) => c.includes(w))) return "dividas";
  if (ESSENTIAL.some((w) => c.includes(w))) return "necessidades";
  return "desejos";
}

const round = (v: number) => Math.round(v * 100) / 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export interface Profile {
  months: number;
  incomeAvg: number;
  incomeMin: number;
  /** How much income swings month to month, 0..1. */
  incomeSwing: number;
  spendingAvg: number;
  byBucket: Record<Bucket, number>;
  fixedAvg: number;
  installmentsAvg: number;
  leftoverAvg: number;
  /** Share of income already spoken for, 0..1+. */
  committed: number;
  saved: number;
  /** Months of essentials the savings would cover. */
  reserveMonths: number;
  topCategories: { category: string; amount: number; bucket: Bucket }[];
}

export function buildProfile(input: PlanInputs): Profile | null {
  const months = input.months.filter((m) => m.income > 0 || Object.keys(m.spending).length > 0);
  if (months.length === 0) return null;
  const incomes = months.map((m) => m.income);
  const incomeAvg = avg(incomes);
  const byBucket: Record<Bucket, number> = { necessidades: 0, desejos: 0, guardar: 0, dividas: 0 };
  const byCategory = new Map<string, number>();
  for (const m of months)
    for (const [cat, v] of Object.entries(m.spending)) {
      byBucket[bucketOf(cat)] += v / months.length;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + v / months.length);
    }
  const spendingAvg = Object.values(byBucket).reduce((s, v) => s + v, 0);
  const swing = incomeAvg > 0 ? (Math.max(...incomes) - Math.min(...incomes)) / incomeAvg : 0;
  return {
    months: months.length,
    incomeAvg: round(incomeAvg),
    incomeMin: round(Math.min(...incomes)),
    incomeSwing: round(swing),
    spendingAvg: round(spendingAvg),
    byBucket: Object.fromEntries(Object.entries(byBucket).map(([k, v]) => [k, round(v)])) as Record<Bucket, number>,
    fixedAvg: round(avg(months.map((m) => m.fixed))),
    installmentsAvg: round(avg(months.map((m) => m.installments))),
    leftoverAvg: round(incomeAvg - spendingAvg),
    committed: incomeAvg > 0 ? round(spendingAvg / incomeAvg) : 0,
    saved: round(input.saved),
    reserveMonths: byBucket.necessidades > 0 ? round(input.saved / byBucket.necessidades) : 0,
    topCategories: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount: round(amount), bucket: bucketOf(category) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
  };
}

export interface Allocation {
  label: string;
  bucket: Bucket | "livre";
  /** Share of the base income, 0..1. */
  share: number;
  amount: number;
  /** What the person actually does today, for comparison. */
  today: number;
}

export interface MethodPlan {
  id: MethodId;
  label: string;
  how: string;
  pros: string[];
  cons: string[];
  forWho: string;
  /** 0..100: how well it fits this person now. */
  fit: number;
  why: string;
  /** The income the plan is built on (the lowest month, for variable income). */
  base: number;
  allocations: Allocation[];
}

function alloc(base: number, rows: [string, Bucket | "livre", number, number][]): Allocation[] {
  return rows.map(([label, bucket, share, today]) => ({ label, bucket, share, amount: round(base * share), today: round(today) }));
}

export function planMethods(p: Profile): MethodPlan[] {
  const I = p.incomeAvg;
  const b = p.byBucket;
  const variable = p.incomeSwing > 0.25;
  const heavy = p.committed > 0.85 || b.dividas + p.installmentsAvg > I * 0.3;
  const noReserve = p.reserveMonths < 1;

  const methods: MethodPlan[] = [
    {
      id: "50-30-20",
      label: "50/30/20",
      how: "Metade da renda para o essencial, 30% para o que você escolhe gastar e 20% para guardar ou quitar dívidas.",
      pros: ["Simples de seguir", "Equilibra presente e futuro", "Não exige controlar cada categoria"],
      cons: ["Pode não caber se o essencial passa de 50%", "Pouco detalhado para quem quer controle fino"],
      forWho: "Quem tem renda estável e quer uma regra fácil.",
      fit: 70 - (b.necessidades > I * 0.6 ? 25 : 0) - (heavy ? 20 : 0) - (variable ? 15 : 0),
      why:
        b.necessidades > I * 0.6
          ? `Hoje o essencial leva ${Math.round((b.necessidades / I) * 100)}% da sua renda, acima dos 50% do método.`
          : "Seus gastos essenciais cabem nos 50%, então a regra é viável.",
      base: I,
      allocations: alloc(I, [
        ["Necessidades", "necessidades", 0.5, b.necessidades],
        ["Desejos", "desejos", 0.3, b.desejos],
        ["Guardar e quitar dívidas", "guardar", 0.2, b.guardar + b.dividas],
      ]),
    },
    {
      id: "pague-se-primeiro",
      label: "Pague-se primeiro",
      how: "Assim que o dinheiro entra, uma parte vai direto para a reserva. O resto é para viver o mês.",
      pros: ["Garante que você guarda todo mês", "Funciona sem planilha"],
      cons: ["Exige disciplina para não resgatar", "Não organiza os gastos em si"],
      forWho: "Quem ainda não tem reserva de emergência.",
      fit: 55 + (noReserve ? 25 : 0) - (p.leftoverAvg < I * 0.05 ? 25 : 0),
      why: noReserve
        ? `Sua reserva cobre ${p.reserveMonths.toLocaleString("pt-BR")} mês de essenciais; o ideal são pelo menos 3.`
        : "Você já tem alguma reserva; o método ajuda a manter o ritmo.",
      base: I,
      allocations: alloc(I, [
        ["Guardar primeiro", "guardar", 0.15, b.guardar],
        ["Para viver o mês", "livre", 0.85, p.spendingAvg - b.guardar],
      ]),
    },
    {
      id: "base-zero",
      label: "Orçamento base zero",
      how: "Cada real da renda recebe uma função antes do mês começar, até sobrar zero sem destino.",
      pros: ["Controle total", "Nada some sem você saber"],
      cons: ["Dá trabalho todo mês", "Exige revisar com frequência"],
      forWho: "Quem quer controle detalhado ou precisa apertar o orçamento.",
      fit: 50 + (heavy ? 15 : 0) + (p.committed > 0.95 ? 10 : 0),
      why: p.committed > 0.95 ? "Quase toda a renda já está comprometida; dar destino a cada real evita surpresas." : "Bom se você quiser saber exatamente para onde vai cada real.",
      base: I,
      allocations: alloc(I, [
        ["Essencial", "necessidades", I > 0 ? Math.min(b.necessidades / I, 0.7) : 0.5, b.necessidades],
        ["Dívidas e parcelas", "dividas", I > 0 ? Math.min((b.dividas + p.installmentsAvg) / I, 0.3) : 0, b.dividas + p.installmentsAvg],
        ["Reserva", "guardar", 0.1, b.guardar],
        ["Escolhas do mês", "desejos", 0, b.desejos],
      ]).map((a, i, all) => (i === all.length - 1 ? { ...a, share: Math.max(0, 1 - all.slice(0, -1).reduce((s, x) => s + x.share, 0)), amount: round(Math.max(0, I - all.slice(0, -1).reduce((s, x) => s + x.amount, 0))) } : a)),
    },
    {
      id: "envelopes",
      label: "Envelopes",
      how: "Cada categoria de gasto variável ganha um valor fixo no mês. Acabou o envelope, acabou o gasto ali.",
      pros: ["Visual e concreto", "Ótimo para conter gastos variáveis"],
      cons: ["Exige acompanhar cada categoria", "Menos flexível"],
      forWho: "Quem perde o controle em categorias como delivery, compras ou lazer.",
      fit: 50 + (b.desejos > I * 0.35 ? 20 : 0),
      why: b.desejos > I * 0.35 ? `Os gastos de escolha estão em ${Math.round((b.desejos / I) * 100)}% da renda; limites por categoria ajudam.` : "Útil para segurar categorias específicas.",
      base: I,
      allocations: p.topCategories
        .filter((c) => c.bucket === "desejos")
        .slice(0, 5)
        .map((c) => ({ label: c.category, bucket: "desejos" as const, share: I > 0 ? round((c.amount * 0.85) / I) : 0, amount: round(c.amount * 0.85), today: c.amount })),
    },
    {
      id: "reorganizacao",
      label: "Reorganização com foco em dívidas",
      how: "Primeiro estabiliza o essencial, depois direciona tudo o que sobra para quitar dívidas e parcelas, da mais cara para a mais barata.",
      pros: ["Reduz juros", "Libera renda mais rápido"],
      cons: ["Exige cortar escolhas por um tempo"],
      forWho: "Quem tem muita renda comprometida com parcelas ou dívidas.",
      fit: heavy ? 90 : 30,
      why: heavy
        ? `Parcelas e dívidas levam ${Math.round(((b.dividas + p.installmentsAvg) / Math.max(I, 1)) * 100)}% da renda; liberar isso é a prioridade.`
        : "Suas parcelas não pesam a ponto de exigir esse método.",
      base: I,
      allocations: alloc(I, [
        ["Essencial", "necessidades", I > 0 ? Math.min(b.necessidades / I, 0.6) : 0.5, b.necessidades],
        ["Parcelas e dívidas", "dividas", I > 0 ? Math.min((b.dividas + p.installmentsAvg) / I, 0.35) : 0.3, b.dividas + p.installmentsAvg],
        ["Escolhas, reduzidas", "desejos", 0.1, b.desejos],
      ]),
    },
    {
      id: "renda-variavel",
      label: "Renda variável",
      how: "O plano é feito sobre o seu pior mês recente. O que entrar acima disso vai primeiro para a reserva.",
      pros: ["Não quebra nos meses fracos", "Transforma meses bons em segurança"],
      cons: ["Parece apertado nos meses bons"],
      forWho: "Quem tem renda que muda muito de um mês para o outro.",
      fit: variable ? 85 : 25,
      why: variable
        ? `Sua renda variou ${Math.round(p.incomeSwing * 100)}% entre os meses; planejar sobre o mês mais fraco (${p.incomeMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) evita aperto.`
        : "Sua renda é estável, então esse cuidado não é necessário.",
      base: p.incomeMin,
      allocations: alloc(p.incomeMin, [
        ["Essencial", "necessidades", 0.55, b.necessidades],
        ["Escolhas", "desejos", 0.3, b.desejos],
        ["Reserva", "guardar", 0.15, b.guardar],
      ]),
    },
  ];

  return methods.map((m) => ({ ...m, fit: Math.max(0, Math.min(100, m.fit)) })).sort((a, b) => b.fit - a.fit);
}

/** Planned against actual, for a plan the person has chosen. */
export function planVsActual(plan: MethodPlan, month: PlanMonth) {
  const actual: Record<string, number> = { necessidades: 0, desejos: 0, guardar: 0, dividas: 0 };
  for (const [cat, v] of Object.entries(month.spending)) actual[bucketOf(cat)] += v;
  return plan.allocations.map((a) => {
    const spent = a.bucket === "livre" ? actual.necessidades + actual.desejos + actual.dividas : actual[a.bucket] ?? 0;
    return { label: a.label, planned: a.amount, spent: round(spent), left: round(a.amount - spent), over: spent > a.amount + 0.004 };
  });
}
