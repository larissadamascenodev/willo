/** O cartão como a tela de Cartões o usa. */
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

export function getInvoiceStatusLabel(card: CreditCardItem, invoiceInfo?: OpenInvoiceInfo): { label: string; isClosed: boolean } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // If the invoice shown is for a future month (current month already paid), show closing date
  if (invoiceInfo && (invoiceInfo.month > currentMonth || invoiceInfo.year > currentYear || invoiceInfo.isPaid)) {
    const closingDay = card.closing_day;
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthLabel = monthNames[(invoiceInfo.month - 1) % 12];
    return { label: `Fecha dia ${closingDay} de ${monthLabel}`, isClosed: false };
  }

  const today = now.getDate();
  const closingDay = card.closing_day;
  const dueDay = card.due_day;

  if (today >= closingDay) {
    let dueDate: Date;
    if (dueDay > closingDay) {
      dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    } else {
      dueDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `Venceu há ${Math.abs(diffDays)} dias`, isClosed: true };
    if (diffDays === 0) return { label: "Vence hoje", isClosed: true };
    if (diffDays === 1) return { label: "Vence amanhã", isClosed: true };
    return { label: `Vence em ${diffDays} dias`, isClosed: true };
  }

  const daysUntilClose = closingDay - today;
  return { label: `Fecha em ${daysUntilClose} dia${daysUntilClose > 1 ? "s" : ""}`, isClosed: false };
}
