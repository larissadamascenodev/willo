import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CategoryInput {
  name: string;
  amount: number;
  percentage: number;
  txCount: number;
}

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { categories, totalExpenses, monthLabel, previousMonthCategories } = await req.json() as {
      categories: CategoryInput[];
      totalExpenses: number;
      monthLabel: string;
      previousMonthCategories: CategoryInput[];
    };

    if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("ANTHROPIC_API_KEY not configured");

    const prevMap = new Map(previousMonthCategories.map((c) => [c.name, c.amount]));

    const catSummary = categories
      .map((c) => {
        const prev = prevMap.get(c.name);
        const change = prev ? Math.round(((c.amount - prev) / prev) * 100) : null;
        return `- ${c.name}: R$ ${c.amount.toFixed(2)} (${c.percentage}% do total, ${c.txCount} transações${change !== null ? `, variação ${change > 0 ? "+" : ""}${change}% vs mês anterior` : ""})`;
      })
      .join("\n");

    const systemPrompt = `Você é o DinHub AI, assistente financeiro pessoal integrado ao app DinHub. 
Fale em português brasileiro informal, tom amigável e leve. Use emojis com moderação.
Seja direto, útil e nunca robótico. Misture humor leve com alertas práticos.
Nunca invente dados — use apenas os números fornecidos.`;

    const userPrompt = `Analise os gastos de ${monthLabel}:

Total gasto: R$ ${totalExpenses.toFixed(2)}

Categorias:
${catSummary}

Gere insights financeiros usando a ferramenta fornecida.`;

    let result: unknown = null;
    try {
      result = await callClaudeTool(systemPrompt, userPrompt, {
        name: "generate_financial_insights",
        description: "Gera insights, alertas, sugestões de limite e projeções financeiras.",
        input_schema: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  description: "2-4 frases curtas, amigáveis e úteis sobre os gastos. Tom humano com humor leve.",
                  items: { type: "string" },
                },
                alerts: {
                  type: "array",
                  description: "Alertas de comportamento (ex: aumento vs mês anterior). Só incluir se relevante.",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      message: { type: "string" },
                      severity: { type: "string", enum: ["info", "warning", "danger"] },
                    },
                    required: ["category", "message", "severity"],
                    additionalProperties: false,
                  },
                },
                limitSuggestions: {
                  type: "array",
                  description: "Sugestões de limite para categorias com gasto alto (acima de 25% do total).",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      suggestedLimit: { type: "number" },
                      message: { type: "string" },
                    },
                    required: ["category", "suggestedLimit", "message"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights", "alerts", "limitSuggestions"],
              additionalProperties: false,
            },
      });
    } catch (err) {
      console.error("Claude API error:", err);
      const message = err instanceof Anthropic.RateLimitError
        ? "⏳ Muitas requisições no momento. Tente novamente em alguns segundos."
        : "Não foi possível gerar insights no momento.";
      return new Response(
        JSON.stringify({ insights: [message], alerts: [], limitSuggestions: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result) {
      return new Response(JSON.stringify({ insights: [], alerts: [], limitSuggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("category-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
