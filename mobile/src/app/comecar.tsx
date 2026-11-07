import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "~/supabase/client";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import Field, { PasswordField } from "~/components/auth/Field";
import LegalSheet from "~/components/auth/LegalSheet";
import Provider from "~/components/auth/Provider";
import { AppleMark, GoogleMark } from "~/components/auth/BrandIcons";
import { AlertTriangle, Check, ChevronLeft, Info, Mail } from "~/components/icons";
import Funnel from "~/components/onboarding/Funnel";
import { savePendingOnboarding, saveOnboardingAnswers } from "~/lib/onboarding";
import { GREEN, INK, RED } from "~/theme/tokens";
import { useThemeRedraw } from "~/theme/theme";

/**
 * The way in for someone new.
 *
 * First the onboarding (components/onboarding/Funnel): Willo's questions, what he will
 * do with the answers, the financial profile and the plans. Then the account, on a page
 * drawn like the sign-in: the Apple button, the Google button, a line for e-mail that
 * grows the form in place, and "Já tenho conta" for someone who already has one. The
 * onboarding stays mounted under it, so going back lands on the plans as they were.
 *
 * What was answered waits on the phone until the account is live and is written for
 * the person then — see lib/onboarding. If the project asks for e-mail confirmation,
 * the page says so and sends them to sign in once they have confirmed.
 */

const APP_URL = "https://willo-app.vercel.app";

type Note = { tone: "bad" | "info"; text: string; field?: "email" | "password" };

export default function Comecar() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [funnel, setFunnel] = useState(true);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const back = () => {
    setNote(null);
    if (confirmEmail) return setConfirmEmail(false);
    if (form) return setForm(false);
    setFunnel(true);
  };

  const openForm = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setNote(null);
    setForm(true);
    setTimeout(() => emailRef.current?.focus(), 380);
  };

  const soon = (who: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setNote({ tone: "info", text: `Criar conta com ${who} chega em breve. Por enquanto, use o seu e-mail.` });
  };

  const refuse = (text: string, field?: "email" | "password") => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setNote({ tone: "bad", text, field });
  };

  const createAccount = async () => {
    if (busy) return;
    if (!email.trim().includes("@")) return refuse("Digite o seu e-mail.", "email");
    if (password.length < 6) return refuse("A senha precisa ter pelo menos 6 caracteres.", "password");

    setBusy(true);
    setNote(null);
    await savePendingOnboarding({ email, name: name.trim(), goal, bank: null, balance: 0 });

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: APP_URL, data: { display_name: name.trim() } },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      refuse(
        msg.includes("already")
          ? "Esse e-mail já tem conta. Toque em “Já tenho conta” para entrar."
          : msg.includes("password")
            ? "Escolha uma senha mais forte, com letras e números."
            : "Não foi possível criar a conta agora. Tente de novo.",
      );
      setBusy(false);
      return;
    }

    /* An address that already has an account comes back as a success with no
       identities, so the answer that it exists cannot be an error. */
    if (data.user && data.user.identities?.length === 0) {
      refuse("Esse e-mail já tem conta. Toque em “Já tenho conta” para entrar.");
      setBusy(false);
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    /* With a session, the auth listener swaps the screen. Without one the project is
       waiting for the e-mail to be confirmed. */
    if (!data.session) {
      setConfirmEmail(true);
      setBusy(false);
    }
  };

  const funnelView = (
    <View style={funnel ? { flex: 1 } : { display: "none" }}>
      <Funnel
        onExit={() => (router.canGoBack() ? router.back() : router.replace("/bem-vindo" as never))}
        onDone={(answers, plan) => {
          setName(answers.name.trim());
          setGoal(answers.goal);
          void saveOnboardingAnswers({ ...answers, plan });
          setFunnel(false);
        }}
      />
    </View>
  );

  if (funnel) return funnelView;

  const transition = LinearTransition.duration(340);
  const first = name.split(" ")[0];

  return (
    <>
      {funnelView}
      <Room lit sky={false}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
            <Pressable onPress={back} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}>
              <Glass radius={20} interactive style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
              </Glass>
            </Pressable>
          </View>

          {confirmEmail ? (
            <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingBottom: 60 }}>
              <Animated.View entering={ZoomIn.springify().damping(12).stiffness(380)} style={{ width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}>
                <Check size={34} color="#0B0B0B" strokeWidth={3.2} />
              </Animated.View>
              <Text style={{ marginTop: 22, fontSize: 28, fontWeight: "800", letterSpacing: -0.9, color: "#fff", textAlign: "center" }}>Confirme o seu e-mail</Text>
              <Text style={{ marginTop: 10, maxWidth: 320, fontSize: 15.5, lineHeight: 22, color: INK.soft, textAlign: "center" }}>
                Enviamos um link para <Text style={{ fontWeight: "700", color: "#fff" }}>{email.trim()}</Text>. Abra, confirme e volte aqui para entrar.
              </Text>
              <Pressable
                onPress={() => router.replace({ pathname: "/login", params: { email: email.trim() } } as never)}
                style={({ pressed }) => ({ marginTop: 28, alignSelf: "stretch", height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}
              >
                <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>Já confirmei, entrar</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Animated.View layout={transition} style={{ flex: form ? 0 : 1, minHeight: form ? 28 : 0 }} />

              <Animated.View layout={transition} entering={FadeInDown.delay(60).duration(420)} style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 38, fontWeight: "300", letterSpacing: -1, lineHeight: 44, color: "#fff", textAlign: "center" }}>{first ? `${first}, crie` : "Crie"}</Text>
                <Text style={{ fontSize: 38, fontWeight: "800", letterSpacing: -1.3, lineHeight: 44, color: "#fff", textAlign: "center" }}>sua conta.</Text>
                {!form && <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 21, color: INK.soft, textAlign: "center" }}>Seu perfil e o que você me contou ficam guardados nela.</Text>}
              </Animated.View>

              <Animated.View layout={transition} entering={FadeInDown.delay(160).duration(420)} style={{ marginTop: form ? 24 : 34, flexDirection: form ? "row" : "column", gap: form ? 10 : 12 }}>
                <Provider compact={form} label="Continuar com Apple" short="Apple" onPress={() => soon("a Apple")}>
                  <AppleMark size={form ? 16 : 20} />
                </Provider>
                <Provider compact={form} label="Continuar com Google" short="Google" onPress={() => soon("o Google")}>
                  <GoogleMark size={form ? 16 : 19} />
                </Provider>
              </Animated.View>

              {!form && (
                <Animated.View entering={FadeIn.delay(220).duration(300)} exiting={FadeOut.duration(120)} style={{ alignItems: "center" }}>
                  <Pressable onPress={openForm} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 14, paddingVertical: 12, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.86)" }}>Continuar com e-mail</Text>
                  </Pressable>
                  <Pressable onPress={() => router.replace("/login" as never)} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ fontSize: 15, color: INK.soft }}>
                      Já tenho conta · <Text style={{ fontWeight: "700", color: "#fff" }}>Entrar</Text>
                    </Text>
                  </Pressable>
                </Animated.View>
              )}

              {form && (
                <Animated.View entering={FadeInDown.delay(120).duration(380)} style={{ marginTop: 14, gap: 12 }}>
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
                    placeholder="Pelo menos 6 caracteres"
                    autoComplete="new-password"
                    onSubmitEditing={createAccount}
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
                    borderColor: note.tone === "bad" ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.14)",
                    backgroundColor: note.tone === "bad" ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {note.tone === "bad" ? <AlertTriangle size={16} color={RED} /> : <Info size={16} color="rgba(255,255,255,0.8)" />}
                  <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.88)" }}>{note.text}</Text>
                </Animated.View>
              )}

              {form && (
                <Animated.View entering={FadeInDown.delay(200).duration(380)}>
                  <Pressable
                    onPress={createAccount}
                    disabled={busy}
                    style={({ pressed }) => ({ marginTop: 16, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", transform: [{ scale: pressed ? 0.985 : 1 }] })}
                  >
                    {busy ? <ActivityIndicator color="#0B0B0B" /> : <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>Criar conta</Text>}
                  </Pressable>
                  <Pressable onPress={() => router.replace("/login" as never)} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", marginTop: 8, paddingVertical: 12, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Já tenho conta</Text>
                  </Pressable>
                </Animated.View>
              )}

              <Animated.View layout={transition} style={{ flex: form ? 1 : 1.15, minHeight: 24 }} />

              <Text style={{ paddingHorizontal: 8, fontSize: 13, lineHeight: 20, color: INK.faint, textAlign: "center" }}>
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
            </ScrollView>
          )}
        </KeyboardAvoidingView>
        <LegalSheet which={legal} onClose={() => setLegal(null)} />
      </Room>
    </>
  );
}
