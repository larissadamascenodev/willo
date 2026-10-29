/**
 * The banks the app knows by face.
 *
 * The shared list in the web app only carries a colour and a name; this one adds the
 * bank's mark, because on the phone a card or an account is picked out of a list by
 * its logo before its name is read. A bank here with no `logo` still has a colour and
 * gets a lettered tile — better a plain tile than a blurred or wrong logo.
 *
 * `bleed` says the image already fills a square (it brings its own background), so it
 * is shown edge to edge; one that does not sits on white with room around it.
 */

export interface CatalogBank {
  id: string;
  name: string;
  /** The brand colour: for bars, tiles without a logo, and the accent of the account. */
  hex: string;
  match: RegExp;
  logo?: number;
  bleed?: boolean;
}

/* The ones shown first, in the order people look for them. */
export const CATALOG: CatalogBank[] = [
  { id: "nubank", name: "Nubank", hex: "#8A05BE", match: /nubank|\bnu\b/i, logo: require("../../assets/banks/nubank.png"), bleed: true },
  { id: "itau", name: "Itaú", hex: "#EC7000", match: /ita[uú]/i, logo: require("../../assets/banks/itau.png"), bleed: true },
  { id: "bradesco", name: "Bradesco", hex: "#CC092F", match: /bradesco/i },
  { id: "santander", name: "Santander", hex: "#EC0000", match: /santander/i, logo: require("../../assets/banks/santander.png") },
  { id: "inter", name: "Inter", hex: "#FF7A00", match: /\binter\b/i, logo: require("../../assets/banks/inter.png"), bleed: true },
  { id: "caixa", name: "Caixa", hex: "#005CA9", match: /caixa/i },
  { id: "bb", name: "Banco do Brasil", hex: "#FCD116", match: /banco do brasil|\bbb\b/i, logo: require("../../assets/banks/bb.png") },
  { id: "c6", name: "C6 Bank", hex: "#242424", match: /\bc6\b/i, logo: require("../../assets/banks/c6.png"), bleed: true },
  { id: "mercadopago", name: "Mercado Pago", hex: "#00B1EA", match: /mercado ?pago/i, logo: require("../../assets/banks/mercadopago.png"), bleed: true },
  { id: "picpay", name: "PicPay", hex: "#11C76F", match: /picpay/i, logo: require("../../assets/banks/picpay.png"), bleed: true },
  { id: "btg", name: "BTG Pactual", hex: "#0A2B6B", match: /\bbtg\b/i, logo: require("../../assets/banks/btg.png") },
  { id: "pagbank", name: "PagBank", hex: "#14B14B", match: /pagbank|pagseguro/i, logo: require("../../assets/banks/pagbank.png") },
  { id: "neon", name: "Neon", hex: "#0AAEE9", match: /\bneon\b/i, logo: require("../../assets/banks/neon.png") },
  { id: "pan", name: "Banco Pan", hex: "#0AA5F0", match: /\bpan\b|banco pan/i, logo: require("../../assets/banks/pan.png"), bleed: true },
  { id: "safra", name: "Safra", hex: "#0B1F4B", match: /safra/i, logo: require("../../assets/banks/safra.png") },
  { id: "sicoob", name: "Sicoob", hex: "#00A39A", match: /sicoob/i, logo: require("../../assets/banks/sicoob.png"), bleed: true },
  { id: "nomad", name: "Nomad", hex: "#FFD000", match: /\bnomad\b/i, logo: require("../../assets/banks/nomad.png"), bleed: true },
  { id: "revolut", name: "Revolut", hex: "#191C1F", match: /revolut/i, logo: require("../../assets/banks/revolut.png"), bleed: true },
  { id: "wise", name: "Wise", hex: "#9FE870", match: /\bwise\b/i, logo: require("../../assets/banks/wise.png"), bleed: true },
  { id: "rico", name: "Rico", hex: "#FF5A00", match: /\brico\b/i, logo: require("../../assets/banks/rico.png") },
];

/** The first twelve, which is what fits on a screen of tiles. */
export const POPULAR = CATALOG.slice(0, 11);

export const catalogFor = (name: string) => CATALOG.find((b) => b.match.test(name));
