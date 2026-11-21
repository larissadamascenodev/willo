import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { lastHeaderAvatar, rememberHeaderAvatar } from "~/lib/headerAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, withTiming, type EntryExitAnimationFunction } from "react-native-reanimated";
import { Bell, Eye, EyeOff, User } from "~/components/icons";
import RaisedButton from "~/components/RaisedButton";
import GlassShape from "~/components/GlassShape";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { GREEN } from "~/theme/tokens";

import { useGroundTh } from "~/theme/groundInk";

/**
 * The row that stays put while everything else scrolls under it.
 *
 * Who is signed in — the photo, and the first name once the page has scrolled — and, on the
 * right, one capsule of glass holding the two things that act on the whole screen: the eye
 * that hides every figure, and the bell with what is waiting.
 */

const ease = Easing.bezier(0.22, 1, 0.36, 1);
/* The same ten pixels and the same curve the web uses. */
const enter: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateX: -10 }] },
    animations: { opacity: withTiming(1, { duration: 220, easing: ease }), transform: [{ translateX: withTiming(0, { duration: 220, easing: ease }) }] },
  };
};
const leave: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: { opacity: withTiming(0, { duration: 180, easing: ease }), transform: [{ translateX: withTiming(-10, { duration: 180, easing: ease }) }] },
  };
};


export default function HomeHeader({
  name,
  userId,
  avatarUrl,
  unread = 0,
  collapsed = false,
  onProfile,
  onBell,
}: {
  name?: string | null;
  /** Whose picture it is: the one kept while loading is only ever this person's. */
  userId?: string;
  avatarUrl?: string | null;
  /** How many notices are unread: a dot on the bell. */
  unread?: number;
  /** The page has scrolled: the name comes in beside the photo. */
  collapsed?: boolean;
  /** Opens who is signed in, and the way out. */
  onProfile?: () => void;
  /** Opens the notifications. */
  onBell?: () => void;
}) {
  rememberHeaderAvatar(userId, avatarUrl);
  const shownAvatar = avatarUrl ?? lastHeaderAvatar(userId);
  const th = useGroundTh();
  const insets = useSafeAreaInsets();
  const hidden = useHiddenValues();
  const firstName = name?.trim().split(" ")[0] ?? "";
  const initial = firstName ? firstName[0].toUpperCase() : "";

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: insets.top + 12,
        paddingBottom: 10,
      }}
    >
      {/* A photo fills the whole circle, edge to edge; without one, the glass drop holds the initial. */}
      {shownAvatar ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={onProfile} hitSlop={6} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }], opacity: pressed ? 0.85 : 1 })}>
          <Image source={{ uri: shownAvatar }} cachePolicy="memory-disk" transition={0} style={{ width: 50, height: 50, borderRadius: 25 }} />
        </Pressable>
      ) : (
        <RaisedButton label="Perfil" onPress={onProfile} size={50}>
          {initial ? <Text style={{ fontSize: 18, fontWeight: "700", color: th("#fff") }}>{initial}</Text> : <User size={21} color={th("rgba(255,255,255,0.9)")} />}
        </RaisedButton>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        {collapsed && firstName ? (
          <Animated.Text entering={enter} exiting={leave} numberOfLines={1} style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: th("#fff") }}>
            {firstName}
          </Animated.Text>
        ) : null}
      </View>

      {/* One capsule of glass: the eye and the bell. */}
      <GlassShape radius={26} style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", height: "100%" }}>
          <Pressable
            onPress={() => setHiddenValues(!hidden)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar valores" : "Esconder valores"}
            hitSlop={4}
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            {hidden ? <EyeOff size={21} color={th("#fff")} strokeWidth={2} /> : <Eye size={21} color={th("#fff")} strokeWidth={2} />}
          </Pressable>
          <Pressable
            onPress={onBell}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notificações, ${unread} novas` : "Notificações"}
            hitSlop={4}
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Bell size={21} color={th("#fff")} strokeWidth={2} />
            {unread > 0 && <View pointerEvents="none" style={{ position: "absolute", right: 11, top: 10, width: 9, height: 9, borderRadius: 4.5, backgroundColor: th(GREEN, "bg") }} />}
          </Pressable>
        </View>
      </GlassShape>
    </View>
  );
}
