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
