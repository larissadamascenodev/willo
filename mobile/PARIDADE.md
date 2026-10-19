# Paridade com a versão web

O que falta para o aplicativo nativo ser o mesmo aplicativo que está no ar em
`willo-app.vercel.app`. Levantado lendo o código da web, rota por rota, não de memória.

Legenda: **✅ pronto** · **🟡 parcial** (está lá, falta detalhe) · **⬜ não começou**

---

## 1. Telas

### ✅ Início — `/`
Céu, stories, board de widgets, barra inferior, barra de rolagem no topo.

Falta: **🟡 tamanhos de widget** — hoje só metade e linha inteira; a referência que você mandou
tem meia-largura **alta** e linha inteira **alta**. Decisão pendente: dois tamanhos ou quatro.

### ✅ Transações — `/transacoes`
Saldo solto, Entrada/Saída na mesma escala, abas, busca, dias agrupados, menu de segurar.

Falta:
- **⬜ Modal de resumo** ao tocar numa linha (`CardEntryModal`) — hoje tocar não abre nada
- **⬜ Editar** pelo menu de segurar → abrir o formulário já preenchido
- **⬜ Excluir** de verdade (hoje o menu confirma mas não apaga)
- **⬜ Filtros** (categoria, status, conta) — o botão de filtros da web
- **⬜ Deslizar a linha** para editar/excluir
- **⬜ Seletor de mês completo** — hoje são três meses fixos; a web tem o seletor cheio

### ✅ Cartões — `/cartoes`
Total, limite repartido, cards com marca do banco e etiqueta de status, menu de segurar.

Falta:
- **⬜ Criar cartão** (`CardCreateSheet` — a folha de dois passos)
- **⬜ Editar / excluir cartão** (`CreditCardEditModal`)
- **🟡 Recuo do resumo ao rolar** — a web fixa e desfoca o total; aqui ele rola

### ✅ Fatura — `/fatura/[id]`
Identidade no topo, cifra do que a fatura pede hoje, ciclo, limite, gráfico de próximas
faturas com selo de paga, lançamentos recentes, abre na fatura que precisa de atenção.

Falta:
- **⬜ Pagar fatura** (`InvoicePayModal`: escolher conta, valor, parcelar o pagamento)
- **⬜ Desfazer pagamento**
- **⬜ Adicionar lançamento** (`InvoiceAddChooserModal`: manual ou escanear)
- **⬜ Escanear fatura** (`InvoiceScanScreen` + `InvoiceUploadReviewModal` + a edge function)
- **⬜ Editar / excluir cartão** no ⋮ (o menu abre, as ações não fazem nada)
- **⬜ Modal de resumo** ao tocar num lançamento

### ✅ Lançamentos da fatura — `/fatura/[id]/lancamentos`
Parcelado × à vista, abas Todos/Parcelados, busca.

Falta: **⬜ tocar numa linha** abrir o resumo.

### ✅ Próximos eventos — `/eventos`
Calendário do mês com marcas por dia, A receber / A pagar, dias escritos.

Falta: **⬜ tocar num evento** leva a algum lugar.

### ✅ Contas — `/gestao`
Total, barra repartida por banco, uma linha por conta.

Falta:
- **⬜ Criar conta** (a folha igual à de cartão)
- **⬜ Reserva e potes** (`ReserveAndPots`)
- **⬜ Tocar numa conta** → `/conta/[id]`

### 🟡 Novo lançamento — `/novo`
Valor, descrição, categoria, conta/cartão, repetição, status, observação. Salva de verdade.

Falta:
- **⬜ Transferência** entre contas (a terceira aba)
- **⬜ Escolher a data** (hoje é sempre hoje)
- **⬜ Criar conta/cartão/categoria** de dentro do formulário
- **⬜ Sugestão de categoria** pela IA
- **⬜ Modo edição** (abrir preenchido a partir de um lançamento)

### ⬜ Raio-X — `/bot-finance`
154 linhas de página, mas puxa 7 componentes em `components/raiox/`. É o painel de análise:
score do mês, radar, projeções, vilões, recomendações.

### ⬜ Detalhe da conta — `/conta/[id]`
466 linhas. Saldo, extrato da conta, editar, excluir.

### ⬜ Receitas e despesas — `/detalhe/[tipo]`
433 linhas. A tela que abre ao tocar no card de receitas/despesas.

### ⬜ Parcelamentos — `/parcelamentos`
377 linhas. Tudo que está sendo pago parcelado, com progresso de cada compra.

### ⬜ Metas — `/metas` e `/metas/[id]`
333 + 347 linhas, mais 5 componentes. Criar meta, guardar, sacar, capa, prazo.

### ⬜ Fluxo de caixa / Balanço / Projeções — `/fluxo-de-caixa`, `/bot-finance/balanco`, `/bot-finance/projecoes`
1089 linhas numa página só (`Financeiro`), com os gráficos.

### ⬜ Gastos por categoria — `/analytics/categorias`
1841 linhas. A maior do app: análise por categoria com histórico e comparações.

### ⬜ Gerenciar categorias — `/categorias`
383 linhas. Criar, editar, esconder, cor e ícone.

### ⬜ Configurações — `/configuracoes`
771 linhas. Perfil, moeda, tema, notificações, trocar senha, excluir conta, termos.

### ⬜ Agentes — `/agentes`
204 linhas. Os agentes do app.

### ⬜ Assistente (Willo) — `/assistente`
213 linhas + `components/assistant/`. O chat.

### ⬜ Onboarding — `/onboarding`, `/configurar`
6 + 6 componentes. O fluxo de entrada e a configuração guiada.

### ⬜ Login, cadastro e recuperação — `/auth`, `/welcome`, `/reset-password`
Hoje o app tem uma tela de login mínima (e-mail e senha). Falta: Apple, Google,
cadastro, recuperação dentro do app, e a tela de boas-vindas.

### ⬜ Planos — `/planos`
### ⬜ Central de ajuda, suporte, termos, privacidade

---

## 2. Coisas que atravessam todas as telas

- **⬜ Registro rápido** — a folha com Receita / Despesa / Escanear / Transferir e o microfone
- **⬜ Notificações** — o sino abre o painel (`NotificationsPanel`)
- **⬜ Perfil** — tocar no avatar vai para configurações
- **⬜ Ocultar valores** — existe no menu de widget; falta aplicar em todas as telas
- **⬜ Toasts** — a web usa `sonner` para confirmar ações; o app ainda não avisa nada
- **⬜ Tema claro** — desligado na web (`LIGHT_THEME_ENABLED = false`), então não é dívida
- **🟡 Mês selecionado** — o contexto existe, mas só Transações e Fatura trocam de mês
- **⬜ Puxar para atualizar** em todas as telas (hoje só na home)

## 3. Ferramentas

- **⬜ Escanear comprovante** (`components/scan/`, 4 arquivos + edge function `process-invoice`)
- **⬜ Escanear fatura inteira** com revisão linha a linha
- **⬜ Lançamento por voz** (o microfone do registro rápido)
- **⬜ Plano financeiro com IA** (`AIFinancialWizardModal` + `ai-financial-plan`)
- **⬜ Insights de categoria** (`category-insights`)
- **⬜ Conectar Gmail** (`gmail-connect`)
- **⬜ Exportar / excluir conta** (`delete-account`)

## 4. Diferenças que são de propósito

Não são dívida — são decisões que valem para o nativo:

- **A barra de baixo é desenhada**, não um tab bar do sistema
- **O vidro não usa blur** nos cards: na web `.willo-glass` é só borda e branco a 4,6%
- **O preenchimento dos cards é 6,2%**, não 4,6% — o OLED chega ao preto e o navegador não
- **O céu é SVG**, porque React Native não tem gradiente radial
- **O layout dos widgets não viaja** entre web e celular: cada um guarda o seu

---

## Ordem sugerida

1. Fechar Transações: resumo, editar, excluir, filtros
2. Fechar Fatura: pagar, adicionar, editar cartão
3. Criar conta e criar cartão (as duas folhas)
4. Raio-X
5. Detalhe da conta, Parcelamentos, Receitas e despesas
6. Metas
7. Fluxo de caixa e Gastos por categoria (os dois grandes de gráfico)
8. Configurações, Categorias
9. Agentes e Assistente
10. Login completo e onboarding
11. Escanear e as ferramentas de IA
