/**
 * A change shown before the database has answered.
 *
 * Deleting or editing an entry takes a few round trips (a fixed entry is excluded and
 * a new one written; an instalment hands its purchase on), and the list used to wait
 * for all of them and then for a reload. Now the screen that made the change says so
 * at once, the list shows it at once, and the work goes on behind. While it does, the
 * list keeps showing the change over whatever half-finished state a reload reads;
 * when the work is done the change is settled and the list is read again.
 */

export type OptimisticChange =
  | { id: string; removed: true }
  | { id: string; row: Record<string, unknown> & { id: string; date: string } };

const SHOW = "transaction-optimistic";
const SETTLE = "transaction-settled";

export function showNow(change: OptimisticChange) {
  window.dispatchEvent(new CustomEvent(SHOW, { detail: change }));
}

export function settle(id: string) {
  window.dispatchEvent(new CustomEvent(SETTLE, { detail: { id } }));
}

/** Runs the work behind a change already shown; whatever happens, the change is settled. */
export async function behind(id: string, work: () => Promise<unknown>, onError: (e: unknown) => void) {
  try {
    await work();
  } catch (e) {
    onError(e);
  } finally {
    settle(id);
  }
}

export function listenOptimistic(onShow: (c: OptimisticChange) => void, onSettle: (id: string) => void) {
  const show = (e: unknown) => onShow((e as { detail: OptimisticChange }).detail);
  const done = (e: unknown) => onSettle((e as { detail: { id: string } }).detail.id);
  window.addEventListener(SHOW, show as never);
  window.addEventListener(SETTLE, done as never);
  return () => {
    window.removeEventListener(SHOW, show as never);
    window.removeEventListener(SETTLE, done as never);
  };
}

/** The list as loaded, with the changes still on their way laid over it. */
export function overlay<T extends { id: string; date: string }>(rows: T[], changes: Map<string, OptimisticChange>, inMonth: (date: string) => boolean): T[] {
  if (changes.size === 0) return rows;
  const out: T[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const c = changes.get(r.id);
    seen.add(r.id);
    if (!c) out.push(r);
    else if ("row" in c) {
      const merged = { ...r, ...c.row } as T;
      if (inMonth(merged.date)) out.push(merged);
    }
  }
  for (const [id, c] of changes) if (!seen.has(id) && "row" in c && inMonth(c.row.date)) out.push(c.row as unknown as T);
  return out;
}
