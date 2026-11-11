import { Pressable, Text, View } from "react-native";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { Eye, EyeOff, Pencil, RectangleHorizontal, Square, Trash2 } from "~/components/icons";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import type { WidgetSize } from "@/lib/homeWidgets";
import { GREEN, INK } from "~/theme/tokens";

import { th } from "~/theme/theme";

/**
 * What can be done to a card, opened beside it when it is held: hide the figures, edit
 * the board, remove the card — and, at the foot, its two sizes, Compacto and Grande,
 * which change it at once.
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
  editing,
  onClose,
  onEdit,
  onResize,
  onRemove,
}: {
  target: WidgetMenuTarget | null;
  /** Already editing: "Editar widgets" has nothing to open. */
  editing?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}) {
  const hidden = useHiddenValues();
  return (
    <AnchoredMenu open={!!target} anchor={target?.rect} onClose={onClose}>
      <MenuRow
        icon={hidden ? Eye : EyeOff}
        label={hidden ? "Mostrar dados" : "Ocultar dados"}
        onPress={() => {
          setHiddenValues(!hidden);
          onClose();
        }}
      />
      {!editing && <MenuRow icon={Pencil} label="Editar widgets" onPress={onEdit} />}
      <MenuRow icon={Trash2} label="Remover" danger onPress={onRemove} last={!target?.resizable} />
      {target?.resizable && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.08)", "line") }}>
          <SizeButton icon={Square} label="Compacto" active={target.size === "half"} onPress={() => onResize("half")} />
          <SizeButton icon={RectangleHorizontal} label="Grande" active={target.size === "full"} onPress={() => onResize("full")} />
        </View>
      )}
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
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 54,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: th(active ? "rgba(103,205,103,0.6)" : "rgba(255,255,255,0.10)", "line"),
        backgroundColor: th(active ? "rgba(103,205,103,0.12)" : "rgba(255,255,255,0.04)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={18} color={th(active ? GREEN : "rgba(255,255,255,0.7)")} strokeWidth={1.8} />
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: th(active ? GREEN : INK.soft) }}>{label}</Text>
    </Pressable>
  );
}
