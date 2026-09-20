import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, ShieldCheck } from "lucide-react";

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
  type: "terms" | "privacy";
}

const termsContent = [
  { title: "Aceitação dos Termos", text: "Ao utilizar o Willo, você concorda com estes Termos de Uso. Nosso objetivo é garantir uma experiência segura e transparente para você." },
  { title: "Sobre o Willo", text: "O Willo é uma ferramenta de organização financeira pessoal. Permite registrar receitas, despesas, metas e investimentos, tudo em um só lugar. O app não realiza movimentações bancárias nem substitui consultoria financeira profissional." },
  { title: "Cadastro e Responsabilidade", text: "Você é responsável por manter suas credenciais de acesso seguras. As informações inseridas no app são de sua inteira responsabilidade. Dados falsos ou uso indevido podem resultar em suspensão da conta." },
  { title: "Planos e Acesso", text: "O Willo oferece um período de teste gratuito por tempo limitado, permitindo que você explore as funcionalidades da plataforma antes de contratar um plano. Após o término do período de teste, o acesso completo às funcionalidades depende de uma assinatura ativa." },
  { title: "Cobrança e Renovação", text: "Após o período gratuito, a assinatura será iniciada automaticamente, conforme as condições informadas no momento da contratação. A cobrança é recorrente, conforme o plano escolhido. Ao contratar um plano, você concorda com as condições de cobrança, valores e renovação automática." },
  { title: "Cancelamento", text: "Você pode cancelar sua assinatura a qualquer momento diretamente pela plataforma. Após o cancelamento, o acesso permanecerá ativo até o final do período já pago. O não uso do serviço não implica cancelamento automático da assinatura." },
  { title: "Reembolso", text: "Você pode solicitar reembolso integral no prazo de até 7 dias corridos após a contratação, conforme previsto no Código de Defesa do Consumidor. Após esse prazo, não haverá reembolso de valores já pagos." },
  { title: "Uso Aceitável", text: "Use o Willo apenas para fins pessoais e legítimos. É proibido tentar acessar dados de outros usuários, fazer engenharia reversa ou usar o app para atividades ilícitas." },
  { title: "Limitação de Responsabilidade", text: "O Willo oferece ferramentas de organização, não garantias de resultados financeiros. Decisões financeiras tomadas com base nas análises do app são de sua responsabilidade." },
  { title: "Propriedade Intelectual", text: "Todo o conteúdo, design, código e marca do Willo são de propriedade exclusiva da equipe Willo. É proibida a reprodução sem autorização prévia." },
  { title: "Alterações nos Termos", text: "Podemos atualizar estes termos periodicamente. Alterações relevantes serão comunicadas dentro do app ou por e-mail." },
  { title: "Contato", text: "Dúvidas? Fale conosco pelo suporte dentro do app. Estamos sempre prontos para ajudar." },
];

const privacyContent = [
  { title: "Seus Dados São Seus", text: "O Willo nunca vende, compartilha ou monetiza seus dados pessoais. Suas informações financeiras são usadas exclusivamente para oferecer a melhor experiência dentro do app." },
  { title: "O Que Coletamos", text: "Coletamos apenas as informações necessárias para o funcionamento do app: dados de cadastro (nome, e-mail), dados financeiros inseridos por você (receitas, despesas, metas) e dados de uso para melhoria da plataforma." },
  { title: "Como Usamos", text: "Seus dados são utilizados para personalizar sua experiência, gerar insights financeiros com IA e melhorar continuamente a plataforma. Nunca utilizamos seus dados para publicidade direcionada." },
  { title: "Inteligência Artificial", text: "O Willo utiliza IA para gerar insights e projeções financeiras. Os dados processados pela IA são anonimizados e não são compartilhados com terceiros." },
  { title: "Segurança e Criptografia", text: "Todos os dados são protegidos com criptografia de ponta a ponta. Utilizamos as melhores práticas de segurança do mercado para garantir a proteção das suas informações." },
  { title: "LGPD", text: "O Willo está em conformidade com a Lei Geral de Proteção de Dados (LGPD). Você tem o direito de acessar, corrigir, excluir e portar seus dados a qualquer momento." },
  { title: "Seus Direitos", text: "Você pode solicitar a exclusão completa dos seus dados, exportar suas informações, revogar consentimentos e solicitar informações sobre o tratamento dos seus dados." },
  { title: "Cookies e Rastreamento", text: "Utilizamos cookies essenciais para o funcionamento do app. Não utilizamos cookies de rastreamento publicitário." },
  { title: "Atualizações", text: "Esta política pode ser atualizada periodicamente. Alterações significativas serão comunicadas por e-mail ou dentro do app." },
  { title: "Contato", text: "Para questões relacionadas à privacidade, entre em contato pelo suporte dentro do app." },
];

const LegalModal = ({ open, onClose, type }: LegalModalProps) => {
  if (!open) return null;

  const isTerms = type === "terms";
  const content = isTerms ? termsContent : privacyContent;
  const title = isTerms ? "Termos de Uso" : "Política de Privacidade";
  const Icon = isTerms ? FileText : ShieldCheck;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[72vh] w-full max-w-md flex-col overflow-hidden rounded-2xl willo-glass sm:max-h-[85vh] sm:max-w-lg"
            style={{
              boxShadow: "0 12px 40px -8px rgba(0,0,0,0.6)",
            }}
          >
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-primary/6 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-border/15">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center">
                  <Icon className="w-[18px] h-[18px] text-primary" />
                </div>
                <h2 className="text-lg font-extrabold text-foreground tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 scrollbar-none">
              <div className="space-y-5 pr-1">
                {content.map((section, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.03 }}
                    className="space-y-1.5"
                  >
                    <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{section.text}</p>
                    {i < content.length - 1 && <div className="pt-3 border-b border-border/10" />}
                  </motion.div>
                ))}

                <p className="text-center text-[11px] text-muted-foreground/40 pt-3 pb-2">
                  Última atualização: Abril 2026
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LegalModal;
