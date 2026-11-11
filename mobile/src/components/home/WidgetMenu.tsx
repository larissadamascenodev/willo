import { Pressable, Text, View } from "react-native";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { EyeOff, RectangleHorizontal, Square } from "~/components/icons";
import type { WidgetSize } from "@/lib/homeWidgets";
import { GREEN, INK } from "~/theme/tokens";

import { th } from "~/theme/theme";

/**
 * What can be done to a card while the board is being edited, opened beside it with a
 * touch: take it off the board, or choose its size — Compacto, half a row (the Radar's
 * size), or Grande, the whole row. The size changes at once.
 */

export interface WidgetMenuTarget {
  id: string;
  label: string;
  size: WidgetSize;
  resizable: boolean;
  rect: AnchorRect;
}

export default function WidgetMenu({
  target,
  onClose,
  onResize,
  onRemove,
}: {
  target: WidgetMenuTarget | null;
  onClose: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}) {
  return (
    <AnchoredMenu open={!!target} anchor={target?.rect} onClose={onClose}>
      {target?.resizable && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 }}>
          <SizeButton icon={Square} label="Compacto" active={target.size === "half"} onPress={() => onResize("half")} />
          <SizeButton icon={RectangleHorizontal} label="Grande" active={target.size === "full"} onPress={() => onResize("full")} />
        </View>
      )}
      <MenuRow icon={EyeOff} label="Ocultar da tela" danger onPress={onRemove} last />
    </AnchoredMenu>
  );
}

function SizeButton({
  icon: Icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 64,
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: th(active ? "rgba(103,205,103,0.6)" : "rgba(255,255,255,0.10)", "line"),
        backgroundColor: th(active ? "rgba(103,205,103,0.12)" : "rgba(255,255,255,0.04)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={20} color={th(active ? GREEN : "rgba(255,255,255,0.7)")} strokeWidth={1.8} />
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(active ? GREEN : INK.soft) }}>{label}</Text>
    </Pressable>
  );
}
