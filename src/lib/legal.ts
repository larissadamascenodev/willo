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
  /** A natural person: the CPF is not published, it is given on written request. */
  document: "pessoa física",
  city: "Campinas/SP",
  email: "contato.appwillo@gmail.com",
  site: "https://appwillo.com",
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
  title: "Termos de Uso, Isenção de Responsabilidade e Assunção de Risco",
  kicker: "TERMOS DE USO",
  version: "2.0",
  updated: "12/11/2026",
  path: "/termos",
  intro: "Leia com atenção antes de usar. Ao continuar, você declara ter lido, compreendido e aceito integralmente este documento.",
  sections: [
    {
      title: "0. Identificação da Desenvolvedora",
      blocks: [
        { p: `0.1. Este aplicativo é desenvolvido e operado por ${C.name}, pessoa física, residente em ${C.city}, doravante denominada "Desenvolvedora". A identificação completa da Desenvolvedora (CPF) pode ser solicitada por escrito pelo canal de contato da cláusula 0.3.` },
        { p: "0.2. Fase atual do produto: o Willo está em desenvolvimento contínuo e recebe atualizações frequentes. Funcionalidades podem estar incompletas, sujeitas a alterações ou descontinuadas sem aviso prévio, e você reconhece esse estado do produto ao usá-lo." },
        { p: `0.3. Contato: ${C.email} (prazo de resposta: até 15 dias úteis).` },
      ],
    },
    {
      title: "1. Natureza do Serviço: Ferramenta de Organização Financeira",
      blocks: [
        { p: "1.1. O Willo é uma ferramenta digital de organização financeira pessoal. Ele registra as receitas e despesas que você informa, organiza contas, cartões, faturas, parcelas e metas, e mostra análises, previsões e respostas sobre os seus próprios números." },
        { p: "1.2. O Willo não é e não se equipara a:" },
        {
          list: [
            "banco, instituição financeira, instituição de pagamento, corretora ou administradora de cartões;",
            "serviço que movimenta dinheiro: o Willo não faz pagamentos, transferências, Pix, investimentos nem empréstimos;",
            "consultoria, análise ou recomendação de valores mobiliários e investimentos (Resoluções CVM nº 19/2021 e nº 20/2021);",
            "assessoria contábil, tributária ou jurídica;",
            "participante do Open Finance ou birô de crédito: o Willo não se conecta à sua conta bancária, não pede a senha do seu banco e não consulta o seu CPF em cadastros de crédito.",
          ],
        },
        { p: "1.3. As sugestões, alertas, mini-metas e respostas geradas pelo Willo, inclusive por inteligência artificial, não constituem recomendação de investimento, de crédito ou de qualquer produto financeiro." },
        { p: "1.4. Saldos, previsões, etapas da Sua Jornada e análises são estimativas calculadas a partir dos dados que você registra. Eles não substituem o extrato do seu banco nem a fatura oficial do seu cartão." },
      ],
    },
    {
      title: "2. Público-Alvo e Restrições de Uso",
      blocks: [
        { p: "2.1. Restrição etária: o Willo destina-se exclusivamente a pessoas com 18 (dezoito) anos ou mais." },
        { p: "2.2. Uso pessoal: a conta é individual e intransferível. Você deve informar dados verdadeiros e manter o seu acesso em segurança, e responde pelo uso feito com a sua conta." },
        { p: "2.3. Situação financeira delicada: se você está com dívidas em atraso, risco de perder um bem ou dificuldade para pagar despesas essenciais, procure também orientação especializada (como o Procon, a Defensoria Pública ou o serviço de renegociação do seu banco). O Willo ajuda a organizar, mas não substitui esse apoio." },
      ],
    },
    {
      title: "3. Natureza e Limitações do Conteúdo Gerado por IA",
      blocks: [
        { p: "3.1. Parte do conteúdo do Willo é gerada por modelos de linguagem de grande escala (LLMs). Esses modelos são ferramentas estatísticas: não têm formação profissional, não conhecem toda a sua vida financeira e não assumem responsabilidade profissional." },
        { p: "3.2. O conteúdo gerado por IA pode conter imprecisões, informações incorretas (alucinações), valores mal lidos ou sugestões inadequadas ao seu caso. Você assume o risco de agir com base nessas informações sem conferi-las." },
        { p: "3.3. Quando o Willo lê um texto, uma foto, um áudio, um arquivo de fatura, um e-mail ou uma compra enviada pelos Atalhos, o resultado é uma sugestão de lançamento. Confira valor, data, categoria e cartão antes de salvar: o que você salva é registro seu." },
      ],
    },
    {
      title: "4. Assunção Voluntária de Riscos",
      blocks: [
        { p: "4.1. Ao usar o Willo, você declara, de forma livre, consciente e informada, que as decisões sobre o seu dinheiro são suas e que assume os riscos delas, entre eles:" },
        {
          list: [
            "juros, multas e encargos por contas ou faturas pagas com atraso;",
            "decisões de gasto, de parcelamento, de crédito ou de investimento tomadas com base nas análises do aplicativo;",
            "diferenças entre o saldo mostrado no Willo e o saldo real no seu banco, causadas por lançamentos não registrados, registrados errado ou duplicados;",
            "avisos e lembretes que não cheguem por configuração do aparelho, falta de conexão ou falha técnica.",
          ],
        },
      ],
    },
    {
      title: "5. Isenção de Responsabilidade",
      blocks: [
        { p: "5.1. Na extensão máxima permitida pela legislação brasileira, o Willo e a Desenvolvedora não se responsabilizam por:" },
        {
          list: [
            "prejuízos financeiros, juros, multas ou perdas decorrentes de decisões tomadas com base no aplicativo;",
            "imprecisões, erros ou alucinações do conteúdo gerado por IA, e erros de leitura não conferidos antes de salvar;",
            "lançamentos incorretos, incompletos ou duplicados feitos por você ou trazidos pelo Willo Copilot;",
            "indisponibilidade do serviço, perda de dados ou falhas técnicas, inclusive de fornecedores;",
            "acesso não autorizado aos seus dados por terceiros, apesar das medidas de segurança adotadas;",
            "danos decorrentes do uso por menores de 18 anos.",
          ],
        },
        { p: "5.2. Esta cláusula não afasta os direitos garantidos pelo Código de Defesa do Consumidor (Lei 8.078/1990) nem a responsabilidade por dano causado com dolo." },
      ],
    },
    {
      title: "6. Funções do Aplicativo",
      blocks: [
        { p: "6.1. Willo Copilot: é uma função opcional que anota as suas compras com a ajuda de uma automação que você mesmo cria no app Atalhos do iPhone. A automação envia ao Willo só o necessário para o lançamento: valor, estabelecimento, data, forma de pagamento e cartão. O Willo não lê as suas notificações, não acessa a sua conta bancária e não movimenta dinheiro. Você cria, edita e desliga a automação a qualquer momento; desligá-la não apaga o que já foi salvo." },
        { p: "6.2. Comprovantes, voz e e-mail: você pode registrar gastos por foto, por voz ou, na versão web, conectando o Gmail em modo somente leitura. Cada função depende da sua permissão (câmera, galeria, microfone ou acesso ao e-mail), que pode ser revogada a qualquer momento." },
        { p: "6.3. Lembretes e notificações: com a sua permissão, o Willo avisa sobre contas e faturas a vencer. Um aviso que não chegue não muda o vencimento da conta: o pagamento continua sendo responsabilidade sua." },
        { p: "6.4. Sua Jornada, mini-metas, pontos e medalhas: são recursos de motivação calculados a partir dos seus registros. Não têm valor monetário, não podem ser trocados por dinheiro ou benefícios e podem ser recalculados quando os seus dados mudam." },
      ],
    },
    {
      title: "7. Propriedade Intelectual e Conteúdo do Usuário",
      blocks: [
        { p: "7.1. A marca Willo, o mascote, o design, os textos e o software pertencem à Desenvolvedora. Estes Termos concedem a você uma licença pessoal, não exclusiva e intransferível de uso do aplicativo." },
        { p: "7.2. Os seus dados continuam seus. Ao enviar fotos, áudios, arquivos ou mensagens, você concede ao Willo licença limitada, não exclusiva e revogável para processá-los apenas para prestar o serviço." },
        { p: "7.3. É vedado copiar, revender ou distribuir o aplicativo ou o conteúdo gerado por ele para fins comerciais sem autorização prévia e por escrito." },
      ],
    },
    {
      title: "8. Parcerias de Divulgação",
      blocks: [
        { p: "8.1. O Willo pode firmar parcerias de divulgação com criadores de conteúdo e outros parceiros, cada uma regida por contrato próprio. Estes Termos não criam, para nenhum usuário, direito a comissão, pagamento ou benefício de indicação." },
        { p: "8.2. O parceiro responde pelo conteúdo que publica e deve observar o Código de Defesa do Consumidor e o Código Brasileiro de Autorregulamentação Publicitária (CONAR), sem prometer resultado financeiro garantido." },
      ],
    },
    {
      title: "9. Alterações nos Termos",
      blocks: [
        { p: "9.1. Estes Termos podem ser alterados a qualquer tempo. A versão vigente fica sempre publicada no site e no aplicativo, em Perfil." },
        { p: "9.2. As alterações valem a partir da publicação, e o uso continuado do aplicativo depois dela constitui aceite das novas condições. Mudanças relevantes são avisadas no aplicativo. Se não concordar, você pode cancelar a assinatura na loja (cláusula 11.4) e excluir a sua conta." },
      ],
    },
    {
      title: "10. Reembolso, Cancelamento e Direito de Arrependimento",
      blocks: [
        { p: "10.1. Quem cobra: toda assinatura do Willo é contratada e paga na Apple App Store ou no Google Play. Cobrança, estorno e reembolso são feitos pela própria loja. O Willo não recebe nem armazena os dados do seu cartão." },
        { p: "10.2. Como pedir reembolso: o pedido é feito na loja onde a compra foi realizada. No iPhone, acesse reportaproblem.apple.com, entre com o seu Apple ID e escolha \"Solicitar um reembolso\". No Android, acesse o histórico de pedidos do Google Play e toque em \"Informar um problema\"." },
        { p: "10.3. Quem decide: ressalvado o direito de arrependimento (cláusula 10.4), a análise e a devolução do valor seguem as políticas da loja, que decide o pedido." },
        { p: "10.4. Direito de arrependimento (art. 49 do CDC): você pode desistir da contratação em até 7 (sete) dias, pela mesma loja em que contratou (Decreto 7.962/2013, art. 5º, §1º). Recomenda-se mencionar o art. 49 do CDC no pedido." },
        { p: "10.5. Cancelar não é pedir reembolso: cancelar interrompe as renovações futuras, mas não devolve valores já cobrados." },
        { p: "10.6. Apagar o aplicativo ou excluir a conta não cancela a assinatura, que pertence à sua conta da Apple ou do Google. Cancele sempre pela loja (cláusula 11.4)." },
        { p: "10.7. Quando a loja aprova um reembolso, o acesso correspondente à assinatura é encerrado." },
      ],
    },
    {
      title: "11. Assinatura, Renovação Automática e Pagamento",
      blocks: [
        { p: "11.1. Planos e preço: o Willo oferece assinatura mensal e anual. O valor de cada plano e a duração do teste gratuito, quando houver, aparecem no aplicativo e na loja antes da confirmação da compra, e é essa informação exibida na contratação que vale. Valores podem variar por promoções e testes e podem mudar para novas contratações, sem efeito sobre assinaturas em vigor." },
        { p: "11.2. Teste gratuito: quando oferecido, o acesso é integral e sem cobrança durante o período exibido na contratação (por exemplo, 7 dias). Cancelar antes do fim do teste impede a cobrança. Sem cancelamento, a loja cobra automaticamente o plano escolhido ao fim do teste. O teste é limitado a uma contratação por pessoa, Apple ID ou conta Google." },
        { p: "11.3. O plano anual é cobrado de uma só vez, no início de cada período anual (ou ao fim do teste gratuito). O valor \"por mês\" que a tela de assinatura pode mostrar é só uma comparação (o valor anual dividido por 12), não uma parcela." },
        { p: "11.4. Renovação e cancelamento: a assinatura renova-se automaticamente ao fim de cada período pelo mesmo valor, salvo cancelamento com pelo menos 24 horas de antecedência. No iPhone, cancele em Ajustes → [seu nome] → Assinaturas → Willo, ou em apps.apple.com/account/subscriptions. No Android, em Google Play → Pagamentos e assinaturas → Assinaturas." },
        { p: "11.5. Depois do cancelamento, você mantém o acesso até o fim do período já pago." },
        { p: "11.6. Sem assinatura ativa, você continua podendo consultar os dados que já registrou, mas não consegue registrar novos lançamentos nem usar as funções de inteligência artificial." },
        { p: "11.7. Falha de pagamento: se a renovação falhar, a loja pode oferecer um período de tolerância; sem regularização, o acesso da assinatura é encerrado." },
        { p: "11.8. Aumentos de preço para assinantes ativos são comunicados com antecedência, conforme as regras das lojas, e você pode cancelar antes de o novo valor valer." },
      ],
    },
    {
      title: "12. Revogação de Consentimento",
      blocks: [
        { p: "12.1. Conforme a LGPD (art. 8º, §5º), você pode revogar a qualquer momento os consentimentos que deu." },
        { p: "12.2. O consentimento para o envio de dados aos provedores de inteligência artificial (Anthropic e Google Gemini), com transferência internacional para servidores nos EUA, é necessário para as funções do Willo. Para revogá-lo, exclua a sua conta em Perfil → Excluir conta. A revogação encerra o serviço, mas não cancela a assinatura na loja (cláusula 10.6)." },
        { p: "12.3. Notificações, câmera, galeria, microfone e a automação do Willo Copilot podem ser desligados a qualquer momento nos ajustes do aparelho ou no app Atalhos." },
        { p: "12.4. A revogação vale daqui em diante e não invalida o que foi feito antes com base no consentimento então vigente." },
      ],
    },
    {
      title: "13. Indenização",
      blocks: [
        { p: "13.1. Você se compromete a indenizar o Willo e a Desenvolvedora por reclamações, danos e despesas (incluindo honorários advocatícios razoáveis) decorrentes de: (i) uso indevido do serviço; (ii) violação destes Termos; (iii) registro de dados de terceiros sem autorização; (iv) uso por menor de 18 anos contra a vedação da cláusula 2.1." },
      ],
    },
    {
      title: "14. Força Maior e Limitação Tecnológica",
      blocks: [
        { p: "14.1. O Willo usa inteligência artificial generativa e serviços de terceiros, sujeitos a falhas de geração, indisponibilidade de provedores e mudanças de modelo." },
        { p: "14.2. Você reconhece que esses eventos são próprios da tecnologia atual e não configuram, por si só, defeito do serviço (CDC, art. 14, §1º, III, e art. 12, §1º, III)." },
      ],
    },
    {
      title: "15. Não-Consultoria (Reforço Regulatório)",
      blocks: [
        { p: "15.1. O conteúdo do Willo não constitui: (a) consultoria de valores mobiliários nem análise de valores mobiliários (Resoluções CVM nº 19/2021 e nº 20/2021); (b) serviço contábil (Decreto-Lei 9.295/1946); (c) orientação jurídica ou tributária; (d) oferta de crédito ou de produto financeiro." },
        { p: "15.2. Toda sugestão do Willo é informativa e de organização pessoal, e as decisões são sempre suas." },
      ],
    },
    {
      title: "16. Prova Eletrônica do Aceite",
      blocks: [
        { p: "16.1. Ao aceitar estes Termos e a Política de Privacidade, o Willo registra a data e a hora, as versões dos documentos aceitos e a sua conta, como prova do aceite, que pode ser apresentada em eventual disputa." },
      ],
    },
    {
      title: "17. Lei Aplicável e Foro",
      blocks: [
        { p: "17.1. Estes Termos seguem a legislação brasileira." },
        { p: "17.2. Em relações de consumo, o foro é o do domicílio do usuário (CDC, art. 101, I). Nas demais, o da comarca de Campinas/SP." },
        { p: "17.3. Comunicações eletrônicas (e-mail cadastrado e avisos no aplicativo) têm a mesma validade de notificação física." },
        { p: "17.4. Se alguma cláusula for considerada inválida, as demais continuam valendo." },
      ],
    },
    {
      title: "18. Cláusula de Sobrevivência",
      blocks: [
        { p: "18.1. As cláusulas 4 (Riscos), 5 (Isenção), 13 (Indenização), 14 (Força Maior) e 16 (Prova Eletrônica) continuam valendo após o encerramento da conta, pelo prazo prescricional aplicável." },
      ],
    },
    {
      title: "19. Aplicativo Obtido na App Store ou no Google Play",
      blocks: [
        { p: "19.1. Estes Termos são celebrados entre você e a Desenvolvedora, e não com a Apple Inc. ou com o Google LLC, que não são responsáveis pelo aplicativo nem pelo seu conteúdo." },
        { p: "19.2. O uso também segue as regras da loja onde o aplicativo foi obtido. A Apple e o Google não têm obrigação de prestar manutenção ou suporte ao aplicativo." },
        { p: "19.3. Se o aplicativo deixar de cumprir uma garantia aplicável, você pode notificar a Apple, que poderá reembolsar o preço pago, conforme as regras dela. Na extensão permitida pela lei, a Apple não tem outra obrigação de garantia sobre o aplicativo." },
        { p: "19.4. A Apple não responde por reclamações suas ou de terceiros sobre o aplicativo, incluindo responsabilidade pelo produto, descumprimento de exigência legal ou regulatória e proteção ao consumidor, sem prejuízo dos seus direitos perante a Desenvolvedora." },
        { p: "19.5. Alegações de terceiros de que o aplicativo viola direitos de propriedade intelectual são de responsabilidade da Desenvolvedora, e não da Apple." },
        { p: "19.6. Você declara não estar em país sujeito a embargo do governo dos EUA nem em lista de pessoas restritas desse governo. A Apple e suas subsidiárias são terceiras beneficiárias destes Termos e podem exigir o seu cumprimento." },
      ],
    },
    {
      title: "20. Suspensão e Encerramento da Conta",
      blocks: [
        { p: "20.1. A conta pode ser suspensa ou encerrada, com aviso ao e-mail cadastrado, em caso de fraude, uso indevido, tentativa de burlar limites técnicos, violação destes Termos ou ordem legal ou judicial." },
        { p: "20.2. Você pode excluir a sua conta a qualquer momento em Perfil → Excluir conta. Isso apaga os seus dados conforme a Política de Privacidade, mas não cancela a assinatura na loja (cláusula 10.6)." },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  key: "privacy",
  title: "Política de Privacidade e Proteção de Dados",
  kicker: "PRIVACIDADE",
  version: "2.0",
  updated: "12/11/2026",
  path: "/privacidade",
  intro: "Esta Política explica quais dados o Willo coleta, para que usa, com quem compartilha, por quanto tempo guarda e como você exerce os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). O Willo não vende os seus dados e não os usa para publicidade.",
  sections: [
    {
      title: "1. Dados que Coletamos",
      blocks: [
        { p: "1.1. Conta e identificação: nome ou apelido, e-mail, identificador interno de usuário e, quando você entra com Apple ou Google, o identificador dessa conta." },
        { p: "1.2. Dados financeiros que você registra: receitas, despesas, valores, datas, categorias, descrições, contas e saldos informados, cartões (nome, limite, fechamento e vencimento), faturas, parcelas, metas, caixinhas, recorrências e lembretes." },
        { p: "1.3. Respostas do início: objetivo, renda informada, como o mês costuma terminar, hábitos de gasto e preferências, usados para montar o seu perfil financeiro e a Sua Jornada." },
        { p: "1.4. Conteúdo que você envia: fotos de comprovantes, arquivos de fatura, áudios de voz e mensagens ao Willo." },
        { p: "1.5. Compras enviadas pelos Atalhos (opcional, Willo Copilot): valor, estabelecimento, data, forma de pagamento e cartão de cada compra que a automação envia. Não lemos as suas notificações nem outros dados do aparelho." },
        { p: "1.6. E-mail (opcional, versão web): se você conectar o Gmail, lemos, em modo somente leitura, as mensagens necessárias para importar faturas e compras." },
        { p: "1.7. Assinatura e compra: plano, datas de início, renovação e cancelamento e identificadores das compras nas lojas. Não recebemos nem guardamos dados do seu cartão." },
        { p: "1.8. Aparelho e uso técnico: sistema e modelo do aparelho, versão do aplicativo, idioma e registros técnicos de erro no servidor, incluindo endereço IP. Não coletamos o identificador de publicidade do aparelho e não fazemos rastreamento entre aplicativos." },
        { p: "1.9. Registros de consentimento: cada aceite dos Termos, desta Política e do envio de dados à inteligência artificial, com as versões aceitas, a data e a hora e a sua conta." },
        { p: "1.10. O que nunca pedimos: senha do banco, número completo do cartão, código de segurança (CVV) ou acesso à sua conta bancária." },
      ],
    },
    {
      title: "2. Inteligência Artificial",
      blocks: [
        { p: "2.1. Provedores: as funções de IA do Willo (assistente, leitura de fotos, de áudios e de faturas, registro por voz e sugestão de categorias) são processadas pela Anthropic (Anthropic, PBC, EUA), com o modelo Claude, provedora principal, e pelo Google Gemini (Google LLC, EUA), usado em funções específicas ou quando a provedora principal não está disponível." },
        { p: "2.2. O que é enviado: apenas o necessário para cada resposta, como o texto, a foto ou o áudio que você enviou e, no assistente, um resumo dos seus lançamentos, saldos e faturas. Não enviamos o seu e-mail nem a sua senha: o pedido é identificado por um código interno. O seu primeiro nome pode ser usado para personalizar a resposta." },
        { p: "2.3. Finalidade: gerar o conteúdo exibido no aplicativo. O Willo não usa para publicidade os dados enviados à IA." },
        { p: "2.4. Consentimento: o envio de dados aos provedores de IA, com transferência internacional para os EUA, depende do seu consentimento, dado na tela Antes de começar do aplicativo. Revogação: cláusula 6 desta Política e cláusula 12 dos Termos de Uso." },
        { p: "2.5. Políticas dos provedores: anthropic.com/legal/privacy e policies.google.com/privacy." },
      ],
    },
    {
      title: "3. Com Quem Compartilhamos",
      blocks: [
        { p: "3.1. Compartilhamos dados apenas com os fornecedores abaixo, cada um para a finalidade indicada:" },
        {
          list: [
            "Supabase (EUA): autenticação, banco de dados e funções de servidor. O banco de dados fica em São Paulo (Brasil); as funções de servidor podem rodar fora do Brasil.",
            "Anthropic e Google Gemini: inteligência artificial (cláusula 2).",
            "Apple e Google, como lojas: pagamento, assinatura e entrada com Apple ou Google.",
            "RevenueCat (EUA): gestão das assinaturas. Recebe o identificador interno da sua conta e os comprovantes e a situação das compras, nunca os dados do seu cartão.",
            "Google (Gmail): conexão com o e-mail, quando você usar essa função na versão web.",
            "Expo (EUA): entrega de atualizações do aplicativo.",
            "Vercel (EUA): hospedagem do site.",
          ],
        },
        { p: "3.2. O Willo não vende os seus dados e não os cede a bancos, financeiras, seguradoras, birôs de crédito, anunciantes ou empregadores. Não usamos ferramentas de publicidade, pixels de rastreamento nem atribuição de anúncios." },
        { p: "3.3. Autoridades: dados podem ser fornecidos a autoridades quando exigido por lei ou por ordem judicial." },
        { p: "3.4. Transferência internacional: alguns fornecedores ficam fora do Brasil, principalmente nos EUA. A transferência ocorre com base no seu consentimento específico (art. 33, VIII) e nas garantias contratuais de proteção de dados oferecidas por esses fornecedores (art. 33, II)." },
      ],
    },
    {
      title: "4. Para que Usamos os Seus Dados",
      blocks: [
        {
          list: [
            "a) prestar o serviço: registrar, organizar e mostrar os seus lançamentos, saldos, faturas, metas e a Sua Jornada;",
            "b) gerar análises, previsões e respostas por IA (cláusula 2);",
            "c) ler comprovantes, áudios, e-mails e as compras enviadas pelos Atalhos, quando você usar essas funções;",
            "d) processar e validar a sua assinatura;",
            "e) enviar os lembretes e avisos que você autorizou;",
            "f) garantir a segurança, prevenir fraude e corrigir erros;",
            "g) cumprir obrigações legais e exercer direitos em processos.",
          ],
        },
      ],
    },
    {
      title: "5. Segurança dos Dados",
      blocks: [
        { p: "5.1. Usamos criptografia em trânsito e em repouso, regras de acesso no banco de dados que impedem uma pessoa de ler os dados de outra e acesso administrativo restrito." },
        { p: "5.2. Nenhum sistema é totalmente inviolável. Em caso de incidente de segurança que possa causar risco ou dano relevante, seguimos a cláusula 11." },
      ],
    },
    {
      title: "6. Seus Direitos (LGPD, art. 18)",
      blocks: [
        { p: "Você pode, a qualquer momento:" },
        {
          list: [
            "confirmar se tratamos os seus dados e acessá-los;",
            "corrigir dados incompletos, inexatos ou desatualizados;",
            "pedir anonimização, bloqueio ou eliminação de dados desnecessários;",
            "pedir a portabilidade dos seus dados;",
            "saber com quem compartilhamos os seus dados (cláusula 3);",
            "revogar consentimentos (Termos de Uso, cláusula 12);",
            "excluir a sua conta pelo próprio aplicativo, em Perfil → Excluir conta (cláusula 7);",
            "peticionar à Autoridade Nacional de Proteção de Dados (gov.br/anpd).",
          ],
        },
        { p: `Para o que não estiver disponível no aplicativo, escreva para ${C.email}. Prazo de resposta: até 15 dias.` },
      ],
    },
    {
      title: "7. Retenção e Exclusão",
      blocks: [
        { p: "7.1. Guardamos os seus dados enquanto a sua conta existir." },
        { p: "7.2. Ao excluir a conta, apagamos o perfil, os lançamentos, contas, cartões, faturas, metas, lembretes, conversas e arquivos enviados, no momento da exclusão." },
        { p: "7.3. Mesmo depois da exclusão, ficam guardados: a) os registros de consentimento (cláusula 1.9), por até 5 (cinco) anos, como prova dos documentos aceitos (LGPD, art. 16, I, e art. 7º, VI); b) os dados que a lei obrigue a manter, pelo prazo legal." },
        { p: "7.4. Cópias de segurança: o banco de dados tem cópias automáticas, apagadas em ciclos. Um dado excluído pode permanecer nelas, sem uso, até o ciclo seguinte de rotação." },
        { p: "7.5. Os dados já recebidos pelos fornecedores da cláusula 3 seguem os prazos de cada um. Depois da exclusão, deixamos de enviar dados seus a eles." },
        { p: "7.6. A exclusão da conta não cancela a assinatura na loja (Termos de Uso, cláusula 10.6)." },
      ],
    },
    {
      title: "8. Menores de Idade",
      blocks: [
        { p: "8.1. O Willo não é destinado a menores de 18 anos e não coleta intencionalmente dados deles. Se identificarmos dados de um menor, eles serão excluídos." },
      ],
    },
    {
      title: "9. Alterações nesta Política",
      blocks: [
        { p: "9.1. A versão vigente desta Política fica sempre publicada no site e no aplicativo, em Perfil. As alterações valem a partir da publicação; mudanças relevantes são avisadas no aplicativo e, quando exigirem, pedirão um novo consentimento." },
      ],
    },
    {
      title: "10. Registro de Consentimento",
      blocks: [
        { p: "10.1. Conforme a LGPD (art. 8º, §2º), o Willo mantém o registro de cada consentimento prestado, com os dados da cláusula 1.9, guardado junto à sua conta no servidor." },
        { p: "10.2. Você pode pedir um relatório dos seus consentimentos pelo canal de contato. Após a exclusão da conta, eles são guardados conforme a cláusula 7.3." },
      ],
    },
    {
      title: "11. Incidentes de Segurança",
      blocks: [
        { p: "11.1. Em caso de incidente de segurança com dados pessoais, o Willo: (i) contém o incidente o mais rápido possível; (ii) avalia o escopo e os dados afetados; (iii) comunica a ANPD e os titulares afetados, quando houver risco ou dano relevante, no prazo da Resolução CD/ANPD nº 15/2024; (iv) registra o incidente (LGPD, art. 37); e (v) adota medidas para evitar que se repita." },
        { p: `11.2. Para relatar um incidente, escreva para ${C.email} com o assunto "INCIDENTE LGPD".` },
      ],
    },
    {
      title: "12. Bases Legais por Finalidade",
      blocks: [
        {
          table: {
            head: ["Finalidade", "Base legal"],
            rows: [
              ["Conta, cadastro e prestação do serviço", "Execução de contrato (art. 7º, V)"],
              ["Funções de IA e transferência internacional", "Consentimento (art. 7º, I, e art. 33, VIII)"],
              ["Assinatura e pagamento", "Execução de contrato (art. 7º, V)"],
              ["Gmail e Willo Copilot", "Consentimento (art. 7º, I)"],
              ["Lembretes e notificações", "Consentimento (art. 7º, I)"],
              ["Segurança, prevenção de fraude e correção de erros", "Legítimo interesse (art. 7º, IX)"],
              ["Registros de consentimento após a exclusão", "Exercício regular de direitos (art. 7º, VI, e art. 16, I)"],
              ["Obrigações legais", "Obrigação legal (art. 7º, II)"],
            ],
          },
        },
      ],
    },
    {
      title: "13. Site",
      blocks: [
        { p: "13.1. O site do Willo não usa cookies de publicidade, pixels de rastreamento nem ferramentas de atribuição de anúncios." },
      ],
    },
    {
      title: "Controlador e Encarregado",
      blocks: [
        { p: `Controlador (LGPD, art. 5º, VI): ${C.name}, pessoa física residente em ${C.city}.` },
        { p: `Encarregado de Dados (LGPD, art. 41): ${C.email}. Nesta fase do produto, controladora e encarregada são a mesma pessoa, conforme a Resolução CD/ANPD nº 2/2022 para agentes de tratamento de pequeno porte.` },
        { p: "Autoridade Nacional de Proteção de Dados (ANPD): gov.br/anpd." },
      ],
    },
  ],
};

export const LEGAL = { terms: TERMS, privacy: PRIVACY } as const;
