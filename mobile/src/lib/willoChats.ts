import type { AnswerCard } from "~/components/willo/AnswerCards";
import type { ReceiptLine } from "~/components/registro/ReceiptCard";

/**
 * The conversations with Willo, kept on the phone.
 *
 * Each opening of the screen starts a new one and the earlier ones stay here to go back
 * to. One list per person, so that signing in as someone else on the same phone does not
 * show them the last person's money.
 */

export type ChatItem =
  | { kind: "msg"; id: string; role: "bot" | "user"; text: string }
  | { kind: "done"; id: string; text: string; total?: number; income?: boolean }
  | { kind: "card"; id: string; card: AnswerCard }
  | { kind: "receipt"; id: string; line: ReceiptLine; when: string };

export interface SavedChat {
  id: string;
  title: string;
  /** Last written to, in ms. */
  at: number;
  items: ChatItem[];
}

const MAX_CHATS = 30;
const MAX_ITEMS = 100;

const keyOf = (userId: string) => `willo-chats:${userId}`;

export function loadChats(userId: string): SavedChat[] {
  try {
    const raw = localStorage.getItem(keyOf(userId));
    return raw ? (JSON.parse(raw) as SavedChat[]) : [];
  } catch {
    return [];
  }
}

const store = (userId: string, chats: SavedChat[]) => {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(chats));
  } catch {
    /* Kept for this session only. */
  }
};

export function saveChat(userId: string, chat: Omit<SavedChat, "title" | "at">) {
  const first = chat.items.find((i) => i.kind === "msg" && i.role === "user");
  const title = first?.kind === "msg" ? first.text : chat.items.some((i) => i.kind === "receipt") ? "Lançamento" : "Conversa";
  const others = loadChats(userId).filter((c) => c.id !== chat.id);
  const next: SavedChat = { id: chat.id, title: title.slice(0, 80), at: Date.now(), items: chat.items.slice(-MAX_ITEMS) };
  store(userId, [next, ...others].slice(0, MAX_CHATS));
}

export function deleteChat(userId: string, id: string) {
  store(userId, loadChats(userId).filter((c) => c.id !== id));
}
