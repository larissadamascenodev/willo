const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
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

module.exports = withNativeWind(config, { input: "./src/global.css" });
