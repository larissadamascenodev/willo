import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet from "~/components/BottomSheet";
import { X } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * A long list of entries — every charge of a category, everything an account has moved —
 * rising from the foot of the screen as one piece of Liquid Glass, its name and what it holds
 * at the top and the cross to close it beside them. Pulled down, it goes the way it came.
 */
export default function GlassListSheet({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <BottomSheet open={open} onClose={onClose} full glass>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingBottom: 4 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: th("#fff") }}>
            {title}
          </Text>
          {subtitle ? <Text style={{ marginTop: 3, fontSize: 13.5, color: th(INK.soft) }}>{subtitle}</Text> : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.1)", "bg"), opacity: pressed ? 0.6 : 1 })}
        >
          <X size={16} color={th("rgba(255,255,255,0.85)")} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>{children}</View>
    </BottomSheet>
  );
}
