import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPENSE_CATEGORIES = [
  "Alimentação", "Supermercado", "Transporte", "Saúde", "Assinaturas",
  "Lazer", "Moradia", "Educação", "Vestuário", "Pets",
  "Beleza", "Presentes", "Viagem", "Tecnologia", "Impostos",
  "Farmácia", "Combustível", "Estacionamento", "Restaurante",
  "Delivery", "Academia", "Streaming", "Telefonia", "Internet",
  "Energia", "Água", "Gás", "Manutenção", "Seguros",
  "Material Escolar", "Livros", "Jogos", "Cinema", "Festas",
  "Eletrônicos", "Móveis", "Decoração", "Jardinagem",
  "Limpeza", "Higiene", "Barbearia", "Cosméticos",
];

const INCOME_CATEGORIES = [
  "Salário", "Freelance", "Investimentos", "Vendas",
  "Aluguéis", "Bônus", "Comissão", "Mesada",
  "Dividendos", "Reembolso", "Cashback", "Prêmio",
];

const CATEGORY_ICON_MAP: Record<string, { icon: string; color: string }> = {
  "Alimentação": { icon: "utensils", color: "#f44336" },
  "Supermercado": { icon: "shopping-cart", color: "#4caf50" },
  "Transporte": { icon: "car", color: "#2196f3" },
  "Saúde": { icon: "heart", color: "#e91e63" },
  "Assinaturas": { icon: "repeat", color: "#9c27b0" },
  "Lazer": { icon: "gamepad-2", color: "#ff9800" },
  "Moradia": { icon: "home", color: "#00bcd4" },
  "Educação": { icon: "graduation-cap", color: "#ffc107" },
  "Vestuário": { icon: "shirt", color: "#673ab7" },
  "Pets": { icon: "paw-print", color: "#795548" },
  "Beleza": { icon: "scissors", color: "#e91e63" },
  "Presentes": { icon: "gift", color: "#ff5722" },
  "Viagem": { icon: "plane", color: "#00bcd4" },
  "Tecnologia": { icon: "smartphone", color: "#3f51b5" },
  "Impostos": { icon: "file-text", color: "#607060" },
  "Farmácia": { icon: "pill", color: "#e91e63" },
  "Combustível": { icon: "zap", color: "#ff9800" },
  "Estacionamento": { icon: "car", color: "#607060" },
  "Restaurante": { icon: "utensils", color: "#ff5722" },
  "Delivery": { icon: "shopping-bag", color: "#ff9800" },
  "Academia": { icon: "dumbbell", color: "#4caf50" },
  "Streaming": { icon: "tv", color: "#9c27b0" },
  "Telefonia": { icon: "smartphone", color: "#2196f3" },
  "Internet": { icon: "globe", color: "#00bcd4" },
  "Energia": { icon: "zap", color: "#ffc107" },
  "Água": { icon: "zap", color: "#2196f3" },
  "Gás": { icon: "zap", color: "#ff9800" },
  "Manutenção": { icon: "wrench", color: "#607060" },
  "Seguros": { icon: "file-text", color: "#3f51b5" },
  "Material Escolar": { icon: "book-open", color: "#ffc107" },
  "Livros": { icon: "book-open", color: "#795548" },
  "Jogos": { icon: "gamepad-2", color: "#9c27b0" },
  "Cinema": { icon: "clapperboard", color: "#e91e63" },
  "Festas": { icon: "music", color: "#ff5722" },
  "Eletrônicos": { icon: "monitor", color: "#3f51b5" },
  "Móveis": { icon: "home", color: "#795548" },
  "Decoração": { icon: "lightbulb", color: "#ff9800" },
  "Jardinagem": { icon: "target", color: "#4caf50" },
  "Limpeza": { icon: "star", color: "#00bcd4" },
  "Higiene": { icon: "heart", color: "#2196f3" },
  "Barbearia": { icon: "scissors", color: "#607060" },
  "Cosméticos": { icon: "star", color: "#e91e63" },
  "Salário": { icon: "dollar-sign", color: "#4caf50" },
  "Freelance": { icon: "briefcase", color: "#2196f3" },
  "Investimentos": { icon: "trending-up", color: "#4caf50" },
  "Vendas": { icon: "shopping-bag", color: "#ff9800" },
  "Aluguéis": { icon: "home", color: "#ffc107" },
  "Bônus": { icon: "award", color: "#4caf50" },
  "Comissão": { icon: "users", color: "#2196f3" },
  "Mesada": { icon: "wallet", color: "#4caf50" },
  "Dividendos": { icon: "trending-up", color: "#00bcd4" },
  "Reembolso": { icon: "dollar-sign", color: "#4caf50" },
  "Cashback": { icon: "dollar-sign", color: "#8bc34a" },
  "Prêmio": { icon: "award", color: "#ffc107" },
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

    const { description, type, customCategories } = await req.json();
    if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("ANTHROPIC_API_KEY not configured");

    const baseCategories = type === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    // Merge custom categories from client
    const allCategories = [...baseCategories];
    if (customCategories && Array.isArray(customCategories)) {
      for (const cc of customCategories) {
        if (!allCategories.includes(cc)) allCategories.push(cc);
      }
    }

    let category: string | null = null;
    const args = await callClaudeTool<{ category?: string }>(
      `You categorize Brazilian financial transactions. Given a description, return the most likely category from this list: ${allCategories.join(", ")}. 
IMPORTANT RULES:
- NEVER return "Outros" as a category. Always pick a specific category.
- If no existing category fits well, suggest a NEW descriptive category name in Portuguese (e.g., "Supermercado", "Farmácia", "Academia", "Streaming").
- The category name should be a single word or short phrase, capitalized.
- Return ONLY the category name.`,
      String(description ?? ""),
      {
        name: "suggest_category",
        description: "Suggest a category for the transaction",
        input_schema: {
          type: "object",
          properties: {
            category: { type: "string", description: "The category name. Must NOT be 'Outros'." },
          },
          required: ["category"],
          additionalProperties: false,
        },
      },
    );
    if (args?.category && args.category !== "Outros") {
      category = args.category;
    }

    // Determine icon/color for the category
    let icon = "file-text";
    let color = "#8b5cf6";
    if (category && CATEGORY_ICON_MAP[category]) {
      icon = CATEGORY_ICON_MAP[category].icon;
      color = CATEGORY_ICON_MAP[category].color;
    }

    return new Response(JSON.stringify({ category, icon, color }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-category error:", e);
    return new Response(JSON.stringify({ category: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
