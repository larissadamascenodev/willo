import { motion } from "framer-motion";
import { ChevronLeft,
  FileText, ShieldCheck, CreditCard, RotateCcw, XCircle, AlertTriangle,
  Lock, CheckCircle2, Brain, Smartphone, Scale, RefreshCw,
  Mail, Sparkles, Heart, Copyright,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "@/lib/support";

/* ─── types ─── */
interface Section {
  icon: React.ElementType;
  title: string;
  content: string[];
}

/* ─── content ─── */
const sections: Section[] = [
  {
    icon: CheckCircle2,
    title: "Aceitação dos termos",
    content: [
      "Ao criar uma conta e usar o Willo, você concorda com estes Termos de Uso e com a nossa Política de Privacidade.",
      "Se não concordar com algum ponto, é só não usar o app.",
    ],
  },
  {
    icon: Smartphone,
    title: "O que é o Willo",
    content: [
      "O Willo é uma **ferramenta de organização financeira pessoal**: você registra receitas, despesas, cartões, contas e metas, e o app organiza, calcula e mostra o que está acontecendo com o seu dinheiro.",
      "O Willo **não movimenta dinheiro**: não faz pagamentos, transferências, Pix, investimentos nem se conecta às suas contas bancárias. Tudo que aparece no app vem do que **você informa**, digitando ou enviando uma foto de comprovante.",
      "O conteúdo é **educativo e informativo**. O Willo não é instituição financeira, não faz recomendação de investimento e não substitui um consultor ou planejador financeiro.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Cadastro e responsabilidade",
    content: [
      "Para usar o app é preciso criar uma conta com e-mail válido. O app é destinado a **maiores de 13 anos**.",
      "Você é responsável por **guardar sua senha** e por tudo que acontecer na sua conta. Nunca pedimos sua senha por e-mail, WhatsApp ou telefone.",
      "As informações que você registra são de **sua responsabilidade**. O Willo calcula em cima do que recebe.",
    ],
  },
  {
    icon: CreditCard,
    title: "Preço",
    content: [
      "Hoje o Willo é **gratuito** e todas as funções estão liberadas. Não há assinatura nem cobrança dentro do app.",
      "Se um plano pago for lançado no futuro, a compra será feita **pela própria App Store ou Google Play**, com os preços, a renovação e o cancelamento seguindo as regras dessas lojas. Você será avisado antes, e o que já existe na sua conta continua seu.",
    ],
  },
  {
    icon: Brain,
    title: "Inteligência artificial",
    content: [
      "O app usa IA para **ler fotos de comprovantes e faturas** e para **sugerir categorias e análises**.",
      "Essas leituras e sugestões são automáticas e **podem conter erros**. Sempre confira os valores antes de salvar, e ajuste o que estiver diferente.",
      "As análises e projeções são estimativas baseadas nos seus próprios registros, não promessas de resultado.",
    ],
  },
  {
    icon: Lock,
    title: "Uso aceitável",
    content: [
      "Use o Willo para fins pessoais e legítimos.",
      "É proibido tentar **acessar dados de outras pessoas**, sobrecarregar ou burlar o serviço, fazer engenharia reversa ou usar o app para qualquer atividade ilícita.",
    ],
  },
  {
    icon: XCircle,
    title: "Excluir sua conta e encerramento",
    content: [
      "Você pode **excluir sua conta a qualquer momento** dentro do app, em Configurações → Dados → Excluir minha conta. Isso apaga seus dados de forma definitiva.",
      "Podemos suspender ou encerrar contas que violem estes termos ou coloquem o serviço e outras pessoas em risco.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Limitação de responsabilidade",
    content: [
      "O Willo é oferecido **como está**. Fazemos o possível para manter tudo funcionando e correto, mas não garantimos ausência de falhas, indisponibilidade ou erros de cálculo.",
      "**As decisões financeiras são suas.** O Willo não responde por perdas, prejuízos ou escolhas tomadas com base nas informações e análises do app.",
    ],
  },
  {
    icon: Copyright,
    title: "Propriedade intelectual",
    content: [
      "O nome, a marca, o design, os textos e o código do Willo pertencem ao Willo.",
      "Os **seus dados continuam seus**: usamos apenas para fazer o app funcionar para você, como explicado na Política de Privacidade.",
    ],
  },
  {
    icon: RefreshCw,
    title: "Alterações nestes termos",
    content: [
      "Podemos atualizar estes termos. Mudanças relevantes serão avisadas dentro do app.",
      "Continuar usando o Willo depois do aviso significa que você concorda com a versão nova.",
    ],
  },
  {
    icon: Scale,
    title: "Lei aplicável",
    content: [
      "Estes termos seguem as leis brasileiras, incluindo o **Código de Defesa do Consumidor** e a **LGPD** (Lei 13.709/2018).",
      "Eventuais questões serão tratadas no foro do seu domicílio.",
    ],
  },
  {
    icon: Mail,
    title: "Contato",
    content: [
      `Dúvidas sobre estes termos? Escreva para **${SUPPORT_EMAIL}** ou use a página de suporte do app.`,
    ],
  },
];

/* ─── helpers ─── */
const renderBold = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <span key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

/* ─── section card ─── */
const SectionBlock = ({ section, index }: { section: Section; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.08 + index * 0.03, ease: "easeOut" }}
    className="space-y-3"
  >
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <section.icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
      </div>
      <span className="text-sm md:text-base font-bold text-foreground">{section.title}</span>
    </div>

    <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed md:leading-7 text-justify">
      {section.content.map((line, i) => (
        <span key={i}>
          {i > 0 && " "}
          {renderBold(line)}
        </span>
      ))}
    </p>
  </motion.div>
);

/* ─── page ─── */
const TermosDeUso = () => {
  const navigate = useNavigate();

  return (
    <div className="pt-1 pb-12 space-y-5 w-full max-w-6xl mx-auto px-4 md:px-8 lg:px-12">
      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)}
        className="-ml-2 flex h-9 items-center gap-0.5 text-sm text-white/70 hover:text-white active:opacity-60 transition-colors"
      >
        <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
      </motion.button>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border/10 backdrop-blur-2xl p-6"
        style={{
          background:
            "linear-gradient(145deg, hsl(var(--card) / 0.9) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative space-y-4">
          {/* Icon cluster */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex gap-1.5">
              {[ShieldCheck, Lock, Brain].map((Icon, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-primary/[0.08] border border-primary/15 flex items-center justify-center"
                >
                  <Icon className="w-3.5 h-3.5 text-primary/70" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
              Termos de Uso
            </h1>
            <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed max-w-xs md:max-w-md">
              Como funciona o uso do Willo
            </p>
          </div>

          <div className="rounded-xl bg-primary/[0.06] border border-primary/10 p-3.5 space-y-1">
            <p className="text-[13px] md:text-sm font-semibold text-foreground">
              Transparência acima de tudo.
            </p>
            <p className="text-[12px] md:text-[13px] text-muted-foreground leading-relaxed">
              Esses termos explicam como você pode usar o Willo com segurança.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      <div className="space-y-5 px-1">
        {sections.map((section, i) => (
          <div key={i}>
            <SectionBlock section={section} index={i} />
            {i < sections.length - 1 && (
              <div className="mt-5 border-t border-border/10" />
            )}
          </div>
        ))}
      </div>

      {/* Trust badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-primary/15 p-5"
        style={{
          background:
            "linear-gradient(160deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--card) / 0.8) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Seus dados e sua experiência</span> são
            prioridade no Willo.
          </p>
        </div>
      </motion.div>

      {/* Commitment */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55 }}
        className="relative overflow-hidden rounded-2xl border border-primary/15 p-6 text-center"
        style={{
          background:
            "linear-gradient(160deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--card) / 0.8) 100%)",
        }}
      >
        <div className="relative space-y-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[13px] md:text-sm text-muted-foreground">Nosso compromisso</p>
            <p className="text-base md:text-lg font-bold">
              <span className="text-foreground">Transparência e respeito </span>
              <span className="text-primary">em cada interação</span>
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <Heart className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-[11px] text-muted-foreground/60">
              Feito com carinho pela equipe Willo
            </span>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-[11px] text-muted-foreground/40 pt-2"
      >
        Última atualização: Abril 2026
      </motion.p>
    </div>
  );
};

export default TermosDeUso;
