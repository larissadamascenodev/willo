import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "~/supabase/client";
import BottomSheet from "~/components/BottomSheet";
import Field, { PasswordField } from "~/components/auth/Field";
import LegalSheet from "~/components/auth/LegalSheet";
import Provider from "~/components/auth/Provider";
import { AppleMark, GoogleMark } from "~/components/auth/BrandIcons";
import { signInWithApple, signInWithGoogle } from "~/lib/socialAuth";
import { AlertTriangle, CircleCheck, Info, Mail } from "~/components/icons";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * "Já tenho conta", as a sheet that rises over the page instead of a page of its own:
 * whoever taps it stays where they were, a swipe down away from going back.
 *
 * Apple and Google first; "Entrar com e-mail" grows the form in place, and the two
 * buttons fold into two small cards above it. The same rules as the old sign-in page:
 * an Apple or Google account that did not exist yet is kept and taken through the
 * questions (lib/socialAuth, mode "entrar"); on success the auth listener moves on.
 */

const RESET_REDIRECT = "https://willo-app.vercel.app/reset-password";

type Note = { tone: "bad" | "good" | "info"; text: string; field?: "email" | "password" };

export default function LoginSheet({ open, onClose, email: knownEmail = "" }: { open: boolean; onClose: () => void; email?: string }) {
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [form, setForm] = useState(!!knownEmail);
  const [email, setEmail] = useState(knownEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  /* Each opening starts on the choice (or on the form, when the address is known). */
  useEffect(() => {
    if (!open) return;
    setForm(!!knownEmail);
    setEmail(knownEmail);
    setPassword("");
    setNote(null);
    setBusy(false);
  }, [open, knownEmail]);

  const openForm = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setNote(null);
    setForm(true);
    setTimeout(() => emailRef.current?.focus(), 380);
  };

  const refuse = (text: string, field?: "email" | "password") => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setNote({ tone: "bad", text, field });
  };

  const social = async (way: "apple" | "google") => {
    if (busy) return;
    void Haptics.selectionAsync().catch(() => undefined);
    setNote(null);
    setBusy(true);
    const res = way === "apple" ? await signInWithApple("entrar") : await signInWithGoogle("entrar");
    if (res.ok) return;
    setBusy(false);
    if (!res.cancelled && res.message) refuse(res.message);
  };

  const submit = async () => {
    if (busy) return;
    if (!email.trim().includes("@")) return refuse("Digite o seu e-mail.", "email");
    if (password.length < 6) return refuse("Digite a sua senha.", "password");
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const msg = error.message.toLowerCase();
      refuse(
        msg.includes("invalid")
          ? "E-mail ou senha incorretos. Se você entra pela Apple ou pelo Google, toque em “Esqueci minha senha” para criar uma."
          : msg.includes("confirm")
            ? "Confirme o seu e-mail pelo link que enviamos e tente de novo."
            : "Não foi possível entrar. Tente de novo.",
      );
      setBusy(false);
    }
  };

  const sendReset = async () => {
    if (busy) return;
    if (!email.trim().includes("@")) return refuse("Digite o seu e-mail primeiro.", "email");
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: RESET_REDIRECT });
    setBusy(false);
    if (error) return refuse("Não foi possível enviar o e-mail. Tente de novo.");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setNote({ tone: "good", text: "Enviamos um link para o seu e-mail. Abra, defina uma senha e volte aqui para entrar com ela." });
  };

  const transition = LinearTransition.duration(320);

  return (
    <>
      <BottomSheet open={open} onClose={onClose}>
        <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 6 }}>
          <Animated.View layout={transition}>
            <Text style={{ fontSize: 26, fontWeight: "300", letterSpacing: -0.6, color: "#fff" }}>
              Bem-vindo <Text style={{ fontWeight: "800" }}>de volta.</Text>
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: INK.soft }}>Entre na sua conta do Willo.</Text>
          </Animated.View>

          <Animated.View layout={transition} style={{ marginTop: 20, flexDirection: form ? "row" : "column", gap: form ? 10 : 10 }}>
            <Provider compact={form} label="Entrar com Apple" short="Apple" onPress={() => void social("apple")}>
              <AppleMark size={form ? 16 : 20} />
            </Provider>
            <Provider compact={form} label="Entrar com Google" short="Google" onPress={() => void social("google")}>
              <GoogleMark size={form ? 16 : 19} />
            </Provider>
          </Animated.View>

          {!form && (
            <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(120)}>
              <Pressable onPress={openForm} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: "center", marginTop: 8, paddingVertical: 12, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.86)" }}>Entrar com e-mail</Text>
              </Pressable>
            </Animated.View>
          )}

          {form && (
            <Animated.View entering={FadeInDown.delay(80).duration(340)} style={{ marginTop: 14, gap: 12 }}>
              <Field
                ref={emailRef}
                label="E-mail"
                inset
                icon={Mail}
                value={email}
                error={note?.tone === "bad" && note.field === "email"}
                onChangeText={(t) => {
                  setEmail(t);
                  setNote(null);
                }}
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <PasswordField
                ref={passwordRef}
                label="Senha"
                inset
                value={password}
                error={note?.tone === "bad" && note.field === "password"}
                onChangeText={(t) => {
                  setPassword(t);
                  setNote(null);
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
            </Animated.View>
          )}

          {note && (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                marginTop: 14,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                borderRadius: 16,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderColor: note.tone === "bad" ? "rgba(248,113,113,0.25)" : note.tone === "good" ? "rgba(200,243,109,0.25)" : "rgba(255,255,255,0.14)",
                backgroundColor: note.tone === "bad" ? "rgba(248,113,113,0.08)" : note.tone === "good" ? "rgba(200,243,109,0.08)" : "rgba(255,255,255,0.06)",
              }}
            >
              {note.tone === "bad" ? <AlertTriangle size={16} color={RED} /> : note.tone === "good" ? <CircleCheck size={16} color={GREEN} /> : <Info size={16} color="rgba(255,255,255,0.8)" />}
              <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.88)" }}>{note.text}</Text>
            </Animated.View>
          )}

          {form && (
            <Animated.View entering={FadeInDown.delay(140).duration(340)}>
              <Pressable
                onPress={submit}
                disabled={busy}
                style={({ pressed }) => ({ marginTop: 16, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", transform: [{ scale: pressed ? 0.985 : 1 }] })}
              >
                {busy ? <ActivityIndicator color="#0B0B0B" /> : <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>Entrar</Text>}
              </Pressable>
              <Pressable onPress={sendReset} disabled={busy} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", marginTop: 4, paddingVertical: 12, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Esqueci minha senha</Text>
              </Pressable>
            </Animated.View>
          )}

          {busy && !form && <ActivityIndicator style={{ marginTop: 10 }} color="rgba(255,255,255,0.7)" />}

          <Text style={{ marginTop: 14, paddingHorizontal: 8, fontSize: 12.5, lineHeight: 18, color: INK.faint, textAlign: "center" }}>
            Ao continuar, você concorda com os{" "}
            <Text onPress={() => setLegal("terms")} style={{ fontWeight: "700", color: INK.soft, textDecorationLine: "underline" }}>
              Termos de Uso
            </Text>{" "}
            e{" "}
            <Text onPress={() => setLegal("privacy")} style={{ fontWeight: "700", color: INK.soft, textDecorationLine: "underline" }}>
              Política de Privacidade
            </Text>
            .
          </Text>
        </View>
      </BottomSheet>
      <LegalSheet which={legal} onClose={() => setLegal(null)} />
    </>
  );
}
