import { useRef, useState, type ComponentRef } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "~/supabase/client";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import Field, { PasswordField } from "~/components/auth/Field";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { AlertTriangle, ChevronLeft, CircleCheck, Mail } from "~/components/icons";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The door, for someone who already has an account.
 *
 * The same sphere as the welcome, small, so it is plainly the same place — and it
 * spins while the sign-in is in flight, which says it is working better than a
 * spinner in a button does. Two glass fields, one button, and a line for whoever
 * has forgotten the password.
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
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "bad" | "good"; text: string; field?: "email" | "password" } | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/bem-vindo" as never));

  const refuse = (text: string, field?: "email" | "password") => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setNote({ tone: "bad", text, field });
  };

  const submit = async () => {
    if (busy) return;

    if (!email.trim().includes("@")) return refuse("Digite o seu e-mail.", "email");
    if (password.length < 6) return refuse("Digite a sua senha.", "password");

    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      refuse(
        msg.includes("invalid")
          ? "E-mail ou senha incorretos. Se você entra pela Apple ou pelo Google, toque em “Esqueci a senha” para criar uma."
          : msg.includes("confirm")
            ? "Confirme o seu e-mail pelo link que enviamos e tente de novo."
            : "Não foi possível entrar. Tente de novo.",
      );
      setBusy(false);
    }
    /* On success the auth listener swaps the screen; `busy` stays on so the button
       cannot be pressed twice while that happens. */
  };

  const sendReset = async () => {
    if (busy) return;
    if (!email.trim().includes("@")) return refuse("Digite o seu e-mail primeiro.", "email");
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    setBusy(false);
    if (error) return refuse("Não foi possível enviar o e-mail. Tente de novo.");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setNote({
      tone: "good",
      text: "Enviamos um link para o seu e-mail. Abra, defina uma senha e volte aqui para entrar com ela.",
    });
  };

  return (
    <Room lit sky>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <Pressable onPress={back} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}>
            <Glass radius={20} interactive style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
            </Glass>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 4, paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Who this is, and what it asks ── */}
          <Animated.View entering={FadeIn.delay(80).duration(700)} style={{ alignItems: "center" }}>
            <ParticleOrb size={124} mode={busy ? "thinking" : "idle"} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(420)} style={{ marginTop: 4, alignItems: "center" }}>
            <Text style={{ fontSize: 31, fontWeight: "800", letterSpacing: -1, lineHeight: 35, color: "#fff", textAlign: "center" }}>
              Que bom te ver{"\n"}de novo.
            </Text>
            <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 21, color: INK.soft, textAlign: "center" }}>
              Entre com a mesma conta que você usa{"\n"}no navegador.
            </Text>
          </Animated.View>

          {/* ── The two fields ── */}
          <Animated.View entering={FadeInDown.delay(220).duration(420)} style={{ marginTop: 30, gap: 12 }}>
            <Field
              icon={Mail}
              value={email}
              error={note?.tone === "bad" && note.field === "email"}
              onChangeText={(t) => {
                setEmail(t);
                setNote(null);
              }}
              placeholder="E-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <PasswordField
              ref={passwordRef}
              value={password}
              error={note?.tone === "bad" && note.field === "password"}
              onChangeText={(t) => {
                setPassword(t);
                setNote(null);
              }}
              placeholder="Senha"
              autoComplete="current-password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </Animated.View>

          <Pressable
            onPress={sendReset}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => ({ alignSelf: "flex-end", marginTop: 6, paddingVertical: 8, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 13.5, fontWeight: "500", color: INK.soft }}>Esqueci a senha</Text>
          </Pressable>

          {/* ── What happened, if anything ── */}
          {note && (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                marginTop: 6,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                borderRadius: 16,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderColor: note.tone === "bad" ? "rgba(248,113,113,0.25)" : "rgba(200,243,109,0.25)",
                backgroundColor: note.tone === "bad" ? "rgba(248,113,113,0.08)" : "rgba(200,243,109,0.08)",
              }}
            >
              {note.tone === "bad" ? <AlertTriangle size={16} color={RED} /> : <CircleCheck size={16} color={GREEN} />}
              <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.88)" }}>{note.text}</Text>
            </Animated.View>
          )}

          {/* Solid, always. Whether it can go through is answered on the press. */}
          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => ({
              marginTop: 18,
              height: 58,
              borderRadius: 29,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            {busy ? <ActivityIndicator color="#0B0B0B" /> : <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>Entrar</Text>}
          </Pressable>

          <View style={{ flex: 1, minHeight: 28 }} />

          {/* ── No account yet ── */}
          <Pressable onPress={() => router.replace("/comecar" as never)} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 15, color: INK.softer }}>
              Ainda não tem conta? <Text style={{ fontWeight: "700", color: "#fff" }}>Criar conta</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Room>
  );
}
