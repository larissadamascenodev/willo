/**
 * Whether what was said is conversation rather than something to write down.
 *
 * Told apart on the phone, with no AI: asking the reader first added two seconds to every
 * question, and a question with a number in it ("posso comprar algo de 500?") was read as
 * an expense of 500.
 */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ASKING =
  /^(qual|quais|quanto|quantos|quantas|quando|onde|quem|como|cade|porque|por que|pq|o que|oq|sera|posso|devo|consigo|tenho|pode|da pra|da para|vale (a pena|mais|comprar)|me (da|de|diz|diga|fala|explica|ajuda|mostra|conta|passa|sugere|sugira|ensina|lembra|lembre|avisa|avise)|conta (uma|um|pra|para|como|sobre)|fala|explica|resume|resuma|traduz|traduza|escreve|escreva|faz|faca|compara|compare|calcula|calcule|sugere|sugira|mostra|mostre|cria|crie|criar|define|defina|coloca|coloque|lembrete|limite|oi|ola|e ai|bom dia|boa tarde|boa noite|obrigad|valeu|tudo bem)\b/;

const MONEY_WORD =
  /\b(dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil|reais|real|conto|contos|pila)\b/;

/** Worded as a question or a request, whatever numbers are in it. */
export function isAsking(said: string): boolean {
  const q = plain(said);
  return q.endsWith("?") || ASKING.test(q);
}

/** Nothing here could be an entry: no asking the reader, straight to the conversation. */
export function isConversation(said: string): boolean {
  const q = plain(said);
  return isAsking(q) || !(/\d/.test(q) || MONEY_WORD.test(q));
}
