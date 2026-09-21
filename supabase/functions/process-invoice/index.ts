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

const NAME_RULES = `REGRA CRÍTICA DE DESCRIÇÃO — SIMPLIFIQUE NOMES:
- Nunca retorne razões sociais, CNPJs, códigos de autorização ou nomes jurídicos completos
- Remova o cartão que abre a linha na fatura: "•••• 3426", "**** 4680"
- Remova qualquer prefixo de adquirente antes de "*": "PAG*", "MP*", "EC *", "MLP *", "AUT*", "DL*", "EBN*", "APPLE.COM/BILL"
  * "Ec *Terabyteshop" → "TerabyteShop"
  * "Mlp *Kabum-Kabum" → "KaBuM!"
  * "Dl*Uberrides" → "Uber"
  * "Www-Casasbahia-Com-Br" → "Casas Bahia"
- Simplifique para o nome popular/comercial que o usuário reconhece:
  * "IFOOD COM AGENCIA DE RESTAURANTES ONLINE S.A." → "iFood"
  * "UBER DO BRASIL TECNOLOGIA LTDA" → "Uber"
  * "NETFLIX INTERNATIONAL B.V." → "Netflix"
  * "PAG*JoseDaSilva" → "José da Silva"
  * "MERCADOPAGO*LOJA123" → "MercadoPago - Loja 123"
- Se identificar o estabelecimento final (ex: McDonald's via iFood), use: "iFood - McDonald's"
- Mantenha o nome curto, limpo e reconhecível`;

const CATEGORY_GUIDE = `CATEGORIAS DISPONÍVEIS (use EXATAMENTE um destes nomes, nunca invente outro):
  * Alimentação — mercado de bairro, açougue, hortifruti, padaria (compra de alimentos)
  * Supermercado — redes de supermercado (Extra, Pão de Açúcar, Carrefour, Atacadão, Assaí)
  * Delivery — iFood, Rappi, Uber Eats, 99Food, Zé Delivery, Aiqfome
  * Fast Food — McDonald's, Burger King, Subway, Bob's, Habib's (compra presencial)
  * Cafeteria — Starbucks, cafeterias, padarias para consumo no local
  * Bebidas — bar, distribuidora de bebidas, adega
  * Transporte — Uber, 99, táxi, ônibus, metrô, combustível, posto, estacionamento, pedágio
  * Saúde — farmácia, drogaria, hospital, clínica, médico, laboratório, plano de saúde
  * Assinaturas — Netflix, Spotify, Amazon Prime, Disney+, YouTube Premium, iCloud, Google One
  * Educação — escola, curso, faculdade, livro, Udemy, Coursera
  * Moradia — aluguel, condomínio, IPTU, material de construção, manutenção da casa
  * Conta de Luz — energia elétrica
  * Conta de Água — água e esgoto
  * Conta de Gás — gás encanado ou botijão
  * Lazer — cinema, shows, eventos, jogos, streaming de jogos
  * Vestuário — roupas, calçados, acessórios
  * Tecnologia — eletrônicos, gadgets, celular, informática
  * Beleza — salão, barbearia, cosméticos, perfumaria
  * Pets — petshop, veterinário, ração
  * Presentes — presentes para terceiros
  * Viagem — passagens, hospedagem, turismo, aluguel de carro
  * Impostos — tributos, taxas governamentais
  * Academia — academia, crossfit, natação, atividades físicas
  * Outros — só quando realmente não der para identificar
IMPORTANTE: retorne a categoria com a acentuação e as maiúsculas exatamente como na lista.`;

const INVOICE_PROMPT = `Você é um assistente especializado em ler faturas de cartão de crédito brasileiras (Nubank, Itaú, Bradesco, Santander, Inter, C6, BB, Caixa, XP) em PDF, print ou foto.

Extraia TODAS as compras listadas na fatura, linha por linha, de todas as páginas e de todos os portadores/cartões adicionais.

${NAME_RULES}

Extraia SOMENTE da lista de transações/compras. NUNCA extraia estas linhas:
- Pagamentos da fatura: "Pagamento em 14 AGO", "PAGAMENTO EFETUADO", "PAGAMENTO RECEBIDO", "PGTO DEBITO AUTOMATICO"
- Saldos e rotativo: "Saldo em rotativo", "Saldo em atraso", "Saldo em aberto", "Saldo financiado", "Saldo anterior"
- Créditos e devoluções: "Crédito de atraso", "Crédito de rotativo", 'Crédito de "Loja X"', "Estorno de ...", qualquer valor negativo
- Resumo da fatura: "Fatura anterior", "Total de compras", "Total a pagar", "Outros lançamentos", "Juros de financiamento"
- Limites e cabeçalhos: "Limite total", "Limite disponível", "Pré-aprovado", "Valor máximo", "Pagamentos e Financiamentos"
- Subtotais por portador: uma linha com só um nome de pessoa/empresa e um valor, sem data, logo acima de um bloco de compras
Encargos realmente cobrados nesta fatura (anuidade, IOF de uma compra, multa, seguro) DEVEM ser extraídos, categoria "Outros".

Para cada compra retorne:
- description: nome SIMPLIFICADO do estabelecimento (ver regras acima), sem a marcação de parcela
- amount: valor em reais da LINHA (número decimal, ponto como separador decimal, sem "R$").
  Atenção: em compra parcelada a fatura mostra o valor DA PARCELA — retorne esse valor da parcela, não o total da compra.
- date: data em que a COMPRA foi feita, no formato YYYY-MM-DD.
  A fatura costuma mostrar só dia e mês ("12/06", "12 JUN"). Complete o ano de forma coerente com o período da fatura:
  se o mês da compra for maior que o mês de fechamento da fatura, a compra é do ano anterior.
  Se a linha não tiver data alguma, retorne null.
- installment_current: número da parcela atual. null se não for parcelado
- installment_total: total de parcelas. null se não for parcelado
- category: ver lista abaixo
- type: sempre "despesa"
- confidence: 0 a 1 conforme a legibilidade da linha (valor nítido, data presente, nome claro = alto)

REGRAS DE DETECÇÃO DE PARCELAMENTO:
- Padrões: "- Parcela 4/10", "Parcela 4/10", "4/10", "04/10", "PARC 04/10", "Parcela 4 de 10", "4 DE 10", "(4/10)"
- Extraia installment_current e installment_total e REMOVA essa marcação do description
- Quando a linha explica o total ("Total a pagar: R$ 391,00 ... divididos em 6 parcelas de R$ 65,17"),
  o amount continua sendo o valor cobrado NESTA fatura, não o total da compra
- Uma compra "4/10" significa que 3 parcelas já foram cobradas em faturas anteriores — mesmo assim extraia normalmente, o app cuida disso
- Sem indicação de parcelamento: os dois campos ficam null (não invente "1/1")

${CATEGORY_GUIDE}

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem explicação.
Formato: { "items": [...] }`;

const TRANSACTION_PROMPT = `Você é um assistente especializado em extrair transações financeiras de comprovantes, recibos, notas fiscais e extratos bancários brasileiros.

Analise o conteúdo fornecido (pode ser um comprovante de pagamento, recibo, nota fiscal, extrato bancário, print de transferência PIX, boleto, etc.) e extraia TODAS as transações/lançamentos encontrados.

${NAME_RULES}
- "PIX ENVIADO - CP 123.456.789-00" → manter o nome do favorecido se visível, senão "PIX Enviado"

Para cada item extraído, retorne:
- description: nome SIMPLIFICADO da transação (ver regras acima)
- amount: valor em reais (número decimal, sem R$). Busque padrões: "R$ X.XXX,XX", "X.XXX,XX", "R$X,XX". Pegue o valor principal da transação.
- date: data da transação no formato YYYY-MM-DD. Detecte: DD/MM/YYYY, DD/MM/YY, DD/MM HH:mm. Se não tiver ano, use ${new Date().getFullYear()}.
- installment_current: número da parcela atual se parcelado, senão null
- installment_total: total de parcelas se parcelado, senão null
- category: ver lista abaixo
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

${CATEGORY_GUIDE}

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

/** Gemini takes the file inline, and base64 grows it ~33%; stay well under the request ceiling. */
const MAX_FILE_BYTES = 12 * 1024 * 1024;

const KNOWN_CATEGORIES = [
  "Alimentação", "Supermercado", "Delivery", "Fast Food", "Cafeteria", "Bebidas",
  "Transporte", "Saúde", "Assinaturas", "Educação", "Moradia",
  "Conta de Luz", "Conta de Água", "Conta de Gás", "Lazer", "Vestuário",
  "Tecnologia", "Beleza", "Pets", "Presentes", "Viagem", "Impostos", "Academia", "Outros",
  "Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada",
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The model occasionally invents a category; anything off-list falls back to "Outros". */
function normalizeCategory(raw: unknown): string {
  if (!raw) return "Outros";
  const wanted = normalize(String(raw));
  return KNOWN_CATEGORIES.find((c) => normalize(c) === wanted) ?? "Outros";
}

/**
 * Statements mix real purchases with payments, balances, refunds and per-cardholder
 * subtotals. Those carry big positive amounts too, so they are filtered by name.
 */
const NON_PURCHASE = [
  /^pagamento\b/,
  /\bpagamentos?\s+(e\s+financiamentos|em|efetuad|recebid|realizad|minimo|necessario|de\s+boleto)/,
  /^pgto\b/,
  /\bsaldo\s+(anterior|final|financiado|devedor|em\s+(aberto|atraso|rotativo))/,
  /\btotal\s+(a\s+pagar|da\s+fatura|de\s+compras)/,
  /^fatura\s+anterior/,
  /\blimite\s+(total|disponivel|transferido|garantido)/,
  /^pre-?aprovado/,
  /^credito\s+de\b/,
  /^estorno\b|^cancelamento\b/,
  /^juros\s+(de\s+)?(financiamento|parcelamento|rotativo|divida)/,
  /^encerramento\s+de\s+divida/,
  /^iof\s+de\s+compras/,
  /^outros\s+lancamentos/,
  /^valor\s+(maximo|original)/,
  /^fechamento\s+da\s+proxima/,
  /^encargos\b/,
  /^(saque|pix)\s+no\s+credito/,
  /^conversao:/,
];

/** Statements often print the day before the description ("14 AGO Crédito de rotativo"). */
const LEADING_DATE = /^(\d{1,2}[\s/-]?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|\d{1,2})[\s/-]?(\d{2,4})?)\s+/;

function isNonPurchase(description: string): boolean {
  const text = normalize(description).replace(/^[•·\-*\s]+/, "").replace(LEADING_DATE, "");
  return NON_PURCHASE.some((re) => re.test(text));
}

/** Statements prefix lines with the card ("•••• 3426") and the acquirer ("Ec *", "Mlp *"). */
function cleanDescription(raw: string): string {
  return String(raw)
    .replace(/^[•·*\s]*\d{4}\s+/, "")
    .replace(/\s*-\s*Parcela\s*\d+\s*\/\s*\d+\s*$/i, "")
    .trim();
}

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

      if (file.size > MAX_FILE_BYTES) {
        throw new Error("Arquivo muito grande. Envie uma fatura de até 12 MB (ou só as páginas com as compras).");
      }

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

    const userTextInvoice = "Extraia todas as compras desta fatura de cartão de crédito, de todas as páginas e de todos os portadores. Identifique parcelamentos e ignore pagamentos, saldos e totais.";
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
      .filter((item: any) => !isNonPurchase(String(item.description)))
      .map((item: any) => {
        const total = item.installment_total ? Number(item.installment_total) : null;
        const current = item.installment_current ? Number(item.installment_current) : null;
        // "1/1" is not a real instalment plan, and a current above the total is a misread
        const isPlan = !!total && total > 1 && !!current && current >= 1 && current <= total;
        return {
          description: cleanDescription(item.description),
          amount: Math.round(Number(item.amount) * 100) / 100,
          date: item.date || null,
          installment_current: isPlan ? current : null,
          installment_total: isPlan ? total : null,
          category: normalizeCategory(item.category),
          type: item.type === "receita" ? "receita" : "despesa",
          confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
          merchant: item.merchant || null,
          time: item.time || null,
        };
      });

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
