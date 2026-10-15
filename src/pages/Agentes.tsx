import { motion } from "framer-motion";
import { CalendarClock, PiggyBank, Search, ShoppingCart, Sparkles } from "lucide-react";
import AgentMark from "@/components/registro/AgentMark";

/**
 * The team, before it exists.
 *
 * The screen has to be here because the nav points at it, and what it must not do is
 * pretend. So it says what is coming by showing it: each agent gets its own panel with
 * the exact sentence it would send you, marked as an example, because "um agente que
 * investiga cobranças" is an abstraction and "achei a mesma assinatura cobrada duas
 * vezes este mês" is the thing you would actually want.
 *
 * Nothing is pressable. A disabled button is a promise with a date on it, and there is
 * no date.
 */

const AGENTS = [
  {
    key: "cacador",
    name: "Caçador",
    field: "Investigação",
    hex: "#F59E0B",
    icon: Search,
    sky: "linear-gradient(180deg, #2a1708 0%, #3d2a12 32%, #221a14 70%, #0B0C10 100%)",
    example: "Achei a mesma assinatura cobrada duas vezes este mês.",
    detail: "Streaming · 2 × R$ 39,90",
    headline: "Nenhuma cobrança passa despercebida",
    says: "Investiga cobranças repetidas, reajustes silenciosos e assinaturas que você esqueceu, e mostra o que vale contestar.",
  },
  {
    key: "vigia",
    name: "Vigia",
    field: "Vencimentos",
    hex: "#F87171",
    icon: CalendarClock,
    sky: "linear-gradient(180deg, #2c1016 0%, #3a1820 32%, #231419 70%, #0B0C10 100%)",
    example: "A fatura do Nubank fecha em dois dias e está R$ 300 acima do normal.",
    detail: "Vence 13 de nov · R$ 1.768,95",
    headline: "Nada vence sem você saber",
    says: "Acompanha faturas, contas fixas e parcelas, e avisa antes — não no dia, quando já não dá para fazer nada.",
  },
  {
    key: "cofre",
    name: "Cofre",
    field: "Metas",
    hex: "#C8F36D",
    icon: PiggyBank,
    sky: "linear-gradient(180deg, #1b2a10 0%, #243818 32%, #18200f 70%, #0B0C10 100%)",
    example: "Sobrou R$ 240 este mês. Separo para o Negócio Próprio?",
    detail: "Meta · 1% de R$ 50.000,00",
    headline: "O que sobra vai para onde você quis",
    says: "Olha o que sobrou quando o mês fecha e separa para a meta, no dia em que sobra — não no mês seguinte, quando já foi.",
  },
  {
    key: "lista",
    name: "Lista",
    field: "Compras",
    hex: "#7DD3FC",
    icon: ShoppingCart,
    sky: "linear-gradient(180deg, #0d2130 0%, #123042 32%, #0f1c25 70%, #0B0C10 100%)",
    example: "Sua lista cabe no orçamento, com R$ 18 de folga.",
    detail: "12 itens · R$ 182 de R$ 200",
    headline: "O mercado cabe no seu orçamento",
    says: "Monta a lista, estima o total e mostra a folga antes de você sair de casa.",
  },
];

const CHANGES = [
  {
    title: "Você anota do seu jeito",
    body: "Por frase, áudio ou foto, como já faz no registro rápido.",
  },
  {
    title: "Cada agente cuida de uma parte",
    body: "Um investiga cobranças, outro acompanha vencimentos, outro guarda o que sobra e outro organiza as compras.",
  },
  {
    title: "Eles chamam você só quando importa",
    body: "Trazem o que encontraram e sugerem o próximo passo. Quem decide continua sendo você.",
  },
];

export default function Agentes() {
  return (
    <div className="-mx-4 pb-28">
      {/* Opening: who they are, and that they are not here yet. */}
      <section className="relative overflow-hidden px-5 pb-10 pt-6">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 40% at 30% 8%, rgba(255,136,54,0.30) 0%, transparent 70%)," +
              "radial-gradient(80% 44% at 72% 34%, rgba(56,132,170,0.34) 0%, transparent 74%)," +
              "linear-gradient(180deg, #121d35 0%, #16283a 34%, #10171f 72%, #0B0C10 100%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-willo-green px-3 py-1.5 text-[12.5px] font-bold text-[#0B0B0B]">
            <Sparkles className="h-[13px] w-[13px]" strokeWidth={2.6} />
            Em breve
          </span>

          <h1 className="mt-4 text-[32px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white">
            Seu time de agentes
            <br />
            está chegando
          </h1>
          <p className="mt-3 max-w-[300px] text-[15.5px] leading-relaxed text-white/60">
            Quatro especialistas de olho no seu dinheiro, para você não precisar ficar.
          </p>

          <div className="mt-8 flex items-end gap-4">
            {AGENTS.map((a, i) => (
              <motion.div
                key={a.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <AgentMark hex={a.hex} icon={a.icon} size={54} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* One panel each, each showing the sentence it would actually send. */}
      {AGENTS.map((a) => (
        <section key={a.key} className="relative overflow-hidden px-5 pb-9 pt-7">
          <div aria-hidden="true" className="absolute inset-0" style={{ background: a.sky }} />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <span className="inline-block rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur-md">
              {a.name} · {a.field}
            </span>

            {/* What it would say, written as the message rather than as a description. */}
            <div className="mt-4 rounded-[18px] border border-white/[0.10] bg-black/35 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-white/80">{a.name}</p>
                <span className="rounded-full bg-white/[0.10] px-2.5 py-1 text-[11px] font-medium text-white/60">
                  Exemplo
                </span>
              </div>
              <p className="mt-2 text-[16px] font-semibold leading-snug text-white">{a.example}</p>
              <p className="mt-2 text-[12.5px] text-white/50">{a.detail}</p>
            </div>

            <div className="mt-6">
              <AgentMark hex={a.hex} icon={a.icon} size={56} />
            </div>

            <h2 className="mt-5 text-[25px] font-extrabold leading-[1.12] tracking-[-0.025em] text-white">
              {a.headline}
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/60">{a.says}</p>
          </motion.div>
        </section>
      ))}

      {/* How it fits with what already exists. */}
      <section className="px-5 pt-9">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-white">
          O que muda no seu mês
        </h2>

        <div className="mt-4 space-y-3">
          {CHANGES.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[18px] border border-white/[0.07] willo-glass px-4 py-3.5"
            >
              <p className="text-[15.5px] font-semibold text-white">{c.title}</p>
              <p className="mt-1 text-[13.5px] leading-snug text-white/55">{c.body}</p>
            </motion.div>
          ))}
        </div>

        <p className="mt-6 px-1 text-[12.5px] leading-relaxed text-white/40">
          Os nomes e o que cada um faz ainda vão mudar. Esta tela existe para dizer onde
          eles vão morar — não para prometer uma data.
        </p>
      </section>
    </div>
  );
}
