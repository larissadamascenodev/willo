import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { lastHeaderAvatar, rememberHeaderAvatar } from "~/lib/headerAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Eye, EyeOff, User } from "~/components/icons";
import RaisedButton from "~/components/RaisedButton";
import GlassShape from "~/components/GlassShape";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { GREEN, INK } from "~/theme/tokens";

import { useGroundTh } from "~/theme/groundInk";

/**
 * The row that stays put while everything else scrolls under it.
 *
 * Who is signed in — the photo, the first name and the day — and, on the right, one capsule
 * of glass holding the two things that act on the whole screen: the eye that hides every
 * figure, and the bell with what is waiting.
 */

const WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];


export default function HomeHeader({
  name,
  userId,
  avatarUrl,
  unread = 0,
  onProfile,
  onBell,
}: {
  name?: string | null;
  /** Whose picture it is: the one kept while loading is only ever this person's. */
  userId?: string;
  avatarUrl?: string | null;
  unread?: number;
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
  const now = new Date();
  const day = `${WEEK[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

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

      <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel={firstName ? `Perfil de ${firstName}` : "Perfil"} style={{ flex: 1, minWidth: 0 }}>
        {firstName ? (
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
            {firstName}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, color: th(INK.soft) }}>
          {day}
        </Text>
      </Pressable>

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
