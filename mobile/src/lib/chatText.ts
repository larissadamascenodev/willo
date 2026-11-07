/**
 * How Willo's words reach the conversation: in short messages rather than a wall of text,
 * and written out at a pace you can watch, stopping a moment where a person would.
 */

const MOST = 170;

/** A reply in messages: its paragraphs, and the long ones by sentence. A list stays whole. */
export function splitReply(reply: string): string[] {
  const parts: string[] = [];
  for (const paragraph of reply.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (paragraph.length <= MOST || /^\s*•/m.test(paragraph)) {
      parts.push(paragraph);
      continue;
    }
    let current = "";
    for (const sentence of sentencesOf(paragraph)) {
      if (current && (current + sentence).length > MOST) {
        parts.push(current.trim());
        current = "";
      }
      current += sentence;
    }
    if (current.trim()) parts.push(current.trim());
  }
  return parts.length ? parts : [reply];
}

/**
 * A paragraph's sentences, every character kept. A sentence ends at . ! or ? followed
 * by a space or the end — never at the point inside a number, so "R$ 2.585,10" stays
 * whole. Should the pieces ever fail to add back up to the paragraph, it stays whole:
 * a figure must never lose a digit on its way to the screen.
 */
export function sentencesOf(paragraph: string): string[] {
  const found = paragraph.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]*(?:\s+|$)/g) ?? [];
  return found.join("") === paragraph ? found : [paragraph];
}

/** Where each word ends: the text comes a word at a time, not a letter. */
export function wordEnds(text: string): number[] {
  const ends: number[] = [];
  const word = /\S+\s*/g;
  while (word.exec(text)) ends.push(word.lastIndex);
  return ends.length ? ends : [text.length];
}

/** How long to wait after the word ending here, a moment longer at the end of a phrase. */
export function pauseAfterWord(text: string, end: number): number {
  const last = text.slice(0, end).trimEnd().slice(-1);
  if (/[.!?…]/.test(last)) return 230;
  if (/[,;:]/.test(last)) return 130;
  return 75;
}

export const TYPING_STARTS_AFTER = 120;

/** About how long a message takes to write out. */
export function typingMs(text: string): number {
  return wordEnds(text).reduce((ms, end) => ms + pauseAfterWord(text, end), TYPING_STARTS_AFTER);
}
