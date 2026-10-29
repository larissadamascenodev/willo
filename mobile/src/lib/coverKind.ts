/**
 * What a caixinha is for, read from its name.
 *
 * Nothing is stored for this: a caixinha called "Viagem dos Sonhos" or "Férias no Japão"
 * is a trip because of what it says, the same way it has always chosen its colour. The
 * order matters — "Reformar a casa" is a renovation before it is a house.
 */

export type CoverKind =
  | "viagem"
  | "reserva"
  | "reforma"
  | "casa"
  | "carro"
  | "carreira"
  | "consumo"
  | "educacao";

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const RULES: [RegExp, CoverKind][] = [
  [/reserva|emergencia|imprevisto/, "reserva"],
  [/reform|\bobra|decorac/, "reforma"],
  [/viag|viaj|ferias|passagem|intercambio|cruzeiro|lua de mel|japao|europa|disney/, "viagem"],
  [/\bcarro|\bmoto\b|veiculo|automovel/, "carro"],
  [/carreira|profiss|promocao|negocio|empresa|startup|empreend/, "carreira"],
  [/sonho de consumo|consumo|desejo|iphone|macbook|notebook|playstation/, "consumo"],
  [/faculdade|\bcurso|estudo|educac|\bmba\b|pos-?gradua|escola|idioma|ingles/, "educacao"],
  [/\bcasa\b|apartamento|apto|imovel|mudanca|financiamento|moradia/, "casa"],
];

export function coverKind(name: string): CoverKind | null {
  const n = plain(name);
  return RULES.find(([re]) => re.test(n))?.[1] ?? null;
}

/** The kinds the creation flow offers, in the order it shows them. */
export const KIND_ORDER: CoverKind[] = ["reserva", "viagem", "reforma", "carreira", "consumo", "carro", "casa", "educacao"];
