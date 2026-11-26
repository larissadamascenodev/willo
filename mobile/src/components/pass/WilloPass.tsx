import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { categoryHex } from "@/lib/categoryData";
import BankMark from "~/components/BankMark";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, CreditCard, Download, FileText, Landmark, Plus, Receipt, ScanLine, Tag, Wallet } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { playConfirm, preloadConfirm } from "~/lib/sounds";
import { showToast } from "~/lib/toast";
import { PASS_TITLE, amountSize, passAmount, passId, passTheme, type PassData, type PassLink, type PassRow, type PassTheme } from "./passTheme";

/**
 * Willo Pass V9 Signature (Implementação 001): the Willo's own record of an entry just written —
 * not a bank's receipt.
 *
 * The seal and "Gasto registrado" (or Receita / Transferência), then the card: the Willo's mark
 * (white on the dark, black on the light), the entry's real id, the amount large with no sign,
 * the shop with its category's glyph, the details (type, category, institution with its mark,
 * payment, date in full), and "Registrado pelo Willo" with the time. Under it Concluir and the
 * round download.
 *
 * Willo Pass Motion, on a clock started when the confirmation is shown: 0 ms the seal and a soft
 * tap, 120 ms the coin, 160 ms the radial sparks, 200 ms the card materialising (0.85 s, from
 * perspective 700, 40 down, 17° back, 0.9), 380 ms the metal shine across it (1.1 s), the amount
 * at 340, the details at 510, the actions at 660. With reduced motion it is simply there.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_WHITE = require("../../../assets/images/brand/willo-white.png") as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_BLACK = require("../../../assets/images/brand/willo-black.png") as number;
const LOGO_RATIO = 227 / 717;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const ROW_ICON: Record<PassRow["icon"], typeof Tag> = {
  descricao: FileText,
  "tipo-saida": ArrowUpRight,
  "tipo-entrada": ArrowDownLeft,
  "tipo-transferencia": ArrowLeftRight,
  categoria: Tag,
  instituicao: Landmark,
  pagamento: CreditCard,
  data: CalendarDays,
  origem: Landmark,
  destino: Wallet,
};

export default function WilloPass({
  data,
  play = true,
  sound = true,
  actions = true,
  onDone,
  width,
  bare = false,
  links = [],
}: {
  data: PassData;
  /** Played in (the confirmation just happened); otherwise shown still. */
  play?: boolean;
  sound?: boolean;
  /** Concluir and download under the card (in the chat, only the download, on the card). */
  actions?: boolean;
  onDone?: () => void;
  /** The card's width, when it is not the screen's. */
  width?: number;
  /** For the picture: no buttons and no link under the card. */
  bare?: boolean;
  /** Under Concluir: Registrar outra / Escanear outro, Ver transações. */
  links?: PassLink[];
}) {
  const t = passTheme();
  const reduce = useReducedMotion();
  const { width: screenW } = useWindowDimensions();
  const still = !play || reduce;
  const [saving, setSaving] = useState(false);

  /* One clock for the whole sequence, and each piece reads its own window of it. */
  const seal = useSharedValue(still ? 1 : 0);
  const ripple = useSharedValue(still ? 1 : 0);
  const check = useSharedValue(still ? 1 : 0);
  const card = useSharedValue(still ? 1 : 0);
  const shine = useSharedValue(still ? 1 : 0);
  const amount = useSharedValue(still ? 1 : 0);
  const details = useSharedValue(still ? 1 : 0);
  const acts = useSharedValue(still ? 1 : 0);
  const sparks = useSharedValue(still ? 1 : 0);
  const head = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (sound) preloadConfirm();
    if (!play) return;
    /* 0 ms: the seal, and a soft tap. The coin at 120 ms — even with reduced motion. */
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
    const coin = sound ? setTimeout(playConfirm, 120) : null;
    if (!reduce) {
      /* One soft arrival: the seal, its title and the card rise together and settle, slowly
         enough to be seen — never a seal first and a card after. */
      seal.set(withTiming(1, { duration: 760, easing: OUT }));
      head.set(withTiming(1, { duration: 760, easing: OUT }));
      ripple.set(withDelay(120, withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) })));
      check.set(withDelay(180, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) })));
      sparks.set(withDelay(140, withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) })));
      card.set(withTiming(1, { duration: 980, easing: OUT }));
      shine.set(withDelay(480, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })));
      amount.set(withDelay(180, withTiming(1, { duration: 760, easing: OUT })));
      details.set(withDelay(320, withTiming(1, { duration: 760, easing: OUT })));
      acts.set(withDelay(600, withTiming(1, { duration: 620, easing: OUT })));
    }
    return () => {
      if (coin) clearTimeout(coin);
    };
    // Played once, when shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sealStyle = useAnimatedStyle(() => {
    const v = seal.get();
    /* pop: from 0.4, past 1.08, to 1 */
    const s = v < 0.75 ? 0.6 + (1.05 - 0.6) * (v / 0.75) : 1.05 - 0.05 * ((v - 0.75) / 0.25);
    return { opacity: Math.min(1, v * 1.4), transform: [{ scale: s }] };
  });
  const rippleStyle = useAnimatedStyle(() => ({ opacity: still ? 0 : 1 - ripple.get(), transform: [{ scale: 1 + 0.9 * ripple.get() }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: 22 * (1 - check.get()) }));
  const cardStyle = useAnimatedStyle(() => {
    const v = card.get();
    return {
      opacity: Math.min(1, v / 0.45),
      transform: [{ perspective: 900 }, { translateY: 30 * (1 - v) }, { rotateX: `${10 * (1 - v)}deg` }, { scale: 0.94 + 0.06 * v }],
    };
  });
  const cardW = width ?? Math.min(screenW - 32, 400);
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (-1.2 + 2.4 * shine.get()) * cardW }] }));
  const rise = (v: SharedValue<number>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ translateY: 6 * (1 - v.get()) }] }));
  const headStyle = rise(head);
  const amountStyle = rise(amount);
  const detailsStyle = rise(details);
  const actsStyle = rise(acts);

  /* The download: the card itself — the Willo's mark, the amount, the details — captured as it
     is on screen and handed to the share sheet (Salvar imagem, WhatsApp…). Nothing on screen
     changes and nothing is written again. */
  const shot = useRef<ComponentRef<typeof View>>(null);
  const exportPass = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const uri = await captureRef(shot, { format: "png", quality: 1, result: "tmpfile" });
      setSaving(false);
      if (!(await Sharing.isAvailableAsync())) throw new Error("share unavailable");
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Comprovante do Willo" });
    } catch (e) {
      /* Closing the share sheet is not a failure. */
      if (!/cancel/i.test(String((e as Error)?.message ?? ""))) showToast("Não consegui gerar a imagem agora.");
    } finally {
      setSaving(false);
    }
  };

  const big = amountSize(data.amount, cardW - 38);
  const Icon = data.category ? categoryIcon(data.category) : null;
  const catHex = data.category ? categoryHex(data.category) : "#b58a57";

  return (
    <View>
      <View style={{ paddingVertical: 4 }}>
        <View style={{ alignItems: "center", marginTop: 6, marginBottom: 18 }}>
          {still ? (
            /* Drawn plain when still — and so in the downloaded picture, seal and all. */
            <View style={{ width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: t.success, alignItems: "center", justifyContent: "center" }}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={t.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
          ) : (
            <View style={{ width: 39, height: 39 }}>
              <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: t.success }, rippleStyle]} />
              <Animated.View style={[{ width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: t.success, alignItems: "center", justifyContent: "center" }, sealStyle]}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <AnimatedPath d="M5 12.5l4.5 4.5L19 7.5" stroke={t.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="22" animatedProps={checkProps} />
                </Svg>
              </Animated.View>
            </View>
          )}
          <Animated.View style={[{ alignItems: "center" }, headStyle]}>
            <Text style={{ marginTop: 10, fontSize: 20, fontWeight: "600", letterSpacing: -0.6, color: t.text }}>{PASS_TITLE[data.kind]}</Text>
            <Text style={{ marginTop: 5, fontSize: 12, color: t.muted }}>Prontinho. Tudo organizado.</Text>
          </Animated.View>
        </View>

        <Animated.View style={[{ width: cardW, alignSelf: "center", borderRadius: 23, shadowColor: "#000", shadowOpacity: t.cardShadow * 1.5, shadowRadius: 15, shadowOffset: { width: 0, height: 15 } }, cardStyle]}>
          {/* What the download keeps: this card alone, as it is. */}
          <View ref={shot} collapsable={false} style={{ borderRadius: 23, borderWidth: 1, borderColor: t.cardBorder, overflow: "hidden" }}>
            <LinearGradient colors={t.card} locations={[0, 0.47, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
            {/* The inner highlight along the top edge. */}
            <View pointerEvents="none" style={{ position: "absolute", left: 18, right: 18, top: 0, height: 1, backgroundColor: t.light ? "#ffffff" : "rgba(255,255,255,0.22)" }} />
            <View style={{ padding: 19 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Image source={t.light ? LOGO_BLACK : LOGO_WHITE} style={{ width: 69, height: 69 * LOGO_RATIO }} resizeMode="contain" accessibilityLabel="Willo" />
                <Text style={{ fontSize: 9, letterSpacing: 0.6, color: t.muted }}>{passId(data.id)}</Text>
              </View>
              <Animated.View style={[{ alignItems: "center", paddingTop: 16, paddingBottom: 18 }, amountStyle]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: t.text }}>
                  {/* The same type as the amount typed and reviewed: R$ soft and bold, the figure heavy. */}
                  <Text style={{ fontSize: Math.round(big * 0.42), fontWeight: "700", color: t.muted }}>R$ </Text>
                  <Text style={{ fontSize: big, fontWeight: "800", letterSpacing: -big * 0.035, fontVariant: ["tabular-nums"] }}>{passAmount(data.amount)}</Text>
                </Text>
                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                  {Icon && data.kind !== "transferencia" ? (
                    <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${catHex}26` }}>
                      <Icon size={13} color={catHex} strokeWidth={2} />
                    </View>
                  ) : null}
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, color: t.text }}>
                    {data.title}
                  </Text>
                </View>
              </Animated.View>
              <Animated.View style={[{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: 9 }, detailsStyle]}>
                {data.rows.map((r, i) => (
                  <PassLine key={i} row={r} t={t} />
                ))}
                <View style={{ marginTop: 12, paddingTop: 13, borderTopWidth: 1, borderTopColor: t.line, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 9, color: t.muted }}>Registrado pelo Willo</Text>
                  <Text style={{ fontSize: 9, color: t.muted }}>{data.time ?? ""}</Text>
                </View>
              </Animated.View>
            </View>
            {/* The metal shine, crossing once. */}
            {!still && (
              <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: cardW }, shineStyle]}>
                <LinearGradient colors={t.shine} locations={[0.25, 0.43, 0.5, 0.67, 1]} start={{ x: 0, y: 0.35 }} end={{ x: 1, y: 0.65 }} style={{ flex: 1 }} />
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>

      {/* The radial sparks around the seal at 160 ms. */}
      {!still && <SealSparks clock={sparks} />}

      {actions ? (
        <Animated.View style={[{ width: cardW, alignSelf: "center", marginTop: 16, flexDirection: "row", gap: 9 }, actsStyle]}>
          <Pressable onPress={onDone} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: t.done.fill, opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: t.done.ink }}>Concluir</Text>
          </Pressable>
          <Pressable
            onPress={() => void exportPass()}
            accessibilityRole="button"
            accessibilityLabel="Baixar comprovante"
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center", opacity: pressed || saving ? 0.6 : 1 })}
          >
            <Download size={20} color={t.text} strokeWidth={1.7} />
          </Pressable>
        </Animated.View>
      ) : null}
      {actions && links.length > 0 ? (
        <Animated.View style={[{ marginTop: 14, flexDirection: "row", justifyContent: "center", gap: 22 }, actsStyle]}>
          {links.map((l) => {
            const Glyph = l.icon === "escanear" ? ScanLine : l.icon === "novo" ? Plus : Receipt;
            return (
              <Pressable key={l.label} onPress={l.onPress} accessibilityRole="button" hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}>
                <Glyph size={14} color={t.muted} strokeWidth={1.8} />
                <Text style={{ fontSize: 12.5, fontWeight: "500", color: t.muted }}>{l.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
      {!actions && !bare ? (
        <Pressable onPress={() => void exportPass()} accessibilityRole="button" accessibilityLabel="Baixar comprovante" style={({ pressed }) => ({ alignSelf: "center", marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed || saving ? 0.6 : 1 })}>
          <Download size={15} color={t.muted} strokeWidth={1.8} />
          <Text style={{ fontSize: 12.5, color: t.muted }}>Baixar comprovante</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One line of the card: its outline icon and label on the left, the value on the right. */
function PassLine({ row, t }: { row: PassRow; t: PassTheme }) {
  const Icon = ROW_ICON[row.icon];
  return (
    <View style={{ minHeight: 37, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon size={14} color={t.muted} strokeWidth={1.5} />
        <Text style={{ fontSize: 11, color: t.muted }}>{row.label}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" }}>
          {row.bank ? <BankMark name={row.bank.name} hex={row.bank.hex} size={22} /> : null}
          <Text numberOfLines={2} style={{ flexShrink: 1, textAlign: "right", fontSize: 12, fontWeight: "500", color: t.text }}>
            {row.value}
          </Text>
        </View>
        {row.sub ? <Text style={{ marginTop: 1, fontSize: 10.5, color: t.muted }}>{row.sub}</Text> : null}
      </View>
    </View>
  );
}

/** 22 small sparks bursting from the seal. */
function SealSparks({ clock }: { clock: SharedValue<number> }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 6 + 19.5, height: 0, alignItems: "center" }}>
      {Array.from({ length: 22 }, (_, i) => (
        <SealSpark key={i} i={i} clock={clock} />
      ))}
    </View>
  );
}

function SealSpark({ i, clock }: { i: number; clock: SharedValue<number> }) {
  const angle = i * 2.4;
  const r = 25 + i * 2;
  const size = 2 + (i % 2);
  const style = useAnimatedStyle(() => {
    const v = clock.get();
    const o = v <= 0 ? 0 : v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85;
    return { opacity: Math.max(0, o), transform: [{ translateX: Math.cos(angle) * r * v }, { translateY: Math.sin(angle) * r * v }, { scale: 0.2 + 0.3 * v }] };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: "#a9e4c6", shadowColor: "#a9e4c6", shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }, style]}
    />
  );
}

