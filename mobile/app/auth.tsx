import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { ChevronLeft, Mail, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/integrations/supabase/client";
import { WEB_URL } from "~/config";
import { Background, Button, Field, Logo, Text, toast, white } from "~/ui";

/** "Já tenho conta" / "Criar conta": Apple em cima, e-mail e senha logo abaixo. */
export default function Auth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isLogin = mode !== "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) return toast.error("Preencha e-mail e senha");
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // a sessão muda o estado de login e a raiz do app leva para o início
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: WEB_URL } });
        if (error) throw error;
        if (!data.session) {
          toast.success("Conta criada! Confirme pelo link que enviamos pro seu e-mail.");
          router.replace({ pathname: "/auth", params: { mode: "login" } });
        }
      }
    } catch (error: any) {
      const message = String(error?.message ?? "");
      toast.error(
        message.includes("Invalid login") ? "E-mail ou senha incorretos"
          : message.includes("already registered") ? "Esse e-mail já tem conta. Volte e entre."
          : message || "Não foi possível continuar",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) return toast.error("Digite seu e-mail primeiro");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${WEB_URL}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link pra você criar uma senha nova.");
  };

  const signInWithApple = async () => {
    // No Expo Go o "app" que pede o login é o próprio Expo Go, e o Supabase só aceita o com.willo.app.
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return toast.info("Entrar com a Apple funciona no app instalado (TestFlight). No Expo Go, use e-mail e senha.");
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error("sem token");
      const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken });
      if (error) throw error;
    } catch (error: any) {
      if (error?.code === "ERR_REQUEST_CANCELED") return;
      toast.error("Erro ao entrar com a Apple");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1220" }}>
      <Background />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}
        >
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
            accessibilityLabel="Voltar"
            style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 18, borderWidth: 1, borderColor: white(0.1), backgroundColor: white(0.06), alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <ChevronLeft size={24} color="#fff" />
          </Pressable>

          <View style={{ alignItems: "center", marginTop: 28 }}>
            <Logo height={28} />
            <View style={{ marginTop: 26, alignItems: "center" }}>
              <Text size={38} weight="regular" style={{ lineHeight: 42 }}>{isLogin ? "Bem-vindo" : "Crie sua"}</Text>
              <Text size={42} weight="extrabold" style={{ lineHeight: 46 }}>{isLogin ? "de volta." : "conta."}</Text>
            </View>
            {!isLogin && <Text size={15} color={white(0.66)} style={{ marginTop: 10 }}>Pra salvar seu plano e seus dados.</Text>}
          </View>

          <View style={{ marginTop: 32, gap: 12 }}>
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={isLogin ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={29}
                style={{ height: 58 }}
                onPress={signInWithApple}
              />
            )}

            <Field
              label="E-mail"
              icon={<Mail size={20} color={white(0.56)} />}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
            />
            <Field
              label="Senha"
              icon={<Lock size={20} color={white(0.56)} />}
              value={password}
              onChangeText={setPassword}
              placeholder={isLogin ? "••••••••" : "Crie uma senha"}
              secret
              autoCapitalize="none"
              autoComplete={isLogin ? "current-password" : "new-password"}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <View style={{ marginTop: 4 }}>
              <Button label={isLogin ? "Entrar" : "Criar conta"} onPress={submit} loading={submitting} />
            </View>

            {isLogin && (
              <Pressable onPress={forgotPassword} style={{ alignSelf: "center", paddingVertical: 8 }}>
                <Text size={15} weight="medium" color={white(0.56)}>Esqueci minha senha</Text>
              </Pressable>
            )}
          </View>

          <Text size={13} color={white(0.56)} align="center" style={{ marginTop: 28, lineHeight: 20 }}>
            Ao continuar, você concorda com os{" "}
            <Text size={13} weight="bold" color={white(0.74)} style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${WEB_URL}/termos-de-uso`)}>
              Termos de Uso
            </Text>{" "}
            e a{" "}
            <Text size={13} weight="bold" color={white(0.74)} style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${WEB_URL}/politica-privacidade`)}>
              Política de Privacidade
            </Text>
            .
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
