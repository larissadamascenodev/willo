import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { lastHeaderAvatar, rememberHeaderAvatar } from "~/lib/headerAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, withTiming, type EntryExitAnimationFunction } from "react-native-reanimated";
import { Bell, User } from "~/components/icons";
import RaisedButton from "~/components/RaisedButton";
import { GREEN } from "~/theme/tokens";

import { useGroundTh } from "~/theme/groundInk";
/**
 * The row that stays put while everything else scrolls under it.
 *
 * Who is signed in, and the way to what is waiting. The greeting itself opens the
 * readings below, so up here only the name appears, and only once the top of the
 * screen has receded far enough that reading the greeting is no longer the point.
 */
export default function HomeHeader({
  name,
  title,
  userId,
  avatarUrl,
  unread = 0,
  collapsed = false,
  onProfile,
  onBell,
}: {
  name?: string | null;
  /** What takes the middle once the top has scrolled away (the balance); the first name if not given. */
  title?: string | null;
  /** Whose picture it is: the one kept while loading is only ever this person's. */
  userId?: string;
  avatarUrl?: string | null;
  unread?: number;
  /** The top of the screen has receded; the name takes over here. */
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
  const firstName = name?.trim().split(" ")[0] ?? "";

  /* The same ten pixels and the same curve the web uses, rather than whichever
     distance a named preset happens to travel. */
  const enter: EntryExitAnimationFunction = () => {
    "worklet";
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    return {
      initialValues: { opacity: 0, transform: [{ translateX: -10 }] },
      animations: {
        opacity: withTiming(1, { duration: 220, easing: ease }),
        transform: [{ translateX: withTiming(0, { duration: 220, easing: ease }) }],
      },
    };
  };

  const leave: EntryExitAnimationFunction = () => {
    "worklet";
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
      animations: {
        opacity: withTiming(0, { duration: 180, easing: ease }),
        transform: [{ translateX: withTiming(-10, { duration: 180, easing: ease }) }],
      },
    };
  };
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
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: insets.top + 14,
        paddingBottom: 10,
      }}
    >
      {/* Two raised drops: who is signed in, and what is waiting. */}
      {/* A photo fills the whole circle, edge to edge; without one, the glass drop holds the initial. */}
      {shownAvatar ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={onProfile} hitSlop={6} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }], opacity: pressed ? 0.85 : 1 })}>
          <Image source={{ uri: shownAvatar }} cachePolicy="memory-disk" transition={0} style={{ width: 50, height: 50, borderRadius: 25 }} />
        </Pressable>
      ) : (
        <RaisedButton label="Perfil" onPress={onProfile} size={50}>
          {initial ? (
            <Text style={{ fontSize: 18, fontWeight: "700", color: th("#fff") }}>{initial}</Text>
          ) : (
            <User size={21} color={th("rgba(255,255,255,0.9)")} />
          )}
        </RaisedButton>
      )}

      {collapsed && (title || firstName) ? (
        <Animated.Text
          entering={enter}
          exiting={leave}
          numberOfLines={1}
          style={{ flex: 1, textAlign: title ? "center" : "left", fontSize: title ? 17 : 19, fontWeight: title ? "600" : "700", letterSpacing: -0.4, color: th("#fff"), fontVariant: ["tabular-nums"] }}
        >
          {title || firstName}
        </Animated.Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View>
        <RaisedButton label={unread > 0 ? `Notificações, ${unread} novas` : "Notificações"} onPress={onBell} size={50}>
          <Bell size={22} color={th("#fff")} strokeWidth={2} />
        </RaisedButton>
        {unread > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 12,
              top: 11,
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: th(GREEN, "bg"),
            }}
          />
        )}
      </View>
    </View>
  );
}
