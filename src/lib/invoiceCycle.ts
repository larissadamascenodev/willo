/**
 * Where a card is in its cycle, in words.
 *
 * Open until it closes, then due until it is paid, then overdue — the same three
 * states a statement has, read off the card's own closing and due days. It is
 * arithmetic over two numbers and a date, with nothing on screen in it, so both apps
 * ask it rather than each deciding for itself when a card "closes tomorrow".
 */

export interface CreditCardItem {
  id: string;
  name: string;
  limit: number;
  used_limit: number;
  closing_day: number;
  due_day: number;
  color: string | null;
  last_four_digits: string | null;
}

export interface OpenInvoiceInfo {
  amount: number;
  month: number;
  year: number;
  isPaid: boolean;
}

/**
 * Where an invoice stands, counted in days rather than stated as a date.
 *
 * One countdown at a time, and always the one you can still act on: while the invoice
 * is open the question is how long you have left to put things on it, and the moment
 * it closes the question becomes when it has to be paid. A date on its own — "fecha
 * dia 6" — makes you do that arithmetic yourself, every time you look.
 */
export function getInvoiceStatusLabel(card: CreditCardItem, invoiceInfo?: OpenInvoiceInfo): { label: string; isClosed: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayIn = (y: number, m: number, d: number) =>
    new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate()));
  const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const plural = (n: number) => `${n} dia${n === 1 ? "" : "s"}`;

  const year = invoiceInfo?.year ?? today.getFullYear();
  const month = invoiceInfo?.month ?? today.getMonth() + 1;

  const closing = dayIn(year, month, card.closing_day);
  let due = dayIn(year, month, card.due_day);
  // A card that closes late in the month comes due in the next one.
  if (due <= closing) due = dayIn(year, month + 1, card.due_day);

  if (invoiceInfo?.isPaid) return { label: "Fatura paga", isClosed: false };

  const toClose = days(closing);
  if (toClose > 0) {
    return {
      label: toClose === 1 ? "Fecha amanhã" : `Fecha em ${plural(toClose)}`,
      isClosed: false,
    };
  }

  const toDue = days(due);
  if (toDue < 0) return { label: `Venceu há ${plural(Math.abs(toDue))}`, isClosed: true };
  if (toDue === 0) return { label: "Vence hoje", isClosed: true };
  if (toDue === 1) return { label: "Vence amanhã", isClosed: true };
  return { label: `Vence em ${plural(toDue)}`, isClosed: true };
}
