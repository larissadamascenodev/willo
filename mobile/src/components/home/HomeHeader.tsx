import { Image, Pressable, Text, View } from "react-native";
import { Bell } from "~/components/icons";
import { GREEN } from "~/theme/tokens";

/**
 * Who is signed in, rather than the app's own name.
 *
 * The screen already says Willo by being Willo; what the top of it is for is telling
 * you whose money this is and whether anything is waiting. The avatar falls back to
 * an initial, because a photograph is optional and a name is not.
 */
export default function HomeHeader({
  name,
  avatarUrl,
  unread = 0,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  unread?: number;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          opacity: pressed ? 0.7 : 1,
        })}
        accessibilityLabel="Perfil"
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.20)",
          }}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{initial}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
          {name?.split(" ")[0] ?? ""}
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Notificações"
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.10)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Bell size={18} color="rgba(255,255,255,0.9)" />
        {unread > 0 && (
          <View
            style={{
              position: "absolute",
              right: 9,
              top: 9,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: GREEN,
              borderWidth: 2,
              borderColor: "rgba(0,0,0,0.4)",
            }}
          />
        )}
      </Pressable>
    </View>
  );
}
