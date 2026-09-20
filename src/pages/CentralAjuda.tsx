import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Search, BarChart3, Sparkles, Target, Radar, HeartPulse, ScanLine, CreditCard, Wallet, Tags, CalendarClock, Bot, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Feature {
  icon: React.ReactNode;
  label: string;
  color: string;
  soon?: boolean;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Wallet className="w-5 h-5" />,
    label: "Carteira",
    color: "hsl(var(--primary))",
    description:
      "Gerencie todas as suas contas bancárias, carteiras digitais e investimentos em um só lugar. Visualize o saldo consolidado, acompanhe a evolução do patrimônio e faça transferências entre contas de forma rápida.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    label: "Balanço Mensal",
    color: "hsl(215 80% 60%)",
    description:
      "Veja uma visão completa de receitas vs despesas mês a mês. O balanço mostra exatamente quanto você ganhou, quanto gastou e qual foi o saldo líquido do período, ajudando a entender seus hábitos financeiros.",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    label: "Projeções Inteligentes",
    color: "hsl(270 70% 65%)",
    description:
      "Simule cenários futuros para suas finanças. As projeções analisam seus padrões de receita e despesa e estimam como será seu saldo nos próximos meses, considerando contas recorrentes, parcelamentos e metas.",
  },
  {
    icon: <Target className="w-5 h-5" />,
    label: "Metas Financeiras",
    color: "hsl(40 80% 55%)",
    description:
      "Crie metas de economia com valores e prazos definidos. Faça depósitos e saques a qualquer momento, acompanhe o progresso com barras visuais e receba lembretes para manter a consistência nos aportes.",
  },
  {
    icon: <ScanLine className="w-5 h-5" />,
    label: "Scanner de Comprovantes",
    color: "hsl(190 70% 50%)",
    description:
      "Registre transações automaticamente tirando foto ou enviando print de comprovantes de pagamento. O sistema lê os dados do comprovante e preenche valor, data e categoria para você — basta confirmar.",
  },
  {
    icon: <CreditCard className="w-5 h-5" />,
    label: "Faturas de Cartão",
    color: "hsl(350 70% 55%)",
    description:
      "Acompanhe em detalhes cada fatura dos seus cartões de crédito. Veja os itens que compõem a fatura, parcelas em andamento, histórico de meses anteriores e registre o pagamento quando realizar.",
  },
  {
    icon: <Tags className="w-5 h-5" />,
    label: "Categorias e Limites",
    color: "hsl(160 60% 45%)",
    description:
      "Organize receitas e despesas por categorias personalizáveis. Defina limites de gasto por categoria e receba alertas quando estiver próximo de ultrapassar, mantendo o controle do orçamento.",
  },
  {
    icon: <CalendarClock className="w-5 h-5" />,
    label: "Parcelamentos",
    color: "hsl(200 70% 55%)",
    description:
      "Acompanhe todas as compras parceladas ativas. Veja quantas parcelas restam, o valor de cada uma, a data de vencimento e o impacto mensal dos parcelamentos no seu orçamento.",
  },
  {
    icon: <Bot className="w-5 h-5" />,
    label: "BotHub (IA)",
    color: "hsl(280 60% 60%)",
    soon: true,
    description:
      "Seu assistente financeiro inteligente. O BotHub irá analisar suas finanças, responder perguntas, sugerir economias e dar dicas personalizadas com base nos seus dados reais — tudo através de conversas naturais.",
  },
  {
    icon: <Radar className="w-5 h-5" />,
    label: "Radar Financeiro",
    color: "hsl(280 60% 60%)",
    soon: true,
    description:
      "Análise automática de padrões nos seus gastos. O Radar identifica tendências, gastos incomuns e oportunidades de economia que podem passar despercebidas no dia a dia.",
  },
  {
    icon: <HeartPulse className="w-5 h-5" />,
    label: "Saúde Financeira",
    color: "hsl(340 70% 55%)",
    soon: true,
    description:
      "Receba um diagnóstico completo da sua saúde financeira com um score de 0 a 100. O sistema avalia diversificação, reserva de emergência, nível de endividamento e consistência nos registros.",
  },
];

interface FaqItem {
  question: string;
  answer: string;
}

const faqItems: FaqItem[] = [
  {
    question: "Posso ter mais de uma conta bancária?",
    answer:
      "Sim! Vá em 'Carteira' e adicione quantas contas quiser — corrente, poupança, carteiras digitais e investimentos. O saldo consolidado aparece na tela inicial.",
  },
  {
    question: "Como alterar ou excluir uma transação?",
    answer:
      "Na lista de transações, toque na transação desejada para abrir os detalhes. Lá você pode editar os dados ou excluir a transação. Para recorrentes, você pode excluir apenas aquela ocorrência ou todas.",
  },
  {
    question: "Posso fazer transferência entre minhas contas?",
    answer:
      "Sim! Ao criar uma transação, escolha 'Transferência'. Selecione a conta de origem e a conta de destino. O saldo é ajustado automaticamente em ambas.",
  },
  {
    question: "Meus dados estão seguros?",
    answer:
      "Sim! Seus dados são armazenados de forma segura na nuvem com criptografia. Apenas você tem acesso às suas informações financeiras através da sua conta autenticada.",
  },
  {
    question: "Como alterar minha senha?",
    answer:
      "Acesse 'Configurações' e vá na seção 'Segurança e Privacidade'. Toque em 'Alterar Senha', informe a nova senha e confirme.",
  },
  {
    question: "Como entrar em contato com o suporte?",
    answer:
      "Vá em 'Configurações' e toque em 'Falar com o Suporte'. Você será direcionado para nossa página de atendimento onde pode abrir um chamado.",
  },
  {
    question: "Qual plano estou usando?",
    answer:
      "Acesse 'Configurações' e veja a seção 'Assinatura'. Lá você encontra o plano atual, os recursos incluídos e opções para fazer upgrade ou cancelar.",
  },
  {
    question: "Posso mudar de plano a qualquer momento?",
    answer:
      "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento nas Configurações. As mudanças são aplicadas no próximo ciclo de cobrança.",
  },
  {
    question: "Como cancelar minha assinatura?",
    answer:
      "Acesse 'Configurações' > 'Assinatura' e toque em 'Cancelar Plano'. Você continuará tendo acesso até o fim do período já pago.",
  },
];

const CentralAjuda = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [openFeature, setOpenFeature] = useState<string | null>(null);

  const query = normalize(search.trim());

  const filteredFeatures = useMemo(
    () =>
      query
        ? features.filter(
            (f) =>
              normalize(f.label).includes(query) ||
              normalize(f.description).includes(query)
          )
        : features,
    [query]
  );

  const filteredFaq = useMemo(
    () =>
      query
        ? faqItems.filter(
            (f) =>
              normalize(f.question).includes(query) ||
              normalize(f.answer).includes(query)
          )
        : faqItems,
    [query]
  );

  return (
    <div className="min-h-screen pb-28 px-4 pt-4 max-w-lg mx-auto">
      {/* header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => navigate(-1)}
          className="-ml-2 flex h-9 items-center gap-0.5 text-sm text-white/70 hover:text-white active:opacity-60 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Central de Ajuda</h1>
          <p className="text-xs text-muted-foreground">Encontre respostas sobre o app</p>
        </div>
      </div>

      {/* search */}
      <div className="relative mt-4 mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar funcionalidade ou dúvida..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/60 backdrop-blur border-border/40"
        />
      </div>

      {/* features - vertical list */}
      {filteredFeatures.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Funcionalidades
          </h2>
          <div className="space-y-2">
            {filteredFeatures.map((f, i) => {
              const isOpen = openFeature === f.label;
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                >
                  <button
                    onClick={() => setOpenFeature(isOpen ? null : f.label)}
                    className={`w-full text-left rounded-xl px-4 py-3 border transition-colors duration-150 ${
                      isOpen
                        ? "bg-card/90 border-primary/30"
                        : "bg-card/60 border-border/40"
                    }`}
                    style={{ opacity: f.soon ? 0.55 : 1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${f.color}18`, color: f.color }}
                      >
                        {f.icon}
                      </div>
                      <span className="text-sm font-semibold text-foreground flex-1">
                        {f.label}
                      </span>
                      {f.soon && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                          Em breve
                        </Badge>
                      )}
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.p
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className="text-xs text-muted-foreground leading-relaxed pl-12 overflow-hidden"
                        >
                          {f.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ */}
      {filteredFaq.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Perguntas Frequentes
          </h2>
          <div className="bg-card/60 backdrop-blur rounded-xl border border-border/40 overflow-hidden">
            <Accordion type="single" collapsible>
              {filteredFaq.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border/30 last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 text-sm text-foreground hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-xs text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* empty state */}
      {filteredFeatures.length === 0 && filteredFaq.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum resultado para "{search}"</p>
        </div>
      )}
    </div>
  );
};

export default CentralAjuda;
