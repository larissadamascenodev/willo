import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import { Check, ChevronDown } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { isLight, th } from "~/theme/theme";

/**
 * Choosing an account (or a card), the same way in every sheet.
 *
 * Two or fewer: both side by side, one tap. More than two: one button showing the one
 * chosen, which grows upward into the list when tapped — in its own place, not in a
 * window of its own — so the sheet never moves and nothing hides under the keyboard.
 */

export interface AccountOption {
  id: string;
  name: string;
  color?: string | null;
  /** Under the name in the list: a balance, "padrão", the card's limit… */
  note?: string;
}

const tick = () => void Haptics.selectionAsync().catch(() => undefined);

export default function AccountSelect({
  options,
  value,
  onChange,
  title = "Escolha a conta",
  placeholder = "Escolher conta",
}: {
  options: AccountOption[];
  value: string | null;
  onChange: (id: string) => void;
  /** The list's heading, when it opens. */
  title?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.id === value) ?? null;

  if (options.length === 0) return null;

  if (options.length <= 2) {
    return (
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((o) => {
          const on = o.id === value;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tick();
                onChange(o.id);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                height: 50,
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                paddingLeft: 8,
                paddingRight: 12,
                borderRadius: 18,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: th(on ? "#fff" : "rgba(255,255,255,0.10)", "line"),
                backgroundColor: th(on ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)", "bg"),
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <BankMark name={o.name} hex={colorFor(o.name, o.color)} size={32} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: on ? "700" : "500", color: th("#fff") }}>
                {o.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  /* The button grows upward into the list: the chosen row stays at its foot, where it
     was tapped, and the others rise above it inside the same glass. */
  const ROW = 58;
  const listHeight = Math.min(options.length, 5) * (ROW + 6);
  const row = (o: AccountOption) => {
    const on = o.id === value;
    return (
      <Pressable
        key={o.id}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => {
          tick();
          onChange(o.id);
          setOpen(false);
        }}
        style={({ pressed }) => ({
          height: ROW,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 10,
          borderRadius: 16,
          borderCurve: "continuous",
          backgroundColor: th(on ? "rgba(255,255,255,0.12)" : pressed ? "rgba(255,255,255,0.06)" : "transparent", "bg"),
        })}
      >
        <BankMark name={o.name} hex={colorFor(o.name, o.color)} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: on ? "700" : "600", color: th("#fff") }}>
            {o.name}
          </Text>
          {o.note ? (
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.softer) }}>
              {o.note}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: th("rgba(255,255,255,0.3)", "line"), backgroundColor: th(on ? "#fff" : "transparent", "bg") }}>
          {on && <Check size={13} color={th("#0B0B0B")} strokeWidth={3.2} />}
        </View>
      </Pressable>
    );
  };

  return (
    /* Its place in the sheet stays the button's height; the open list rises over what is above. */
    <View style={{ height: 56, zIndex: open ? 50 : 0 }}>
      <Animated.View
        layout={LinearTransition.duration(220)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 18,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: th(open ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.14)", "line"),
          backgroundColor: open ? (isLight() ? "#FFFFFF" : "#1E2026") : th("rgba(255,255,255,0.07)", "bg"),
          overflow: "hidden",
        }}
      >
        {open && (
          <Animated.View entering={FadeIn.duration(180)} style={{ padding: 6, paddingBottom: 0 }}>
            <Text style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12.5, fontWeight: "600", color: th(INK.softer) }}>{title}</Text>
            {options.length > 5 ? (
              <ScrollView style={{ maxHeight: listHeight }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 6 }}>{options.map(row)}</View>
              </ScrollView>
            ) : (
              <View style={{ gap: 6 }}>{options.map(row)}</View>
            )}
            <View style={{ height: 1, marginTop: 6, marginHorizontal: 4, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />
          </Animated.View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={chosen ? `${chosen.name}. Trocar` : placeholder}
          onPress={() => {
            tick();
            setOpen((v) => !v);
          }}
          style={({ pressed }) => ({
            height: 54,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingLeft: 10,
            paddingRight: 14,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          {chosen ? <BankMark name={chosen.name} hex={colorFor(chosen.name, chosen.color)} size={36} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th(chosen ? "#fff" : INK.soft) }}>
              {chosen?.name ?? placeholder}
            </Text>
            {chosen?.note ? (
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: th(INK.softer) }}>
                {chosen.note}
              </Text>
            ) : null}
          </View>
          {chosen && !open ? <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>Trocar</Text> : null}
          <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <ChevronDown size={16} color={th(INK.soft)} strokeWidth={2.2} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
