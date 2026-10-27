import { useState, type ReactNode } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInRight, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BANKS } from "@/lib/banks";
import { supabase } from "~/supabase/client";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import Field, { PasswordField } from "~/components/auth/Field";
import { Check, ChevronLeft, Mail } from "~/components/icons";
import { savePendingOnboarding } from "~/lib/onboarding";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The questions that make an account — for someone new.
 *
 * Four short steps, one thing at a time: what to call them, what they want from the
 * app, the account they use most, and last the e-mail and password. The account
 * comes last on purpose. By then they have already said who they are and what they
 * want, so being asked for a password feels like the end of something rather than
 * a wall at the start.
 *
 * What they said waits on the phone until the account is live, and is written for
 * them then — see lib/onboarding. If the project asks for e-mail confirmation, the
 * last screen says so and sends them to sign in once they have confirmed.
 */

const GOALS = [
  { id: "ver", label: "Saber para onde vai o meu dinheiro", hint: "Gastos por categoria, mês a mês" },
  { id: "controlar", label: "Parar de fechar o mês no vermelho", hint: "Contas, vencimentos e saldo previsto" },
  { id: "juntar", label: "Juntar dinheiro para uma meta", hint: "Uma viagem, uma reserva, um sonho" },
  { id: "cartoes", label: "Organizar cartões e parcelas", hint: "Faturas, limites e quando você fica livre" },
] as const;

const OTHER = "Outra";
const STEPS = 4;
const APP_URL = "https://willo-app.vercel.app";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Comecar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [bank, setBank] = useState<string | null>(null);
  const [otherBank, setOtherBank] = useState("");
  const [cents, setCents] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const accountName = bank === OTHER ? otherBank.trim() : bank;

  const back = () => {
    setNote(null);
    if (confirmEmail) {
      setConfirmEmail(false);
      return;
    }
    if (step === 0) router.canGoBack() ? router.back() : router.replace("/bem-vindo" as never);
    else setStep((s) => s - 1);
  };

  const next = () => {
    setNote(null);
    void Haptics.selectionAsync().catch(() => undefined);
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };

  /** Each button is solid; what is missing is said when it is pressed. */
  const advance = () => {
    if (step === 0) {
      if (name.trim().length < 2) return setNote("Como posso te chamar?");
      return next();
    }
    if (step === 1) return next();
    if (step === 2) {
      if (bank === OTHER && accountName!.length < 2) return setNote("Escreva o nome da conta.");
      return next();
    }
  };

  const createAccount = async () => {
    if (busy) return;
    if (!email.trim().includes("@")) return setNote("Digite o seu e-mail.");
    if (password.length < 6) return setNote("A senha precisa ter pelo menos 6 caracteres.");

    setBusy(true);
    setNote(null);
    await savePendingOnboarding({
      email,
      name: name.trim(),
      goal,
      bank: accountName || null,
      balance: cents / 100,
    });

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: APP_URL, data: { display_name: name.trim() } },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      setNote(
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
      setNote("Esse e-mail já tem conta. Toque em “Já tenho conta” para entrar.");
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

  return (
    <Room lit sky>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Back, and how far along ── */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable onPress={back} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Glass radius={20} interactive style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
            </Glass>
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i <= step || confirmEmail ? "#fff" : "rgba(255,255,255,0.16)",
                }}
              />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {confirmEmail ? (
            <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 60 }}>
              <Animated.View
                entering={ZoomIn.springify().damping(12).stiffness(380)}
                style={{ width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}
              >
                <Check size={34} color="#0B0B0B" strokeWidth={3.2} />
              </Animated.View>
              <Text style={{ marginTop: 22, fontSize: 28, fontWeight: "800", letterSpacing: -0.9, color: "#fff", textAlign: "center" }}>
                Confirme o seu e-mail
              </Text>
              <Text style={{ marginTop: 10, maxWidth: 320, fontSize: 15.5, lineHeight: 22, color: INK.soft, textAlign: "center" }}>
                Enviamos um link para <Text style={{ fontWeight: "700", color: "#fff" }}>{email.trim()}</Text>. Abra, confirme e volte aqui para entrar.
              </Text>
            </Animated.View>
          ) : (
            <Animated.View key={step} entering={FadeInRight.duration(320)}>
              {step === 0 && (
                <>
                  <Heading>Como posso{"\n"}te chamar?</Heading>
                  <Sub>É assim que o Willo vai falar com você.</Sub>
                  <TextInput
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      setNote(null);
                    }}
                    placeholder="Seu nome"
                    placeholderTextColor={INK.faint}
                    autoFocus
                    autoCapitalize="words"
                    autoComplete="given-name"
                    returnKeyType="next"
                    onSubmitEditing={advance}
                    style={{
                      marginTop: 34,
                      paddingVertical: 10,
                      fontSize: 34,
                      fontWeight: "700",
                      letterSpacing: -0.8,
                      color: "#fff",
                      borderBottomWidth: 2,
                      borderBottomColor: name ? GREEN : "rgba(255,255,255,0.18)",
                    }}
                  />
                </>
              )}

              {step === 1 && (
                <>
                  <Heading>{name.trim().split(" ")[0]}, o que você{"\n"}quer do Willo?</Heading>
                  <Sub>Escolha o que mais combina com você agora.</Sub>
                  <View style={{ marginTop: 26, gap: 10 }}>
                    {GOALS.map((g, i) => {
                      const on = goal === g.id;
                      return (
                        <Animated.View key={g.id} entering={FadeInRight.delay(60 + i * 50).duration(300)}>
                          <Pressable
                            onPress={() => {
                              setGoal(g.id);
                              setNote(null);
                              void Haptics.selectionAsync().catch(() => undefined);
                              setTimeout(next, 320);
                            }}
                            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
                          >
                            <Glass
                              radius={20}
                              interactive
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                paddingHorizontal: 16,
                                paddingVertical: 15,
                                borderWidth: 1,
                                borderColor: on ? "#fff" : "rgba(255,255,255,0.08)",
                              }}
                            >
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{g.label}</Text>
                                <Text style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>{g.hint}</Text>
                              </View>
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderWidth: on ? 0 : 1.5,
                                  borderColor: "rgba(255,255,255,0.28)",
                                  backgroundColor: on ? "#fff" : "transparent",
                                }}
                              >
                                {on && <Check size={14} color="#0B0B0B" strokeWidth={3.2} />}
                              </View>
                            </Glass>
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <Heading>Qual é a sua{"\n"}conta principal?</Heading>
                  <Sub>Onde o seu dinheiro entra e sai. Você pode adicionar outras depois.</Sub>

                  <View style={{ marginTop: 26, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {[...BANKS.map((b) => ({ name: b.name, hex: b.hex })), { name: OTHER, hex: "#8B8D94" }].map((b) => {
                      const on = bank === b.name;
                      return (
                        <Pressable
                          key={b.name}
                          onPress={() => {
                            setBank(on ? null : b.name);
                            setNote(null);
                            void Haptics.selectionAsync().catch(() => undefined);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            height: 42,
                            paddingHorizontal: 14,
                            borderRadius: 21,
                            borderWidth: 1,
                            borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
                            backgroundColor: on ? "#fff" : "rgba(255,255,255,0.05)",
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          })}
                        >
                          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: b.hex }} />
                          <Text style={{ fontSize: 14.5, fontWeight: "600", color: on ? "#0B0B0B" : "#fff" }}>{b.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {bank === OTHER && (
                    <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 18 }}>
                      <Field
                        label="Nome da conta"
                        value={otherBank}
                        onChangeText={(t) => {
                          setOtherBank(t);
                          setNote(null);
                        }}
                        placeholder="Ex.: Carteira, Sicredi…"
                        autoCapitalize="words"
                      />
                    </Animated.View>
                  )}

                  {bank && (
                    <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 26 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: INK.softer }}>
                        Quanto tem nela hoje? <Text style={{ textTransform: "none", letterSpacing: 0, color: INK.faint }}>(opcional)</Text>
                      </Text>
                      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: INK.softer }}>R$</Text>
                        <TextInput
                          value={brl(cents)}
                          onChangeText={(t) => setCents(Number(t.replace(/\D/g, "") || "0"))}
                          keyboardType="number-pad"
                          style={{ flex: 1, fontSize: 36, fontWeight: "800", letterSpacing: -1, color: "#fff", padding: 0 }}
                        />
                      </View>
                    </Animated.View>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <Heading>Agora, crie a{"\n"}sua conta.</Heading>
                  <Sub>É com ela que você entra aqui e no navegador.</Sub>
                  <View style={{ marginTop: 28, gap: 12 }}>
                    <Field
                      label="E-mail"
                      inset
                      icon={Mail}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setNote(null);
                      }}
                      placeholder="seu@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                    />
                    <PasswordField
                      label="Senha"
                      inset
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        setNote(null);
                      }}
                      placeholder="Pelo menos 6 caracteres"
                      autoComplete="new-password"
                      onSubmitEditing={createAccount}
                      returnKeyType="go"
                    />
                  </View>
                </>
              )}

              {note && <Text style={{ marginTop: 16, fontSize: 14, lineHeight: 20, color: RED }}>{note}</Text>}
            </Animated.View>
          )}
        </ScrollView>

        {/* ── The one button ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 14 }}>
          {confirmEmail ? (
            <Pressable
              onPress={() => router.replace({ pathname: "/login", params: { email: email.trim() } } as never)}
              style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>Já confirmei, entrar</Text>
            </Pressable>
          ) : step === 1 && !goal ? null : (
            <>
              <Pressable
                onPress={step === 3 ? createAccount : advance}
                disabled={busy}
                style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}
              >
                {busy ? (
                  <ActivityIndicator color="#0B0B0B" />
                ) : (
                  <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>{step === 3 ? "Criar conta" : "Continuar"}</Text>
                )}
              </Pressable>
              {step === 2 && (
                <Pressable
                  onPress={() => {
                    setBank(null);
                    setCents(0);
                    next();
                  }}
                  style={({ pressed }) => ({ marginTop: 6, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ fontSize: 14, color: INK.soft }}>Pular por enquanto</Text>
                </Pressable>
              )}
              {step === 3 && (
                <Pressable
                  onPress={() => router.replace("/login" as never)}
                  style={({ pressed }) => ({ marginTop: 6, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ fontSize: 14, color: INK.soft }}>Já tenho conta</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Room>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 34, fontWeight: "800", letterSpacing: -1.2, lineHeight: 38, color: "#fff" }}>{children}</Text>;
}

function Sub({ children }: { children: ReactNode }) {
  return <Text style={{ marginTop: 10, fontSize: 15.5, lineHeight: 22, color: INK.soft }}>{children}</Text>;
}
