import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "~/supabase/client";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import Field from "~/components/auth/Field";
import { ChevronLeft } from "~/components/icons";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The door, for someone who already has an account.
 *
 * The button is always a button. It was dimmed to a third while the fields were
 * empty, which on a dark screen turns white into a grey bar that reads as a divider
 * — so the one control on the screen looked like it was not there. It stays solid
 * and answers a press that cannot go through by saying what is missing.
 *
 * Someone with no account is one tap from the questions that make one.
 */

const RESET_REDIRECT = "https://willo-app.vercel.app/reset-password";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Coming back from "confirm your e-mail", the address is already known. */
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "bad" | "good"; text: string } | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/bem-vindo" as never));

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
          ? "E-mail ou senha incorretos. Se você entra pela Apple ou pelo Google, use “Criar uma senha por e-mail”."
          : msg.includes("confirm")
            ? "Confirme o seu e-mail pelo link que enviamos e tente de novo."
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
    <Room lit sky>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, height: insets.top + 60 }}>
          <Pressable onPress={back} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}>
            <Glass radius={20} interactive style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
            </Glass>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={{ fontSize: 34, fontWeight: "800", color: "#fff", letterSpacing: -1.1 }}>Que bom te ver{"\n"}de novo.</Text>
            <Text style={{ marginTop: 10, fontSize: 15, color: INK.soft, lineHeight: 21 }}>
              Entre com a mesma conta que você usa no navegador.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: 30, gap: 12 }}>
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
                trailing
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
              <Pressable onPress={() => setReveal((v) => !v)} hitSlop={10} style={{ position: "absolute", right: 14, bottom: 17 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: INK.softer }}>{reveal ? "Ocultar" : "Mostrar"}</Text>
              </Pressable>
            </View>
          </Animated.View>

          {note && (
            <Text style={{ marginTop: 14, fontSize: 13.5, lineHeight: 19, color: note.tone === "bad" ? RED : GREEN }}>{note.text}</Text>
          )}

          {/* Solid, always. Whether it can go through is answered on the press. */}
          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => ({
              marginTop: 22,
              height: 56,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: pressed ? 0.82 : 1,
            })}
          >
            {busy ? <ActivityIndicator color="#0B0B0B" /> : <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>Entrar</Text>}
          </Pressable>

          <Pressable onPress={sendReset} disabled={busy} style={({ pressed }) => ({ marginTop: 10, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: INK.soft }}>Esqueci a senha, ou entro pela Apple ou Google</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <View style={{ marginTop: 24, alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 14, color: INK.softer }}>Ainda não tem conta?</Text>
            <Pressable onPress={() => router.replace("/comecar" as never)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>Criar conta</Text>
            </Pressable>
          </View>

          <Text style={{ marginTop: 22, fontSize: 12, color: INK.faint, lineHeight: 17, textAlign: "center" }}>
            Entrar com a Apple e com o Google chega junto com a versão instalada — elas precisam de permissões nativas que o aplicativo de teste não tem.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Room>
  );
}
