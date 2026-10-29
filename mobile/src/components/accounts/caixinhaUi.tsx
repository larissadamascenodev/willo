import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Plus } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The pieces a caixinha is made and changed with: grouped glass with rows in it, a
 * capsule that slides to the chosen option, a stepper, and an amount typed at the size
 * it is read. Creating one and editing one use the same pieces, so the two look like
 * the same place.
 */

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A grouped piece of glass, the way a settings page groups its rows. */
export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          borderRadius: 24,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.06)",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.07)" }}>
      {children}
    </View>
  );
}

/**
 * A choice of a few, as one control: a capsule of glass with a white pill that slides
 * under the chosen one. `value` null lights none — for time, there is no date at all.
 */
export function Segments<V extends string | number>({
  options,
  value,
  onChange,
  height = 50,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  height?: number;
}) {
  const [track, setTrack] = useState(0);
  const index = options.findIndex((o) => o.value === value);
  const each = track > 0 ? (track - 8) / options.length : 0;
  const x = useSharedValue(0);
  const shown = useSharedValue(index >= 0 ? 1 : 0);

  useEffect(() => {
    if (index >= 0) x.set(withSpring(index * each, { duration: 420, dampingRatio: 0.82 }));
    shown.set(withTiming(index >= 0 ? 1 : 0, { duration: 180 }));
  }, [index, each, x, shown]);

  const pill = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View
      onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
      style={{
        height,
        padding: 4,
        borderRadius: height / 2,
        flexDirection: "row",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.06)",
      }}
    >
      {each > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 4,
              left: 4,
              width: each,
              height: height - 10,
              borderRadius: (height - 10) / 2,
              backgroundColor: "#fff",
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
            pill,
          ]}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={{ flex: 1, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: on ? "#0B0B0B" : "rgba(255,255,255,0.78)" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ icon: Icon, label, disabled, onPress }: { icon: typeof Plus; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.08)",
        opacity: disabled ? 0.3 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Icon size={19} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
}

/** The figure a row is about, typed in place at the size it is read. */
export function AmountField({ cents, onChange, size }: { cents: number; onChange: (c: number) => void; size: number }) {
  return (
    <TextInput
      value={brl(cents)}
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, "").slice(0, 11);
        onChange(Math.min(Number(digits || "0"), 999999999));
      }}
      keyboardType="number-pad"
      style={{
        marginTop: 4,
        minWidth: 0,
        fontSize: size,
        fontWeight: "800",
        letterSpacing: -size / 26,
        color: cents === 0 ? INK.faint : "#fff",
        padding: 0,
      }}
    />
  );
}
