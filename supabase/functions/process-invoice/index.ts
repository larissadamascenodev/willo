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
  is_refund: boolean;
  date: string | null;
  installment_current: number | null;
  installment_total: number | null;
  category: string;
  type: string;
  confidence: number;
  merchant?: string | null;
  time?: string | null;
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
- "Pix no Crédito - FULANO DE TAL" é uma COMPRA de verdade: um Pix pago com o limite do cartão.
  O nome é a pessoa ou empresa que recebeu, sem o "Pix no Crédito" na frente:
  * "Pix no Crédito - BEATRIZ DIAS BUZZATTO - 3/4" → "Beatriz Dias Buzzatto", parcela 3 de 4
  * "Pix no Crédito - Larissa Dias Damasceno - 2/6" → "Larissa Dias Damasceno", parcela 2 de 6
  Só ignore "Pix no crédito" quando ela vier SOZINHA, sem nome nenhum: aí é a linha de limite
  do bloco "Valor máximo para transações", não um lançamento.
- Mantenha o nome curto, limpo e reconhecível`;

const CATEGORY_GUIDE = `CATEGORIAS DISPONÍVEIS (use EXATAMENTE um destes nomes, nunca invente outro):
  * Pix no crédito — Pix parcelado ou no crédito, transferências, pagamento para uma pessoa física
    (o nome da linha é o nome de alguém, ex: "Larissa Dias Damasceno", "Cleide da Silva Marcal")
  * Tarifas e juros — juros, multa de atraso, IOF, anuidade, encargos, seguro do cartão
  * Compras online — marketplaces e lojas online: Mercado Livre, Shopee, Amazon, AliExpress, Magalu,
    Casas Bahia, Shein, Temu, quando não der para saber o que foi comprado
  * Telefone e Internet — Vivo, Claro, Tim, Oi, Telefônica, internet, celular
  * Serviços — SaaS, infoprodutos, plataformas digitais, serviços profissionais (Kiwify, Hotmart, hospedagem)
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
  * Outros — ÚLTIMO recurso, evite ao máximo
REGRA: "Outros" atrapalha as estatísticas do usuário. Antes de usar, pergunte-se se cabe em
"Compras online", "Serviços", "Pix no crédito" ou "Tarifas e juros" — quase sempre cabe.
Nome de pessoa física = "Pix no crédito". Loja que você não reconhece = "Compras online".
Plataforma ou site = "Serviços".
IMPORTANTE: retorne a categoria com a acentuação e as maiúsculas exatamente como na lista.`;

const INVOICE_PROMPT = `Você é um assistente especializado em ler faturas de cartão de crédito brasileiras (Nubank, Itaú, Bradesco, Santander, Inter, C6, BB, Caixa, XP) em PDF, print ou foto.

Extraia TODAS as compras listadas na fatura, linha por linha, de todas as páginas e de todos os portadores/cartões adicionais.

${NAME_RULES}

A SOMA de tudo que você extrair precisa fechar com os LANÇAMENTOS DO PERÍODO:
"Total de compras" + IOF + encargos − estornos.

CUIDADO, e isso é o mais importante desta instrução: o "Total a pagar" NÃO é essa soma. Ele é
um SALDO. Já soma o que sobrou da fatura anterior e já desconta o pagamento que a pessoa fez.
Numa fatura em que a pessoa pagou mais do que devia, as compras do período somam MUITO MAIS
que o "Total a pagar", e está certo assim. Nunca descarte uma compra de verdade, nunca invente
um valor negativo e nunca mude o valor de uma linha para forçar a soma a bater com o
"Total a pagar".

Existem três tipos de linha, e os três entram:

1. COMPRAS — valor positivo, categoria pela lista abaixo.
2. ENCARGOS realmente cobrados nesta fatura — juros de rotativo, multa de atraso, IOF, anuidade,
   seguro. Valor positivo, categoria "Tarifas e juros". NÃO invente: só os que aparecem na fatura.
3. ESTORNOS E DEVOLUÇÕES de compras — "Estorno de X", 'Crédito de "Loja X"', devolução, cancelamento.
   Valor NEGATIVO (ex: -19.90), com a mesma categoria que a compra original teria.
   Sem eles a conta do usuário não fecha.

NUNCA conte a mesma compra duas vezes. É o erro mais caro que existe aqui:
- Uma fatura costuma trazer um RESUMO (por categoria, por portador, por período) e depois o
  DETALHAMENTO linha a linha. Extraia SÓ o detalhamento. Se a mesma compra aparece nos dois,
  ela entra uma vez só.
- Páginas de PDF às vezes se repetem ou se sobrepõem. Se a mesma linha (mesmo nome, mesmo valor,
  mesma data) aparecer em mais de um lugar, ela entra uma vez só.
- Blocos de "Pagamentos e Financiamentos", "Resumo por categoria" e gráficos repetem valores que
  já estão no detalhamento. Ignore todos.
- Um parcelamento entra pelo valor da PARCELA desta fatura, nunca pelo total da compra, e nunca
  pelos dois.

PAGAMENTOS DA FATURA: extraia, SIM, com valor NEGATIVO.
"Pagamento em 14 AGO", "PAGAMENTO EFETUADO", "PAGAMENTO RECEBIDO", "PGTO DEBITO AUTOMATICO".
Mantenha a palavra "Pagamento" no começo do description. O app precisa saber quanto foi pago
para calcular o limite liberado. Ele sabe que pagamento não é despesa e cuida disso sozinho.
NÃO extraia a linha de resumo "Pagamento recebido": ela repete a soma dos pagamentos do
detalhamento. Só as linhas do detalhamento, uma por pagamento.

NUNCA extraia estas linhas (não são nem compra, nem encargo, nem estorno):
- Saldos e seus créditos espelhados, que se anulam: "Saldo em rotativo" com "Crédito de rotativo",
  "Saldo em atraso" com "Crédito de atraso", "Saldo em aberto", "Saldo financiado", "Saldo anterior",
  "Encerramento de dívida" com "Juros de dívida encerrada" e com "Estorno de juros da dívida encerrada".
  Esses pares se anulam e o sinal varia: às vezes o encerramento é positivo e o estorno negativo,
  às vezes o contrário. Fora os DOIS lados, sempre, não importa o sinal de cada um.
- "Estorno de juros" que aparece no RESUMO da fatura. Ele é o mesmo lançamento que o detalhamento
  mostra como "Estorno de juros de rotativo". Extraia só o do detalhamento, uma vez.
- Resumo da fatura: "Fatura anterior", "Total de compras", "Total a pagar", "Outros lançamentos",
  "Juros de financiamento" (é o mesmo valor que já aparece como "Juros de rotativo" na lista)
- Limites e cabeçalhos: "Limite total", "Limite disponível", "Pré-aprovado", "Valor máximo", "Pagamentos e Financiamentos"
- Subtotais por portador: uma linha com só um nome de pessoa/empresa e um valor, sem data, logo acima de um bloco de compras

Retorne também "summary" com os valores IMPRESSOS no RESUMO da fatura, exatamente como estão
lá, para o app conferir a conta. Zero quando a linha não existe nessa fatura, e sinal negativo
quando a fatura mostra o valor negativo:
{
  "total_a_pagar": número,      // "Total a pagar"
  "total_compras": número,      // "Total de compras" do período
  "fatura_anterior": número,    // "Fatura anterior", "Saldo anterior", "Saldo da fatura anterior"
  "pagamentos": número,         // "Pagamento recebido", "Pagamentos", "Créditos" — NEGATIVO
  "estornos_resumo": número,    // "Estorno de juros", "Estorno de encargos" do resumo — NEGATIVO
  "outros_lancamentos": número,  // "Outros lançamentos" do resumo, com o sinal impresso
  "fechamento_proxima_fatura": número,  // "Fechamento da próxima fatura", 0 se não houver
  "saldo_aberto_total": número,         // "Saldo em aberto total" / "Saldo devedor total"
  "limite_total": número,               // "Limite total" do cartão
  "limite_utilizado": número            // "Utilizado" / "Limite utilizado"
}

Esses quatro últimos são CONFERÊNCIA, não lançamento. O app usa eles para avisar a pessoa
quando a leitura não fechou. Copie o que está impresso, sem calcular nada. Se a fatura não
trouxer algum deles, mande 0.

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

FOTO OU PRINT EM VEZ DE PDF:
Pode vir um print do extrato ou da lista de lançamentos do app do banco, não a fatura inteira.
Nesse caso cada lançamento costuma ocupar uma linha ou um bloco com: nome, tipo ("Pix no crédito",
"Compra no débito"), data, marcação de parcela e valor à direita. Extraia um item por lançamento
visível, do mesmo jeito. O valor à direita de uma linha parcelada é o valor DA PARCELA.
Não invente o que está cortado na borda da imagem: se não dá para ler, não extraia.

REGRAS DE DETECÇÃO DE PARCELAMENTO:
- Padrões: "- Parcela 4/10", "Parcela 4/10", "4/10", "04/10", "PARC 04/10", "Parcela 4 de 10", "4 DE 10", "(4/10)"
- Extraia installment_current e installment_total e REMOVA essa marcação do description
- A linha que EXPLICA um parcelamento NÃO é uma compra. Em faturas do Nubank ela vem logo
  abaixo da compra, recuada, nesta forma:
      "Total a pagar: R$ 384,89 (valor da transação de R$ 300,00 + R$ 2,01 de IOF
       + R$ 82,88 de juros) divididos em 6 parcelas de R$ 64,15."
  Ela repete valores que já estão na linha de cima. Use ela só para confirmar o número de
  parcelas e o valor da parcela da compra anterior, e NUNCA gere um item a partir dela.
  Se a explicação ocupa duas ou três linhas, continua sendo zero itens.
- Uma compra "4/10" significa que 3 parcelas já foram cobradas em faturas anteriores — mesmo assim extraia normalmente, o app cuida disso
- "Antecipada - Loja X - Parcela 6/6" é uma parcela que o banco puxou para esta fatura.
  MANTENHA a palavra "Antecipada" no começo do description: é por ela que o app sabe que
  essa parcela já foi cobrada e não deve cobrá-la de novo lá na frente.
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
  "Tecnologia", "Beleza", "Pets", "Presentes", "Viagem", "Impostos", "Academia",
  "Pix no crédito", "Tarifas e juros", "Compras online", "Telefone e Internet", "Serviços", "Outros",
  "Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada",
];

/** Last-resort routing so an unusable "Outros" does not poison the user's statistics. */
const CATEGORY_HINTS: [RegExp, string][] = [
  [/juros|multa|iof|anuidade|encargo|tarifa|seguro/, "Tarifas e juros"],
  [/\bpix\b|transferencia|ted\b|doc\b/, "Pix no crédito"],
  [/mercado\s?livre|mercadolivre|shopee|amazon|aliexpress|magalu|casas\s?bahia|shein|temu|americanas/, "Compras online"],
  [/vivo|claro|tim\b|oi\b|telefonica|internet/, "Telefone e Internet"],
  [/kiwify|hotmart|eduzz|saas|hospedagem|dominio/, "Serviços"],
  [/uber|99app|99\s?pop|taxi|posto|combustivel/, "Transporte"],
];

function refineCategory(category: string, description: string): string {
  if (category !== "Outros") return category;
  const text = normalize(description);
  return CATEGORY_HINTS.find(([re]) => re.test(text))?.[1] ?? "Outros";
}

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
  // a refund of a purchase IS kept (as a negative item); only the rotativo mirrors are dropped
  /^credito\s+de\s+(atraso|rotativo|divida|juros)/,
  /^juros\s+(de\s+)?(financiamento|parcelamento|divida)/,
  /^encerramento\s+de\s+divida/,
  // The other half of that pair. The signs swap from statement to statement, so excluding
  // only "Encerramento de dívida" let a lone credit through and the invoice came out short
  // by exactly its value. "Estorno de juros de rotativo" is a real credit and stays: this
  // only matches the one tied to a dívida.
  /^estorno\s+de\s+juros\s+d[ao]\s+divida/,
  /^iof\s+de\s+compras/,
  /^outros\s+lancamentos/,
  /^valor\s+(maximo|original)/,
  /^fechamento\s+da\s+proxima/,
  /^encargos\b/,
  // Anchored to the end on purpose. This is here for the limits block, which prints the
  // label by itself ("Pix no crédito ... R$ 3.600,00"). Unanchored it also threw away every
  // real "Pix no Crédito - FULANO - 2/6", which is how a screenshot of five transactions
  // came back with one.
  /^(saque|pix)\s+no\s+credito\s*$/,
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

// A full statement PDF regularly takes ~20s to read, and a long one more than that;
// the old 25s ceiling turned those into "a leitura está demorando mais que o normal".
/**
 * How long the whole read may take, shared between attempts.
 *
 * The thirteen page statement this was tuned against reads in about thirty seconds when
 * the service is healthy. What breaks it is not length: it is a run of 5xx from upstream,
 * and the old shape gave each model exactly one try, so a bad minute became "tente
 * novamente" with nothing retried. Attempts now alternate between the models and back off
 * between tries, for as long as the budget allows, because the second model lives on the
 * same service as the first and a moment later is often all it takes.
 */
const TOTAL_BUDGET_MS = 115_000;
const MIN_ATTEMPT_MS = 20_000;
const MAX_ATTEMPTS = 4;
/** Growing pauses, so a struggling service is not hammered. */
const BACKOFF_MS = [0, 2_000, 5_000, 9_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Worth trying again: overloaded, rate limited, timed out, or a model that moved. */
const isRetryable = (status: number) => status === 429 || status === 404 || status >= 500;

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  parts: GeminiPart[],
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

    const userTextInvoice = "Extraia todas as compras, encargos e estornos desta fatura, de todas as páginas e de todos os portadores. Estorno vai com valor negativo. Identifique parcelamentos, ignore pagamentos e saldos, e retorne o summary com os totais impressos.";
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
    const startedAt = Date.now();
    // What each attempt actually did, returned on failure. Without it a read that breaks on
    // someone else's machine is only ever "tente novamente", and there is nothing to act on.
    const attempts: Array<{ model: string; seconds: number; status?: number; message?: string }> = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const model = GEMINI_MODELS[attempt % GEMINI_MODELS.length];
      const pause = BACKOFF_MS[attempt] ?? 0;
      let left = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (left - pause < MIN_ATTEMPT_MS) break;
      if (pause) {
        await sleep(pause);
        left = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      }

      const attemptAt = Date.now();
      try {
        rawContent = await callGemini(GEMINI_API_KEY, model, systemPrompt, parts, left);
        attempts.push({ model, seconds: Math.round((Date.now() - attemptAt) / 1000) });
        lastError = null;
        break;
      } catch (err) {
        if (!(err instanceof GeminiError)) throw err;
        console.error(`Gemini ${model} failed: status=${err.status} ${err.message}`);
        attempts.push({
          model,
          seconds: Math.round((Date.now() - attemptAt) / 1000),
          status: err.status,
          message: String(err.message).slice(0, 200),
        });
        lastError = err;
        if (!isRetryable(err.status)) break;
      }
    }

    if (lastError) {
      if (lastError.status === 504 || lastError.status === 503) {
        return new Response(
          JSON.stringify({
            error: "A leitura está demorando mais que o normal. Tente novamente em instantes.",
            reason: "leitura_lenta",
            attempts,
          }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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
      return new Response(
        JSON.stringify({
          error: "Não foi possível processar a imagem. Tente com uma foto mais nítida.",
          reason: "sem_resposta",
          attempts,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jsonStart = rawContent.indexOf("{");
    const jsonEnd = rawContent.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) rawContent = rawContent.slice(jsonStart, jsonEnd + 1);

    rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: {
      items: any[];
      summary?: {
        total_a_pagar?: number;
        total_compras?: number;
        fatura_anterior?: number;
        pagamentos?: number;
        estornos_resumo?: number;
        outros_lancamentos?: number;
        fechamento_proxima_fatura?: number;
        saldo_aberto_total?: number;
        limite_total?: number;
        limite_utilizado?: number;
      };
    };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      throw new Error("Não foi possível interpretar o documento. Tente com uma imagem mais nítida.");
    }

    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("Nenhuma transação encontrada.");
    }

    /*
     * Everything the reader saw, before any line is judged. The import below still works
     * from the filtered list, so nothing changes for it; this array exists so the
     * reconciliation engine can decide for itself what a line means. It has to: a payment
     * is dropped by the filter, and the engine cannot report what was paid off a list that
     * has already had the payments taken out of it.
     */
    const rawEvents = parsed.items
      .filter((item: any) => item.description && Number.isFinite(Number(item.amount)))
      .map((item: any, i: number) => ({
        id: `ev_${i + 1}`,
        date: item.date || null,
        description: String(item.description),
        amount: Number(item.amount),
        installment_current: item.installment_current ? Number(item.installment_current) : null,
        installment_total: item.installment_total ? Number(item.installment_total) : null,
        financing: item.financing ?? null,
      }));

    const cleanedItems: ExtractedItem[] = parsed.items
      .filter((item: any) => item.description && Number(item.amount) && Number.isFinite(Number(item.amount)))
      .filter((item: any) => !isNonPurchase(String(item.description)))
      .map((item: any) => {
        const total = item.installment_total ? Number(item.installment_total) : null;
        const current = item.installment_current ? Number(item.installment_current) : null;
        // "1/1" is not a real instalment plan, and a current above the total is a misread
        const isPlan = !!total && total > 1 && !!current && current >= 1 && current <= total;
        const amount = Math.round(Number(item.amount) * 100) / 100;
        const description = cleanDescription(item.description);
        return {
          description,
          // refunds keep their negative sign so the imported total matches the statement
          amount,
          is_refund: amount < 0,
          date: item.date || null,
          installment_current: isPlan ? current : null,
          installment_total: isPlan ? total : null,
          category: refineCategory(normalizeCategory(item.category), description),
          type: item.type === "receita" ? "receita" : "despesa",
          confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
          merchant: item.merchant || null,
          time: item.time || null,
        };
      });



    const sumOf = (list: ExtractedItem[]) =>
      Math.round(list.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;

    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const summary = parsed.summary ?? {};
    const declaredTotal = Number(summary.total_a_pagar) || null;
    const declaredPurchases = Number(summary.total_compras) || null;
    const declaredNextInvoice = Number(summary.fechamento_proxima_fatura) || null;
    const declaredOutstanding = Number(summary.saldo_aberto_total) || null;
    const declaredCardLimit = Number(summary.limite_total) || null;
    const declaredUsedLimit = Number(summary.limite_utilizado) || null;

    // What the statement brought in from before this period: last month's bill and the
    // payment made against it.
    //
    // The summary's reversal line stays out. A statement prints it twice, once in the
    // summary ("Estorno de juros") and once in the detail ("Estorno de juros de rotativo"),
    // and the detail is already extracted as its own item. Adding it here as well credited
    // the same R$ 20,69 twice.
    const carried = num(summary.fatura_anterior) + num(summary.pagamentos);

    // What the extracted lines should add up to. The printed "Total a pagar" is NOT that
    // number — it is a balance, so it already carries last month's bill and subtracts the
    // payment. On a statement where more was paid than was owed, the period's purchases
    // legitimately come to far MORE than the total to pay, and treating that total as the
    // reference is what made a R$ 973,44 statement look like it had been read twice.
    // Taking the carry-over back out leaves the period's own movement.
    let expectedTotal: number | null = null;
    if (declaredTotal !== null) {
      expectedTotal = Math.round((declaredTotal - carried) * 100) / 100;
    } else if (declaredPurchases !== null) {
      expectedTotal = declaredPurchases;
    }

    // A double count can only ever push the sum ABOVE that reference, and only an exact
    // repeat is a candidate. Dropping repeats is allowed to stand only when it brings the
    // sum CLOSER: two identical coffees on the same day are real, and nothing here may
    // quietly delete them.
    let finalItems = cleanedItems;
    let deduped = 0;
    if (expectedTotal !== null && sumOf(cleanedItems) - expectedTotal > 0.5) {
      const seen = new Set<string>();
      const unique = cleanedItems.filter((i) => {
        const key = [i.description, i.amount, i.date, i.installment_current, i.installment_total].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const before = Math.abs(sumOf(cleanedItems) - expectedTotal);
      const after = Math.abs(sumOf(unique) - expectedTotal);
      if (unique.length < cleanedItems.length && after < before) {
        deduped = cleanedItems.length - unique.length;
        finalItems = unique;
      }
    }

    const extractedTotal = sumOf(finalItems);

    const hasInstallments = finalItems.some((i) => i.installment_total && i.installment_total > 1);
    const totalItems = finalItems.length;
    const installmentItems = finalItems.filter((i) => i.installment_total && i.installment_total > 1);
    const avgConfidence = finalItems.length > 0
      ? finalItems.reduce((sum, i) => sum + i.confidence, 0) / finalItems.length
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
        items: finalItems,
        message,
        total_items: totalItems,
        installment_items: installmentItems.length,
        avg_confidence: Math.round(avgConfidence * 100) / 100,
        extracted_total: extractedTotal,
        declared_total: declaredTotal,
        declared_purchases: declaredPurchases,
        /** What the lines should add up to: the printed total with the carry-over taken back out. */
        expected_total: expectedTotal,
        /* The statement's own checkpoints, so the review can prove the import against more
           than one number. A reading can land the current invoice and still be wrong about
           what is owed later. */
        declared_next_invoice: declaredNextInvoice,
        declared_outstanding: declaredOutstanding,
        declared_card_limit: declaredCardLimit,
        declared_used_limit: declaredUsedLimit,
        /** Which models ran and how long each took, so a slow read can be seen, not guessed. */
        attempts,
        /** Unfiltered, for the reconciliation engine. */
        raw_events: rawEvents,
        summary: {
          total_a_pagar: declaredTotal,
          total_compras: declaredPurchases,
          fatura_anterior: num(summary.fatura_anterior),
          pagamentos: num(summary.pagamentos),
          outros_lancamentos: num(summary.outros_lancamentos),
          fechamento_proxima_fatura: declaredNextInvoice,
          saldo_aberto_total: declaredOutstanding,
          limite_total: declaredCardLimit,
          limite_utilizado: declaredUsedLimit,
        },
        /** Last month's bill plus payments. Non-zero means "Total a pagar" is not the period's sum. */
        carried_over: Math.round(carried * 100) / 100,
        /** How many exact repeats were dropped to make the sum meet that reference. */
        deduped,
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
