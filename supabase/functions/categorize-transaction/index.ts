import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Anthropic from "npm:@anthropic-ai/sdk";

/**
 * Puts a transaction in its category, the way a bank app does with what Open Finance
 * reports — except that here the person typed it, so all there is to go on is what they
 * wrote ("Uber 25", "iFood", "Shell"), the amount and whether money came in or went out.
 *
 * The phone sends one entry while it is being typed, to suggest a category the person
 * then confirms, or a batch of older ones to file under the new list. Claude answers by
 * filling a tool whose every category is one of the list's own names, so nothing comes
 * back that the app cannot show.
 *
 * The list is the phone's (mobile/src/lib/taxonomy.ts), copied here; when one changes the
 * other has to.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TAXONOMY: { group: string; type: "despesa" | "receita"; categories: string[] }[] = [
  { group: "Alimentação", type: "despesa", categories: ["Supermercado", "Alimentos e bebidas", "Restaurantes, bares e lanchonetes", "Delivery de alimentos"] },
  { group: "Compras", type: "despesa", categories: ["Compras", "Compras online", "Eletrônicos", "Pet Shops e veterinários", "Vestuário", "Artigos infantis", "Livraria", "Artigos esportivos", "Papelaria", "Cashback"] },
  { group: "Saúde e bem-estar", type: "despesa", categories: ["Saúde", "Saúde e bem-estar", "Academia e centros de lazer", "Prática de esportes", "Bem-estar", "Dentista", "Farmácia", "Ótica", "Hospitais, clínicas e laboratórios"] },
  { group: "Transporte", type: "despesa", categories: ["Transporte", "Táxi e transporte privado urbano", "Transporte público", "Aluguel de veículos", "Aluguel de bicicletas", "Serviços automotivos", "Postos de gasolina", "Estacionamentos", "Pedágios e pagamentos no veículo", "Taxas e impostos sobre veículos", "Manutenção de veículos", "Multas de trânsito"] },
  { group: "Moradia", type: "despesa", categories: ["Moradia", "Aluguel", "Condomínio", "Serviços de utilidade pública", "Água", "Eletricidade", "Gás", "Utensílios para casa", "Impostos sobre moradia", "Telecomunicação", "Internet", "Celular", "TV"] },
  { group: "Lazer e entretenimento", type: "despesa", categories: ["Lazer", "Viagens", "Aeroportos e cias. aéreas", "Hospedagem", "Assinaturas e streaming", "Programas de milhagem", "Passagem de ônibus", "Bilhetes", "Estádios e arenas", "Museus e pontos turísticos", "Cinema, Teatro e Concertos"] },
  { group: "Educação", type: "despesa", categories: ["Educação", "Escola e faculdade", "Cursos", "Material escolar"] },
  { group: "Finanças", type: "despesa", categories: ["Investimentos", "Investimento automático", "Renda fixa", "Fundos multimercado", "Renda variável", "Ajuste de margem", "Juros de rendimentos de dividendos", "Previdência privada", "Pensão", "Transferência mesma titularidade", "Transferência mesma titularidade - Dinheiro", "Transferência mesma titularidade - PIX", "Transferência mesma titularidade - TED", "Transferências", "Transferência - Boleto bancário", "Transferência - Dinheiro", "Transferência - Cheque", "Transferências - DOC", "Transferência - Câmbio", "Transferência - Mesma instituição", "Transferência - PIX", "Transferência - TED", "Transferências para terceiros", "Transferência para terceiros - Boleto bancário", "Transferência para terceiros - Débito", "Transferência para terceiros - DOC", "Transferência para terceiros - PIX", "Transferência para terceiros - TED", "Pagamento de cartão de crédito", "Parcelamento de fatura", "Empréstimos e financiamento", "Atraso no pagamento e custos de cheque especial", "Juros cobrados", "Financiamento", "Financiamento imobiliário", "Financiamento de veículos", "Empréstimo estudantil", "Empréstimos", "Obrigações legais", "Impostos", "Seguros", "Tarifas bancárias", "Saldo bloqueado", "Pensão alimentícia"] },
  { group: "Apostas e jogos", type: "despesa", categories: ["Apostas", "Loteria", "Apostas online"] },
  { group: "Doações", type: "despesa", categories: ["Doações"] },
  { group: "Outros", type: "despesa", categories: ["Outros", "Serviços", "Estorno"] },
  { group: "Receitas", type: "receita", categories: ["Salário", "Freelance", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada", "Rendimentos", "Investimentos", "Reembolso", "Cashback", "Transferências recebidas", "Outras receitas"] },
];

const namesFor = (type: "despesa" | "receita") => TAXONOMY.filter((g) => g.type === type).flatMap((g) => g.categories);
const listFor = (type: "despesa" | "receita") =>
  TAXONOMY.filter((g) => g.type === type)
    .map((g) => `${g.group}: ${g.categories.join(" | ")}`)
    .join("\n");

const MAX_ITEMS = 60;

const SYSTEM = `Você categoriza lançamentos financeiros de pessoas no Brasil, como um app de banco faz com o Open Finance.
Cada lançamento tem só o nome que a pessoa digitou, o valor em reais e se é despesa ou receita.
Escolha para cada um a categoria mais específica da lista do tipo dele. Use o que o nome diz: marcas e lugares conhecidos (Uber e 99 são táxi e transporte privado; iFood e Rappi são delivery; Shell, Ipiranga e BR são postos; Netflix e Spotify são assinaturas e streaming; Drogasil e Raia são farmácia), palavras como "aluguel", "luz", "fatura", "pix".
Um Pix ou transferência para uma pessoa sem outra pista é "Transferências para terceiros - PIX". Pagamento de fatura de cartão é "Pagamento de cartão de crédito".
Se o nome não der nenhuma pista, use "Outros" para despesa e "Outras receitas" para receita. Nunca invente uma categoria fora da lista.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "not_configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const items = (Array.isArray(body?.items) ? body.items : [])
      .slice(0, MAX_ITEMS)
      .map((it: any, i: number) => ({
        i,
        name: String(it?.name ?? "").slice(0, 120),
        amount: Number(it?.amount) || 0,
        type: it?.type === "receita" ? "receita" : "despesa",
      }))
      .filter((it: any) => it.name.trim().length > 0);
    if (items.length === 0) return json({ results: [] });

    const allNames = [...new Set([...namesFor("despesa"), ...namesFor("receita")])];
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: `# Categorias de despesa
${listFor("despesa")}

# Categorias de receita
${listFor("receita")}`, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "categorizar",
          description: "Registra a categoria escolhida para cada lançamento, pelo índice i.",
          input_schema: {
            type: "object",
            properties: {
              resultados: {
                type: "array",
                items: {
                  type: "object",
                  properties: { i: { type: "integer" }, categoria: { type: "string", enum: allNames } },
                  required: ["i", "categoria"],
                },
              },
            },
            required: ["resultados"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "categorizar" },
      messages: [
        {
          role: "user",
          content: items.map((it: any) => `${it.i}. [${it.type}] ${it.name} — R$ ${it.amount.toFixed(2)}`).join("\n"),
        },
      ],
    });

    const call = response.content.find((b) => b.type === "tool_use");
    const picked = new Map<number, string>();
    for (const r of ((call as any)?.input?.resultados ?? []) as { i: number; categoria: string }[]) {
      picked.set(Number(r.i), String(r.categoria));
    }

    /* Only a name of the entry's own kind is kept; anything else falls back. */
    const results = items.map((it: any) => {
      const own = namesFor(it.type);
      const cat = picked.get(it.i);
      return { i: it.i, category: cat && own.includes(cat) ? cat : it.type === "receita" ? "Outras receitas" : "Outros" };
    });
    return json({ results });
  } catch (e) {
    console.error("categorize-transaction", e instanceof Error ? e.message : e);
    return json({ error: "unexpected" }, 500);
  }
});
