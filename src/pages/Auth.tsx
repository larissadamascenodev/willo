import { motion } from "framer-motion";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/shared/Logo";
import AuthPanel from "@/components/auth/AuthPanel";
import { useAuth } from "@/contexts/AuthContext";

/**
 * "Já tenho conta" — reached from the welcome screen. Apple and Google up
 * front, e-mail behind a link that expands the form (see AuthPanel).
 */
const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = (location.state as { mode?: "login" | "signup" } | null)?.mode === "signup" ? "signup" : "login";

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
          <Logo size="sm" className="animate-pulse" />
          <span className="text-sm text-white/56">Carregando...</span>
        </motion.div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return <AuthPanel mode={mode} onBack={() => navigate("/welcome")} />;
};

export default Auth;
