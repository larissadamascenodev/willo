import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, withTiming, type EntryExitAnimationFunction } from "react-native-reanimated";
import { Bell, User } from "~/components/icons";
import { GREEN } from "~/theme/tokens";

/**
 * The row that stays put while everything else scrolls under it.
 *
 * Who is signed in, and the way to what is waiting. The greeting itself opens the
 * readings below, so up here only the name appears, and only once the top of the
 * screen has receded far enough that reading the greeting is no longer the point.
 */
export default function HomeHeader({
  name,
  avatarUrl,
  unread = 0,
  collapsed = false,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  unread?: number;
  /** The top of the screen has receded; the name takes over here. */
  collapsed?: boolean;
}) {
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
      <Pressable
        accessibilityLabel="Perfil"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.34)",
          backgroundColor: "rgba(255,255,255,0.10)",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} />
        ) : initial ? (
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{initial}</Text>
        ) : (
          <User size={18} color="rgba(255,255,255,0.8)" />
        )}
      </Pressable>

      {collapsed && firstName ? (
        <Animated.Text
          entering={enter}
          exiting={leave}
          numberOfLines={1}
          style={{ flex: 1, fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}
        >
          {firstName}
        </Animated.Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <Pressable
        accessibilityLabel="Notificações"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Bell size={18} color="#fff" />
        {unread > 0 && (
          <View
            style={{
              position: "absolute",
              right: 11,
              top: 11,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: GREEN,
              borderWidth: 2,
              borderColor: "rgba(0,0,0,0.7)",
            }}
          />
        )}
      </Pressable>
    </View>
  );
}
