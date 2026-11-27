/**
 * A category for a shop's name, the way the app guesses one (src/lib/quickEntry/parseLocal.ts):
 * what the person filed before under the same name, then words that leave no doubt. Nothing
 * certain is null — the card then says nothing, and confirming files it under Outros.
 */

import { plain } from "./notice.ts";

const KEYWORDS: Record<string, string[]> = {
  "Compras online": ["mercado livre", "mercadolivre", "shopee", "amazon", "shein", "magalu", "magazine luiza", "aliexpress", "americanas", "casas bahia", "temu"],
  Transporte: ["uber", "uber trip", "99", "99 pop", "taxi", "onibus", "metro", "cabify", "indrive"],
  Combustível: ["gasolina", "combustivel", "etanol", "posto", "diesel", "shell", "ipiranga", "petrobras", "br mania"],
  Supermercado: ["mercado", "supermercado", "atacadao", "assai", "carrefour", "feira", "hortifruti", "pao de acucar", "extra", "dia", "oxxo", "st marche", "zaffari", "guanabara", "mambo", "sams club", "makro"],
  Restaurante: ["restaurante", "rodizio", "lanche", "lanchonete", "pizza", "pizzaria", "hamburguer", "hamburgueria", "sushi", "acai", "sorvete", "sorveteria", "churrascaria", "pastel", "mcdonalds", "mc donalds", "burger king", "outback", "subway", "bobs", "habibs", "madero", "coco bambu"],
  Delivery: ["ifood", "delivery", "rappi", "ze delivery", "aiqfome"],
  Cafeteria: ["cafe", "cafeteria", "starbucks", "padaria", "panificadora", "confeitaria"],
  Farmácia: ["farmacia", "drogaria", "droga raia", "drogasil", "raia", "pague menos", "panvel"],
  Streaming: ["netflix", "spotify", "disney", "prime video", "hbo", "youtube premium", "globoplay", "deezer"],
  Academia: ["academia", "smartfit", "smart fit", "crossfit", "pilates"],
  Estacionamento: ["estacionamento", "zona azul", "valet", "estapar"],
  Pets: ["petshop", "pet shop", "petz", "cobasi", "veterinario"],
};

export async function guessCategory(
  name: string,
  /* The person's own last entry under this name, if any. */
  history: () => Promise<string | null>,
): Promise<string | null> {
  const before = await history().catch(() => null);
  if (before) return before;
  const key = plain(name).trim();
  for (const [category, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => key === w || key.startsWith(`${w} `) || key.endsWith(` ${w}`) || key.includes(` ${w} `))) return category;
  }
  return null;
}
