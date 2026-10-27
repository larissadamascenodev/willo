import { useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Eye, EyeOff, Lock } from "~/components/icons";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * A field, drawn as a card of glass on the ground.
 *
 * A glyph on the left says what it asks for, and takes the green of the rim while
 * the field has the keyboard, which is all the feedback a field needs. `right` is
 * for a control that lives inside it, like the eye on a password.
 *
 * The name of the field sits in the card above what is typed (`inset`), the way it
 * does on the web's sign-in, so the card reads as one thing and the name stays
 * even once there is something typed over where a placeholder would have been.
 * Without `inset` the name hangs above the card instead, and without a name the
 * placeholder says it.
 */
export default function Field({
  label,
  inset = false,
  icon: Icon,
  right,
  error = false,
  ...props
}: ComponentProps<typeof TextInput> & {
  label?: string;
  inset?: boolean;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  right?: ReactNode;
  error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const outside = !!label && !inset;
  const inside = !!label && inset;

  return (
    <View>
      {outside ? (
        <Text style={{ fontSize: 11.5, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: INK.softer, marginBottom: 8 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          height: inside ? 76 : 58,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingLeft: 18,
          paddingRight: right ? 6 : 18,
          borderRadius: inside ? 22 : 18,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: error ? "rgba(248,113,113,0.7)" : focused ? "rgba(200,243,109,0.75)" : "rgba(255,255,255,0.10)",
          backgroundColor: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.055)",
        }}
      >
        {Icon ? <Icon size={20} color={error ? RED : focused ? GREEN : INK.softer} strokeWidth={2} /> : null}
        <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
          {inside ? (
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: "600",
                letterSpacing: 2,
                textTransform: "uppercase",
                color: error ? RED : focused ? "rgba(200,243,109,0.9)" : INK.softer,
                marginBottom: 2,
              }}
            >
              {label}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel={label ?? props.placeholder}
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
            style={{ height: inside ? 30 : "100%", fontSize: 17, color: "#fff", padding: 0 }}
          />
        </View>
        {right}
      </View>
    </View>
  );
}

/** A password, with the eye that shows it. */
export function PasswordField(
  props: Omit<ComponentProps<typeof Field>, "icon" | "right" | "secureTextEntry">,
) {
  const [reveal, setReveal] = useState(false);
  return (
    <Field
      icon={Lock}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!reveal}
      right={
        <Pressable
          onPress={() => setReveal((v) => !v)}
          accessibilityLabel={reveal ? "Ocultar senha" : "Mostrar senha"}
          hitSlop={6}
          style={({ pressed }) => ({ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
        >
          {reveal ? <EyeOff size={20} color={INK.soft} /> : <Eye size={20} color={INK.soft} />}
        </Pressable>
      }
    />
  );
}
