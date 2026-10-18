import { useState, type ReactNode } from "react";
import { Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import { INK, RED } from "~/theme/tokens";

/**
 * A menu for the thing under your thumb.
 *
 * A sheet is a place you go to; this is something you do to what you are already
 * holding, so it opens beside it and the page behind it steps back. Carried over
 * with the two decisions that were argued out on the web: the page is dimmed more
 * than it is blurred, because a heavy blur turned the screen to soup and the menu
 * lost the one thing an anchored menu is for; and it centres on the middle of what
 * is held rather than on its left edge, because a full-width row starts at the page
 * gutter and left-aligning pinned the menu to one side with a third of it empty.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

const MARGIN = 14;
const WIDTH = 258;

export default function AnchoredMenu({
  open,
  anchor,
  onClose,
  children,
}: {
  open: boolean;
  anchor?: AnchorRect | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [height, setHeight] = useState(0);

  const span = Math.min(WIDTH, screenW - MARGIN * 2);

  let left = (screenW - span) / 2;
  let top = (screenH - height) / 2;

  if (anchor) {
    const wanted = anchor.left + anchor.width / 2 - span / 2;
    left = Math.min(Math.max(wanted, MARGIN), screenW - span - MARGIN);
    const below = anchor.bottom + 10;
    top = below + height + MARGIN < screenH ? below : Math.max(anchor.top - height - 10, MARGIN);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <BlurView intensity={14} tint="dark" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.58)" }}>
          <View
            onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
            style={{
              position: "absolute",
              width: span,
              left,
              top,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(30,30,33,0.97)",
              overflow: "hidden",
              opacity: height ? 1 : 0,
            }}
          >
            {/* The press must not reach the backdrop behind it. */}
            <Pressable onPress={() => {}}>{children}</Pressable>
          </View>
        </BlurView>
      </Pressable>
    </Modal>
  );
}

/** The header every anchored menu wears: what you are holding, and what it is. */
export function MenuHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
      }}
    >
      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11.5, color: INK.softer }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** One line of a menu: a glyph, a word, and nothing else. */
export function MenuRow({
  icon: Icon,
  label,
  danger,
  onPress,
  last,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  danger?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
        backgroundColor: pressed ? "rgba(255,255,255,0.07)" : "transparent",
      })}
    >
      <Icon size={18} color={danger ? RED : "rgba(255,255,255,0.85)"} strokeWidth={2} />
      <Text style={{ fontSize: 15, fontWeight: "500", color: danger ? RED : "#fff" }}>{label}</Text>
    </Pressable>
  );
}
