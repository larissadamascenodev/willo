# Willo — app do iPhone (Expo)

O app nativo do Willo. Usa o **mesmo banco (Supabase) e a mesma lógica** do site: a pasta `../src`
(serviços, cálculo de saldo e projeções, hooks de dados) é compartilhada, e as telas daqui são
nativas (React Native).

## Ver no seu iPhone (Expo Go)

1. **No iPhone:** instale o app **Expo Go** na App Store.
2. **No computador (Prompt de Comando):** entre na pasta do app e instale:

   ```
   cd caminho\da\pasta\willo\mobile
   npm install
   ```

3. Confira que o arquivo `.env` do site está na pasta de cima (`willo\.env`) com
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O app lê as chaves de lá; não há
   nada novo para configurar.
4. Inicie:

   ```
   npx expo start
   ```

5. Aparece um **QR code** no terminal. Abra a **câmera do iPhone**, aponte para ele e toque no
   aviso para abrir no Expo Go. O celular e o computador precisam estar **na mesma rede Wi-Fi**.

Se o QR não abrir (rede da empresa, firewall do Windows, Wi-Fi com isolamento):

```
npx expo start --tunnel
```

Quando o Windows perguntar se libera o Node.js na rede, aceite em **redes privadas**.

Se o Expo Go reclamar de versão incompatível, atualize o Expo Go na App Store: o app usa o
Expo SDK 57.

### Ver com dados de exemplo (sem entrar na sua conta)

No Prompt de Comando (sem espaço antes do `&&`):

```
set EXPO_PUBLIC_MOCK=1&& npx expo start
```

O app abre já logado numa conta fictícia, com um banco em memória. Nada é gravado no Supabase.
Para voltar ao normal, feche o terminal e use `npx expo start`.

## O que funciona no Expo Go e o que não

| | Expo Go | App instalado (TestFlight / loja) |
|---|---|---|
| Telas, dados, login por e-mail | sim | sim |
| Entrar com a Apple | não (o Supabase só aceita o `com.willo.app`) | sim |
| Câmera, galeria | sim | sim |
| Notificações locais | limitado | sim |

## O que já está no app

Início (com “complete sua conta”, cartões, parcelamentos e metas), Transações, Projeções, Raio-X
(score, previsão do mês, calendário de pressão, fatura inteligente, simuladores e retrospectiva),
Carteira (contas, reserva e cofrinhos), Cartões e Faturas (pagar, importar fatura por foto ou PDF),
Parcelamentos, Metas, Receitas/Despesas do mês, Fluxo de caixa, Categorias e limites, e Ajustes
(perfil, senha, moeda, apagar dados e **excluir a conta**). Lançar por foto de comprovante e
transferir entre contas ficam no “+”.

Ainda não portado: o assistente (em espera), as assinaturas no início, o gráfico “Financeiro” do
início, o quiz de entrada do site (o app vai direto para o login) e o login com Google.

## Antes de enviar para a App Store

1. **Publicar a função `delete-account` no Supabase.** O botão “Excluir minha conta” chama essa
   função (a Apple exige a exclusão dentro do app). Ela está em `supabase/functions/delete-account`
   e ainda não está no projeto.
2. **Cobrança.** `BILLING_ENABLED` está falso em `src/lib/billing.ts`. Assinatura dentro do app
   precisa ser compra do próprio iOS (StoreKit/RevenueCat), não o Stripe do site.
3. **Privacidade.** Os textos de câmera e fotos já estão no `app.config.ts`. Na ficha da loja,
   declare que o app envia comprovantes e faturas a um provedor de IA para leitura.
4. **Entrar com a Apple** só funciona no app instalado (TestFlight ou loja), não no Expo Go.

## Publicar na App Store

Precisa de conta Apple Developer (US$ 99/ano). O build é feito na nuvem pelo EAS, sem Mac:

```
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios
```

## Como o código está organizado

- `app/` — as telas e rotas (expo-router): `(tabs)` são as abas; o resto abre por cima.
- `src/ui/` — o kit visual (texto, vidro, botões, folha inferior…), igual ao do site.
- `src/features/` — as peças de cada tela.
- `src/platform/` — o que adapta o código do navegador para o celular (`localStorage`, eventos),
  o cliente do Supabase e o banco de demonstração.
- `../src` — a lógica compartilhada com o site. **Não copie para cá**: importe com `@/…`.

Comandos úteis: `npm run typecheck` confere os tipos do app e da lógica compartilhada.
