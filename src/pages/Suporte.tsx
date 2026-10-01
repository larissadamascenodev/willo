import { motion } from "framer-motion";
import { ChevronLeft, Clock, ExternalLink, HelpCircle, Mail, MessageCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/shared/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, supportMailto, supportWhatsApp } from "@/lib/support";

const INFO_ITEMS = [
  { icon: Clock, text: "Respondemos em até 2 dias úteis" },
  { icon: MessageCircle, text: "Atendimento humano, em português" },
  { icon: ShieldCheck, text: "Nunca pedimos sua senha" },
];

/**
 * Support page — open to anyone, with or without an account, because the App
 * Store listing points its support URL here.
 */
const Suporte = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 pb-12 pt-1">
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(user ? "/" : "/welcome"))}
        aria-label="Voltar"
        className="-ml-2 flex h-9 items-center text-white/70 transition-colors hover:text-white active:opacity-60"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[26px] font-extrabold tracking-tight text-white">Precisa de ajuda?</h1>
        <p className="mt-1 text-[14px] leading-snug text-white/50">
          Fale com a gente sobre qualquer coisa do Willo: dúvida, problema, sugestão ou sua conta.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="space-y-2.5">
        {INFO_ITEMS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white/[0.06]">
              <Icon className="h-4 w-4 text-white/70" />
            </span>
            <span className="text-[13.5px] text-white/60">{text}</span>
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2.5">
        <a
          href={supportMailto()}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-white text-[15px] font-bold text-[#0B0B0B] active:scale-[0.99]"
        >
          <Mail className="h-4 w-4" /> Enviar e-mail para o suporte
        </a>
        {SUPPORT_WHATSAPP && (
          <a
            href={supportWhatsApp()}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full border border-white/[0.1] willo-glass text-[15px] font-semibold text-white active:scale-[0.99]"
          >
            <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        )}
        <p className="text-center text-[12.5px] text-white/35">{SUPPORT_EMAIL}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.12] willo-glass"
      >
        <button type="button" onClick={() => navigate("/ajuda")} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left active:bg-white/[0.04]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.06]">
            <HelpCircle className="h-[18px] w-[18px] text-white/80" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-white">Central de ajuda</span>
            <span className="block text-[12.5px] text-white/45">Respostas para as dúvidas mais comuns</span>
          </span>
        </button>
        <div className="flex items-start gap-3.5 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.06]">
            <Trash2 className="h-[18px] w-[18px] text-white/80" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-white">Excluir sua conta</span>
            <span className="block text-[12.5px] leading-snug text-white/45">
              No app: Configurações → Dados → Excluir minha conta. Apaga tudo, sem volta. Se não conseguir entrar na conta, escreva para o nosso e-mail que a gente apaga para você.
            </span>
          </span>
        </div>
      </motion.div>

      <div className="flex flex-col items-center gap-2 pt-2">
        <Logo size="sm" className="opacity-40" />
        <div className="flex items-center gap-2 text-[12.5px] text-white/40">
          <button type="button" onClick={() => navigate("/termos-de-uso")} className="py-1">Termos de uso</button>
          <span className="text-white/20">·</span>
          <button type="button" onClick={() => navigate("/politica-privacidade")} className="py-1">Privacidade</button>
        </div>
      </div>
    </div>
  );
};

export default Suporte;
