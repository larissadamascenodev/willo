/**
 * Depoimentos de pessoas reais que usam o Willo.
 *
 * Esta lista nasce vazia de propósito, e a tela que a lê não aparece enquanto ela
 * estiver assim. Depoimento inventado num app de dinheiro é propaganda enganosa (CDC,
 * art. 37) e queima a confiança que o resto do onboarding passa 22 telas construindo —
 * então o lugar certo para resolver isso é aqui, com texto que alguém escreveu de
 * verdade e autorizou.
 *
 * Para publicar um:
 *   1. Tenha a autorização de uso por escrito.
 *   2. Use o primeiro nome e a inicial do sobrenome, como a pessoa preferir.
 *   3. Não edite o sentido do que ela disse. Cortar é ok; reescrever não.
 *   4. `foto` é opcional: sem foto a tela desenha as iniciais, e isso é melhor do que
 *      uma foto de banco de imagens.
 *
 * O mesmo vale para qualquer contagem de usuários: só entra número que você consiga
 * provar.
 */

export interface Depoimento {
  /** Como a pessoa quer ser identificada, por exemplo "Larissa D.". */
  nome: string;
  /** O que ela disse, nas palavras dela. */
  texto: string;
  /** De 1 a 5, se houver avaliação. Deixe de fora quando não houver. */
  estrelas?: number;
  /** URL de uma foto que ela autorizou. Sem isso, a tela usa as iniciais. */
  foto?: string;
}

export const DEPOIMENTOS: Depoimento[] = [];

/**
 * Quantas pessoas usam o Willo, se e quando esse número for verificável. Null mantém a
 * linha fora da tela — melhor nada do que um número redondo que ninguém conferiu.
 */
export const PESSOAS_USANDO: number | null = null;

/** Nada a mostrar enquanto ninguém real tiver dito nada: o fluxo pula a tela. */
export const temDepoimentos = () => DEPOIMENTOS.length > 0;
