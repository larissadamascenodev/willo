import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import CenterModal from "~/components/CenterModal";
import { Camera, ChevronRight, FileText, PenLine, Receipt } from "~/components/icons";
import { NeedsNewBuild, pickFile } from "~/lib/pickStatement";
import { leaveStatement } from "~/lib/statementDraft";
import { INK, RED } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * Putting something on the card, three ways: by hand; a photo, read the way a receipt
 * is, with the card already chosen; or the statement file, read whole on a screen of its
 * own where every line can be checked, changed or taken out before it goes in.
 */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function AddToCardSheet({
  open,
  card,
  month,
  year,
  onClose,
}: {
  open: boolean;
  card: { id: string; dueDay: number; name: string } | null;
  month: number;
  year: number;
  onClose: () => void;
  /** Kept for callers; the screens that read now refresh the card themselves. */
  onImported?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  /* The sheet leaves first: the phone will not bring up the next screen over one still leaving. */
  const thenGo = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as never), 320);
  };

  const manual = () => card && thenGo(`/manual?cartao=${card.id}`);
  const photo = () => card && thenGo(`/scanner?cartao=${card.id}`);
  const file = async () => {
    if (!card) return;
    setError(null);
    try {
      const picked = await pickFile();
      if (!picked) return;
      leaveStatement({ picked, card, month, year });
      thenGo("/fatura/importar");
    } catch (e) {
      setError(e instanceof NeedsNewBuild || e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
    }
  };

  return (
    <CenterModal open={open} onClose={onClose} title="Adicionar ao cartão" subtitle={`Fatura de ${MONTHS[month - 1]}`}>
      <Animated.View entering={FadeIn.duration(200)}>
        <View style={{ marginTop: 8, gap: 12 }}>
          <Option icon={PenLine} hex="#A78BFA" title="Adicionar manualmente" note="Uma compra, digitada por você" onPress={manual} />
          <Option icon={Camera} hex="#C8F36D" title="Foto ou imagem" note="O Willo lê a compra e já põe neste cartão" onPress={photo} />
          <Option icon={FileText} hex="#7CC4FF" title="Arquivo da fatura" note="O PDF do banco: cada compra, parcela e estorno" onPress={() => void file()} />
        </View>
        {error && <Text style={{ marginTop: 14, fontSize: 13, color: th(RED) }}>{error}</Text>}
      </Animated.View>
    </CenterModal>
  );
}

function Option({
  icon: Icon,
  hex,
  title,
  note,
  onPress,
}: {
  icon: typeof Receipt;
  hex: string;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ borderRadius: 22, borderCurve: "continuous", overflow: "hidden" }}>
        {/* The option's own colour, faint, washing in from the corner its glyph sits in. */}
        <LinearGradient
          colors={th([`${hex}2E`, `${hex}0A`, "rgba(255,255,255,0.03)"], "grad")}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th(`${hex}33`, "line") }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18, paddingHorizontal: 16 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: th(`${hex}26`, "bg") }}>
            <Icon size={22} color={th(hex)} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>{title}</Text>
            <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: th(INK.soft) }}>{note}</Text>
          </View>
          <ChevronRight size={18} color={th("rgba(255,255,255,0.45)")} />
        </View>
      </View>
    </Pressable>
  );
}
