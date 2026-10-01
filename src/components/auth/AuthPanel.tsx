import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { supabase } from "@/integrations/supabase/client";
import GlowButton from "@/components/shared/GlowButton";
import LegalModal from "@/components/shared/LegalModal";
import { showWelcomeToast } from "@/components/shared/welcomeToast";
import { markSkipLegacyOnboarding, type PendingOnboardingProfile } from "@/lib/onboardingQuiz";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";

const AppleIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.015.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1 3.902-1 .613 0 2.886.06 4.407 2.19-.118.08-2.319 1.35-2.319 4.13 0 3.32 2.94 4.45 2.94 4.5z" />
  </svg>
);

const GoogleIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.64 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.56 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12s4.15 9.25 9.25 9.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
  </svg>
);

interface Props {
  mode: "login" | "signup";
  onBack: () => void;
  /** Signup only: what the onboarding collected, saved once a session exists. */
  pendingProfile?: PendingOnboardingProfile;
}

/**
 * The "Bem-vindo de volta" / "Crie sua conta" screen: Apple and Google up
 * front, and e-mail tucked behind a link that expands the form in place.
 */
const AuthPanel = ({ mode, onBack, pendingProfile }: Props) => {
  const navigate = useNavigate();
  const isLogin = mode === "login";
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  const rememberProfile = () => {
    if (!isLogin) markSkipLegacyOnboarding(pendingProfile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showWelcomeToast(data.session?.user?.user_metadata?.display_name ?? null);
        navigate("/", { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: pendingProfile?.displayName ? { display_name: pendingProfile.displayName } : undefined,
          },
        });
        if (error) throw error;
        rememberProfile();
        if (data.session) {
          showWelcomeToast(pendingProfile?.displayName ?? null);
          navigate("/", { replace: true });
        } else {
          // The project still asks for e-mail confirmation
          toast.success("Conta criada! Confirme pelo link que enviamos pro seu e-mail.");
          navigate("/auth", { replace: true });
        }
      }
    } catch (error: any) {
      const msg = String(error?.message ?? "");
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou senha incorretos"
          : msg.includes("already registered") ? "Esse e-mail já tem conta. Toque em voltar e entre."
          : msg || "Não foi possível continuar",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      toast.error("Digite seu e-mail primeiro");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link pra você criar uma senha nova.");
  };

  const handleGoogle = async () => {
    rememberProfile();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
    if (error) toast.error("Erro ao entrar com Google");
  };

  const handleApple = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.info("Entrar com a Apple funciona no app do iPhone — aqui no navegador é só a interface.");
      return;
    }
    try {
      const result = await SignInWithApple.authorize({ clientId: "com.willo.app", redirectURI: window.location.origin, scopes: "email name" });
      const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: result.response.identityToken });
      if (error) throw error;
      rememberProfile();
      navigate("/", { replace: true });
    } catch {
      toast.error("Erro ao entrar com a Apple");
    }
  };

  const socialBtn = "flex h-[58px] w-full items-center justify-center gap-3 rounded-full border border-white/[0.12] willo-glass text-[15px] font-medium uppercase tracking-[0.04em] text-white transition-transform active:scale-[0.98]";

  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden bg-black"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Soft light at the top corners */}
      <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-white/[0.07] blur-[100px]" />
      <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-[100px]" />

      <div className="relative shrink-0 px-6 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06] text-white transition-transform active:scale-95"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <motion.main layout className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 ${emailOpen ? "justify-start pt-4" : "justify-center"}`}>
        <motion.div layout className="flex flex-col items-center text-center">
          <img src={wordmarkOnDark} alt="Willo" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          <h1 className="mt-7 leading-[1.05] tracking-tight text-white">
            <span className="block text-[40px] font-light">{isLogin ? "Bem-vindo" : "Crie sua"}</span>
            <span className="block text-[44px] font-extrabold">{isLogin ? "de volta." : "conta."}</span>
          </h1>
          {!isLogin && <p className="mt-3 text-[15px] text-white/66">Pra salvar seu plano e seus dados.</p>}
        </motion.div>

        <motion.div layout className="mt-9 space-y-3">
          <button type="button" onClick={handleApple} className={socialBtn}>
            <AppleIcon /> {isLogin ? "Entrar com Apple" : "Continuar com Apple"}
          </button>
          <button type="button" onClick={handleGoogle} className={socialBtn}>
            <GoogleIcon /> {isLogin ? "Entrar com Google" : "Continuar com Google"}
          </button>
        </motion.div>

        <AnimatePresence initial={false} mode="popLayout">
          {!emailOpen ? (
            <motion.button
              key="link"
              type="button"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEmailOpen(true)}
              className="mx-auto mt-6 text-[15px] font-bold text-white/74 active:text-white"
            >
              {isLogin ? "Entrar com e-mail" : "Criar com e-mail"}
            </motion.button>
          ) : (
            <motion.form
              key="form"
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onSubmit={handleSubmit}
              className="mt-3 space-y-3"
            >
              <label className="block rounded-[22px] border border-white/[0.1] bg-[#0B0B0B] px-5 py-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/66">E-mail</span>
                <span className="mt-1.5 flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-white/56" />
                  <input
                    type="email"
                    autoFocus
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[17px] text-white placeholder:text-white/50 focus:outline-none"
                  />
                </span>
              </label>
              <label className="block rounded-[22px] border border-white/[0.1] bg-[#0B0B0B] px-5 py-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/66">Senha</span>
                <span className="mt-1.5 flex items-center gap-3">
                  <Lock className="h-5 w-5 shrink-0 text-white/56" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={isLogin ? "••••••••" : "Crie uma senha"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[17px] text-white placeholder:text-white/50 focus:outline-none"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="text-white/56">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </span>
              </label>

              <GlowButton type="submit" variant="dark" disabled={submitting} className="pt-1">
                {submitting ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
              </GlowButton>

              {isLogin && (
                <button type="button" onClick={handleForgot} className="mx-auto block pt-2 text-[15px] font-medium text-white/56 active:text-white">
                  Esqueci minha senha
                </button>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        <motion.p layout className="mx-auto mt-8 max-w-[320px] text-center text-[14px] leading-relaxed text-white/56">
          Ao continuar, você concorda com os{" "}
          <button type="button" onClick={() => setLegal("terms")} className="font-bold text-white/74 underline underline-offset-2">
            Termos de Uso
          </button>{" "}
          e{" "}
          <button type="button" onClick={() => setLegal("privacy")} className="font-bold text-white/74 underline underline-offset-2">
            Política de Privacidade
          </button>
          .
        </motion.p>
      </motion.main>

      <LegalModal open={!!legal} onClose={() => setLegal(null)} type={legal || "terms"} />
    </div>
  );
};

export default AuthPanel;
