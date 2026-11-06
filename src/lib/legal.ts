/**
 * Willo's Terms of Use and Privacy Policy, as structured text, shared by the app and
 * the site so both always say the same thing.
 *
 * Written for what Willo actually does: a personal finance organiser that writes down
 * what the person tells it (typed, spoken, photographed, read from e-mail or, with
 * Willo Copilot, from a purchase an iOS Shortcuts automation sends), explains it and forecasts it,
 * with AI from Anthropic and Google. Brazilian law (LGPD, CDC, Marco Civil, Decreto
 * 7.962/2013) and the App Store's rules (account deletion in the app, the AI-sharing
 * disclosure of guideline 5.1.2, the standard licence terms) shape it.
 *
 * Before publishing: fill in `OPERATOR` with the real legal identity and contact, and
 * have a lawyer read both texts. Bump `version` and `updated` on every change: the
 * app records which version each person accepted.
 */

export const OPERATOR = {
  /** Who runs Willo: the person's full name, or the company's name and CNPJ. */
  name: "Larissa Dias Damasceno",
  /** CPF is not published; for a company, "CNPJ 00.000.000/0001-00". */
  document: "CNPJ 59.261.159/0001-02",
  city: "Campinas/SP",
  email: "[E-MAIL DE CONTATO]",
  site: "https://willo-app.vercel.app",
};

export type LegalBlock = { p: string } | { list: string[] } | { table: { head: string[]; rows: string[][] } };
export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}
export interface LegalDoc {
  key: "terms" | "privacy";
  title: string;
  kicker: string;
  version: string;
  updated: string;
  path: string;
  intro: string;
  sections: LegalSection[];
}

const C = OPERATOR;

export const TERMS: LegalDoc = {
  key: "terms",
  title: "Termos de Uso",
  kicker: "CONTRATO DE USO",
  version: "1.1",
  updated: "06/11/2026",
  path: "/termos-de-uso",
  intro: "Leia com atenção antes de usar. Ao criar sua conta ou continuar usando o Willo, você declara ter lido, compreendido e aceito estes Termos.",
  sections: [
    {
      title: "1. Quem oferece o Willo",
      blocks: [
        { p: `1.1. O Willo é desenvolvido e operado por ${C.name}${C.document.startsWith("[") ? "" : `, ${C.document}`}, com sede em ${C.city}, doravante "Willo" ou "nós".` },
        { p: "1.2. Fase do produto: o Willo está em fase de testes. Funções podem estar incompletas, mudar ou ser descontinuadas sem aviso prévio, e você reconhece esse estado ao usá-lo." },
        { p: `1.3. Contato: ${C.email}. Respondemos em até 15 dias.` },
      ],
    },
    {
      title: "2. O que o Willo é, e o que não é",
      blocks: [
        { p: "2.1. O Willo é uma ferramenta de organização financeira pessoal. Ele registra as receitas e despesas que você informa, organiza categorias, contas, cartões e faturas, mostra análises e previsões e responde perguntas sobre os seus próprios números." },
        { p: "2.2. O Willo não é e não se equipara a:" },
        {
          list: [
            "banco, instituição financeira, instituição de pagamento ou corretora;",
            "serviço que movimenta dinheiro: o Willo não faz pagamentos, transferências, Pix, investimentos nem empréstimos;",
            "consultoria ou recomendação de investimentos, nos termos da Resolução CVM nº 19/2021;",
            "assessoria contábil, tributária ou jurídica;",
            "participante do Open Finance: o Willo não se conecta à sua conta bancária nem pede a sua senha do banco.",
          ],
        },
        { p: "2.3. Saldos, previsões, alertas e análises são estimativas calculadas a partir dos dados que você registra. Eles não substituem o extrato do seu banco nem a fatura oficial do seu cartão." },
        { p: "2.4. As decisões financeiras são sempre suas. Confira valores, vencimentos e saldos no seu banco antes de pagar, investir ou contratar." },
      ],
    },
    {
      title: "3. Quem pode usar",
      blocks: [
        { p: "3.1. O Willo destina-se a pessoas com 18 anos ou mais." },
        { p: "3.2. Você deve informar dados verdadeiros no cadastro e manter seu acesso em segurança. Você é responsável pelo uso feito com a sua conta." },
      ],
    },
    {
      title: "4. Os dados que você registra",
      blocks: [
        { p: "4.1. Você é responsável pela exatidão do que registra. O Willo não confere os seus lançamentos com o seu banco." },
        { p: "4.2. Quando o Willo lê um texto, uma foto, um áudio, um e-mail ou uma compra enviada pelos Atalhos, o resultado é uma sugestão de lançamento. Confira antes de salvar: o que você salva é registro seu." },
      ],
    },
    {
      title: "5. Inteligência artificial",
      blocks: [
        { p: "5.1. Algumas funções usam inteligência artificial: o assistente de conversa, a leitura de fotos, de áudios e de faturas, e a sugestão de categorias. O que os números podem responder sozinhos é respondido sem IA." },
        { p: "5.2. Os modelos de IA são ferramentas estatísticas: podem errar, interpretar mal um valor ou gerar informação incorreta. Respostas da IA são informativas, não constituem aconselhamento financeiro, de investimentos, contábil ou jurídico, e não garantem resultado." },
        { p: "5.3. Os provedores de IA, os dados enviados a eles e o consentimento necessário estão descritos na Política de Privacidade, seção 4." },
      ],
    },
    {
      title: "6. Willo Copilot: compras anotadas pelos Atalhos",
      blocks: [
        { p: "6.1. O Willo Copilot é uma função opcional que registra suas compras com a ajuda de uma automação que você mesmo cria no app Atalhos do iPhone. Quando você paga com o cartão ou com o aplicativo do banco escolhido, a automação envia ao Willo os dados daquela compra, e o Willo transforma esses dados em um lançamento." },
        { p: "6.2. A automação envia apenas o necessário para o lançamento: valor, estabelecimento, data, forma de pagamento e cartão ou banco. O Willo não lê as suas notificações, não acessa a sua conta bancária, não vê a sua senha e não movimenta dinheiro." },
        { p: "6.3. Você cria, edita e desliga a automação no app Atalhos, a qualquer momento. Desligá-la não apaga os lançamentos já salvos. O app Atalhos é da Apple, e o que ele permite pode mudar com as versões do iOS." },
        { p: "6.4. Os dados que chegam podem vir incompletos, e o Copilot pode deixar de reconhecer uma compra ou reconhecê-la errado. Confira sempre o que ele anotou." },
      ],
    },
    {
      title: "7. Comprovantes, voz e e-mail",
      blocks: [
        { p: "7.1. Você pode registrar gastos por foto de comprovante, por voz ou, na versão web, conectando o seu Gmail em modo somente leitura para importar faturas. Cada uma depende da sua permissão (câmera, galeria, microfone ou acesso ao e-mail) e pode ser revogada a qualquer momento." },
        { p: "7.2. Ao enviar fotos, áudios, arquivos ou mensagens, você nos concede licença limitada, não exclusiva e revogável para processá-los apenas para prestar o serviço." },
      ],
    },
    {
      title: "8. Lembretes e notificações",
      blocks: [
        { p: "8.1. Com a sua permissão, o Willo pode avisar sobre contas a vencer e lembretes que você criar. Um aviso que não chegue, por configuração do aparelho ou falha técnica, não muda o vencimento da sua conta: o pagamento continua sendo responsabilidade sua." },
      ],
    },
    {
      title: "9. Uso permitido",
      blocks: [
        { p: "9.1. O Willo é para uso pessoal. É proibido usá-lo para fins ilegais, registrar dados de terceiros sem autorização, tentar acessar contas de outras pessoas, contornar limites técnicos, copiar ou revender o serviço, ou interferir no seu funcionamento." },
      ],
    },
    {
      title: "10. Propriedade intelectual",
      blocks: [
        { p: "10.1. A marca Willo, o mascote, o design, os textos e o software pertencem ao Willo. Estes Termos concedem a você uma licença pessoal, não exclusiva e intransferível de uso do aplicativo." },
        { p: "10.2. Os seus dados continuam seus. Você pode pedir uma cópia ou a exclusão deles (Política de Privacidade, seção 9)." },
      ],
    },
    {
      title: "11. Disponibilidade e limitação de responsabilidade",
      blocks: [
        { p: "11.1. Trabalhamos para manter o Willo disponível e correto, mas ele pode ficar fora do ar, apresentar falhas ou perder dados por motivos técnicos, inclusive de fornecedores." },
        { p: "11.2. Na extensão permitida pela lei, o Willo não responde por decisões financeiras tomadas com base nas suas análises, por juros, multas ou atrasos de contas, por erros de leitura de fotos, áudios, e-mails ou compras enviadas pelos Atalhos não conferidos antes de salvar, nem por erros da inteligência artificial." },
        { p: "11.3. Nada nestes Termos afasta direitos garantidos pelo Código de Defesa do Consumidor (Lei 8.078/1990) nem a responsabilidade por dano causado com dolo." },
      ],
    },
    {
      title: "12. Assinatura e pagamento",
      blocks: [
        { p: "12.1. Funções pagas, quando existirem, serão contratadas e cobradas pela App Store (Apple) ou pelo Google Play. Preço, período e eventual teste gratuito aparecem antes da confirmação da compra. O Willo não recebe nem guarda dados do seu cartão." },
        { p: "12.2. A assinatura renova-se automaticamente ao fim de cada período, salvo cancelamento com pelo menos 24 horas de antecedência. No iPhone, cancele em Ajustes → [seu nome] → Assinaturas." },
        { p: "12.3. Reembolsos são pedidos à loja onde a compra foi feita (no iPhone, em reportaproblem.apple.com) e decididos por ela." },
        { p: "12.4. Direito de arrependimento: você pode desistir da contratação em até 7 dias (art. 49 do CDC), pela mesma loja em que contratou (Decreto 7.962/2013, art. 5º)." },
        { p: "12.5. Apagar o aplicativo ou excluir a conta não cancela a assinatura, que pertence à sua conta da Apple ou do Google." },
      ],
    },
    {
      title: "13. Suspensão e exclusão da conta",
      blocks: [
        { p: "13.1. Podemos suspender ou encerrar contas em caso de fraude, uso indevido ou violação destes Termos, com aviso ao e-mail cadastrado." },
        { p: "13.2. Você pode excluir a sua conta a qualquer momento pelo próprio aplicativo, no seu Perfil. A exclusão apaga os seus dados conforme a Política de Privacidade, seção 10." },
      ],
    },
    {
      title: "14. Registro do aceite",
      blocks: [
        { p: "14.1. Quando você aceita estes Termos e a Política de Privacidade, registramos a data e a hora, a versão de cada documento e a sua conta, como prova do aceite." },
      ],
    },
    {
      title: "15. Alterações",
      blocks: [
        { p: "15.1. Podemos alterar estes Termos. A versão vigente, com a data no topo, fica sempre no aplicativo e no site. Mudanças relevantes serão avisadas no aplicativo e, quando exigirem, pedirão um novo aceite." },
      ],
    },
    {
      title: "16. Aplicativo obtido na App Store",
      blocks: [
        { p: "16.1. Estes Termos são celebrados entre você e o Willo, e não com a Apple Inc. O Willo, e não a Apple, é responsável pelo aplicativo e pelo seu conteúdo." },
        { p: "16.2. A licença de uso limita-se a aparelhos Apple que você possua ou controle, nos termos das regras de uso da App Store. A Apple não tem obrigação de prestar manutenção ou suporte ao aplicativo." },
        { p: "16.3. Se o aplicativo deixar de cumprir uma garantia aplicável, você pode notificar a Apple, que poderá reembolsar o preço pago, se houver. Na extensão permitida pela lei, a Apple não tem outra obrigação de garantia sobre o aplicativo." },
        { p: "16.4. A Apple não responde por reclamações suas ou de terceiros sobre o aplicativo, incluindo responsabilidade pelo produto, descumprimento de exigência legal ou regulatória e proteção ao consumidor, sem prejuízo dos seus direitos perante o Willo. Alegações de violação de propriedade intelectual por terceiros são de responsabilidade do Willo." },
        { p: "16.5. Você declara não estar em país sujeito a embargo do governo dos EUA nem em lista de pessoas restritas desse governo. A Apple e suas subsidiárias são terceiras beneficiárias destes Termos e podem exigir o seu cumprimento." },
      ],
    },
    {
      title: "17. Lei e foro",
      blocks: [
        { p: "17.1. Estes Termos seguem a legislação brasileira." },
        { p: "17.2. Em relações de consumo, o foro é o do seu domicílio (art. 101, I, do CDC). Nas demais, o da comarca de " + C.city + "." },
        { p: "17.3. Se alguma cláusula for considerada inválida, as demais continuam valendo." },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  key: "privacy",
  title: "Política de Privacidade",
  kicker: "POLÍTICA DE DADOS",
  version: "1.1",
  updated: "06/11/2026",
  path: "/politica-privacidade",
  intro: "Como o Willo coleta, usa, compartilha e protege os seus dados, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). O Willo não vende os seus dados e não usa os seus dados financeiros para publicidade.",
  sections: [
    {
      title: "1. Quem trata os seus dados",
      blocks: [
        { p: `1.1. Controlador (LGPD, art. 5º, VI): ${C.name}${C.document.startsWith("[") ? "" : `, ${C.document}`}, ${C.city}.` },
        { p: `1.2. Encarregado de dados (LGPD, art. 41): ${C.email}. Nesta fase, controlador e encarregado podem ser a mesma pessoa, conforme a Resolução CD/ANPD nº 2/2022 para agentes de pequeno porte.` },
      ],
    },
    {
      title: "2. Dados que coletamos",
      blocks: [
        { p: "2.1. Conta: nome, e-mail, identificador interno e, quando você entra com Apple ou Google, o identificador dessa conta." },
        { p: "2.2. Dados financeiros que você registra: receitas, despesas, valores, datas, categorias, descrições, contas e os saldos que você informa, cartões (nome, limite, fechamento e vencimento), faturas e parcelas, metas, cofrinhos, recorrências e lembretes." },
        { p: "2.3. Conteúdo que você envia: fotos de comprovantes, arquivos de fatura, áudios de voz e mensagens ao assistente." },
        { p: "2.4. E-mail (opcional, versão web): se você conectar o Gmail, lemos, em modo somente leitura, as mensagens necessárias para importar faturas e compras." },
        { p: "2.5. Compras enviadas pelos Atalhos (opcional, Willo Copilot): se você criar a automação no app Atalhos do iPhone, recebemos os dados de cada compra que ela envia: valor, estabelecimento, data, forma de pagamento e cartão ou banco. Não lemos as suas notificações nem outros dados do aparelho." },
        { p: "2.6. Aparelho e uso técnico: sistema e modelo do aparelho, versão do aplicativo, idioma e registros técnicos de erro no servidor, incluindo endereço IP." },
        { p: "2.7. Registros de aceite: data, hora e versão dos Termos e desta Política que você aceitou." },
        { p: "2.8. O que nunca pedimos: senha do banco, número completo do cartão, código de segurança (CVV) ou acesso à sua conta bancária." },
      ],
    },
    {
      title: "3. Para que usamos",
      blocks: [
        {
          list: [
            "prestar o serviço: registrar, organizar e mostrar os seus lançamentos, saldos, faturas e metas;",
            "gerar análises, previsões, alertas e respostas do assistente;",
            "ler comprovantes, áudios, e-mails e as compras enviadas pelos Atalhos quando você usar essas funções;",
            "enviar os lembretes e avisos que você autorizou;",
            "manter a segurança, prevenir fraude e corrigir erros;",
            "cumprir obrigações legais e exercer direitos em processos.",
          ],
        },
        { p: "3.1. Não usamos os seus dados para publicidade, não fazemos rastreamento entre aplicativos e não pedimos o identificador de publicidade do aparelho." },
      ],
    },
    {
      title: "4. Inteligência artificial",
      blocks: [
        { p: "4.1. Provedores: Anthropic, PBC (EUA), com o modelo Claude, é o provedor principal do assistente e da leitura de lançamentos. Google LLC (EUA), com o Gemini, é usado na leitura de áudios, de fotos e de faturas, na sugestão de categorias e quando o provedor principal falha." },
        { p: "4.2. O que é enviado: apenas o necessário para cada resposta, como o texto, a foto ou o áudio que você enviou e, no assistente, um resumo dos seus lançamentos, saldos e faturas. Não enviamos o seu e-mail nem a sua senha: o pedido é identificado por um código interno." },
        { p: "4.3. Os dados enviados aos provedores não são usados por nós para publicidade. Os provedores tratam esses dados conforme os seus termos comerciais e políticas: anthropic.com/legal/privacy e policies.google.com/privacy." },
        { p: "4.4. Consentimento: o envio de dados a provedores de IA, com transferência internacional para os EUA, depende do seu consentimento, pedido no aplicativo antes do primeiro uso dessas funções. Sem ele, as funções de IA não funcionam, e o restante do Willo continua funcionando." },
      ],
    },
    {
      title: "5. Com quem compartilhamos",
      blocks: [
        { p: "5.1. Compartilhamos dados apenas com estes fornecedores, cada um para a finalidade indicada:" },
        {
          list: [
            "Supabase (EUA): autenticação, banco de dados e funções de servidor. O banco de dados fica em São Paulo (Brasil); as funções de servidor podem rodar fora do Brasil.",
            "Anthropic e Google: inteligência artificial (seção 4).",
            "Google: conexão com o Gmail e entrada com Google, quando você usar.",
            "Apple: entrada com Apple e, quando houver, pagamentos e assinaturas.",
            "Expo (EUA): entrega de atualizações do aplicativo.",
            "Vercel (EUA): hospedagem da versão web e do site.",
          ],
        },
        { p: "5.2. Não vendemos nem cedemos os seus dados a bancos, financeiras, seguradoras, birôs de crédito, anunciantes ou empregadores." },
        { p: "5.3. Dados podem ser fornecidos a autoridades quando exigido por lei ou por ordem judicial." },
      ],
    },
    {
      title: "6. Transferência internacional",
      blocks: [
        { p: "6.1. Alguns fornecedores ficam fora do Brasil, principalmente nos EUA. A transferência ocorre com base no seu consentimento específico para as funções de IA (LGPD, art. 33, VIII) e nas garantias contratuais de proteção de dados oferecidas pelos fornecedores (art. 33, II)." },
      ],
    },
    {
      title: "7. Uso de dados do Google",
      blocks: [
        { p: "7.1. O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google seguem a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado. Os dados do Gmail são usados apenas para importar as suas faturas e compras, não são usados para publicidade e não são lidos por pessoas, salvo com o seu consentimento, por segurança ou por exigência legal." },
      ],
    },
    {
      title: "8. Segurança",
      blocks: [
        { p: "8.1. Usamos criptografia em trânsito e em repouso, regras de acesso no banco de dados que impedem uma pessoa de ler os dados de outra, e acesso administrativo restrito. Tokens de acesso ao e-mail ficam guardados no servidor, fora do alcance do aplicativo." },
        { p: "8.2. Nenhum sistema é totalmente inviolável. Em caso de incidente de segurança que possa causar risco ou dano relevante, comunicaremos a ANPD e as pessoas afetadas no prazo da Resolução CD/ANPD nº 15/2024. Para relatar um incidente, escreva para " + C.email + " com o assunto \"INCIDENTE LGPD\"." },
      ],
    },
    {
      title: "9. Seus direitos (LGPD, art. 18)",
      blocks: [
        {
          list: [
            "confirmar que tratamos os seus dados e acessá-los;",
            "corrigir dados incompletos, inexatos ou desatualizados;",
            "pedir anonimização, bloqueio ou eliminação de dados desnecessários;",
            "pedir a portabilidade dos seus dados;",
            "saber com quem compartilhamos os seus dados (seção 5);",
            "revogar consentimentos, como o da IA, o do Gmail e o do Copilot;",
            "excluir a sua conta pelo próprio aplicativo, no seu Perfil;",
            "peticionar à Autoridade Nacional de Proteção de Dados (gov.br/anpd).",
          ],
        },
        { p: `9.1. Para o que não estiver disponível no aplicativo, escreva para ${C.email}. Prazo de resposta: até 15 dias.` },
      ],
    },
    {
      title: "10. Por quanto tempo guardamos",
      blocks: [
        { p: "10.1. Guardamos os seus dados enquanto a sua conta existir." },
        { p: "10.2. Ao excluir a conta, apagamos o seu perfil, lançamentos, contas, cartões, faturas, metas, lembretes, conversas e arquivos enviados, no momento da exclusão. Cópias de segurança são apagadas no ciclo seguinte de rotação." },
        { p: "10.3. Mesmo após a exclusão, guardamos os registros de aceite por até 5 anos, como prova dos documentos aceitos (LGPD, art. 16, I, e art. 7º, VI), e os dados que a lei obrigue a manter, pelo prazo legal." },
      ],
    },
    {
      title: "11. Bases legais",
      blocks: [
        {
          table: {
            head: ["Finalidade", "Base legal"],
            rows: [
              ["Conta, cadastro e prestação do serviço", "Execução de contrato (art. 7º, V)"],
              ["Funções de IA e transferência internacional", "Consentimento (art. 7º, I, e art. 33, VIII)"],
              ["Gmail e Willo Copilot", "Consentimento (art. 7º, I)"],
              ["Lembretes e notificações", "Consentimento (art. 7º, I)"],
              ["Segurança, prevenção de fraude e correção de erros", "Legítimo interesse (art. 7º, IX)"],
              ["Registros de aceite após a exclusão", "Exercício regular de direitos (art. 7º, VI)"],
              ["Obrigações legais", "Obrigação legal (art. 7º, II)"],
            ],
          },
        },
      ],
    },
    {
      title: "12. Menores de idade",
      blocks: [
        { p: "12.1. O Willo não é destinado a menores de 18 anos e não coleta intencionalmente os dados deles. Se identificarmos dados de um menor, eles serão excluídos." },
      ],
    },
    {
      title: "13. Site e versão web",
      blocks: [
        { p: "13.1. A versão web guarda no seu navegador apenas o necessário para manter você conectado e as suas preferências. Não usamos cookies de publicidade nem pixels de rastreamento." },
      ],
    },
    {
      title: "14. Alterações",
      blocks: [
        { p: "14.1. A versão vigente desta Política, com a data no topo, fica sempre no aplicativo e no site. Mudanças relevantes serão avisadas no aplicativo e, quando exigirem, pedirão um novo consentimento." },
      ],
    },
  ],
};

export const LEGAL = { terms: TERMS, privacy: PRIVACY } as const;
