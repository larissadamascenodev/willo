/**
 * Two source trees, one meaning for `@/`.
 *
 * The web app and this one share everything that is not a screen — the invoice
 * maths, the services that talk to Supabase, the hooks that assemble a month. That
 * code lives in ../src and imports itself as `@/…`, so `@/` has to keep meaning the
 * same thing here, or none of it would resolve. This app's own files answer to `~/`.
 *
 * The one exception is the Supabase client: the shared code asks for it by the web
 * path, and here that path is answered by a twin that stores its session on the
 * phone instead of in a browser.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@/integrations/supabase/client": "./src/supabase/client",
            "@": "../src",
            "~": "./src",
          },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],
      /* Reanimated's worklets. It has to be the last plugin in the list. */
      "react-native-worklets/plugin",
    ],
  };
};
