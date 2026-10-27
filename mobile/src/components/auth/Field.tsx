import { useState, type ComponentProps } from "react";
import { Text, TextInput, View } from "react-native";
import { GREEN, INK } from "~/theme/tokens";

/**
 * A labelled field, drawn on the ground rather than inside a card.
 *
 * Its edge turns green while it has the keyboard, which is all the feedback a field
 * needs. `trailing` leaves room on the right for a control that sits over it — the
 * show/hide on a password.
 */
export default function Field({
  label,
  trailing = false,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; trailing?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text
        style={{
          fontSize: 11.5,
          fontWeight: "600",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: INK.softer,
          marginBottom: 7,
        }}
      >
        {label}
      </Text>
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={INK.faint}
        style={{
          height: 54,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingRight: trailing ? 82 : 16,
          fontSize: 16,
          color: "#fff",
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: focused ? GREEN : INK.edge,
        }}
      />
    </View>
  );
}
