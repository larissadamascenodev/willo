/** 123456 centavos → "1.234,56". */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "2026-10-02" (a data do dia local, não UTC). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-02" → Date ao meio-dia local (evita virar o dia anterior por fuso). */
export function fromDateKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}
