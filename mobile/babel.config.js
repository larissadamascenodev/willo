/**
 * Two source trees, one meaning for `@/`.
 *
 * The web app and this one share everything that is not a screen — the invoice
 * maths, the services that talk to Supabase, the hooks that assemble a month. That
 * code lives in ../src and imports itself as `@/…`, so `@/` has to keep meaning the
 * same thing here, or none of it would resolve. This app's own files answer to `~/`.
 *
 * Two modules are the exception: the shared code asks for the Supabase client and
 * the auth context by their web paths, and here those paths are answered by twins
 * that keep a session on the phone instead of in a browser.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@/integrations/supabase/client": "./src/supabase/client",
            "@/contexts/AuthContext": "./src/lib/auth",
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
