import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import CenterModal from "~/components/CenterModal";
import { deleteCardKeepingHistory } from "~/lib/cardDelete";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/** Asking before a card goes, and saying what goes with it and what stays. */
export default function DeleteCardModal({ card, onClose, onDeleted }: { card: { id: string; name: string } | null; onClose: () => void; onDeleted?: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!card || !user) return;
    setBusy(true);
    try {
      await deleteCardKeepingHistory(card, user.id);
      showToast(`Cartão ${card.name} excluído`);
      onClose();
      onDeleted?.();
    } catch {
      showToast("Não consegui excluir o cartão agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenterModal open={!!card} onClose={() => !busy && onClose()} title={`Excluir ${card?.name ?? "cartão"}?`}>
      <Text style={{ fontSize: 15, lineHeight: 21, color: th(INK.soft) }}>
        As compras, parcelas e faturas deste cartão saem do Willo. As faturas que você já pagou continuam nas suas contas, como pagamentos.
      </Text>
      <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onClose}
          disabled={busy}
          style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.10)", "bg"), opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => void remove()}
          disabled={busy}
          style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th(RED, "bg"), opacity: busy ? 0.5 : pressed ? 0.8 : 1 })}
        >
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{busy ? "Excluindo…" : "Excluir"}</Text>
        </Pressable>
      </View>
    </CenterModal>
  );
}
