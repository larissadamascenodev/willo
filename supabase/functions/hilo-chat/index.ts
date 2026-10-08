import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Hilo, the assistant inside Willo.
 *
 * The rules below are the product's, not the model's invention. Two of them carry the
 * whole thing: the app's numbers are the truth, and nothing is ever reported as done
 * unless it actually happened. This slice can only read, so the second one mostly means
 * Hilo must say it cannot register yet instead of pretending it did.
 */
const HILO_SYSTEM = `Você é o Hilo, o assistente financeiro do aplicativo Willo.

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
- Recomendação: sua opinião. O Hilo recomenda, a pessoa decide.

# O que você pode fazer agora

Nesta versão você LÊ os dados e analisa. Você ainda NÃO consegue criar, alterar nem excluir nada.

Se pedirem para registrar, editar ou apagar um lançamento, diga com naturalidade que ainda não consegue fazer isso por aqui e aponte o caminho: o botão de nova transação no app. Não diga que adicionou. Não diga que vai adicionar. Não prometa fazer depois.

Você pode, e deve, ajudar a pessoa a decidir antes: calcular o impacto, comparar meses, simular uma compra.

# Simulação de compra

"Quero comprar X" é intenção, não compra feita. Trate como simulação, a não ser que ela diga claramente que já comprou.

Pergunte só o necessário para simular, normalmente à vista ou no cartão, e em quantas vezes. Depois mostre:
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

type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

/**
 * Reading tools only. Everything here is a plain scoped query: the heavy derived numbers
 * (projection, sobra prevista, invoice totals) are computed by the app and arrive in the
 * snapshot, so the rules that produce them live in one place instead of two.
 */
const TOOLS: ToolDef[] = [
  {
    name: "listar_transacoes",
    description:
      "Lista os lançamentos registrados, do mais recente para o mais antigo. Use para responder sobre gastos específicos, procurar por um estabelecimento, ou olhar um período que não está no retrato.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "Data inicial, formato YYYY-MM-DD." },
        data_fim: { type: "string", description: "Data final, formato YYYY-MM-DD." },
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Filtra por tipo." },
        categoria: { type: "string", description: "Nome exato da categoria." },
        busca: { type: "string", description: "Trecho do nome do lançamento, por exemplo 'ifood'." },
        limite: { type: "number", description: "Quantos trazer, padrão 40, máximo 200." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "resumo_por_categoria",
    description:
      "Soma os lançamentos por categoria num período. Use para 'onde foi meu dinheiro', comparar categorias, ou ver quanto pesa cada uma.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "Data inicial, formato YYYY-MM-DD." },
        data_fim: { type: "string", description: "Data final, formato YYYY-MM-DD." },
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Padrão despesa." },
      },
      required: ["data_inicio", "data_fim"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_parcelamentos",
    description:
      "Lista as compras parceladas em andamento, com a parcela atual, o total de parcelas e quanto ainda falta. Use para saber o que termina quando.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "listar_metas",
    description: "Lista as metas e objetivos, com valor alvo, quanto já foi guardado e o prazo.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Runs one read tool against the caller's own rows. RLS does the scoping. */
async function runTool(supabase: any, name: string, input: any): Promise<unknown> {
  switch (name) {
    case "listar_transacoes": {
      let q = supabase
        .from("transactions")
        .select("id,name,amount,type,category,date,status,payment_method,installments,installment_current")
        .order("date", { ascending: false })
        .limit(Math.min(Number(input?.limite) || 40, 200));

      if (input?.data_inicio) q = q.gte("date", input.data_inicio);
      if (input?.data_fim) q = q.lte("date", input.data_fim);
      if (input?.tipo) q = q.eq("type", input.tipo);
      if (input?.categoria) q = q.eq("category", input.categoria);
      if (input?.busca) q = q.ilike("name", `%${input.busca}%`);

      const { data, error } = await q;
      if (error) throw error;

      const total = (data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      return {
        quantidade: data?.length ?? 0,
        soma: Math.round(total * 100) / 100,
        lancamentos: (data ?? []).map((t: any) => ({
          nome: t.name,
          valor: Number(t.amount),
          tipo: t.type,
          categoria: t.category,
          data: t.date,
          status: t.status,
          parcela: t.installments ? `${t.installment_current}/${t.installments}` : null,
        })),
      };
    }

    case "resumo_por_categoria": {
      const tipo = input?.tipo ?? "despesa";
      const { data, error } = await supabase
        .from("transactions")
        .select("category,amount")
        .eq("type", tipo)
        .gte("date", input.data_inicio)
        .lte("date", input.data_fim);
      if (error) throw error;

      const byCat = new Map<string, { soma: number; itens: number }>();
      for (const row of data ?? []) {
        const prev = byCat.get(row.category) ?? { soma: 0, itens: 0 };
        byCat.set(row.category, { soma: prev.soma + Number(row.amount), itens: prev.itens + 1 });
      }
      const categorias = [...byCat.entries()]
        .map(([categoria, v]) => ({ categoria, soma: Math.round(v.soma * 100) / 100, itens: v.itens }))
        .sort((a, b) => b.soma - a.soma);
      const total = categorias.reduce((s, c) => s + c.soma, 0);

      return {
        tipo,
        periodo: { de: input.data_inicio, ate: input.data_fim },
        total: Math.round(total * 100) / 100,
        categorias,
      };
    }

    case "listar_parcelamentos": {
      const { data, error } = await supabase
        .from("transactions")
        .select("name,amount,category,date,installments,installment_current,credit_card_id")
        .not("installments", "is", null)
        .gt("installments", 1)
        .order("date", { ascending: false })
        .limit(200);
      if (error) throw error;

      // One row per instalment, so collapse to the purchase and report where it stands.
      const byPurchase = new Map<string, any>();
      for (const row of data ?? []) {
        const key = `${row.name}|${row.amount}|${row.installments}`;
        const prev = byPurchase.get(key);
        if (!prev || Number(row.installment_current) > Number(prev.installment_current)) {
          byPurchase.set(key, row);
        }
      }

      return {
        parcelamentos: [...byPurchase.values()]
          .map((r: any) => {
            const atual = Number(r.installment_current) || 1;
            const total = Number(r.installments);
            const restantes = Math.max(total - atual, 0);
            return {
              nome: r.name,
              categoria: r.category,
              valor_parcela: Number(r.amount),
              parcela_atual: atual,
              total_parcelas: total,
              parcelas_restantes: restantes,
              falta_pagar: Math.round(Number(r.amount) * restantes * 100) / 100,
            };
          })
          .sort((a, b) => b.falta_pagar - a.falta_pagar),
      };
    }

    case "listar_metas": {
      const { data, error } = await supabase
        .from("goals")
        .select("name,target_amount,current_amount,target_date,status")
        .limit(50);
      if (error) throw error;

      return {
        metas: (data ?? []).map((g: any) => ({
          nome: g.name,
          alvo: Number(g.target_amount),
          guardado: Number(g.current_amount ?? 0),
          falta: Math.round((Number(g.target_amount) - Number(g.current_amount ?? 0)) * 100) / 100,
          prazo: g.target_date,
          situacao: g.status,
        })),
      };
    }

    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

/** The app's own numbers, written out so the model reads them the way a person would. */
function describeSnapshot(s: any): string {
  if (!s) return "Retrato financeiro indisponível nesta mensagem.";

  const lines: string[] = [];
  lines.push(`Hoje é ${s.hoje}.`);

  if (s.contas) {
    lines.push(
      `\nCONTAS\nSaldo atual somando as contas: ${money(s.contas.saldo_atual)}.` +
        (s.contas.saldo_previsto_fim_mes != null
          ? ` Previsto para o fim do mês, com o que já está lançado: ${money(s.contas.saldo_previsto_fim_mes)}.`
          : ""),
    );
    for (const c of s.contas.lista ?? []) {
      lines.push(`- ${c.nome}: ${money(c.saldo)}`);
    }
  }

  if (s.mes) {
    lines.push(
      `\nMÊS ATUAL (${s.mes.referencia})\n` +
        `Receitas: ${money(s.mes.receitas)} (${money(s.mes.receitas_recebidas)} já recebido).\n` +
        `Despesas: ${money(s.mes.despesas)} (${money(s.mes.despesas_pagas)} já pago).\n` +
        `Balanço do mês: ${money(s.mes.balanco)}.\n` +
        `Média de gasto por dia: ${money(s.mes.media_diaria)}.`,
    );
  }

  if ((s.previsao?.proximos_meses ?? []).length) {
    lines.push("\nPROJEÇÃO, mês a mês, com o que já está lançado");
    for (const m of s.previsao.proximos_meses) {
      lines.push(
        `- ${m.mes}: entra ${money(m.receita)}, sai ${money(m.despesa)}, sobra ${money(m.sobra)}`,
      );
    }
  }

  if ((s.cartoes ?? []).length) {
    lines.push("\nCARTÕES");
    for (const c of s.cartoes) {
      lines.push(
        `- ${c.nome}: fatura aberta ${money(c.fatura_aberta)}, vence dia ${c.vencimento}. ` +
          `Limite ${money(c.limite)}, usado ${money(c.usado)}, disponível ${money(c.disponivel)}.`,
      );
    }
  }

  if ((s.proximos_eventos ?? []).length) {
    lines.push("\nPRÓXIMOS EVENTOS");
    for (const e of s.proximos_eventos) {
      lines.push(`- ${e.data}: ${e.nome}, ${money(e.valor)} (${e.tipo})`);
    }
  }

  return lines.join("\n");
}

const MAX_TOOL_ROUNDS = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("ANTHROPIC_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    if (incoming.length === 0) {
      return new Response(JSON.stringify({ error: "messages é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

    const messages: Anthropic.MessageParam[] = incoming
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && m?.content)
      .map((m: any) => ({ role: m.role, content: m.content }));

    // The frozen half of the prompt is cached; the snapshot changes every request, so it
    // sits after the breakpoint where it cannot invalidate the part that never moves.
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: HILO_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: `# Retrato financeiro agora\n\n${describeSnapshot(body?.snapshot)}` },
    ];

    const toolsUsed: string[] = [];
    let response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system,
      messages,
      tools: TOOLS as Anthropic.Tool[],
    });

    for (let round = 0; round < MAX_TOOL_ROUNDS && response.stop_reason === "tool_use"; round++) {
      const calls = response.content.filter((b) => b.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      // Every result for a turn goes back in ONE user message, or the model learns to
      // stop asking for several at once.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        if (call.type !== "tool_use") continue;
        toolsUsed.push(call.name);
        try {
          const out = await runTool(supabase, call.name, call.input);
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(out),
          });
        } catch (err) {
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            is_error: true,
            content: `Falha ao consultar: ${err instanceof Error ? err.message : "erro desconhecido"}`,
          });
        }
      }

      messages.push({ role: "user", content: results });

      response = await anthropic.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 8000,
        output_config: { effort: "medium" },
        system,
        messages,
        tools: TOOLS as Anthropic.Tool[],
      });
    }

    // A policy decline comes back as a normal 200, so the stop reason is checked before
    // the content is read.
    if (response.stop_reason === "refusal") {
      return new Response(
        JSON.stringify({ reply: "Não consigo responder isso por aqui. Tenta me perguntar de outro jeito?" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    return new Response(
      JSON.stringify({
        reply: reply || "Não consegui montar uma resposta agora. Tenta de novo?",
        tools_used: toolsUsed,
        truncated: response.stop_reason === "max_tokens",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("hilo-chat error:", e);

    // Say which wall was hit. A raw provider string in the chat tells the person
    // nothing they can act on, and the two causes below need different actions.
    const raw = e instanceof Error ? e.message : String(e);
    let message = "Não consegui pensar agora. Tenta de novo em instantes?";
    let reason = "desconhecido";
    if (/credit balance|insufficient|billing/i.test(raw)) {
      message = "O Hilo está sem créditos de IA na conta da Anthropic. Assim que recarregar, ele volta.";
      reason = "sem_credito";
    } else if (/rate.?limit|429/i.test(raw)) {
      message = "Muitas perguntas ao mesmo tempo. Espera alguns segundos e tenta de novo.";
      reason = "limite";
    } else if (/api.?key|authentication/i.test(raw)) {
      message = "A chave da IA não está configurada no servidor.";
      reason = "sem_chave";
    }

    return new Response(
      JSON.stringify({ error: message, reason, detail: raw.slice(0, 300) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
