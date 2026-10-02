// O type-check do app também lê alguns arquivos do site, que usam variáveis do Vite.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly [key: string]: string | boolean | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
