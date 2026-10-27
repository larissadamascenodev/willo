const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/**
 * The bundler has to look outside its own folder.
 *
 * Babel rewrites `@/…` to ../src, but Metro still refuses to serve a file it is not
 * watching, and it still looks for packages only in its own node_modules. So both are
 * widened to take in the repository root, which is where the web app and the shared
 * code live.
 */
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

/*
 * No lazy bundles in development.
 *
 * The shared services clear their caches through `import("@/…")`, which Metro
 * serves in development as a bundle of its own, fetched when first reached. For a
 * file outside this folder it then registers that bundle for hot reload under the
 * wrong path, cannot find it, and the whole dev server exits — the first time a
 * transaction was saved on the phone. With lazy bundling off those imports ship in
 * the main bundle, as they do in a release build. The CLI reads this flag on each
 * request, so setting it here, before the server starts, is enough.
 */
process.env.EXPO_NO_METRO_LAZY = "1";

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(repoRoot, "src")];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

/* The two trees have their own copies of React; one of them has to win, or hooks
   break with the error about two Reacts in the same app. */
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = config;
