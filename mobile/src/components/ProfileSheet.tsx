import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import { LogOut } from "~/components/icons";
import { useHomeHero } from "~/lib/homeHero";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Who is signed in, and the way out.
 *
 * The avatar on the home screen opens this. It says whose account the phone is
 * showing — which matters the moment someone has more than one — and signs out,
 * after asking, because signing out takes the person to the welcome and a stray
 * tap should not do that.
 *
 * It also holds the one switch that is for trying things out: what the top of the
 * home is, the sphere or the stories. Both exist so they can be compared.
 *
 * The rest of what an account is — name, photo, deleting it — belongs to the
 * settings screen, which is still to come.
 */
export default function ProfileSheet({
  open,
  onClose,
  name,
  avatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const { user, signOut } = useAuth();
  const [hero, setHero] = useHomeHero();
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAsking(false);
      setLeaving(false);
    }
  }, [open]);

  const email = user?.email ?? "";
  const shown = name?.trim() || (user?.user_metadata?.display_name as string | undefined) || email.split("@")[0] || "Você";

  const leave = async () => {
    setLeaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    await signOut();
    /* The door takes over from here; this sheet goes with the screen it was on. */
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
            }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text style={{ fontSize: 30, fontWeight: "700", color: "#fff" }}>{shown.slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <Text style={{ marginTop: 14, fontSize: 21, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>{shown}</Text>
          {!!email && <Text style={{ marginTop: 3, fontSize: 14, color: INK.soft }}>{email}</Text>}
        </View>

        {/* The top of the home. */}
        <View style={{ marginTop: 26 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "600", letterSpacing: 1.3, textTransform: "uppercase", color: INK.softer, marginBottom: 10 }}>
            Topo da tela inicial
          </Text>
          <SegmentedTabs
            compact
            height={36}
            value={hero}
            onChange={setHero}
            options={[
              { key: "orb" as const, label: "Orbe" },
              { key: "stories" as const, label: "Stories" },
            ]}
          />
        </View>

        <View style={{ marginTop: 24 }}>
          {!asking ? (
            <Pressable
              onPress={() => setAsking(true)}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 26,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: "rgba(248,113,113,0.25)",
                backgroundColor: "rgba(248,113,113,0.08)",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <LogOut size={17} color={RED} />
              <Text style={{ fontSize: 15.5, fontWeight: "600", color: RED }}>Sair da conta</Text>
            </Pressable>
          ) : (
            <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
              <Text style={{ textAlign: "center", fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.8)" }}>
                Você vai precisar entrar de novo para ver os seus dados neste aparelho.
              </Text>
              <Pressable
                onPress={() => void leave()}
                disabled={leaving}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 26,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#EF4444",
                  opacity: leaving ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                {leaving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>Sair</Text>}
              </Pressable>
              <Pressable onPress={() => setAsking(false)} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14.5, color: "rgba(255,255,255,0.7)" }}>Cancelar</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
