import { isLight } from "~/theme/theme";

/**
 * The Willo Pass's own colours (Implementação 001, Pass V9), given outright for each theme —
 * not run through th(), so the light theme reads exactly as specified, R$ and titles included.
 */
export interface PassTheme {
  light: boolean;
  ground: string;
  text: string;
  muted: string;
  success: string;
  line: string;
  card: [string, string, string];
  cardBorder: string;
  cardShadow: number;
  shine: [string, string, string, string, string];
  done: { fill: string; ink: string };
  track: string;
  knob: string;
  knobInk: string;
}

export function passTheme(): PassTheme {
  const light = isLight();
  return light
    ? {
        light,
        ground: "#eaeaec",
        text: "#171719",
        muted: "#65656d",
        success: "#27865b",
        line: "rgba(0,0,0,0.082)",
        card: ["#ffffff", "#ededf0", "#fafafa"],
        cardBorder: "#ffffff",
        cardShadow: 0.0625,
        shine: ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0)", "rgba(255,255,255,0)"],
        done: { fill: "#171719", ink: "#ffffff" },
        track: "rgba(136,136,136,0.07)",
        knob: "#ffffff",
        knobInk: "#171719",
      }
    : {
        light,
        ground: "#121214",
        text: "#f5f5f7",
        muted: "#aaaab0",
        success: "#69c99d",
        line: "rgba(255,255,255,0.11)",
        card: ["#3c3c40", "#242426", "#2d2d30"],
        cardBorder: "rgba(255,255,255,0.19)",
        cardShadow: 0.2,
        shine: ["rgba(255,255,255,0)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0)", "rgba(255,255,255,0)"],
        done: { fill: "#f7f7f8", ink: "#171719" },
        track: "rgba(136,136,136,0.07)",
        knob: "#f5f5f7",
        knobInk: "#171719",
      };
}

export type PassKind = "despesa" | "receita" | "transferencia";

/** A small link under the Pass's actions: another entry, the transactions. */
export interface PassLink {
  icon: "novo" | "escanear" | "transacoes";
  label: string;
  onPress: () => void;
}

/** What a row of the review or of the Pass says; `bank` puts the institution's mark before the name. */
export interface PassRow {
  icon: "descricao" | "tipo-saida" | "tipo-entrada" | "tipo-transferencia" | "categoria" | "instituicao" | "pagamento" | "data" | "origem" | "destino";
  label: string;
  value: string;
  bank?: { name: string; hex: string };
  /** Under the value, smaller (Débito for an account). */
  sub?: string;
}

export interface PassData {
  kind: PassKind;
  amount: number;
  /** The shop, the person, or what it was. */
  title: string;
  /** For the category's own glyph beside the title. */
  category?: string | null;
  rows: PassRow[];
  /** The entry's real id, once written. */
  id?: string | null;
  /** When it was written, HH:MM. */
  time?: string | null;
}

export const PASS_TITLE: Record<PassKind, string> = {
  despesa: "Gasto registrado",
  receita: "Receita registrada",
  transferencia: "Transferência registrada",
};

export const KIND_LABEL: Record<PassKind, string> = { despesa: "Despesa", receita: "Receita", transferencia: "Transferência" };

/** The Willo's id for the entry: WL- and five characters of its real id. */
export const passId = (id?: string | null) => (id ? `WL-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}` : "");

/** 1234.5 → "1.234,50", no sign. */
export const passAmount = (v: number) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The amount's size, so it always fits on one line: 58 at most, 35 at least (clamp 35–58),
 * from how many characters it has against the room it gets ("R$ " at its smaller size counts).
 */
export function amountSize(amount: number, room: number, max = 58) {
  const chars = passAmount(amount).length + 3 * 0.68;
  return Math.round(Math.max(35, Math.min(max, room / (chars * 0.6))));
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "2026-11-23" → "23 de novembro de 2026". */
export function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[(m || 1) - 1]} de ${y}`;
}

/**
 * The lines of a review and of its Pass, from what the entry is — real data only:
 * despesa / receita: Tipo, Categoria, Instituição (with its mark), Pagamento or Recebimento, Data;
 * transferência: Tipo, Origem, Destino, Pagamento, Data.
 */
export function passRows(e: {
  kind: PassKind;
  category?: string | null;
  bank?: { name: string; hex: string } | null;
  /** conta (débito) or cartão (crédito). */
  method?: "conta" | "cartao";
  /** For a purchase in instalments: how many. */
  installments?: number | null;
  date: string;
  from?: { name: string; hex: string } | null;
  to?: { name: string; hex: string } | null;
}): PassRow[] {
  const date: PassRow = { icon: "data", label: "Data", value: longDate(e.date) };
  if (e.kind === "transferencia") {
    return [
      { icon: "tipo-transferencia", label: "Tipo", value: KIND_LABEL.transferencia },
      { icon: "origem", label: "Origem", value: e.from?.name ?? "—", bank: e.from ?? undefined },
      { icon: "destino", label: "Destino", value: e.to?.name ?? "—", bank: e.to ?? undefined },
      { icon: "pagamento", label: "Pagamento", value: "Entre contas" },
      date,
    ];
  }
  const income = e.kind === "receita";
  const pay = income ? "Na conta" : e.method === "cartao" ? (e.installments && e.installments > 1 ? `Crédito · ${e.installments}x` : "Crédito") : "Débito";
  return [
    { icon: income ? "tipo-entrada" : "tipo-saida", label: "Tipo", value: KIND_LABEL[e.kind] },
    { icon: "categoria", label: "Categoria", value: e.category || "Outros" },
    { icon: "instituicao", label: "Instituição", value: e.bank?.name ?? "—", bank: e.bank ?? undefined },
    { icon: "pagamento", label: income ? "Recebimento" : "Pagamento", value: pay },
    date,
  ];
}

/** The time of day now, HH:MM, for an entry written just now. */
export const nowTime = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
