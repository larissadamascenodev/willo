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
 * The button is always a button. It was dimmed to a third while the fields were
 * empty, which on a dark screen turns white into a grey bar that reads as a divider
 * — so the one control on the screen looked like it was not there. It stays solid
 * and answers a press that cannot go through by saying what is missing.
 */

const RESET_REDIRECT = "https://willo-app.vercel.app/reset-password";

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "bad" | "good"; text: string } | null>(null);

  const submit = async () => {
    if (busy) return;

    if (!email.trim().includes("@")) {
      setNote({ tone: "bad", text: "Digite o seu e-mail." });
      return;
    }
    if (password.length < 6) {
      setNote({ tone: "bad", text: "Digite a sua senha." });
      return;
    }

    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      setNote({
        tone: "bad",
        text: msg.includes("invalid")
          ? "E-mail ou senha incorretos. Se você entra pela Apple ou pelo Google, use “Criar uma senha”."
          : "Não foi possível entrar. Tente de novo.",
      });
      setBusy(false);
    }
    /* On success the auth listener swaps the screen; `busy` stays on so the button
       cannot be pressed twice while that happens. */
  };

  const sendReset = async () => {
    if (busy) return;
    if (!email.trim().includes("@")) {
      setNote({ tone: "bad", text: "Digite o seu e-mail primeiro." });
      return;
    }
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    setBusy(false);
    setNote(
      error
        ? { tone: "bad", text: "Não foi possível enviar o e-mail. Tente de novo." }
        : {
            tone: "good",
            text: "Enviamos um link para o seu e-mail. Abra, defina uma senha e volte aqui para entrar com ela.",
          },
    );
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

        <View style={{ marginTop: 30, gap: 12 }}>
          <Field
            label="E-mail"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setNote(null);
            }}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />

          <View>
            <Field
              label="Senha"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setNote(null);
              }}
              placeholder="••••••••"
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete="current-password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Pressable
              onPress={() => setReveal((v) => !v)}
              hitSlop={10}
              style={{ position: "absolute", right: 14, bottom: 17 }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: INK.softer }}>
                {reveal ? "Ocultar" : "Mostrar"}
              </Text>
            </Pressable>
          </View>
        </View>

        {note && (
          <Text
            style={{
              marginTop: 14,
              fontSize: 13.5,
              lineHeight: 19,
              color: note.tone === "bad" ? RED : GREEN,
            }}
          >
            {note.text}
          </Text>
        )}

        {/* Solid, always. Whether it can go through is answered on the press. */}
        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => ({
            marginTop: 22,
            height: 54,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: pressed ? 0.82 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#0B0B0B" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>Entrar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={sendReset}
          disabled={busy}
          style={({ pressed }) => ({
            marginTop: 14,
            height: 48,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: INK.edge,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 14.5, fontWeight: "600", color: INK.soft }}>
            Criar uma senha por e-mail
          </Text>
        </Pressable>

        <View style={{ marginTop: 26, borderTopWidth: 1, borderTopColor: INK.edge, paddingTop: 14 }}>
          <Text style={{ fontSize: 12, color: INK.faint, lineHeight: 17 }}>
            Entrar com a Apple e com o Google chega junto com a versão instalada — elas precisam
            de permissões nativas que o aplicativo de teste não tem. Até lá, a senha vale para a
            mesma conta.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A labelled field, drawn on the ground rather than inside a card. */
function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
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
          paddingRight: 82,
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
