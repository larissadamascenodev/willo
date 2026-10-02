const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const webSrc = path.resolve(projectRoot, "../src");

const config = getDefaultConfig(projectRoot);

// A lógica do site (serviços, cálculos, hooks de dados) fica em ../src e é usada aqui sem cópia.
config.watchFolders = [webSrc];

// Os pacotes saem só de mobile/node_modules: o site usa React 18 e o app, React 19,
// e dois Reacts na mesma árvore quebram os hooks.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

// "@/..." é o alias do site para ../src; "~/..." é a pasta src deste app.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName.startsWith("@/")) return resolve(context, path.join(webSrc, moduleName.slice(2)), platform);
  if (moduleName.startsWith("~/")) return resolve(context, path.join(projectRoot, "src", moduleName.slice(2)), platform);
  return resolve(context, moduleName, platform);
};

module.exports = config;
