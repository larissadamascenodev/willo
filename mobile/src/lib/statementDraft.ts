import type { PickedStatement } from "~/lib/pickStatement";

/**
 * The statement file picked on a card, handed to the screen that reads it.
 *
 * A file is not something a route can carry in its address, so it waits here for the
 * import screen, which takes it once and clears it.
 */

export interface StatementDraft {
  picked: PickedStatement;
  card: { id: string; dueDay: number; name: string };
  month: number;
  year: number;
}

let draft: StatementDraft | null = null;

export function leaveStatement(next: StatementDraft) {
  draft = next;
}

export function takeStatement(): StatementDraft | null {
  const out = draft;
  draft = null;
  return out;
}
