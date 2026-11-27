/**
 * Reading a bank's notification — "Compra no débito aprovada: R$ 21,00 em PADARIA DOCE LAR",
 * "Você recebeu um Pix de R$ 150,00 de MARIA SILVA" — into a purchase or an income.
 *
 * Only money that moved is read: a purchase, a Pix or transfer sent or received, a
 * withdrawal. Anything else a bank says (an invoice closing, a limit raised, an offer)
 * comes back null and is left alone. Kept free of Deno so it can be tested anywhere.
 */

export interface Notice {
  amount: number;
  type: "despesa" | "receita";
  /** "conta" for debit, Pix and transfers; "cartao" for credit; null when it does not say. */
  method: "conta" | "cartao" | null;
  name: string;
}

export const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "R$ 1.234,56", "1234.56", "12,9" — as a number. */
export function amountOf(raw: unknown): number {
  if (typeof raw === "number") return Math.abs(raw);
  const s = String(raw ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const normal = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  return Math.abs(Number(normal)) || 0;
}

const MOVED = /(compra|pagamento|pagou|gastou|debitad|transacao|enviou|transferiu|pix|transfer|ted\b|doc\b|debito|credito|recebeu|recebid|aprovad|enviad|saque|deposito)/;
const NOT_MOVED = /(fatura (fechou|fechada|disponivel|vence)|limite|cupom|desconto|resgate|ganhe|black friday|\boff\b|aproveite|convite|indique|sorteio|promo|tentamos te enviar|ocorreu um erro|vence (hoje|amanha|em)|lembrete|oferta|promoc|cashback|rendeu|rendimento|investimento|boleto disponivel|nao aprovad|recusad|negad|estornad|cancelad)/;
const OUT = /(sua transferencia foi (enviada|realizada|concluida)|transferencia enviada|pix enviado|voce enviou|voce transferiu)/;
const INCOME = /(voce depositou|depositou r\$|ja esta disponivel|esta rendendo na sua conta|rendendo na sua conta|voce recebeu|recebeu (um|uma|r\$)|pix recebido|transferencia recebida|deposito recebido|caiu na sua conta|recebido de|entrou na sua conta)/;
const STOP = "(?:foi|com|no|na|nos|nas|pelo|pela|via|para|as|às|ao|em|e|do cartao|cartao|final|hoje|agora)";

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());

function after(text: string, word: string): string | null {
  const re = new RegExp(`\\b${word}\\s+([A-Za-zÀ-ÿ0-9*&'][^\\n.,!;:]*?)(?=\\s+${STOP}\\b|[.,!;:\\n]|$)`, "i");
  const m = re.exec(text);
  const v = m?.[1]?.trim();
  return v && v.length >= 2 && !/^r\$/i.test(v) ? v : null;
}

export function readNotice(text: string, app?: string | null): Notice | null {
  /* Inside a name in capitals the "E" belongs to it ("EMPREENDIMENTOS E BEBIDAS"): held aside so
     the name is not cut there as it would be at "R$ 10 em X e ...". */
  const t = String(text ?? "").replace(/([A-ZÀ-Ý]{2,}) E (?=[A-ZÀ-Ý]{2,})/g, "$1  ");
  const p = plain(t);
  if (!MOVED.test(p) || NOT_MOVED.test(p)) return null;

  const m = /R\$\s*-?\d(?:[\d.,]*\d)?/.exec(t) ?? /\d+[.,]\d{2}\b/.exec(t);
  const amount = m ? amountOf(m[0]) : 0;
  if (!(amount > 0)) return null;

  /* Money in, unless the notice says it went out ("Pix enviado", "Você transferiu"). "Recebemos sua
     transferência" (Nubank) is money the person sent in to themselves: in. */
  const income = (INCOME.test(p) || /recebemos sua transferencia/.test(p)) && !OUT.test(p);
  const method: Notice["method"] = income || /(debito|pix|transfer|ted\b|doc\b|saque)/.test(p) ? "conta" : /credito/.test(p) ? "cartao" : null;

  /* Who: "em PADARIA X" for a purchase, "de MARIA" for money received, "para JOÃO" for money sent. */
  const rest = m ? t.slice(m.index + m[0].length) : t;
  const who = income
    ? (after(rest, "de") ?? after(t, "de"))
    : (after(rest, "em") ?? after(t, "em") ?? after(rest, "para") ?? after(t, "para"));

  const fallback = income
    ? /pix/.test(p)
      ? "Pix recebido"
      : "Transferência recebida"
    : /pix/.test(p)
      ? "Pix enviado"
      : /transfer/.test(p)
        ? "Transferência enviada"
      : /saque/.test(p)
        ? "Saque"
        : method === "cartao"
          ? "Compra no crédito"
          : "Compra no débito";
  const name = who ? titleCase(who).replace(//g, "e").slice(0, 60) : app ? `${fallback} · ${app}` : fallback;
  return { amount, type: income ? "receita" : "despesa", method, name };
}
