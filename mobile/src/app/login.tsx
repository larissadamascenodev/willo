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
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "~/supabase/client";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import Field, { PasswordField } from "~/components/auth/Field";
import { AppleMark, GoogleMark } from "~/components/auth/BrandIcons";
import { AlertTriangle, ChevronLeft, CircleCheck, Info, Mail } from "~/components/icons";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The door, for someone who already has an account.
 *
 * It opens on the choice: the Apple button, the Google button, and under them a
 * line for e-mail. Choosing e-mail does not go to another screen — the same page
 * grows the form, and the two big buttons fold up into two small cards at the top
 * of it, one glyph each, side by side, so the way in that was not chosen stays one
 * tap away without taking up the room the form needs.
 *
 * Apple and Google are drawn and answer a tap, but cannot sign anyone in yet: they
 * need the native build, and the Apple one needs the developer account that is not
 * there yet. The tap says so, and points at e-mail, rather than doing nothing.
 *
 * There is no "create an account" here: the welcome, one step back, is where that
 * lives, and offering it twice only gives someone who already has an account a
 * second way to go wrong.
 *
 * The button is always a button. It was dimmed to a third while the fields were
 * empty, which on a dark screen turns white into a grey bar that reads as a divider
 * — so the one control on the screen looked like it was not there. It stays solid
 * and answers a press that cannot go through by saying what is missing.
 */

const RESET_REDIRECT = "https://willo-app.vercel.app/reset-password";
const SITE = "https://willo-app.vercel.app";

type Note = { tone: "bad" | "good" | "info"; text: string; field?: "email" | "password" };

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Coming back from "confirm your e-mail", the address is already known — and the
     form is what they came for. */
  const params = useLocalSearchParams<{ email?: string }>();
  const known = typeof params.email === "string" ? params.email : "";
  const [form, setForm] = useState(!!known);
  const [email, setEmail] = useState(known);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  /* From the form, back is back to the choice; from the choice, it leaves. */
  const back = () => {
    if (form) {
      setForm(false);
      setNote(null);
      return;
    }
    router.canGoBack() ? router.back() : router.replace("/bem-vindo" as never);
  };

  const openForm = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setNote(null);
    setForm(true);
    /* Once the cards have folded away. */
    setTimeout(() => emailRef.current?.focus(), 380);
  };

  const soon = (who: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setNote({ tone: "info", text: `Entrar com ${who} chega em breve. Por enquanto, entre com o seu e-mail.` });
  };

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
          ? "E-mail ou senha incorretos. Se você entra pela Apple ou pelo Google, toque em “Esqueci minha senha” para criar uma."
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

  const transition = LinearTransition.duration(340);

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
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 18 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* The choice is centred in the page; the form starts near the top, where
              the keyboard will not cover it. */}
          <Animated.View layout={transition} style={{ flex: form ? 0 : 1, minHeight: form ? 28 : 0 }} />

          {/* ── Welcome back ── */}
          <Animated.View layout={transition} entering={FadeInDown.delay(60).duration(420)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 40, fontWeight: "300", letterSpacing: -1, lineHeight: 44, color: "#fff", textAlign: "center" }}>Bem-vindo</Text>
            <Text style={{ fontSize: 40, fontWeight: "800", letterSpacing: -1.4, lineHeight: 46, color: "#fff", textAlign: "center" }}>de volta.</Text>
          </Animated.View>

          {/* ── Apple and Google: two big buttons, or two small cards ── */}
          <Animated.View
            layout={transition}
            entering={FadeInDown.delay(160).duration(420)}
            style={{ marginTop: form ? 24 : 38, flexDirection: form ? "row" : "column", gap: form ? 10 : 12 }}
          >
            <Provider compact={form} label="Entrar com Apple" onPress={() => soon("a Apple")}>
              <AppleMark size={form ? 17 : 21} thin={form} />
            </Provider>
            <Provider compact={form} label="Entrar com Google" onPress={() => soon("o Google")}>
              <GoogleMark size={form ? 17 : 20} thin={form} />
            </Provider>
          </Animated.View>

          {/* ── Not a button's worth of attention: the e-mail way in ── */}
          {!form && (
            <Animated.View entering={FadeIn.delay(220).duration(300)} exiting={FadeOut.duration(120)}>
              <Pressable onPress={openForm} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: "center", marginTop: 14, paddingVertical: 12, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.86)" }}>Entrar com e-mail</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ── The form ── */}
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
                placeholder="••••••••"
                autoComplete="current-password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
            </Animated.View>
          )}

          {/* ── What happened, if anything ── */}
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
            <Animated.View entering={FadeInDown.delay(200).duration(380)}>
              {/* Solid, always. Whether it can go through is answered on the press. */}
              <Pressable
                onPress={submit}
                disabled={busy}
                style={({ pressed }) => ({
                  marginTop: 16,
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

              <Pressable onPress={sendReset} disabled={busy} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", marginTop: 8, paddingVertical: 12, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Esqueci minha senha</Text>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View layout={transition} style={{ flex: form ? 1 : 1.15, minHeight: 24 }} />

          {/* ── What going on means ── */}
          <Text style={{ paddingHorizontal: 8, fontSize: 13, lineHeight: 20, color: INK.faint, textAlign: "center" }}>
            Ao continuar, você concorda com os{" "}
            <Text onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/termos-de-uso`)} style={{ fontWeight: "700", color: INK.soft, textDecorationLine: "underline" }}>
              Termos de Uso
            </Text>{" "}
            e{" "}
            <Text onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/politica-privacidade`)} style={{ fontWeight: "700", color: INK.soft, textDecorationLine: "underline" }}>
              Política de Privacidade
            </Text>
            .
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Room>
  );
}

/**
 * One of the two outside ways in.
 *
 * Open, it is a long button with its solid glyph and its words; folded, it is half
 * of a row, slimmer, and only the glyph, as a line. The same component in both, so moving between them is
 * the layout animating rather than one thing being swapped for another.
 */
function Provider({
  compact,
  label,
  onPress,
  children,
}: {
  compact: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(340)} style={{ flex: compact ? 1 : undefined }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          height: compact ? 44 : 62,
          borderRadius: compact ? 22 : 31,
          borderCurve: "continuous",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.11)",
          backgroundColor: "rgba(255,255,255,0.07)",
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        {children}
        {!compact && (
          <Animated.Text entering={FadeIn.delay(160).duration(200)} exiting={FadeOut.duration(100)} style={{ fontSize: 16.5, fontWeight: "600", color: "#fff" }}>
            {label}
          </Animated.Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
