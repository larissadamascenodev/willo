import { Fragment, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { LEGAL, OPERATOR, type LegalBlock } from "@/lib/legal";
import GlowButton from "~/components/GlowButton";
import RoundButton from "~/components/RoundButton";
import { ChevronRight, CircleCheck, ExternalLink, X } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The Terms or the Privacy Policy, read in the app.
 *
 * A tall sheet: the document's name, a card that opens the always-current version on
 * the site, the full text, and at the foot the circling-light button to accept it. The
 * text comes from the same source as the site (lib/legal), so both always agree.
 * Accepting records which version was accepted and when, on this phone.
 */

const ACCEPTED_KEY = "willo.legal.accepted";

export function recordAcceptance(which: "terms" | "privacy") {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    if (!store) return;
    const now = JSON.parse(store.getItem(ACCEPTED_KEY) ?? "{}") as Record<string, { version: string; at: string }>;
    now[which] = { version: LEGAL[which].version, at: new Date().toISOString() };
    store.setItem(ACCEPTED_KEY, JSON.stringify(now));
  } catch {
    /* Nothing to record into. */
  }
}

export default function LegalSheet({ which, onClose, onAccept }: { which: "terms" | "privacy" | null; onClose: () => void; onAccept?: () => void }) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<"terms" | "privacy" | null>(which);
  const up = useSharedValue(0);

  useEffect(() => {
    if (which) {
      setShown(which);
      up.set(withSpring(1, { duration: 520, dampingRatio: 0.94 }));
    } else {
      up.set(withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) }));
      const id = setTimeout(() => setShown(null), 260);
      return () => clearTimeout(id);
    }
  }, [which, up]);

  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - up.get()) * 900 }] }));
  const dim = useAnimatedStyle(() => ({ opacity: up.get() }));
  if (!shown) return null;
  const doc = LEGAL[shown];
  const url = `${OPERATOR.site}${doc.path}`;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }, dim]}>
        <Pressable style={{ flex: 1 }} onPress={onClose}>
          <BlurView tint="dark" intensity={18} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          { position: "absolute", left: 0, right: 0, bottom: 0, top: insets.top + 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderCurve: "continuous", overflow: "hidden" },
          rise,
        ]}
      >
        <BlurView intensity={60} tint="dark" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(16,18,22,0.72)" }} />

        <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)", marginTop: 10 }} />

        {/* Its name, and the way out. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 14, flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 2, color: INK.softer }}>{doc.kicker}</Text>
            <Text style={{ marginTop: 4, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{doc.title}</Text>
          </View>
          <RoundButton label="Fechar" onPress={onClose}>
            <X size={18} color="#fff" strokeWidth={2.2} />
          </RoundButton>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {/* The always-current version, on the site. */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              void WebBrowser.openBrowserAsync(url);
            }}
            accessibilityRole="link"
            accessibilityLabel={`Abrir a versão sempre atualizada em ${url}`}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 22, backgroundColor: pressed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)" })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
              <ExternalLink size={19} color="#fff" strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>
                Versão sempre atualizada
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>
                {url.replace(/^https?:\/\//, "")}
              </Text>
            </View>
            <ChevronRight size={18} color={INK.faint} strokeWidth={2} />
          </Pressable>

          <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.softer }}>
            Versão {doc.version} · atualizada em {doc.updated}
          </Text>
          <Text style={{ marginTop: 10, fontSize: 16, lineHeight: 23, fontWeight: "600", color: "#fff" }}>{doc.intro}</Text>

          {doc.sections.map((s) => (
            <View key={s.title} style={{ marginTop: 26 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>{s.title}</Text>
              {s.blocks.map((b, i) => (
                <Fragment key={i}>{renderBlock(b)}</Fragment>
              ))}
            </View>
          ))}

          <Text style={{ marginTop: 28, fontSize: 13, lineHeight: 19, color: INK.faint }}>
            Contato: {OPERATOR.email} · {OPERATOR.name}, {OPERATOR.city}
          </Text>
        </ScrollView>

        {/* Accepting. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
          <GlowButton
            label="Li e aceito"
            icon={<CircleCheck size={18} color="#fff" strokeWidth={2.2} />}
            onPress={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              recordAcceptance(shown);
              onAccept?.();
              onClose();
            }}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

function renderBlock(b: LegalBlock) {
  const body = { marginTop: 10, fontSize: 15, lineHeight: 22, color: INK.soft };
  if ("p" in b) return <Text style={body}>{b.p}</Text>;
  if ("list" in b)
    return (
      <View style={{ marginTop: 8, gap: 6 }}>
        {b.list.map((item) => (
          <View key={item} style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ fontSize: 15, lineHeight: 22, color: INK.faint }}>•</Text>
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: INK.soft }}>{item}</Text>
          </View>
        ))}
      </View>
    );
  return (
    <View style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)" }}>
      <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.06)" }}>
        {b.table.head.map((h) => (
          <Text key={h} style={{ flex: 1, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: "#fff" }}>
            {h.toUpperCase()}
          </Text>
        ))}
      </View>
      {b.table.rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: r ? 1 : 0, borderTopColor: "rgba(255,255,255,0.05)" }}>
          {row.map((cell, k) => (
            <Text key={k} style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: k === 0 ? "#fff" : INK.soft }}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
