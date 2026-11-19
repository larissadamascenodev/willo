import type { ReactNode } from "react";
import { Image, Platform, Text, View, type TextStyle } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WILLO = require("../../../assets/willo-icon.png") as number;

/**
 * What the Willo has to tell, right under the balance.
 *
 * Nothing is drawn when there is nothing to say. When there is — purchases the Copilot
 * caught waiting for a yes, later a word from the Willo — each arrives as one line of glass
 * under the chart, never over it, and the cards below make room for it by sliding down.
 */

export interface HomeNotice {
  key: string;
  /** Small, above the line: who is speaking. */
  from: string;
  title: string;
  text?: string;
  /** What is on the right: a count, or a word. */
  badge?: string;
  icon?: ReactNode;
  onPress: () => void;
}

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

export default function HomeNotices({ notices }: { notices: HomeNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <Animated.View layout={LinearTransition.duration(320)} style={{ gap: 10 }}>
      {notices.map((n) => (
        <Animated.View key={n.key} entering={FadeInDown.duration(380)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(320)}>
          <Surface onPress={n.onPress} radius={24} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {n.icon ?? <Image source={WILLO} style={{ width: 42, height: 42, borderRadius: 12 }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "600", letterSpacing: 0.2, color: th(INK.soft) }}>
                  {n.from}
                </Text>
                <Text numberOfLines={1} style={[nums, { marginTop: 1, fontSize: 16, fontWeight: "700", color: th("#fff") }]}>
                  {n.title}
                </Text>
                {n.text ? (
                  <Text numberOfLines={1} style={[nums, { marginTop: 1, fontSize: 13, color: th(INK.soft) }]}>
                    {n.text}
                  </Text>
                ) : null}
              </View>
              {n.badge ? (
                <View style={{ minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: th(GREEN, "bg") }}>
                  <Text style={[nums, { fontSize: 13.5, fontWeight: "800", color: "#0B0B0B" }]}>{n.badge}</Text>
                </View>
              ) : null}
              <ChevronRight size={18} color={th(INK.softer)} />
            </View>
          </Surface>
        </Animated.View>
      ))}
    </Animated.View>
  );
}
