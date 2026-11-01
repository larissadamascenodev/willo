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
    for (const sentence of paragraph.match(/[^.!?]+[.!?]*(?:\s+|$)/g) ?? [paragraph]) {
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

/** How long to wait after this character before the next. */
export function pauseAfter(char: string): number {
  if (/[.!?…]/.test(char)) return 240;
  if (/[,;:]/.test(char)) return 110;
  if (char === "\n") return 200;
  return 24;
}

export const TYPING_STARTS_AFTER = 120;

/** How long a message takes to write out. */
export function typingMs(text: string): number {
  let ms = TYPING_STARTS_AFTER;
  for (const char of text) ms += pauseAfter(char);
  return ms;
}
