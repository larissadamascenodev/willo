import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

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

// Same free-tier models the invoice reader uses: lite answers fastest, flash is the backup
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];
const GEMINI_TIMEOUT_MS = 15_000;

/** Asks Gemini for a single JSON object matching `schema`, or null if it can't. */
async function callGeminiJson<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
): Promise<T | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: schema,
            },
          }),
        },
      );
      if (!res.ok) {
        console.error(`Gemini ${model} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
        continue;
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();
      if (!text) continue;
      return JSON.parse(text) as T;
    } catch (err) {
      console.error(`Gemini ${model} error:`, err instanceof Error ? err.message : err);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** The icon names the app can actually render (ICON_OPTIONS in CategoryCreateModal). */
const ICON_NAMES = [
  "shopping-cart", "utensils", "car", "pill", "home", "book-open", "shirt", "paw-print",
  "scissors", "gamepad-2", "gift", "plane", "smartphone", "dollar-sign", "briefcase", "music",
  "coffee", "dumbbell", "clapperboard", "file-text", "wrench", "shopping-bag", "lightbulb", "target",
  "heart", "repeat", "graduation-cap", "trending-up", "award", "users", "wallet", "piggy-bank",
  "zap", "star", "globe", "camera", "headphones", "monitor", "tv", "bus", "landmark", "bike",
  "fuel", "baby", "stethoscope", "palette", "utensils-crossed", "wine", "pizza", "hammer", "key",
  "shield", "umbrella", "tent", "map", "truck", "leaf", "flame", "gem", "crown",
  "badge-dollar-sign", "hand-coins", "receipt", "banknote", "droplets", "cup-soda", "package",
  "popcorn", "salad", "ice-cream", "plug", "wifi", "phone", "building-2",
];

const PALETTE = [
  "#00e676", "#f44336", "#ff9800", "#2196f3", "#9c27b0", "#e91e63", "#00bcd4", "#8bc34a",
  "#ffc107", "#795548", "#607060", "#3f51b5", "#009688", "#ff5722", "#673ab7", "#cddc39",
  "#4caf50", "#03a9f4", "#ff4081", "#7c4dff", "#18ffff", "#69f0ae", "#ffab40", "#ea80fc",
];

/** Dresses a brand new category: which icon and colour fit the name the user just typed. */
async function suggestStyle(name: string, usedColors: string[]) {
  const taken = new Set((usedColors ?? []).map((c) => String(c).toLowerCase()));
  const free = PALETTE.filter((c) => !taken.has(c.toLowerCase()));
  const palette = free.length > 0 ? free : PALETTE;

  const args = await callGeminiJson<{ icon?: string; color?: string; type?: string }>(
    `Você escolhe a aparência de uma categoria financeira em um app brasileiro.
Dado o NOME da categoria, escolha:
- icon: um destes nomes, o mais representativo: ${ICON_NAMES.join(", ")}
- color: uma destas cores hex, que combine com o tema: ${palette.join(", ")}
- type: "receita" se a categoria for dinheiro entrando (salário, vendas, cashback, aluguel recebido),
  senão "despesa"
Escolha o ícone mais literal possível. Ex: "Streaming" -> tv, "Uber" -> car, "Pizza" -> pizza,
"Cachorro" -> paw-print, "Faculdade" -> graduation-cap, "Cerveja" -> wine, "Internet" -> wifi.`,
    `Categoria: ${name}`,
    {
      type: "object",
      properties: {
        icon: { type: "string", enum: ICON_NAMES },
        color: { type: "string", enum: palette },
        type: { type: "string", enum: ["despesa", "receita"] },
      },
      required: ["icon", "color", "type"],
    },
  );

  return {
    icon: args?.icon && ICON_NAMES.includes(args.icon) ? args.icon : "file-text",
    color: args?.color && palette.includes(args.color) ? args.color : palette[0],
    type: args?.type === "receita" ? "receita" : "despesa",
  };
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

    const { description, type, customCategories, mode, name, usedColors } = await req.json();

    // Dressing a category the user is creating by hand: pick its icon, colour and type
    if (mode === "style") {
      const trimmed = String(name ?? "").trim();
      if (trimmed.length < 2) {
        return new Response(JSON.stringify({ icon: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const style = await suggestStyle(trimmed, Array.isArray(usedColors) ? usedColors : []);
      return new Response(JSON.stringify(style), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseCategories = type === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    // Merge custom categories from client
    const allCategories = [...baseCategories];
    if (customCategories && Array.isArray(customCategories)) {
      for (const cc of customCategories) {
        if (!allCategories.includes(cc)) allCategories.push(cc);
      }
    }

    let category: string | null = null;
    const args = await callGeminiJson<{ category?: string }>(
      `Você categoriza transações financeiras brasileiras. Dada uma descrição, retorne a categoria
mais provável desta lista: ${allCategories.join(", ")}.
REGRAS IMPORTANTES:
- NUNCA retorne "Outros". Sempre escolha uma categoria específica.
- Se nenhuma da lista servir, sugira um nome NOVO e descritivo em português
  (ex.: "Supermercado", "Farmácia", "Academia", "Streaming").
- O nome deve ser uma palavra ou expressão curta, com a primeira letra maiúscula.`,
      String(description ?? ""),
      {
        type: "object",
        properties: { category: { type: "string" } },
        required: ["category"],
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
    const detail = e instanceof Error ? e.message : String(e);
    console.error("suggest-category error:", detail);
    // A failed suggestion must never block the user — the form keeps its own defaults
    return new Response(JSON.stringify({ category: null, icon: null, detail }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
