/**
 * Centavos printed as reais.
 *
 * Apart from the components so that wanting a formatted amount does not drag a React
 * component into the module asking for it — the same split the category icons use.
 */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** The flow holds integers; these are the only things that print them. */
export const brl = (centavos: number) => BRL.format(centavos / 100);
export const brl0 = (centavos: number) => BRL0.format(Math.round(centavos / 100));
