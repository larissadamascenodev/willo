import { Pressable, View } from "react-native";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { Eye, EyeOff, Pencil, RectangleHorizontal, Square, Trash2 } from "~/components/icons";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import type { WidgetSize } from "@/lib/homeWidgets";
import { GREEN } from "~/theme/tokens";

/** What can be done to the card you are holding, opened beside it. */

export interface WidgetMenuTarget {
  id: string;
  label: string;
  description: string;
  size: WidgetSize;
  resizable: boolean;
  rect: AnchorRect;
}

export default function WidgetMenu({
  target,
  onClose,
  onEdit,
  onResize,
  onRemove,
}: {
  target: WidgetMenuTarget | null;
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
      <MenuRow icon={Pencil} label="Editar widgets" onPress={onEdit} />
      <MenuRow icon={Trash2} label="Remover" danger onPress={onRemove} last={!target?.resizable} />

      {target?.resizable && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.08)",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <SizeButton
            icon={Square}
            active={target.size === "half"}
            onPress={() => onResize("half")}
          />
          <SizeButton
            icon={RectangleHorizontal}
            active={target.size === "full"}
            onPress={() => onResize("full")}
          />
        </View>
      )}
    </AnchoredMenu>
  );
}

function SizeButton({
  icon: Icon,
  active,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: active ? "rgba(200,243,109,0.6)" : "rgba(255,255,255,0.10)",
        backgroundColor: active ? "rgba(200,243,109,0.12)" : "rgba(255,255,255,0.04)",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={20} color={active ? GREEN : "rgba(255,255,255,0.7)"} strokeWidth={1.8} />
    </Pressable>
  );
}
