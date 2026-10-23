import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import GlowButton from "@/components/shared/GlowButton";
import LegalModal from "@/components/shared/LegalModal";
import { PhoneCarousel } from "@/components/onboarding-flow/Paywall";
import { VERDE_AGUA } from "@/components/onboarding-v2/tokens";
import {
  ANUAL_POR_MES,
  DESCONTO_ANUAL_PCT,
  DIAS_DE_TESTE,
  linhaDeCobranca,
  PAYWALL_ENABLED,
  PRECO_MENSAL,
  reais,
  type PlanoId,
} from "@/lib/paywallPricing";
import { CheckoutIndisponivelError, iniciarCheckout } from "@/services/checkout";
import { cn } from "@/lib/utils";

/**
 * The last screen: the plan they just saw, and what it costs to keep it.
 *
 * Two ways past it that are not the purchase — the X and "Ver o app primeiro" — both of
 * which record that the paywall was dismissed and let the person in. A paywall nobody
 * can leave is a paywall the stores reject.
 */

interface Props {
  nome: string;
  onPaywallView: () => void;
  onCta: (plano: PlanoId) => void;
  /** The X and the link below: dismissed, and into the app. */
  onDismiss: () => void;
}

export default function PaywallV2({ nome, onPaywallView, onCta, onDismiss }: Props) {
  const [plano, setPlano] = useState<PlanoId>("anual");
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [comprando, setComprando] = useState(false);
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";

  useEffect(() => {
    onPaywallView();
  }, [onPaywallView]);

  const comprar = async () => {
    if (comprando) return;
    /* Billing off: the screen is still worth showing, but the button only finishes. */
    if (!PAYWALL_ENABLED) {
      onCta(plano);
      return;
    }
    setComprando(true);
    try {
      await iniciarCheckout(plano);
    } catch (e) {
      /* No checkout exists yet, so nobody is let in on a purchase that never happened. */
      toast.error(
        e instanceof CheckoutIndisponivelError
          ? "O pagamento ainda não está disponível."
          : "Não conseguimos abrir o pagamento. Tente de novo.",
      );
    } finally {
      setComprando(false);
    }
  };

  return (
    <div
      className="relative flex h-full flex-col bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative grid h-14 shrink-0 grid-cols-[48px_1fr_48px] items-center px-3">
        <span />
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/62">Conta</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar e ver o app"
          className="flex h-11 w-11 items-center justify-center text-white/70 active:opacity-60"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">
        <h1 className="text-center text-[27px] leading-[1.14] tracking-tight text-white">
          <span className="block font-light">{primeiro || "Seu plano"},</span>
          <span className="block font-extrabold">seu plano está pronto.</span>
        </h1>

        <div className="mt-5 h-[210px]">
          <PhoneCarousel />
        </div>

        <div className="mt-6 space-y-3">
          <PlanoOpcao
            selecionado={plano === "anual"}
            onClick={() => setPlano("anual")}
            titulo="Anual"
            destaque={`${reais(ANUAL_POR_MES)}/mês`}
            apoio={`Cobrado uma vez por ano`}
            selo={DESCONTO_ANUAL_PCT > 0 ? `${DESCONTO_ANUAL_PCT}% menos que o mensal` : undefined}
          />
          <PlanoOpcao
            selecionado={plano === "mensal"}
            onClick={() => setPlano("mensal")}
            titulo="Mensal"
            destaque={`${reais(PRECO_MENSAL)}/mês`}
            apoio="Cobrado todo mês"
          />
        </div>

        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-white/60">{linhaDeCobranca(plano)}</p>
      </div>

      <div className="shrink-0 space-y-3 px-6 pb-5 pt-4">
        <GlowButton variant="light" disabled={comprando} onClick={comprar}>
          {comprando ? "Abrindo…" : `Começar ${DIAS_DE_TESTE} dias grátis`}
        </GlowButton>

        <button
          type="button"
          onClick={onDismiss}
          className="mx-auto block min-h-[44px] px-4 text-[14px] text-white/62 underline underline-offset-4"
        >
          Ver o app primeiro
        </button>

        <p className="text-center text-[12px] t-softer">
          <button type="button" onClick={() => setLegal("terms")} className="underline underline-offset-2">
            Termos de Uso
          </button>
          {" · "}
          <button type="button" onClick={() => setLegal("privacy")} className="underline underline-offset-2">
            Política de Privacidade
          </button>
        </p>
      </div>

      <LegalModal open={!!legal} onClose={() => setLegal(null)} type={legal ?? "terms"} />
    </div>
  );
}

function PlanoOpcao({ selecionado, onClick, titulo, destaque, apoio, selo }: {
  selecionado: boolean;
  onClick: () => void;
  titulo: string;
  destaque: string;
  apoio: string;
  selo?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      aria-pressed={selecionado}
      className={cn(
        "relative flex w-full items-center gap-3.5 rounded-[22px] border px-5 py-4 text-left transition-colors",
        selecionado ? "border-white bg-white/[0.08]" : "border-white/[0.08] willo-glass",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          selecionado ? "border-transparent" : "border-white/20",
        )}
        style={selecionado ? { background: VERDE_AGUA } : undefined}
      >
        {selecionado && <Check className="h-3.5 w-3.5 text-[#0B0B0B]" strokeWidth={3.5} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{titulo}</span>
        <span className="block text-[12.5px] t-soft">{apoio}</span>
      </span>

      <span className="text-right">
        <span className="block text-[19px] font-extrabold tabular-nums text-white">{destaque}</span>
        {selo && (
          <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: VERDE_AGUA }}>
            {selo}
          </span>
        )}
      </span>
    </motion.button>
  );
}
