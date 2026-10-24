import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { GREEN, INK } from "~/theme/tokens";

/**
 * Which month the screen is reading.
 *
 * Three months, always with the chosen one in the middle — so tapping the one on
 * the right moves the whole row a month forward, and you can keep walking in
 * either direction for as long as you like. Anchoring the row on today instead
 * would leave it stuck on the same three months no matter what you tapped.
 *
 * Today's month keeps a dot under it when it is not the one chosen, so you can
 * always find your way back. A month outside this year carries its year.
 */

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const shift = (month: number, year: number, offset: number) => {
  const d = new Date(year, month + offset, 1);
  return { month: d.getMonth(), year: d.getFullYear() };
};

export default function MonthStrip({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}) {
  const now = new Date();
  const items = [-1, 0, 1].map((offset) => shift(month, year, offset));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {items.map((item, i) => {
        const active = i === 1;
        const isToday = item.month === now.getMonth() && item.year === now.getFullYear();
        return (
          <Animated.View
            key={`${item.year}-${item.month}`}
            entering={FadeIn.duration(220)}
            layout={LinearTransition.springify().damping(26).stiffness(300)}
          >
            <Pressable
              accessibilityLabel={`${MONTHS[item.month]} de ${item.year}`}
              onPress={() => onChange(item.month, item.year)}
              hitSlop={6}
              style={({ pressed }) => ({
                alignItems: "center",
                borderRadius: 999,
                paddingHorizontal: 11,
                paddingVertical: 6,
                backgroundColor: active ? "#fff" : "transparent",
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: active ? "#0B0B0B" : isToday ? "rgba(255,255,255,0.82)" : INK.softer,
                }}
              >
                {MONTHS[item.month]}
                {item.year !== now.getFullYear() && (
                  <Text style={{ fontSize: 9, opacity: 0.6 }}> {String(item.year).slice(2)}</Text>
                )}
              </Text>
              {isToday && !active && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 1,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: GREEN,
                  }}
                />
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
