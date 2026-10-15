import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import BotMark from "@/components/registro/BotMark";

/**
 * Agentes, before there are any.
 *
 * The nav already points here, so the screen has to exist; what it must not do is
 * pretend. It says what is coming and that it is not here yet, and offers nothing to
 * press, because a disabled control is a promise with a date on it and there is no date.
 *
 * Willo is on it because he is the one agent that does exist — the quick entry is him —
 * and because this room is where the rest of them will stand next to him.
 */

const PLANNED = [
  { name: "Caçador de assinaturas", does: "Acha o que renova sozinho e você esqueceu." },
  { name: "Olho na fatura", does: "Lê o que chega e avisa do que fugiu do normal." },
  { name: "Guarda-metas", does: "Separa o que sobra, no dia em que sobra." },
  { name: "Conselheiro", does: "Responde o que dá para fazer com o que você tem." },
];

export default function Agentes() {
  return (
    <div className="pb-28 pt-2">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3">
          <BotMark size={44} />
          <div>
            <h1 className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-white">
              Agentes
            </h1>
            <p className="mt-1 text-[13px] t-soft">Um time cuidando de partes do seu dinheiro</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-full border border-willo-green/25 bg-willo-green/[0.08] px-3.5 py-2">
          <Sparkles className="h-[15px] w-[15px] shrink-0 text-willo-green-ink" strokeWidth={2.2} />
          <p className="text-[13px] font-semibold text-willo-green-ink">Em breve</p>
        </div>

        <p className="mt-4 text-[14.5px] leading-relaxed t-soft">
          Hoje o Willo anota o que você fala. A ideia é que ele deixe de ser um só:
          cada agente olha uma parte do seu dinheiro sem você precisar pedir, e te
          procura quando tem o que dizer.
        </p>

        <p className="mb-2.5 mt-7 px-1 text-[11px] font-bold uppercase tracking-[0.16em] t-faint">
          O que vem por aí
        </p>

        <div className="space-y-2.5">
          {PLANNED.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[18px] border border-white/[0.07] willo-glass px-4 py-3.5"
            >
              <p className="text-[15px] font-semibold text-white">{agent.name}</p>
              <p className="mt-0.5 text-[13px] leading-snug t-soft">{agent.does}</p>
            </motion.div>
          ))}
        </div>

        <p className="mt-6 px-1 text-[12.5px] leading-relaxed t-faint">
          Os nomes e o que cada um faz ainda vão mudar — esta tela existe para dizer
          onde eles vão morar, não para prometer uma data.
        </p>
      </motion.div>
    </div>
  );
}
