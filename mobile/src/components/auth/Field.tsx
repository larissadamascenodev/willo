import { useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Eye, EyeOff, Lock } from "~/components/icons";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * A field, drawn as a pill of glass on the ground.
 *
 * It is the shape of the buttons around it — long, rounded, one height — so a form
 * reads as a column of the same kind of object. A glyph on the left says what it
 * asks for, and takes the green of the rim while the field has the keyboard, which
 * is all the feedback a field needs. `right` is for a control that lives inside it,
 * like the eye on a password.
 *
 * The label above is optional: a field that says what it is with a glyph and a
 * placeholder does not need to say it twice.
 */
export default function Field({
  label,
  icon: Icon,
  right,
  error = false,
  ...props
}: ComponentProps<typeof TextInput> & {
  label?: string;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  right?: ReactNode;
  error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      {label ? (
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: "600",
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: INK.softer,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          height: 58,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingLeft: 16,
          paddingRight: right ? 6 : 16,
          borderRadius: 18,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: error ? "rgba(248,113,113,0.7)" : focused ? "rgba(200,243,109,0.75)" : "rgba(255,255,255,0.10)",
          backgroundColor: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.055)",
        }}
      >
        {Icon ? <Icon size={19} color={error ? RED : focused ? GREEN : INK.softer} strokeWidth={2} /> : null}
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
          style={{ flex: 1, minWidth: 0, height: "100%", fontSize: 16.5, color: "#fff", padding: 0 }}
        />
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
          style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
        >
          {reveal ? <EyeOff size={19} color={INK.soft} /> : <Eye size={19} color={INK.soft} />}
        </Pressable>
      }
    />
  );
}
