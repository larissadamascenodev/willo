import { motion } from "framer-motion";
import { ChevronLeft,
  Shield, Lock, Brain, BarChart3, Users, Cookie, Megaphone,
  ShieldCheck, UserCheck, Clock, RefreshCw, Mail, Fingerprint, Sparkles, Heart, Eye, Settings2, Database,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "@/lib/support";

/* ─── types ─── */
interface Section {
  icon: React.ElementType;
  title: string;
  content: string[];
  warning?: string;
}

/* ─── content ─── */
const sections: Section[] = [
  {
    icon: Database,
    title: "Quais dados coletamos",
    content: [
      "**Cadastro:** nome, e-mail e senha. A senha é guardada de forma criptografada pelo nosso provedor de autenticação — nem nós conseguimos vê-la. Se você entrar com Apple ou Google, recebemos apenas o identificador e o e-mail informado por eles.",
      "**Perfil (opcional):** foto e a frase que você escreve.",
      "**Dados financeiros:** contas, cartões, transações, faturas e metas que **você mesmo registra**.",
      "**Fotos que você envia:** comprovantes e faturas que você fotografa para o app ler, e capas de metas.",
      "**Uso:** dias em que você abriu o app (para a sequência) e suas preferências, como moeda e lembretes.",
    ],
    warning: "O Willo não se conecta ao seu banco e não movimenta dinheiro. Tudo vem do que você informa.",
  },
  {
    icon: BarChart3,
    title: "Para que usamos",
    content: [
      "**Fazer o app funcionar:** guardar e exibir seus lançamentos, saldos, faturas e metas.",
      "**Calcular:** gráficos, projeções, score do Raio-X e alertas.",
      "**Avisar:** lembretes de contas e faturas a vencer, enviados pelo próprio aparelho.",
      "Não usamos seus dados financeiros para publicidade e **não vendemos seus dados**.",
    ],
  },
  {
    icon: Brain,
    title: "Inteligência artificial",
    content: [
      "Quando você fotografa um comprovante ou uma fatura, **a imagem é enviada ao Google (Gemini)** para extrair estabelecimento, valores e datas.",
      "Para sugerir categorias e gerar as análises e o plano, enviamos **textos e números dos seus lançamentos** à Anthropic (Claude).",
      "Enviamos apenas o necessário para aquela tarefa, e o resultado volta para a sua conta. **Não treinamos modelos com os seus dados.** O tratamento dentro de cada provedor segue os termos deles.",
      "A leitura automática pode errar: confira antes de salvar.",
    ],
  },
  {
    icon: Users,
    title: "Com quem compartilhamos",
    content: [
      "**Supabase:** banco de dados, login e armazenamento das fotos.",
      "**Google (Gemini)** e **Anthropic (Claude):** leitura dos comprovantes e geração das análises, como explicado acima.",
      "**Vercel:** hospedagem da versão web do app.",
      "Também podemos compartilhar dados se a lei exigir. Fora isso, ninguém mais recebe suas informações.",
    ],
    warning: "Nunca vendemos seus dados. Ponto final.",
  },
  {
    icon: Lock,
    title: "Segurança",
    content: [
      "Os dados trafegam **criptografados** (HTTPS) e ficam criptografados também no armazenamento do provedor.",
      "Cada conta só enxerga os próprios dados: isso é garantido por **regras no banco**, por usuário, e não apenas pela tela do app.",
      "Nunca pedimos sua senha por e-mail, WhatsApp ou telefone.",
    ],
  },
  {
    icon: Eye,
    title: "Dados guardados no seu aparelho",
    content: [
      "Guardamos no próprio aparelho algumas preferências, como a **moeda escolhida** e o estado do onboarding, para o app abrir do jeito que você deixou.",
      "Não usamos cookies de publicidade nem rastreadores de terceiros.",
    ],
  },
  {
    icon: UserCheck,
    title: "Seus direitos (LGPD)",
    content: [
      "**Acessar e corrigir:** tudo o que guardamos aparece no app e pode ser editado por você.",
      "**Excluir:** você apaga seus dados ou a conta inteira quando quiser, dentro do app.",
      "**Revogar consentimento:** desligue os lembretes nas configurações ou exclua a conta.",
      "Se precisar de ajuda para exercer qualquer um desses direitos, fale com o suporte.",
    ],
  },
  {
    icon: Shield,
    title: "Excluir sua conta",
    content: [
      "No app: **Configurações → Dados → Excluir minha conta**.",
      "Isso apaga **de forma imediata e definitiva** sua conta, transações, contas, cartões, faturas, metas e fotos enviadas. Não há como recuperar depois.",
      "Cópias de segurança automáticas do provedor podem manter os dados por até **30 dias** antes de serem descartadas.",
      "Se não conseguir entrar na conta, escreva para o suporte que apagamos para você.",
    ],
  },
  {
    icon: Clock,
    title: "Por quanto tempo guardamos",
    content: [
      "Enquanto a sua conta existir. Quando você exclui a conta, os dados são apagados conforme explicado acima.",
    ],
  },
  {
    icon: Heart,
    title: "Crianças e adolescentes",
    content: [
      "O Willo não é destinado a **menores de 13 anos** e não coletamos dados dessa faixa etária de forma consciente.",
    ],
  },
  {
    icon: RefreshCw,
    title: "Alterações nesta política",
    content: [
      "Podemos atualizar esta política. Mudanças relevantes serão avisadas dentro do app.",
    ],
  },
  {
    icon: Mail,
    title: "Contato",
    content: [
      `Dúvidas sobre privacidade ou sobre os seus dados? Escreva para **${SUPPORT_EMAIL}**.`,
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

/* ─── section block ─── */
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

    {section.warning && (
      <div className="mt-2 rounded-lg bg-warning/[0.06] border border-warning/15 px-3 py-2">
        <p className="text-[12px] text-warning font-medium leading-relaxed">
          ⚠️ {section.warning}
        </p>
      </div>
    )}
  </motion.div>
);

/* ─── page ─── */
const PoliticaPrivacidade = () => {
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
          background: "linear-gradient(145deg, hsl(var(--card) / 0.9) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Fingerprint className="w-6 h-6 text-primary" />
            </div>
            <div className="flex -space-x-1.5">
              {[Shield, Lock, Eye].map((Icon, i) => (
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
              Política de Privacidade
            </h1>
            <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed max-w-xs md:max-w-md">
              Como cuidamos dos seus dados
            </p>
          </div>

          <div className="rounded-xl bg-primary/[0.06] border border-primary/10 p-3.5 space-y-1">
            <p className="text-[13px] md:text-sm font-semibold text-foreground">
              Seus dados são seus. E a gente leva isso a sério.
            </p>
            <p className="text-[12px] md:text-[13px] text-muted-foreground leading-relaxed">
              Tudo o que você registra no Willo é protegido e usado apenas para melhorar sua experiência.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick summary */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-border/10 bg-card/60 backdrop-blur-xl p-5 space-y-3"
      >
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Resumo rápido
        </p>
        {[
          { icon: Lock, text: "Não vendemos seus dados" },
          { icon: BarChart3, text: "Usamos dados apenas para melhorar o app" },
          { icon: Settings2, text: "Você pode controlar suas informações" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[13px] font-medium text-foreground">{item.text}</p>
          </div>
        ))}
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

      {/* Transparency block */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-primary/15 p-5"
        style={{
          background: "linear-gradient(160deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--card) / 0.8) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">Transparência total</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Você sempre terá controle sobre seus dados dentro do Willo.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Commitment */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55 }}
        className="relative overflow-hidden rounded-2xl border border-primary/15 p-6 text-center"
        style={{
          background: "linear-gradient(160deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--card) / 0.8) 100%)",
        }}
      >
        <div className="relative space-y-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[13px] md:text-sm text-muted-foreground">Nosso compromisso</p>
            <p className="text-base md:text-lg font-bold">
              <span className="text-foreground">Seus dados protegidos </span>
              <span className="text-primary">com total transparência</span>
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

export default PoliticaPrivacidade;
