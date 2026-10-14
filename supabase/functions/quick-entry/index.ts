import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Reads one sentence of plain Portuguese — typed or spoken — and returns the entries
 * it describes.
 *
 * It does one job: turn "gastei 30 no mercado e 18 no uber" into two rows. It does not
 * decide what to ask the person next, because that depends on how many accounts and
 * cards they have, and the app knows that for certain while a prompt would only guess.
 *
 * The one thing it is told never to do is invent a category. "Gastei 20" genuinely does
 * not say what the money went on, and a row filed under "Outros" is worse than a
 * question, so it returns null and the app asks.
 */

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];
const GEMINI_TIMEOUT_MS = 20_000;

const FALLBACK_CATEGORIES = [
  "Alimentação", "Supermercado", "Transporte", "Saúde", "Assinaturas", "Lazer", "Moradia",
  "Educação", "Vestuário", "Pets", "Beleza", "Presentes", "Viagem", "Tecnologia", "Impostos",
  "Farmácia", "Combustível", "Estacionamento", "Restaurante", "Delivery", "Academia",
  "Streaming", "Telefonia", "Internet", "Energia", "Água", "Gás", "Manutenção", "Seguros",
  "Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão",
  "Mesada", "Dividendos", "Reembolso", "Cashback", "Prêmio",
];

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function callGemini(system: string, parts: Part[], schema: Record<string, unknown>) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  let lastError = "";
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
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
              responseSchema: schema,
            },
          }),
        },
      );
      if (!res.ok) {
        lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 300)}`;
        console.error(lastError);
        continue;
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();
      if (!text) {
        lastError = `${model}: resposta vazia`;
        continue;
      }
      return JSON.parse(text);
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(lastError);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError || "Gemini indisponível");
}

const systemPrompt = (today: string, categories: string[]) => `
Você lê uma frase em português brasileiro e extrai os lançamentos financeiros dela.
Hoje é ${today} (formato ISO, fuso de São Paulo).

Uma frase pode conter VÁRIOS lançamentos: "uber 18, farmácia 40" são dois.
"gastei 50 no mercado e recebi 200 de freela" são dois, um de cada tipo.

Para cada lançamento:

- name: o estabelecimento ou a origem, curto e com maiúscula inicial. "mercado" vira
  "Mercado", "uber" vira "Uber", "salário" vira "Salário". Nunca repita o valor no nome.
- type: "despesa" se o dinheiro saiu, "receita" se entrou. Gastei, paguei, comprei e
  torrei indicam despesa. Recebi, ganhei, caiu e entrou indicam receita.
- amount: número positivo em reais, sempre. "30" vira 30, "30,50" vira 30.5,
  "1,2k" vira 1200, "mil e quinhentos" vira 1500. Nunca negativo.
- category: EXATAMENTE uma destas, ou null:
  ${categories.join(", ")}
  REGRA MAIS IMPORTANTE: se a frase não disser em que o dinheiro foi usado, devolva null.
  "gastei 20" tem category null. "gastei 20 no mercado" tem category "Supermercado".
  NUNCA escolha uma categoria genérica só para preencher. null é a resposta certa quando
  a frase não diz. Errar a categoria é pior do que perguntar.
- date: ISO yyyy-mm-dd. Sem menção de data, use ${today}. "ontem" é o dia anterior,
  "anteontem" dois dias antes, "sexta passada" a sexta mais recente já passada,
  "dia 10" o dia 10 do mês corrente, ou do anterior se o dia 10 ainda não chegou.
- paymentMethod: "cartao" só se a frase disser cartão de crédito ou "no crédito".
  "conta" se disser pix, débito, dinheiro, transferência ou boleto.
  null se a frase não disser nada sobre isso. Não deduza.

Se a frase não contiver nenhum valor em dinheiro, devolva entries vazio.
`.trim();

const SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["despesa", "receita"] },
          amount: { type: "number" },
          category: { type: "string", nullable: true },
          date: { type: "string" },
          paymentMethod: { type: "string", enum: ["conta", "cartao"], nullable: true },
        },
        required: ["name", "type", "amount", "date"],
      },
    },
  },
  required: ["entries"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const text: string = (body.text ?? "").toString().trim();
    const audio = body.audio as { data: string; mimeType: string } | undefined;
    const today: string = body.today ?? new Date().toISOString().slice(0, 10);
    const categories: string[] =
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories.map(String)
        : FALLBACK_CATEGORIES;

    if (!text && !audio) return json({ entries: [] });

    const parts: Part[] = [];
    if (audio?.data) {
      parts.push({ inlineData: { mimeType: audio.mimeType || "audio/webm", data: audio.data } });
      // The transcript comes back so the person sees their own words in the thread and
      // can tell a misheard word from a misread one.
      parts.push({ text: "Transcreva o áudio em transcript e extraia os lançamentos dele." });
    }
    if (text) parts.push({ text });

    const result = await callGemini(systemPrompt(today, categories), parts, SCHEMA);

    // The model is told the category must come from the list; this is the check that it
    // did, because a category the app does not have would land as a dead filter.
    const allowed = new Set(categories);
    const entries = (result?.entries ?? [])
      .filter((e: { amount?: number }) => Number.isFinite(e.amount) && Number(e.amount) > 0)
      .map((e: Record<string, unknown>) => ({
        name: String(e.name ?? "").slice(0, 80) || "Lançamento",
        type: e.type === "receita" ? "receita" : "despesa",
        amount: Math.abs(Number(e.amount)),
        category: typeof e.category === "string" && allowed.has(e.category) ? e.category : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.date)) ? String(e.date) : today,
        paymentMethod:
          e.paymentMethod === "cartao" || e.paymentMethod === "conta" ? e.paymentMethod : null,
      }));

    return json({ entries, transcript: result?.transcript ?? null });
  } catch (err) {
    console.error("quick-entry failed:", err);
    return json({ error: err instanceof Error ? err.message : "Falha ao ler" }, 500);
  }
});
