import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import WelcomeShowcase from "@/components/auth/WelcomeShowcase";
import GlowButton from "@/components/shared/GlowButton";
import { readOnboardingProgress } from "@/lib/onboardingProgress";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";

const SPLASH_DURATION_MS = 1300;

const Welcome = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <img src={wordmarkOnDark} alt="Willo" className="h-6 w-auto animate-pulse" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-white/40 text-sm">Carregando...</span>
        </motion.div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  // Already answered the onboarding here: go back to the result, not the start
  if (readOnboardingProgress()) return <Navigate to="/onboarding" replace />;

  return (
    <div
      className="h-[100dvh] bg-black flex flex-col relative overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
              }}
    >
      <AnimatePresence mode="wait">
        {showSplash ? (
          /* Launch animation: just the wordmark, centered, before the welcome
             screen reveals. Shares layoutId with the header logo below so the
             transition tweens smoothly from big/centered to small/top. */
          <motion.div
            key="splash"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex-1 flex items-center justify-center"
          >
            <motion.div
              layoutId="willo-wordmark"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src={wordmarkOnDark} alt="Willo" className="h-14 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Ambient glows, like light spilling from behind the phone */}
            <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-white/[0.06] blur-[100px]" />
            <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-white/[0.045] blur-[100px]" />

            {/* Top: logo (now small, shares the layout transition from splash) */}
            <motion.div
              layoutId="willo-wordmark"
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex items-center justify-center px-6 pt-6 pb-1 shrink-0"
            >
              <img src={wordmarkOnDark} alt="Willo" className="h-6 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </motion.div>

            {/* A real-looking phone playing the app on loop */}
            <WelcomeShowcase />

            {/* Fixed headline + actions */}
            <div className="relative px-5 pb-4 shrink-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-center"
              >
                <h1 className="font-display text-[25px] font-extrabold leading-tight tracking-tight text-white">
                  Gaste melhor, guarde mais.
                </h1>
                <p className="mt-1 text-[15px] text-white/50">Tudo calculado pro seu bolso.</p>
              </motion.div>

              {/* White pill with a beam of light circling it */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="mt-6"
              >
                <GlowButton variant="light" onClick={() => navigate("/onboarding")}>
                  Começar agora
                </GlowButton>
              </motion.div>

              <button
                type="button"
                onClick={() => navigate("/auth", { state: { mode: "login" } })}
                className="mt-4 w-full text-center text-[14px] text-white/50 transition-colors active:text-white"
              >
                Já tenho conta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Welcome;
