import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "~/supabase/client";
import { GREEN, GROUND, INK, RED } from "~/theme/tokens";

/**
 * The door.
 *
 * E-mail and password only, for now: it is the same account as the browser, so the
 * point of this screen is to prove the session travels, not to be the whole welcome
 * flow. Apple and Google come back with their native sign-in, which needs a build of
 * its own rather than the test app.
 */
export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(
        err.message.toLowerCase().includes("invalid")
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente de novo.",
      );
      setBusy(false);
    }
    /* On success the auth listener swaps the screen; leaving `busy` on keeps the
       button from being pressed twice while that happens. */
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: GROUND }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 34, fontWeight: "800", color: "#fff", letterSpacing: -1 }}>
          willo
        </Text>
        <Text style={{ marginTop: 8, fontSize: 15, color: INK.soft, lineHeight: 21 }}>
          Entre com a mesma conta que você usa no navegador.
        </Text>

        <View style={{ marginTop: 32, gap: 12 }}>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </View>

        {error && (
          <Text style={{ marginTop: 14, fontSize: 13.5, color: RED, lineHeight: 19 }}>{error}</Text>
        )}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 54,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: !canSubmit ? 0.35 : pressed ? 0.8 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#0B0B0B" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>Entrar</Text>
          )}
        </Pressable>

        <View
          style={{
            marginTop: 28,
            borderTopWidth: 1,
            borderTopColor: INK.edge,
            paddingTop: 14,
          }}
        >
          <Text style={{ fontSize: 12, color: INK.faint, lineHeight: 17 }}>
            Versão nativa em construção. Os dados são exatamente os mesmos do aplicativo web —
            mesmo banco, mesma conta.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A labelled field, drawn on the ground rather than inside a card. */
function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={INK.faint}
        style={{
          height: 54,
          borderRadius: 16,
          paddingHorizontal: 16,
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
