# Willo

.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dinhub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/11a2202d-5496-46f3-95b7-aec398c9eabf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Mobile (Capacitor)

O projeto já tem o Capacitor instalado (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`) e configurado em [`capacitor.config.ts`](capacitor.config.ts):

- App name: `Willo`
- App ID: `com.willo.app`
- Web dir: `dist`

### Plataforma iOS

A pasta `ios/` já existe no repositório com o projeto nativo gerado (`npx cap add ios`), usando Swift Package Manager (`ios/App/CapApp-SPM`) em vez de CocoaPods — esse é o padrão do Capacitor 8. Isso significa que **gerar e sincronizar** o projeto iOS (`cap add ios`, `cap sync ios`) não exige Xcode nem macOS, e já foi feito.

O que **exige macOS com Xcode instalado** é apenas compilar/rodar o app de fato:

```sh
npm run build     # gera a pasta dist/ com o build web atual
npx cap sync ios  # copia o build web + plugins pro projeto nativo (rode sempre após mudar o código)
npx cap open ios  # abre o projeto no Xcode — só funciona em macOS
```

No Xcode, use "Run" para compilar no simulador ou em um device físico. Pré-requisito no Mac: Xcode instalado via App Store (o Swift Package Manager resolve as dependências nativas automaticamente ao abrir o projeto, sem precisar instalar CocoaPods).
