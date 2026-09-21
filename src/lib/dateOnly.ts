/**
 * `new Date("YYYY-MM-DD")` parses the string as UTC midnight, so reading it back
 * with `.getDate()/.getMonth()/.getFullYear()` in a timezone behind UTC (e.g. Brazil,
 * UTC-3) rolls it back to the previous local day — turning "2026-09-01" into Aug 31.
 * These helpers read the components straight from the string instead.
 */
export function dayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

export function parseDateOnly(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month: month - 1, day };
}
