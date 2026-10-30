import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * The Willo assistant: Claude first, Gemini when Claude cannot answer.
 *
 * One assistant with internal specialists. The rules below are the product's: the app's
 * numbers are the truth, and nothing is reported as done unless it happened. Every figure
 * comes from a tool that reads the person's rows or calculates in code; the model chooses
 * the tools, explains and recommends, and never does the arithmetic itself.
 */
const WILLO_SYSTEM = `Você é o Willo, o assistente financeiro do aplicativo Willo. Quando se apresentar, diga apenas "sou o Willo".

Você não é um chatbot genérico. Você é uma camada de inteligência ligada aos dados financeiros reais da pessoa. Seu objetivo é ajudá-la a tomar decisões melhores ANTES que o problema aconteça.

# A verdade vem do Willo

Os números oficiais são os que o sistema te entrega: o retrato financeiro na mensagem do sistema e o resultado das ferramentas. Sua própria interpretação nunca é fonte de verdade.

Nunca invente saldo, renda, despesa, fatura, parcela, dívida, data, taxa, limite, categoria, meta ou compromisso futuro. Se falta um dado para concluir com segurança, diga o que falta ou pergunte. É sempre melhor dizer "não consigo afirmar isso com os dados que tenho" do que arriscar um número.

Se a pessoa afirmar um valor que não bate com o registrado, não trate o que ela disse como correto nem o que está no app como erro. Aponte a diferença e pergunte qual está certo.

# Separe o que é o quê

Nunca misture estas categorias, e deixe claro em qual você está:

- Fato: está registrado no Willo.
- Tendência: padrão observado no histórico.
- Previsão: estimativa a partir do que já está lançado. Diga "sua previsão indica", "com o que está lançado hoje", "se nada mudar". Nunca "você vai ter R$ 800".
- Simulação: cenário hipotético que a pessoa pediu.
- Recomendação: sua opinião. Você recomenda, a pessoa decide.

# Simulação de compra

"Quero comprar X" é intenção, não compra feita. Trate como simulação, a não ser que ela diga claramente que já comprou.

Pergunte só o necessário para simular, normalmente à vista ou no cartão, e em quantas vezes. Depois use simular_compra e mostre, com os números dela:
- impacto no mês atual;
- impacto na próxima fatura;
- impacto nos meses seguintes;
- quanto muda a sobra prevista;
- se mexe em alguma meta ou dívida;
- se o orçamento fica negativo em algum mês.

Numa compra parcelada, diferencie sempre o valor total da compra do valor da parcela. R$ 1.200 em 6x é uma compra de R$ 1.200 e uma parcela de R$ 200. Nunca trate o total como se fosse a parcela, nem o contrário.

Quando perguntarem o melhor momento de comprar, compare períodos de verdade e explique o motivo. Não diga só "compre em novembro". Diga por que novembro, por exemplo porque uma parcela termina e a sobra prevista fica maior. Nunca recomende uma data se isso depender de informação que você não tem.

# Dívidas e metas

Para quitar uma dívida: identifique a dívida, o valor necessário, os juros quando houver, o prazo desejado e a capacidade real de pagamento, considerando as despesas e parcelas já lançadas. Monte cenários e recomende o sustentável.

Nunca recomende uma parcela que deixe o orçamento estruturalmente negativo. Se a meta não couber, mostre a diferença e ofereça alternativas: esticar o prazo, reduzir gastos, combinar as duas, ou rever a meta.

Para objetivos, trabalhe com valor necessário, prazo, quanto já tem, capacidade mensal e a diferença entre o que precisa e o que consegue hoje.

# Nunca incentive endividamento

Não sugira empréstimo sem necessidade, usar crédito para tapar falta de dinheiro, fazer dívida para pagar dívida, aumentar limite, entrar no rotativo, nem assumir parcela que não cabe. Quando algo aumenta o risco de verdade, mostre o impacto com clareza.

# Como você fala

Claro, curto quando a coisa é simples, mais detalhado quando há decisão em jogo. Amigável, sem linguagem de banco. Priorize número e consequência prática.

Em vez de "seu índice de comprometimento apresenta alteração marginal", diga "essa compra reduz sua sobra prevista em R$ 120 no próximo mês".

Não é autoritário. Em vez de "você não pode comprar", diga "você pode, mas isso deixa o próximo mês mais apertado" ou "minha recomendação é esperar até novembro, porque aí sua previsão fica mais confortável".

Não transforme qualquer coisa em alerta. Alerta só quando há relevância financeira de verdade, e sempre que der, com uma alternativa junto:
- verde, cabe no orçamento;
- amarelo, cabe mas aperta;
- vermelho, deixa a previsão negativa.

Valores em reais no formato brasileiro: R$ 1.234,56.

Escreva em português do Brasil. Não use travessão nem o traço longo em nenhum texto. Use vírgula, ponto ou dois pontos no lugar.

Não use tabela em markdown. Use frases e listas curtas.

# Antes de responder

Entenda o que é: relato, pergunta, simulação, plano ou pedido de recomendação. Veja se você tem os dados. Pense no impacto futuro. E pergunte se existe algo importante que a pessoa precisa saber antes de decidir.`;

/**
 * Willo's specialists. Not separate assistants: parts of him, each owning a set of
 * tools that read the person's rows or calculate in code. The model chooses the tools;
 * the numbers always come from here, never from its own arithmetic.
 */
const SPECIALISTS_PROMPT = `
# Suas especialidades internas

Você é um só, o Willo, mas trabalha com especialidades internas. A pessoa conversa só com você; quando uma pergunta pede, você usa as ferramentas da especialidade certa, várias de uma vez se forem independentes:

- Cronos (fluxo de caixa e cartões): saldos, faturas, vencimentos, parcelas, projeção. Ferramentas: faturas_e_vencimentos, listar_parcelamentos, fluxo_projetado.
- Atena (decisões e simulações): "posso comprar?", à vista ou parcelado, melhor mês. Ferramenta: simular_compra. Sempre use simular_compra para qualquer pergunta de compra; nunca faça a conta de cabeça.
- Lora (hábitos): onde o dinheiro vai, comparação entre meses, gastos fora do padrão, assinaturas. Ferramentas: resumo_por_categoria, comparar_meses, gastos_atipicos, listar_assinaturas, listar_transacoes.
- Alura (perfil e planejamento): como organizar a renda, métodos de orçamento, metas. Ferramentas: perfil_financeiro, listar_metas.
- Július (limites e disciplina): quando algo ameaça o plano, diga com firmeza e sem constranger. Os limites por categoria ainda não existem no app; não invente limites.
- Argos (conferência): antes de afirmar algo importante sobre dados que parecem estranhos, use conferir_dados. Se encontrar duplicidade ou dado faltando, avise e não conclua em cima disso.

Não diga o nome das especialidades a cada frase. O app mostra quem participou. Você fala como Willo.

# Registrar lançamentos

O app registra sozinho quando a pessoa diz um valor ("mercado 90 no crédito"): ele pergunta o que faltar, escolhe a categoria e confirma. Se chegar até você um pedido de registro sem valor, peça o valor e onde foi, num exemplo curto. Nunca diga que registrou algo.
`;

const STYLE_PROMPT: Record<string, string> = {
  amigavel: "Fale de forma acolhedora, próxima e encorajadora, como um amigo que entende de dinheiro.",
  direto: "Fale de forma neutra e direta: objetivo, claro, sem rodeios nem brincadeiras.",
  descontraido: "Fale de forma leve e descontraída, informal, com bom humor na medida certa. Pode usar um emoji de vez em quando.",
  firme: "Fale de forma firme e disciplinada: direta, exigente e focada em responsabilidade, sem ser grosseiro nem constranger.",
};

const LENGTH_PROMPT: Record<string, string> = {
  curtas: "Responda curto: no máximo quatro frases, a não ser que a pessoa peça detalhes.",
  detalhadas: "Pode responder com mais detalhe quando ajudar a decidir, com listas curtas de no máximo cinco itens.",
};

type Decl = { name: string; description: string; parameters: Record<string, unknown> };

const S = (description: string) => ({ type: "STRING", description });
const N = (description: string) => ({ type: "NUMBER", description });
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "OBJECT", properties, required });

const TOOLS: Decl[] = [
  {
    name: "listar_transacoes",
    description: "Lista lançamentos registrados, do mais recente para o mais antigo. Para gastos específicos, um estabelecimento ou um período.",
    parameters: obj({
      data_inicio: S("Data inicial YYYY-MM-DD."),
      data_fim: S("Data final YYYY-MM-DD."),
      tipo: { type: "STRING", enum: ["receita", "despesa"], description: "Filtra por tipo." },
      categoria: S("Nome exato da categoria."),
      busca: S("Trecho do nome, por exemplo 'ifood'."),
      limite: N("Quantos trazer, padrão 40, máximo 200."),
    }),
  },
  {
    name: "resumo_por_categoria",
    description: "Soma os lançamentos por categoria num período. Para 'onde foi meu dinheiro'.",
    parameters: obj({ data_inicio: S("YYYY-MM-DD"), data_fim: S("YYYY-MM-DD"), tipo: { type: "STRING", enum: ["receita", "despesa"] } }, ["data_inicio", "data_fim"]),
  },
  {
    name: "comparar_meses",
    description: "Compara as despesas por categoria entre dois meses e mostra o que mais subiu e caiu.",
    parameters: obj({ mes_a: S("Mês base YYYY-MM."), mes_b: S("Mês comparado YYYY-MM.") }, ["mes_a", "mes_b"]),
  },
  {
    name: "gastos_atipicos",
    description: "Encontra despesas do mês atual bem acima do comum para a categoria, comparando com os três meses anteriores.",
    parameters: obj(),
  },
  {
    name: "listar_assinaturas",
    description: "Lista cobranças fixas e recorrentes, com custo mensal e anual.",
    parameters: obj(),
  },
  {
    name: "listar_parcelamentos",
    description: "Compras parceladas em andamento: parcela atual, total, quanto falta.",
    parameters: obj(),
  },
  {
    name: "faturas_e_vencimentos",
    description: "Faturas dos cartões abertas e futuras, com total, quanto já foi pago, o que falta e o vencimento.",
    parameters: obj(),
  },
  {
    name: "fluxo_projetado",
    description: "Projeção mês a mês do que entra, sai e sobra, com o que já está lançado.",
    parameters: obj(),
  },
  {
    name: "simular_compra",
    description:
      "Simula uma compra antes de feita: impacto mês a mês na sobra prevista, se algum mês fica negativo, se cabe no limite do cartão e qual o melhor mês para começar. Use sempre para perguntas de compra.",
    parameters: obj(
      {
        valor_total: N("Valor total da compra em reais."),
        parcelas: N("Número de parcelas; 1 para à vista."),
        forma: { type: "STRING", enum: ["credito", "debito"], description: "Cartão de crédito ou à vista na conta (débito, pix, dinheiro)." },
        cartao: S("Nome do cartão, se for no crédito e a pessoa disse qual."),
      },
      ["valor_total"],
    ),
  },
  {
    name: "perfil_financeiro",
    description: "Retrato do perfil: renda média, gastos fixos e variáveis, parcelas, quanto sobra e a distribuição 50/30/20 aplicada aos números.",
    parameters: obj(),
  },
  {
    name: "listar_metas",
    description: "Metas e caixinhas: alvo, guardado, prazo.",
    parameters: obj(),
  },
  {
    name: "conferir_dados",
    description: "Confere a qualidade dos dados: lançamentos possivelmente duplicados, sem categoria, e faturas com valores estranhos.",
    parameters: obj(),
  },
];

const SPECIALIST_OF: Record<string, string> = {
  listar_transacoes: "lora",
  resumo_por_categoria: "lora",
  comparar_meses: "lora",
  gastos_atipicos: "lora",
  listar_assinaturas: "lora",
  listar_parcelamentos: "cronos",
  faturas_e_vencimentos: "cronos",
  fluxo_projetado: "cronos",
  simular_compra: "atena",
  perfil_financeiro: "alura",
  listar_metas: "alura",
  conferir_dados: "argos",
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const round = (v: number) => Math.round(v * 100) / 100;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const end = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(end).padStart(2, "0")}` };
};

async function spendByCategory(supabase: any, start: string, end: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("category,amount")
    .eq("type", "despesa")
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;
  const by = new Map<string, number>();
  for (const r of data ?? []) by.set(r.category, (by.get(r.category) ?? 0) + Number(r.amount));
  return by;
}

/** Atena's arithmetic: what a purchase does to the months ahead. Pure, so it is testable. */
export function simulatePurchase(input: {
  total: number;
  parcels: number;
  /** Months (from this one) the projection covers, with what is left in each. */
  months: { mes: string; receita: number; sobra: number }[];
  /** How many months after this one the first parcel lands. */
  firstOffset: number;
}) {
  const parcels = Math.max(1, Math.round(input.parcels));
  const each = round(input.total / parcels);
  const months = input.months;

  const apply = (start: number) =>
    months.map((m, i) => {
      const hit = i >= start && i < start + parcels ? each : 0;
      return { mes: m.mes, sobra_antes: round(m.sobra), parcela: hit, sobra_depois: round(m.sobra - hit) };
    });

  const plan = apply(input.firstOffset);
  const touched = plan.filter((m) => m.parcela > 0);
  const negative = touched.filter((m) => m.sobra_depois < 0);
  const tight = touched.filter((m, i) => {
    const receita = months[plan.indexOf(m)]?.receita ?? 0;
    return m.sobra_depois >= 0 && m.sobra_depois < Math.max(200, receita * 0.1);
  });
  const veredito = negative.length > 0 ? "vermelho" : tight.length > 0 ? "amarelo" : "verde";

  /* The best month to start: the one whose worst month afterwards is the least bad. */
  let melhor = input.firstOffset;
  let melhorPior = -Infinity;
  for (let start = input.firstOffset; start < Math.max(input.firstOffset + 1, months.length - 1); start++) {
    const worst = Math.min(...apply(start).filter((m) => m.parcela > 0).map((m) => m.sobra_depois), Infinity);
    if (worst > melhorPior + 0.5) {
      melhorPior = worst;
      melhor = start;
    }
  }

  return {
    valor_total: round(input.total),
    parcelas: parcels,
    valor_parcela: each,
    veredito,
    meses: plan,
    meses_negativos: negative.map((m) => m.mes),
    meses_apertados: tight.map((m) => m.mes),
    melhor_mes_para_comecar: months[melhor]?.mes ?? null,
    pior_sobra_comecando_no_melhor_mes: Number.isFinite(melhorPior) ? round(melhorPior) : null,
    observacao: parcels > months.length - input.firstOffset ? "Parte das parcelas cai depois do horizonte da projeção." : null,
  };
}

async function runTool(supabase: any, name: string, input: any, snapshot: any): Promise<unknown> {
  const today = new Date();
  switch (name) {
    case "listar_transacoes": {
      let q = supabase
        .from("transactions")
        .select("name,amount,type,category,date,status,payment_method,installments,installment_current")
        .order("date", { ascending: false })
        .limit(Math.min(Number(input?.limite) || 40, 200));
      if (input?.data_inicio) q = q.gte("date", input.data_inicio);
      if (input?.data_fim) q = q.lte("date", input.data_fim);
      if (input?.tipo) q = q.eq("type", input.tipo);
      if (input?.categoria) q = q.eq("category", input.categoria);
      if (input?.busca) q = q.ilike("name", `%${input.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return {
        quantidade: data?.length ?? 0,
        soma: round((data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0)),
        lancamentos: (data ?? []).map((t: any) => ({
          nome: t.name, valor: Number(t.amount), tipo: t.type, categoria: t.category, data: t.date,
          forma: t.payment_method, parcela: t.installments ? `${t.installment_current}/${t.installments}` : null,
        })),
      };
    }

    case "resumo_por_categoria": {
      const tipo = input?.tipo ?? "despesa";
      const { data, error } = await supabase
        .from("transactions").select("category,amount").eq("type", tipo)
        .gte("date", input.data_inicio).lte("date", input.data_fim);
      if (error) throw error;
      const by = new Map<string, { soma: number; itens: number }>();
      for (const r of data ?? []) {
        const p = by.get(r.category) ?? { soma: 0, itens: 0 };
        by.set(r.category, { soma: p.soma + Number(r.amount), itens: p.itens + 1 });
      }
      const categorias = [...by.entries()].map(([categoria, v]) => ({ categoria, soma: round(v.soma), itens: v.itens })).sort((a, b) => b.soma - a.soma);
      return { tipo, total: round(categorias.reduce((s, c) => s + c.soma, 0)), categorias };
    }

    case "comparar_meses": {
      const a = monthRange(input.mes_a);
      const b = monthRange(input.mes_b);
      const [ma, mb] = await Promise.all([spendByCategory(supabase, a.start, a.end), spendByCategory(supabase, b.start, b.end)]);
      const cats = new Set([...ma.keys(), ...mb.keys()]);
      const linhas = [...cats].map((c) => ({ categoria: c, antes: round(ma.get(c) ?? 0), depois: round(mb.get(c) ?? 0), diferenca: round((mb.get(c) ?? 0) - (ma.get(c) ?? 0)) }))
        .sort((x, y) => Math.abs(y.diferenca) - Math.abs(x.diferenca));
      const ta = [...ma.values()].reduce((s, v) => s + v, 0);
      const tb = [...mb.values()].reduce((s, v) => s + v, 0);
      return { mes_a: input.mes_a, mes_b: input.mes_b, total_a: round(ta), total_b: round(tb), diferenca_total: round(tb - ta), categorias: linhas.slice(0, 12) };
    }

    case "gastos_atipicos": {
      const y = today.getFullYear();
      const m = today.getMonth();
      const cur = monthRange(`${y}-${String(m + 1).padStart(2, "0")}`);
      const past = new Date(y, m - 3, 1);
      const pastStart = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-01`;
      const before = new Date(y, m, 0);
      const pastEnd = `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, "0")}-${String(before.getDate()).padStart(2, "0")}`;
      const [now, hist] = await Promise.all([spendByCategory(supabase, cur.start, cur.end), spendByCategory(supabase, pastStart, pastEnd)]);
      if (hist.size === 0) return { aviso: "Ainda não há histórico de três meses para comparar." };
      const atipicos = [...now.entries()]
        .map(([c, v]) => ({ categoria: c, este_mes: round(v), media_3_meses: round((hist.get(c) ?? 0) / 3) }))
        .filter((x) => x.este_mes > 50 && x.este_mes > x.media_3_meses * 1.5)
        .sort((a, b) => b.este_mes - b.media_3_meses - (a.este_mes - a.media_3_meses));
      return { atipicos, criterio: "mais de 50% acima da média dos três meses anteriores" };
    }

    case "listar_assinaturas": {
      const { data, error } = await supabase
        .from("transactions").select("name,amount,category,payment_method,date")
        .eq("type", "despesa").eq("recurrence_type", "fixa").is("parent_transaction_id", null).limit(100);
      if (error) throw error;
      const lista = (data ?? []).map((t: any) => ({ nome: t.name, mensal: Number(t.amount), anual: round(Number(t.amount) * 12), categoria: t.category, forma: t.payment_method }));
      const mensal = lista.reduce((s: number, x: any) => s + x.mensal, 0);
      return { quantidade: lista.length, total_mensal: round(mensal), total_anual: round(mensal * 12), assinaturas: lista.sort((a: any, b: any) => b.mensal - a.mensal) };
    }

    case "listar_parcelamentos": {
      const { data, error } = await supabase
        .from("transactions").select("id,name,amount,category,installments,installment_current,parent_transaction_id")
        .eq("recurrence_type", "parcelado").gt("installments", 1).limit(400);
      if (error) throw error;
      const by = new Map<string, any>();
      for (const r of data ?? []) {
        const key = r.parent_transaction_id ?? r.id;
        const prev = by.get(key);
        if (!prev || Number(r.installment_current) > Number(prev.installment_current)) by.set(key, r);
      }
      return {
        parcelamentos: [...by.values()].map((r: any) => {
          const atual = Number(r.installment_current) || 1;
          const total = Number(r.installments);
          return { nome: r.name, categoria: r.category, valor_parcela: Number(r.amount), ultima_parcela_lancada: atual, total_parcelas: total };
        }),
      };
    }

    case "faturas_e_vencimentos": {
      const { data, error } = await supabase
        .from("invoices").select("month,year,total_amount,paid_amount,is_paid,credit_cards(name,due_day,closing_day)")
        .gte("year", today.getFullYear() - 1).order("year").order("month");
      if (error) throw error;
      const period = today.getFullYear() * 12 + today.getMonth();
      return {
        faturas: (data ?? [])
          .filter((i: any) => i.year * 12 + (i.month - 1) >= period - 1 && Number(i.total_amount) > 0)
          .slice(0, 24)
          .map((i: any) => ({
            cartao: i.credit_cards?.name,
            mes: `${MONTHS[i.month - 1]} de ${i.year}`,
            total: round(Number(i.total_amount)),
            pago: round(Number(i.paid_amount ?? 0)),
            falta: round(Math.max(0, Number(i.total_amount) - Number(i.paid_amount ?? 0))),
            vence: `${i.credit_cards?.due_day}/${String(i.month).padStart(2, "0")}/${i.year}`,
            situacao: i.is_paid ? "paga" : "aberta",
          })),
      };
    }

    case "fluxo_projetado":
      return { meses: snapshot?.previsao?.proximos_meses ?? [], saldo_atual: snapshot?.contas?.saldo_atual ?? null, previsto_fim_do_mes: snapshot?.contas?.saldo_previsto_fim_mes ?? null };

    case "simular_compra": {
      const months = (snapshot?.previsao?.proximos_meses ?? []) as { mes: string; receita: number; sobra: number }[];
      if (months.length === 0) return { erro: "Sem projeção de meses para simular. Peça para a pessoa abrir o app e tentar de novo." };
      const total = Number(input?.valor_total);
      if (!(total > 0)) return { erro: "Valor da compra inválido." };
      const credito = input?.forma === "credito";
      const cards = (snapshot?.cartoes ?? []) as any[];
      const card = credito
        ? cards.find((c) => input?.cartao && String(c.nome).toLowerCase().includes(String(input.cartao).toLowerCase())) ??
          [...cards].sort((a, b) => b.disponivel - a.disponivel)[0]
        : null;
      /* On a card, a purchase after the closing day lands on next month's invoice. */
      const firstOffset = credito && card ? (today.getDate() < Number(card.fechamento) ? 0 : 1) : 0;
      const result = simulatePurchase({ total, parcels: credito ? Number(input?.parcelas) || 1 : 1, months, firstOffset });
      return {
        ...result,
        forma: credito ? "crédito" : "à vista na conta",
        cartao: card ? { nome: card.nome, limite_disponivel: card.disponivel, cabe_no_limite: card.disponivel >= total } : null,
        saldo_atual_contas: snapshot?.contas?.saldo_atual ?? null,
      };
    }

    case "perfil_financeiro": {
      const past = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const start = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-01`;
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("transactions").select("type,amount,recurrence_type,payment_method")
        .gte("date", start).lte("date", endStr);
      if (error) throw error;
      let renda = 0, fixas = 0, parcelas = 0, variaveis = 0;
      for (const t of data ?? []) {
        const v = Number(t.amount);
        if (t.type === "receita") renda += v;
        else if (t.type === "despesa") {
          if (t.recurrence_type === "fixa") fixas += v;
          else if (t.recurrence_type === "parcelado") parcelas += v;
          else variaveis += v;
        }
      }
      const r = renda / 3;
      if (r <= 0) return { aviso: "Ainda não há receitas suficientes registradas nos últimos três meses para montar o perfil." };
      return {
        base: "média dos três meses anteriores",
        renda_media: round(r),
        fixas_media: round(fixas / 3),
        parcelas_media: round(parcelas / 3),
        variaveis_media: round(variaveis / 3),
        sobra_media: round(r - (fixas + parcelas + variaveis) / 3),
        comprometido_pct: round(((fixas + parcelas + variaveis) / 3 / r) * 100),
        metodo_50_30_20: { necessidades: round(r * 0.5), desejos: round(r * 0.3), guardar: round(r * 0.2) },
        observacao: "Fixas e parcelas aproximam necessidades; variáveis aproximam desejos. É uma estimativa, não um plano salvo.",
      };
    }

    case "listar_metas": {
      const { data, error } = await supabase.from("goals").select("name,target_amount,current_amount,target_date,status").limit(50);
      if (error) throw error;
      return {
        metas: (data ?? []).map((g: any) => ({
          nome: g.name, alvo: Number(g.target_amount), guardado: Number(g.current_amount ?? 0),
          falta: round(Number(g.target_amount) - Number(g.current_amount ?? 0)), prazo: g.target_date, situacao: g.status,
        })),
      };
    }

    case "conferir_dados": {
      const since = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("transactions").select("name,amount,date,category,type,parent_transaction_id").gte("date", since).limit(1000);
      if (error) throw error;
      const seen = new Map<string, number>();
      for (const t of data ?? []) {
        if (t.parent_transaction_id) continue;
        const k = `${String(t.name).toLowerCase()}|${t.amount}|${t.date}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      const duplicados = [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => {
        const [nome, valor, data] = k.split("|");
        return { nome, valor: Number(valor), data, vezes: n };
      });
      const semCategoria = (data ?? []).filter((t: any) => !t.category || t.category === "Outros").length;
      return { periodo_desde: since, possiveis_duplicados: duplicados.slice(0, 20), lancamentos_sem_categoria: semCategoria };
    }

    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

/** The app's own numbers, written out so the model reads them the way a person would. */
function describeSnapshot(s: any): string {
  if (!s) return "Retrato financeiro indisponível nesta mensagem.";
  const lines: string[] = [`Hoje é ${s.hoje}.`];
  if (s.contas) {
    lines.push(`\nCONTAS\nSaldo atual somando as contas: ${money(s.contas.saldo_atual)}.` +
      (s.contas.saldo_previsto_fim_mes != null ? ` Previsto para o fim do mês, com o que já está lançado: ${money(s.contas.saldo_previsto_fim_mes)}.` : ""));
    for (const c of s.contas.lista ?? []) lines.push(`- ${c.nome}: ${money(c.saldo)}`);
  }
  if (s.mes) {
    lines.push(`\nMÊS ATUAL (${s.mes.referencia})\nReceitas: ${money(s.mes.receitas)} (${money(s.mes.receitas_recebidas)} já recebido).\n` +
      `Despesas: ${money(s.mes.despesas)} (${money(s.mes.despesas_pagas)} já pago).\nBalanço do mês: ${money(s.mes.balanco)}.\nMédia de gasto por dia: ${money(s.mes.media_diaria)}.`);
  }
  if ((s.previsao?.proximos_meses ?? []).length) {
    lines.push("\nPROJEÇÃO, mês a mês, com o que já está lançado");
    for (const m of s.previsao.proximos_meses) lines.push(`- ${m.mes}: entra ${money(m.receita)}, sai ${money(m.despesa)}, sobra ${money(m.sobra)}`);
  }
  if ((s.cartoes ?? []).length) {
    lines.push("\nCARTÕES");
    for (const c of s.cartoes) lines.push(`- ${c.nome}: fatura aberta ${money(c.fatura_aberta)}, fecha dia ${c.fechamento}, vence dia ${c.vencimento}. Limite ${money(c.limite)}, usado ${money(c.usado)}, disponível ${money(c.disponivel)}.`);
  }
  if ((s.proximos_eventos ?? []).length) {
    lines.push("\nPRÓXIMOS EVENTOS");
    for (const e of s.proximos_eventos) lines.push(`- ${e.data}: ${e.nome}, ${money(e.valor)} (${e.tipo})`);
  }
  return lines.join("\n");
}

const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
const GEMINI_TIMEOUT_MS = 40_000;
const MAX_TOOL_ROUNDS = 6;

type GPart = { text?: string; functionCall?: { name: string; args?: any }; functionResponse?: { name: string; response: any }; [k: string]: unknown };
type GContent = { role: "user" | "model"; parts: GPart[] };

async function gemini(model: string, system: string, contents: GContent[]) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations: TOOLS }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) throw new Error(`${model}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const content = data.candidates?.[0]?.content as GContent | undefined;
    if (!content?.parts?.length) throw new Error(`${model}: resposta vazia`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** The same tools, in the shape Claude reads: JSON Schema with lowercase types. */
const lower = (v: any): any =>
  Array.isArray(v) ? v.map(lower) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "type" && typeof x === "string" ? x.toLowerCase() : lower(x)]))
    : v;
const CLAUDE_TOOLS = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: lower(t.parameters) }));
const CLAUDE_MODEL = "claude-sonnet-5-5";

type Runner = (name: string, args: any) => Promise<unknown>;

/** Claude's turn: the tool loop, with every result for a turn sent back together. */
async function askClaude(system: string, incoming: { role: "user" | "assistant"; content: string }[], run: Runner): Promise<string> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("claude: sem chave");
  const anthropic = new Anthropic();
  const messages: any[] = incoming.map((m) => ({ role: m.role, content: m.content }));
  const call = () =>
    anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: system }],
      messages,
      tools: CLAUDE_TOOLS as any,
    });
  let response = await call();
  for (let round = 0; round < MAX_TOOL_ROUNDS && response.stop_reason === "tool_use"; round++) {
    messages.push({ role: "assistant", content: response.content });
    const results = await Promise.all(
      response.content
        .filter((b: any) => b.type === "tool_use")
        .map(async (b: any) => ({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(await run(b.name, b.input)) })),
    );
    messages.push({ role: "user", content: results });
    response = await call();
  }
  if (response.stop_reason === "refusal") return "Não consigo responder isso por aqui. Tenta me perguntar de outro jeito?";
  const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  if (!text) throw new Error("claude: sem texto");
  return text;
}

/** Gemini's turn, the same loop in its own shape, trying each model in order. */
async function askGemini(system: string, incoming: { role: "user" | "assistant"; content: string }[], run: Runner): Promise<string> {
  let lastError = "";
  for (const model of GEMINI_MODELS) {
    try {
      const convo: GContent[] = incoming.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      let reply = await gemini(model, system, convo);
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const calls = reply.parts.filter((p) => p.functionCall);
        if (calls.length === 0) break;
        convo.push(reply);
        const responses = await Promise.all(
          calls.map(async (p) => ({ functionResponse: { name: p.functionCall!.name, response: { result: await run(p.functionCall!.name, p.functionCall!.args ?? {}) } } })),
        );
        convo.push({ role: "user", parts: responses });
        reply = await gemini(model, system, convo);
      }
      const text = reply.parts.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error(`${model}: sem texto`);
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("willo-assistant gemini:", lastError);
    }
  }
  throw new Error(lastError || "gemini indisponível");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    if (incoming.length === 0) return json({ error: "messages é obrigatório" }, 400);

    const prefs = body?.prefs ?? {};
    const enabled = prefs.agents ?? {};
    /* A specialist switched off loses its tools (Argos never does). */
    const off = new Set(Object.entries(enabled).filter(([id, on]) => !on && id !== "argos").map(([id]) => id));

    const system = [
      WILLO_SYSTEM,
      SPECIALISTS_PROMPT,
      prefs.style || prefs.length
        ? `# Seu jeito de falar\n${STYLE_PROMPT[prefs.style] ?? ""}\n${LENGTH_PROMPT[prefs.length] ?? ""}`
        : "",
      off.size ? `As especialidades ${[...off].join(", ")} estão desligadas pela pessoa: não use as ferramentas delas.` : "",
      `# Retrato financeiro agora\n\n${describeSnapshot(body?.snapshot)}`,
    ].filter(Boolean).join("\n\n");

    const turns = incoming
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && m?.content)
      .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content) }));

    const used = new Set<string>();
    const run: Runner = async (name, args) => {
      const owner = SPECIALIST_OF[name];
      if (owner && off.has(owner)) return { erro: "Especialidade desligada pela pessoa." };
      try {
        const out = await runTool(supabase, name, args ?? {}, body?.snapshot);
        if (owner) used.add(owner);
        return out;
      } catch (err) {
        return { erro: `Falha ao consultar: ${err instanceof Error ? err.message : "erro"}` };
      }
    };

    /* Claude first; whatever stops it — no key, no credit, an outage — Gemini answers. */
    let reply: string;
    let motor = "claude";
    try {
      reply = await askClaude(system, turns, run);
    } catch (err) {
      console.error("willo-assistant claude:", err instanceof Error ? err.message : err);
      motor = "gemini";
      used.clear();
      reply = await askGemini(system, turns, run);
    }
    return json({ reply, especialistas: [...used], motor });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("willo-assistant error:", raw);
    let message = "Não consegui pensar agora. Tenta de novo em instantes?";
    let reason = "desconhecido";
    if (/429|quota|rate/i.test(raw)) {
      message = "Muitas perguntas ao mesmo tempo. Espera alguns segundos e tenta de novo.";
      reason = "limite";
    } else if (/api.?key|GEMINI_API_KEY|401|403/i.test(raw)) {
      message = "A chave da IA não está configurada no servidor.";
      reason = "sem_chave";
    }
    return json({ error: message, reason, detail: raw.slice(0, 300) }, 502);
  }
});
