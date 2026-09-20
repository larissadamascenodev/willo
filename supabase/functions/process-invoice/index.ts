import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedItem {
  description: string;
  amount: number;
  date: string | null;
  installment_current: number | null;
  installment_total: number | null;
  category: string;
  type: string;
  confidence: number;
}

const INVOICE_PROMPT = `Você é um assistente especializado em extrair transações de faturas de cartão de crédito brasileiras.

Analise o conteúdo fornecido e extraia TODAS as transações/lançamentos.

Para cada item extraído, retorne:
- description: nome/descrição da compra
- amount: valor em reais (número decimal, sem R$)
- date: data da compra no formato YYYY-MM-DD (ou null se não disponível)
- installment_current: número da parcela atual (ex: se "3/10", retorne 3). null se não parcelado
- installment_total: total de parcelas (ex: se "3/10", retorne 10). null se não parcelado
- category: categoria sugerida com primeira letra maiúscula (Alimentação, Transporte, Compras, Saúde, Educação, Lazer, Moradia, Serviços, Assinaturas, Outros)
- type: sempre "despesa" para faturas de cartão
- confidence: um número de 0 a 1 indicando sua confiança na extração (1 = certeza total, 0.5 = incerto). Avalie cada campo: se o valor foi claramente lido, data presente, descrição clara = alta confiança. Se valores estão borrados, ambíguos ou parcialmente legíveis = baixa confiança.

REGRAS DE DETECÇÃO DE PARCELAMENTO:
- Procure padrões como: "3/10", "03/10", "Parcela 3 de 10", "3x de 10", "PARC 03/10"
- Se encontrar, extraia installment_current e installment_total
- Se NÃO encontrar indicação de parcelamento, deixe ambos como null

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem explicação.
Formato: { "items": [...] }`;

const TRANSACTION_PROMPT = `Você é um assistente especializado em extrair transações financeiras de comprovantes, recibos, notas fiscais e extratos bancários brasileiros.

Analise o conteúdo fornecido (pode ser um comprovante de pagamento, recibo, nota fiscal, extrato bancário, print de transferência PIX, boleto, etc.) e extraia TODAS as transações/lançamentos encontrados.

REGRA CRÍTICA DE DESCRIÇÃO — SIMPLIFIQUE NOMES:
- Nunca retorne razões sociais, CNPJs ou nomes jurídicos completos
- Simplifique para o nome popular/comercial que o usuário reconhece:
  * "IFOOD COM AGENCIA DE RESTAURANTES ONLINE S.A." → "iFood"
  * "UBER DO BRASIL TECNOLOGIA LTDA" → "Uber"
  * "NETFLIX INTERNATIONAL B.V." → "Netflix"
  * "PAG*JoseDaSilva" → "José da Silva"
  * "MERCADOPAGO*LOJA123" → "MercadoPago - Loja 123"
  * "PIX ENVIADO - CP 123.456.789-00" → manter o nome do favorecido se visível, senão "PIX Enviado"
- Se identificar o nome do estabelecimento final (ex: McDonald's via iFood), use: "iFood - McDonald's"
- Mantenha o nome curto, limpo e reconhecível

Para cada item extraído, retorne:
- description: nome SIMPLIFICADO da transação (ver regras acima)
- amount: valor em reais (número decimal, sem R$). Busque padrões: "R$ X.XXX,XX", "X.XXX,XX", "R$X,XX". Pegue o valor principal da transação.
- date: data da transação no formato YYYY-MM-DD. Detecte: DD/MM/YYYY, DD/MM/YY, DD/MM HH:mm. Se não tiver ano, use ${new Date().getFullYear()}.
- installment_current: número da parcela atual se parcelado, senão null
- installment_total: total de parcelas se parcelado, senão null
- category: categoria sugerida baseada em palavras-chave. CATEGORIAS DISPONÍVEIS:
  * Alimentação — compras em supermercado, mercado, açougue, hortifruti, padaria (compras essenciais de alimentos)
  * Delivery — iFood, Rappi, Uber Eats, 99Food, Zé Delivery, Aiqfome, qualquer app de entrega de comida/bebida
  * Fast Food — McDonald's, Burger King, Subway, Bob's (quando compra presencial, não delivery)
  * Cafeteria — Starbucks, cafeterias, padarias para consumo no local
  * Supermercado — redes de supermercado (Extra, Pão de Açúcar, Carrefour, Atacadão)
  * Transporte — uber, 99, táxi, ônibus, metrô, combustível, estacionamento, pedágio
  * Saúde — farmácia, drogaria, hospital, clínica, médico, plano de saúde
  * Assinaturas — netflix, spotify, amazon prime, disney+, youtube premium, serviços recorrentes
  * Educação — escola, curso, faculdade, livro, Udemy, Coursera
  * Moradia — aluguel, condomínio, IPTU, manutenção da casa
  * Conta de Luz — energia elétrica
  * Conta de Água — água e esgoto
  * Conta de Gás — gás encanado ou botijão
  * Lazer — cinema, shows, eventos, jogos, streaming de jogos
  * Vestuário — roupas, calçados, acessórios
  * Tecnologia — eletrônicos, gadgets, acessórios tech
  * Beleza — salão, barbearia, cosméticos
  * Pets — petshop, veterinário, ração
  * Presentes — presentes para terceiros
  * Viagem — passagens, hospedagem, turismo
  * Impostos — tributos, taxas governamentais
  * Bebidas — bar, distribuidora de bebidas, adega
  * Academia — academia, crossfit, natação, atividades físicas
  * Se não identificar com confiança → Outros
  IMPORTANTE: Todas as categorias devem ser retornadas com a primeira letra MAIÚSCULA (ex: "Alimentação", "Transporte", "Saúde").
- type: "despesa" para gastos/pagamentos ou "receita" para recebimentos/depósitos/transferências recebidas
  * Palavras que indicam RECEITA: "recebido", "pix recebido", "entrada", "depósito", "crédito", "salário", "transferência recebida"
  * Palavras que indicam DESPESA: "pago", "pagamento", "transferência enviada", "débito", "pix enviado", "compra"
  * Se não conseguir determinar, use "despesa"
- confidence: um número de 0 a 1 indicando sua confiança na extração geral deste item:
  * 0.9-1.0: valor claro, data presente, tipo identificado, descrição legível
  * 0.7-0.9: maioria dos campos claros, alguma ambiguidade menor
  * 0.5-0.7: alguns campos incertos, imagem parcialmente legível
  * 0.0-0.5: dados muito incertos, imagem borrada ou ilegível
  
Também retorne "merchant" quando identificar o nome do destinatário/origem:
- Procure após "para", "de", "favorecido", "destinatário", "pagador", "beneficiário"
- Nome em destaque no comprovante

Também retorne "time" no formato HH:mm (24h) quando identificar o horário da transação:
- Procure após "horário", "hora", "às", ou no formato HH:mm, HHhMM, HH:MM:SS
- Se não encontrar horário, retorne null

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem explicação.
Formato: { "items": [...] }`;

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Free tier models, tried in order: lite answers fastest, flash is the backup
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Free-tier models can hang under high demand; give up early and try the next one
const GEMINI_TIMEOUT_MS = 25_000;

async function callGemini(apiKey: string, model: string, systemPrompt: string, parts: GeminiPart[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    let res: Response;
    let data: any;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) throw new GeminiError(res.status, (await res.text()).slice(0, 500));
      data = await res.json();
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      // 504 = timed out or network failure, retried on the next model
      throw new GeminiError(504, err instanceof Error ? err.message : "request failed");
    }
    const candidate = data.candidates?.[0];
    return (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const contentType = req.headers.get("content-type") || "";

    let imageBase64: string | null = null;
    let mimeType = "image/png";
    let csvText: string | null = null;
    let context = "invoice";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("No file provided");

      context = (formData.get("context") as string) || "invoice";

      const fileName = file.name.toLowerCase();
      const fileType = file.type;

      if (fileName.endsWith(".csv") || fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
        csvText = await file.text();
      } else {
        const buffer = new Uint8Array(await file.arrayBuffer());
        imageBase64 = arrayBufferToBase64(buffer);

        // Detect mime type properly
        if (fileType && fileType.startsWith("image/")) {
          mimeType = fileType;
        } else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
          mimeType = "application/pdf";
        } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
          mimeType = "image/jpeg";
        } else if (fileName.endsWith(".png")) {
          mimeType = "image/png";
        } else if (fileName.endsWith(".webp")) {
          mimeType = "image/webp";
        } else if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
          mimeType = "image/heic";
        } else {
          mimeType = fileType || "image/png";
        }

        console.log(`Processing file: ${file.name}, type: ${mimeType}, size: ${buffer.length} bytes, base64 length: ${imageBase64.length}`);
      }
    } else {
      const body = await req.json();
      context = body.context || "invoice";
      if (body.image_base64) {
        imageBase64 = body.image_base64;
        mimeType = body.mime_type || "image/png";
      } else if (body.csv_text) {
        csvText = body.csv_text;
      } else {
        throw new Error("No file or data provided");
      }
    }

    const systemPrompt = context === "transaction" ? TRANSACTION_PROMPT : INVOICE_PROMPT;

    const userTextInvoice = "Extraia todas as transações desta fatura de cartão de crédito. Identifique parcelamentos.";
    const userTextTransaction = "Extraia todas as transações deste comprovante/recibo/extrato. Identifique o tipo (receita ou despesa), valor, data, destinatário e categoria.";
    const userText = context === "transaction" ? userTextTransaction : userTextInvoice;

    let parts: GeminiPart[];

    if (csvText) {
      parts = [{ text: `Extraia as transações deste conteúdo em formato CSV/planilha:

${csvText}` }];
    } else {
      if (mimeType !== "application/pdf" && !SUPPORTED_IMAGES.includes(mimeType)) {
        throw new Error("Formato de imagem não suportado. Use JPG, PNG ou WEBP.");
      }
      parts = [{ inlineData: { mimeType, data: imageBase64! } }, { text: userText }];
    }

    let rawContent = "";
    let lastError: GeminiError | null = null;
    for (const model of GEMINI_MODELS) {
      try {
        rawContent = await callGemini(GEMINI_API_KEY, model, systemPrompt, parts);
        lastError = null;
        break;
      } catch (err) {
        if (!(err instanceof GeminiError)) throw err;
        console.error(`Gemini ${model} failed: status=${err.status} ${err.message}`);
        lastError = err;
        // Quota, overload or a retired model are worth retrying on the next model
        if (err.status !== 429 && err.status !== 404 && err.status < 500) break;
      }
    }

    if (lastError) {
      if (lastError.status === 504 || lastError.status === 503) {
        throw new Error("A leitura está demorando mais que o normal. Tente novamente em instantes.");
      }
      if (lastError.status === 429) {
        return new Response(JSON.stringify({ error: "Limite gratuito de leituras atingido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ([401, 403].includes(lastError.status) || /API key/i.test(lastError.message)) {
        throw new Error("A leitura por IA está indisponível no momento. Tente novamente mais tarde.");
      }
      throw new Error("Não foi possível processar a imagem. Tente com uma foto mais nítida.");
    }

    const jsonStart = rawContent.indexOf("{");
    const jsonEnd = rawContent.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) rawContent = rawContent.slice(jsonStart, jsonEnd + 1);

    rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: { items: any[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      throw new Error("Não foi possível interpretar o documento. Tente com uma imagem mais nítida.");
    }

    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("Nenhuma transação encontrada.");
    }

    const cleanedItems: ExtractedItem[] = parsed.items
      .filter((item: any) => item.description && item.amount > 0)
      .map((item: any) => ({
        description: String(item.description).trim(),
        amount: Math.round(Number(item.amount) * 100) / 100,
        date: item.date || null,
        installment_current: item.installment_current ? Number(item.installment_current) : null,
        installment_total: item.installment_total ? Number(item.installment_total) : null,
        category: item.category ? String(item.category).charAt(0).toUpperCase() + String(item.category).slice(1) : "Outros",
        type: item.type || "despesa",
        confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
        merchant: item.merchant || null,
        time: item.time || null,
      }));

    const hasInstallments = cleanedItems.some((i) => i.installment_total && i.installment_total > 1);
    const totalItems = cleanedItems.length;
    const installmentItems = cleanedItems.filter((i) => i.installment_total && i.installment_total > 1);
    const avgConfidence = cleanedItems.length > 0
      ? cleanedItems.reduce((sum, i) => sum + i.confidence, 0) / cleanedItems.length
      : 0;

    let message = `${totalItems} lançamento${totalItems > 1 ? "s" : ""} encontrado${totalItems > 1 ? "s" : ""} 🎯`;
    if (hasInstallments) {
      const msgs = [
        `Detectamos ${installmentItems.length} parcelamento${installmentItems.length > 1 ? "s" : ""}… clássico 😅`,
        `${installmentItems.length} parcelado${installmentItems.length > 1 ? "s" : ""} encontrado${installmentItems.length > 1 ? "s" : ""}. Relaxa, tá sob controle 👀`,
        `Parcelou né? Encontramos ${installmentItems.length} 😏`,
      ];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    }

    if (avgConfidence < 0.5) {
      message += " ⚠️ Confiança baixa — revise os dados com atenção.";
    }

    return new Response(
      JSON.stringify({
        items: cleanedItems,
        message,
        total_items: totalItems,
        installment_items: installmentItems.length,
        avg_confidence: Math.round(avgConfidence * 100) / 100,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("process-invoice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
