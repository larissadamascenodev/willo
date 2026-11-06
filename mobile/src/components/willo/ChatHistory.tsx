import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet from "~/components/BottomSheet";
import { Plus, Trash2 } from "~/components/icons";
import { deleteChat, loadChats, type SavedChat } from "~/lib/willoChats";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/** The conversations already had, newest first, by day. */

const dayName = (at: number) => {
  const day = new Date(at);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ago = Math.round((start(new Date()) - start(day)) / 86_400_000);
  if (ago === 0) return "Hoje";
  if (ago === 1) return "Ontem";
  return day.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
};

const lastWords = (chat: SavedChat) => {
  for (let i = chat.items.length - 1; i >= 0; i--) {
    const item = chat.items[i];
    if (item.kind === "msg" && item.role === "bot") return item.text.replace(/\*\*/g, "").replace(/\s+/g, " ");
  }
  return "";
};

export default function ChatHistory({
  open,
  userId,
  currentId,
  onClose,
  onOpen,
  onNew,
}: {
  open: boolean;
  userId: string | null;
  currentId: string;
  onClose: () => void;
  onOpen: (chat: SavedChat) => void;
  onNew: () => void;
}) {
  const [chats, setChats] = useState<SavedChat[]>([]);
  useEffect(() => {
    if (open && userId) setChats(loadChats(userId));
  }, [open, userId]);

  const days: { name: string; chats: SavedChat[] }[] = [];
  for (const chat of chats) {
    const name = dayName(chat.at);
    const seen = days.find((d) => d.name === name);
    if (seen) seen.chats.push(chat);
    else days.push({ name, chats: [chat] });
  }

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Conversas</Text>
          <Pressable
            onPress={onNew}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 34,
              paddingHorizontal: 13,
              borderRadius: 17,
              backgroundColor: th("#fff", "bg"),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Plus size={15} color={th("#0B0B0B")} strokeWidth={2.6} />
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#0B0B0B") }}>Nova</Text>
          </Pressable>
        </View>

        {days.length === 0 && <Text style={{ marginTop: 18, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>Suas conversas com o Willo ficam guardadas aqui.</Text>}

        {days.map((day) => (
          <View key={day.name}>
            <Text style={[T.eyebrow, { marginTop: 22, marginBottom: 4 }]}>{day.name}</Text>
            {day.chats.map((chat, i) => (
              <View
                key={chat.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}
              >
                <Pressable onPress={() => onOpen(chat)} style={({ pressed }) => ({ flex: 1, minWidth: 0, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: chat.id === currentId ? "700" : "500", color: th("#fff") }}>
                    {chat.title}
                  </Text>
                  {lastWords(chat) ? (
                    <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13, color: th(INK.soft) }}>
                      {lastWords(chat)}
                    </Text>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!userId) return;
                    deleteChat(userId, chat.id);
                    setChats(loadChats(userId));
                  }}
                  accessibilityLabel="Apagar esta conversa"
                  hitSlop={8}
                  style={({ pressed }) => ({ width: 34, height: 34, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
                >
                  <Trash2 size={16} color={th(INK.softer)} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}
