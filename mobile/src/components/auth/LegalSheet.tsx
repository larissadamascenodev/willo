import { Fragment, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LEGAL, OPERATOR, type LegalBlock } from "@/lib/legal";
import GlowButton from "~/components/GlowButton";
import RoundButton from "~/components/RoundButton";
import { CircleCheck, X } from "~/components/icons";

import { live, th } from "~/theme/theme";
/**
 * The Terms or the Privacy Policy, read in the app.
 *
 * A tall sheet: the document's name on one line, when it was last changed, the full
 * text set like a printed page, and at the foot the circling-light button to accept
 * it. The text comes from the same source as the site (lib/legal), so both always
 * agree. Accepting records which version was accepted and when, on this phone.
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

/* One measure for the whole page: body, lists and tables share it. */
const BODY = live({ fontSize: 15, lineHeight: 23.5, letterSpacing: -0.1, color: "rgba(255,255,255,0.68)" } as const);
const GUTTER = 24;

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

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }, dim]}>
        <Pressable style={{ flex: 1 }} onPress={onClose}>
          <BlurView tint={th("dark", "tint")} intensity={18} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: th("rgba(0,0,0,0.45)", "bg") }} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          { position: "absolute", left: 0, right: 0, bottom: 0, top: insets.top + 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: "continuous", overflow: "hidden" },
          rise,
        ]}
      >
        <BlurView intensity={60} tint={th("dark", "tint")} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: th("rgba(14,15,18,0.78)", "bg") }} />

        <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: th("rgba(255,255,255,0.18)", "bg"), marginTop: 9 }} />

        {/* The way out, alone at the top right. */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 6 }}>
          <RoundButton label="Fechar" onPress={onClose}>
            <X size={18} color={th("#fff")} strokeWidth={2.2} />
          </RoundButton>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Its name, on one line, and when it last changed. */}
          <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 2.4, color: th("rgba(255,255,255,0.42)") }}>{doc.kicker}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ marginTop: 8, fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.9, color: th("#fff") }}
          >
            {doc.title}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 12.5, letterSpacing: 0.2, color: th("rgba(255,255,255,0.4)"), fontVariant: ["tabular-nums"] }}>
            Versão {doc.version}  ·  atualizada em {doc.updated}
          </Text>

          <View style={{ height: 1, marginTop: 22, marginBottom: 22, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />

          <Text style={{ fontSize: 16.5, lineHeight: 25, letterSpacing: -0.2, fontWeight: "500", color: th("rgba(255,255,255,0.92)") }}>{doc.intro}</Text>

          {doc.sections.map((s) => (
            <View key={s.title} style={{ marginTop: 34 }}>
              <Text style={{ fontSize: 17.5, lineHeight: 23, fontWeight: "700", letterSpacing: -0.35, color: th("#fff") }}>{s.title}</Text>
              {s.blocks.map((b, i) => (
                <Fragment key={i}>{renderBlock(b)}</Fragment>
              ))}
            </View>
          ))}

          <View style={{ height: 1, marginTop: 36, marginBottom: 18, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />
          <Text style={{ fontSize: 12.5, lineHeight: 19, color: th("rgba(255,255,255,0.38)") }}>
            {OPERATOR.name} · {OPERATOR.document}
            {"\n"}
            {OPERATOR.city} · {OPERATOR.email}
          </Text>
        </ScrollView>

        {/* Accepting. */}
        <View style={{ paddingHorizontal: GUTTER - 4, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
          <GlowButton
            label="Li e aceito"
            icon={<CircleCheck size={18} color={th("#fff")} strokeWidth={2.2} />}
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

/** A document's own content, for a page that already scrolls (the login sheet). */
export function LegalDocument({ which }: { which: "terms" | "privacy" }) {
  const doc = LEGAL[which];
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 2.4, color: th("rgba(255,255,255,0.42)") }}>{doc.kicker}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 8, fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.8, color: th("#fff") }}>
        {doc.title}
      </Text>
      <Text style={{ marginTop: 6, fontSize: 12.5, letterSpacing: 0.2, color: th("rgba(255,255,255,0.4)"), fontVariant: ["tabular-nums"] }}>
        Versão {doc.version}  ·  atualizada em {doc.updated}
      </Text>
      <View style={{ height: 1, marginTop: 18, marginBottom: 18, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />
      <Text style={{ fontSize: 15.5, lineHeight: 24, letterSpacing: -0.2, fontWeight: "500", color: th("rgba(255,255,255,0.92)") }}>{doc.intro}</Text>
      {doc.sections.map((s) => (
        <View key={s.title} style={{ marginTop: 28 }}>
          <Text style={{ fontSize: 16.5, lineHeight: 22, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>{s.title}</Text>
          {s.blocks.map((blk, i) => (
            <Fragment key={i}>{renderBlock(blk)}</Fragment>
          ))}
        </View>
      ))}
      <View style={{ height: 1, marginTop: 30, marginBottom: 14, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />
      <Text style={{ fontSize: 12.5, lineHeight: 19, color: th("rgba(255,255,255,0.38)") }}>
        {OPERATOR.name} · {OPERATOR.document}
        {"\n"}
        {OPERATOR.city} · {OPERATOR.email}
      </Text>
    </View>
  );
}

function renderBlock(b: LegalBlock) {
  if ("p" in b) return <Text style={[BODY, { marginTop: 12 }]}>{b.p}</Text>;
  if ("list" in b)
    return (
      <View style={{ marginTop: 10, gap: 8 }}>
        {b.list.map((item) => (
          <View key={item} style={{ flexDirection: "row", gap: 12, paddingLeft: 2 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 10, backgroundColor: th("rgba(255,255,255,0.38)", "bg") }} />
            <Text style={[BODY, { flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </View>
    );
  return (
    <View style={{ marginTop: 16, borderRadius: 18, borderCurve: "continuous", overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.035)", "bg") }}>
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
        {b.table.head.map((h) => (
          <Text key={h} style={{ flex: 1, fontSize: 10.5, fontWeight: "600", letterSpacing: 1.4, color: th("rgba(255,255,255,0.5)") }}>
            {h.toUpperCase()}
          </Text>
        ))}
      </View>
      {b.table.rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: r ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.05)", "line") }}>
          {row.map((cell, k) => (
            <Text key={k} style={{ flex: 1, fontSize: 13.5, lineHeight: 19.5, color: th(k === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)") }}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
