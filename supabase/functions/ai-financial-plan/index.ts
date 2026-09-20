import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Calls Claude forcing a single tool call and returns the tool input (or null). */
async function callClaudeTool<T>(
  system: string,
  user: string,
  tool: { name: string; description: string; input_schema: Record<string, unknown> },
): Promise<T | null> {
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
    tools: [tool as Anthropic.Tool],
    tool_choice: { type: "tool", name: tool.name },
  });
  const block = response.content.find((b) => b.type === "tool_use");
  return block && block.type === "tool_use" ? (block.input as T) : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("ANTHROPIC_API_KEY not configured");

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
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { objective, type, target_amount } = await req.json();
    if (!objective || !type) {
      return new Response(JSON.stringify({ error: "objective and type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's real financial data (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().split("T")[0];

    const [txRes, accRes, goalsRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, type, category, date, status")
        .eq("user_id", user.id)
        .gte("date", dateStr)
        .order("date", { ascending: false })
        .limit(500),
      supabase
        .from("accounts")
        .select("name, type, current_balance, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("goals")
        .select("name, target_amount, current_amount")
        .eq("user_id", user.id),
    ]);

    const transactions = txRes.data || [];
    const accounts = accRes.data || [];
    const goals = goalsRes.data || [];

    // Summarize data for AI (no sensitive info)
    const totalBalance = accounts
      .filter((a: any) => a.type !== "investment")
      .reduce((s: number, a: any) => s + Number(a.current_balance), 0);

    const totalInvested = accounts
      .filter((a: any) => a.type === "investment")
      .reduce((s: number, a: any) => s + Number(a.current_balance), 0);

    // Category breakdown
    const categoryTotals: Record<string, { income: number; expense: number }> = {};
    let totalIncome3m = 0;
    let totalExpense3m = 0;

    for (const tx of transactions) {
      const cat = tx.category || "Outros";
      if (!categoryTotals[cat]) categoryTotals[cat] = { income: 0, expense: 0 };
      if (tx.type === "receita") {
        categoryTotals[cat].income += Number(tx.amount);
        totalIncome3m += Number(tx.amount);
      } else if (tx.type === "despesa" && tx.status === "pago") {
        categoryTotals[cat].expense += Number(tx.amount);
        totalExpense3m += Number(tx.amount);
      }
    }

    const avgMonthlyIncome = totalIncome3m / 3;
    const avgMonthlyExpense = totalExpense3m / 3;
    const avgMonthlySurplus = avgMonthlyIncome - avgMonthlyExpense;

    const topExpenseCategories = Object.entries(categoryTotals)
      .map(([name, data]) => ({ name, monthlyAvg: Math.round(data.expense / 3) }))
      .filter((c) => c.monthlyAvg > 0)
      .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
      .slice(0, 8);

    const existingGoals = goals.map((g: any) => ({
      name: g.name,
      target: g.target_amount,
      current: g.current_amount,
    }));

    const financialSummary = `
Resumo financeiro do usuário (últimos 3 meses):
- Saldo disponível: R$ ${totalBalance.toFixed(2)}
- Total investido: R$ ${totalInvested.toFixed(2)}
- Receita média mensal: R$ ${avgMonthlyIncome.toFixed(2)}
- Despesa média mensal: R$ ${avgMonthlyExpense.toFixed(2)}
- Sobra média mensal: R$ ${avgMonthlySurplus.toFixed(2)}
- Top categorias de gasto mensal: ${topExpenseCategories.map((c) => `${c.name}: R$ ${c.monthlyAvg}`).join(", ")}
- Metas existentes: ${existingGoals.length > 0 ? existingGoals.map((g: any) => `${g.name} (${Math.round((g.current / g.target) * 100)}% completo)`).join(", ") : "Nenhuma"}
`;

    const targetInfo = target_amount ? `Valor alvo: R$ ${target_amount}` : "Sem valor alvo definido";
    const typeLabel = type === "investimento" ? "carteira de investimento" : "meta financeira";

    const systemPrompt = `Você é um consultor financeiro pessoal inteligente e empático. Analise os dados reais do usuário e crie um plano financeiro personalizado.

Responda SEMPRE em português brasileiro. Seja direto, prático e motivacional.

Use os dados reais para:
1. Calcular a capacidade real de poupança (considerando gastos essenciais vs não-essenciais)
2. Sugerir um aporte mensal viável baseado na sobra real
3. Identificar gastos que podem ser reduzidos (categorias específicas do usuário)
4. Calcular prazo realista para atingir o objetivo
5. Criar marcos motivacionais no caminho
6. Listar riscos e formas de acelerar`;

    const userPrompt = `O usuário quer criar uma ${typeLabel}.
Objetivo: ${objective}
${targetInfo}

${financialSummary}

Analise os dados e crie um plano financeiro personalizado.`;

    let plan: unknown;
    try {
      plan = await callClaudeTool(systemPrompt, userPrompt, {
        name: "create_financial_plan",
        description: "Cria um plano financeiro personalizado baseado nos dados do usuário",
        input_schema: {
                type: "object",
                properties: {
                  monthly_contribution: {
                    type: "number",
                    description: "Aporte mensal sugerido em reais",
                  },
                  estimated_months: {
                    type: "number",
                    description: "Prazo estimado em meses para atingir o objetivo",
                  },
                  saving_capacity_explanation: {
                    type: "string",
                    description: "Explicação da capacidade real de poupança (2-3 frases)",
                  },
                  expenses_to_cut: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        current_monthly: { type: "number" },
                        suggested_reduction: { type: "number" },
                        tip: { type: "string" },
                      },
                      required: ["category", "current_monthly", "suggested_reduction", "tip"],
                    },
                    description: "Lista de gastos que podem ser reduzidos",
                  },
                  milestones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        month: { type: "number" },
                        amount: { type: "number" },
                        label: { type: "string" },
                      },
                      required: ["month", "amount", "label"],
                    },
                    description: "Marcos motivacionais no caminho (3-5 marcos)",
                  },
                  risks: {
                    type: "array",
                    items: { type: "string" },
                    description: "Riscos potenciais (2-3 items)",
                  },
                  accelerate_options: {
                    type: "array",
                    items: { type: "string" },
                    description: "Opções para acelerar a estratégia (2-3 items)",
                  },
                  motivational_message: {
                    type: "string",
                    description: "Mensagem motivacional personalizada (1-2 frases)",
                  },
                },
                required: [
                  "monthly_contribution",
                  "estimated_months",
                  "saving_capacity_explanation",
                  "expenses_to_cut",
                  "milestones",
                  "risks",
                  "accelerate_options",
                  "motivational_message",
                ],
                additionalProperties: false,
              },
      });
    } catch (err) {
      console.error("Claude API error:", err);
      if (err instanceof Anthropic.RateLimitError) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Não foi possível gerar o plano agora.");
    }
    if (!plan) throw new Error("AI did not return structured output");

    return new Response(JSON.stringify({ plan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-financial-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
