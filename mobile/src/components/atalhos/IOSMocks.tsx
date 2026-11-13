import { useEffect, type ReactNode } from "react";
import { Image, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Check, ChevronLeft, ChevronRight, CreditCard, Plus, Search, Zap } from "~/components/icons";

/**
 * Small drawings of the iPhone's own screens — Ajustes, the Shortcuts app — the way they
 * look in dark mode, so each step of a tutorial shows the screen the person will see and
 * where to touch on it. Always drawn the iPhone's way, whatever the app's theme.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WILLO_ICON = require("../../../assets/willo-icon.png") as number;

const BG = "#000000";
const GROUP = "#1C1C1E";
const SEP = "#38383A";
const TEXT = "#FFFFFF";
const SOFT = "#8E8E93";
const BLUE = "#0A84FF";

/** The phone's screen: a nav bar with its title, and what is on it. */
export function MockScreen({ title, back, right, children }: { title: string; back?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ width: "100%", height: 300, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: BG, borderWidth: 6, borderColor: "#2A2A2E" }}>
      <View style={{ height: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT }}>9:41</Text>
        <View style={{ width: 18, height: 8, borderRadius: 2, borderWidth: 1, borderColor: SOFT }} />
      </View>
      <View style={{ height: 30, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }}>
        {back ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ChevronLeft size={16} color={BLUE} strokeWidth={2.6} />
            <Text style={{ fontSize: 12.5, color: BLUE }}>{back}</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <Text style={{ paddingHorizontal: 14, fontSize: 20, fontWeight: "800", color: TEXT }}>{title}</Text>
      <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 8 }}>{children}</View>
    </View>
  );
}

export interface MockRow {
  label: string;
  icon?: ReactNode;
  /** The tile colour behind the icon, as the Ajustes rows have. */
  tint?: string;
  value?: string;
  check?: boolean;
  /** The row to touch: ringed, with a finger on it. */
  touch?: boolean;
  chevron?: boolean;
}

/** An iOS grouped list, one row marked as the one to touch. */
export function MockList({ rows, header }: { rows: MockRow[]; header?: string }) {
  return (
    <View>
      {header ? <Text style={{ marginLeft: 8, marginBottom: 4, fontSize: 9.5, fontWeight: "600", letterSpacing: 0.4, color: SOFT }}>{header.toUpperCase()}</Text> : null}
      <View style={{ borderRadius: 10, overflow: "hidden", backgroundColor: GROUP }}>
        {rows.map((r, i) => (
          <View key={r.label + i}>
            {i > 0 && <View style={{ height: 0.5, marginLeft: r.icon ? 40 : 12, backgroundColor: SEP }} />}
            <View style={{ height: 34, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, backgroundColor: r.touch ? "rgba(10,132,255,0.18)" : "transparent" }}>
              {r.icon ? <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: r.tint ?? "#3A3A3C" }}>{r.icon}</View> : null}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: TEXT, fontWeight: r.touch ? "700" : "400" }}>
                {r.label}
              </Text>
              {r.value ? <Text style={{ fontSize: 11.5, color: SOFT }}>{r.value}</Text> : null}
              {r.check ? <Check size={14} color={BLUE} strokeWidth={3} /> : null}
              {r.chevron !== false && !r.check ? <ChevronRight size={13} color={SOFT} strokeWidth={2.4} /> : null}
              {r.touch ? <Finger /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A finger's touch: a ring pulsing where to tap. */
export function Finger({ style }: { style?: object }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - p.get()), transform: [{ scale: 0.6 + p.get() * 1.1 }] }));
  return (
    <View pointerEvents="none" style={[{ position: "absolute", right: 34, top: 7, width: 20, height: 20 }, style]}>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#FFFFFF" }, ring]} />
      <View style={{ position: "absolute", left: 5, top: 5, width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.9)" }} />
    </View>
  );
}

/** The sheet the Shortcuts app shows for a shared shortcut: its tile and "Adicionar Atalho". */
export function MockAddShortcut({ name }: { name: string }) {
  return (
    <View style={{ width: "100%", height: 300, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#111113", borderWidth: 6, borderColor: "#2A2A2E", alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ width: "100%", padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: GROUP, alignItems: "center" }}>
        <View style={{ width: 64, height: 64, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#5E5CE6" }}>
          <Zap size={30} color="#fff" fill="#fff" />
        </View>
        <Text style={{ marginTop: 10, fontSize: 15, fontWeight: "800", color: TEXT }}>{name}</Text>
        <Text style={{ marginTop: 2, fontSize: 11, color: SOFT }}>Abre o Registro rápido do Willo</Text>
        <View style={{ marginTop: 14, alignSelf: "stretch", height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: BLUE }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>Adicionar Atalho</Text>
          <Finger style={{ right: 60, top: 9 }} />
        </View>
        <Text style={{ marginTop: 10, fontSize: 12, color: BLUE }}>Não Adicionar</Text>
      </View>
    </View>
  );
}

/** The Shortcuts app's foot: its three tabs, one of them to touch. */
export function MockTabs({ on }: { on: "Atalhos" | "Automação" | "Galeria" }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 42, flexDirection: "row", borderTopWidth: 0.5, borderTopColor: SEP, backgroundColor: "#0D0D0F" }}>
      {(["Atalhos", "Automação", "Galeria"] as const).map((t) => (
        <View key={t} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: t === on ? BLUE : "#48484A" }} />
          <Text style={{ marginTop: 2, fontSize: 9, fontWeight: "600", color: t === on ? BLUE : SOFT }}>{t}</Text>
          {t === on ? <Finger style={{ right: undefined, left: "50%", marginLeft: -10, top: 4 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** The "+" at the top right, to touch. */
export function MockPlus() {
  return (
    <View>
      <Plus size={18} color={BLUE} strokeWidth={2.6} />
      <Finger style={{ right: -1, top: -1 }} />
    </View>
  );
}

/** The search field at the foot of the action list, with what was typed. */
export function MockSearch({ text }: { text: string }) {
  return (
    <View style={{ height: 30, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 9, backgroundColor: GROUP }}>
      <Search size={13} color={SOFT} />
      <Text style={{ fontSize: 12.5, color: TEXT }}>{text}</Text>
    </View>
  );
}

/** The Willo app's icon, small, for the rows that are its own. */
export function WilloTile() {
  return <Image source={WILLO_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />;
}

/** The Willo action as the Shortcuts editor draws it, with its three blue blanks filled. */
export function MockWilloAction() {
  const chip = (text: string, touch?: boolean) => (
    <View style={{ paddingHorizontal: 6, height: 20, borderRadius: 5, justifyContent: "center", backgroundColor: "rgba(10,132,255,0.22)" }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: BLUE }}>{text}</Text>
      {touch ? <Finger style={{ right: -6, top: 0 }} /> : null}
    </View>
  );
  return (
    <View style={{ borderRadius: 10, padding: 10, backgroundColor: GROUP, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <WilloTile />
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: TEXT }}>Registrar compra no Willo</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
        <Text style={{ fontSize: 12, color: TEXT }}>Registrar</Text>
        {chip("Transação › Valor", true)}
        <Text style={{ fontSize: 12, color: TEXT }}>de</Text>
        {chip("Transação › Comerciante")}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Text style={{ fontSize: 12, color: SOFT }}>Cartão</Text>
        {chip("Transação › Cartão ou Passe")}
      </View>
    </View>
  );
}

/** A card of the Wallet, for the list of cards to mark. */
export function CardIcon({ color }: { color: string }) {
  return <CreditCard size={13} color={color} strokeWidth={2.4} />;
}
