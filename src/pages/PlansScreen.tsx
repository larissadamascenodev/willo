import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import Paywall from "@/components/onboarding-flow/Paywall";
import { BILLING_ENABLED } from "@/lib/billing";

/**
 * Willo Pro plans, opened from Configurações → Assinatura. Billing isn't
 * wired yet, so choosing a plan only explains that everything is unlocked.
 */
const PlansScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const name = (user?.user_metadata?.display_name as string | undefined) ?? (user?.user_metadata?.full_name as string | undefined);

  const leave = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  // Nothing to sell until the in-app purchase exists
  if (!BILLING_ENABLED) return <Navigate to="/" replace />;

  return (
    <div className="h-[100dvh] bg-black">
      <Paywall
        name={name}
        offerDiscount={false}
        onClose={leave}
        onPurchase={() => {
          toast("As assinaturas chegam em breve. Por enquanto, tudo no Willo está liberado pra você.");
          leave();
        }}
      />
    </div>
  );
};

export default PlansScreen;
