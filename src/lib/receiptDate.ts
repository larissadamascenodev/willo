/**
 * The date on a receipt, resolved to the one it can actually mean.
 *
 * Receipts print "09 OUT" far more often than they print a year, and the reader has to
 * put one in. When it guesses wrong the row does not look wrong — it looks like any
 * other row — and it quietly lands in a credit card invoice two years old, where it
 * changes no balance, refunds no limit and appears on no screen. That is how three
 * estornos were filed under November 2024.
 *
 * So a year far enough in the past is treated as the misread it almost certainly is:
 * someone photographing a receipt is not photographing one from two years ago. The day
 * and month are kept, because those are what the paper actually printed, and the year
 * moves to the most recent one that does not put the date in the future.
 *
 * A genuinely old receipt typed in by hand is untouched — this only sees what the
 * reader produced.
 */

/** Beyond this, a date is read as a wrong year rather than as old paper. */
const STALE_MONTHS = 13;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function resolveReceiptDate(
  raw: string | null | undefined,
  today: Date = new Date(),
): string {
  const fallback = iso(today);
  if (!raw) return fallback;

  const parsed = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;

  // A date ahead of today is a misread with nothing to salvage.
  if (parsed > today) return fallback;

  const monthsBack =
    (today.getFullYear() - parsed.getFullYear()) * 12 + (today.getMonth() - parsed.getMonth());
  if (monthsBack <= STALE_MONTHS) return raw.slice(0, 10);

  // Keep the day and month the paper printed; find the closest year that works.
  const candidate = new Date(parsed);
  candidate.setFullYear(today.getFullYear());
  if (candidate > today) candidate.setFullYear(today.getFullYear() - 1);
  return iso(candidate);
}
