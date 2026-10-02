import type { ExpoConfig } from "expo/config";
import fs from "node:fs";
import path from "node:path";

/**
 * O app usa o mesmo projeto Supabase do site, então lê as chaves públicas do .env que o site
 * já tem na pasta acima (VITE_*). Nada novo para configurar. EXPO_PUBLIC_* tem prioridade,
 * caso queira apontar o app para outro projeto.
 */
function readWebEnv(): Record<string, string> {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const web = readWebEnv();

const config: ExpoConfig = {
  name: "Willo",
  slug: "willo",
  scheme: "willo",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#0B0B0B",
  ios: {
    bundleIdentifier: "com.willo.app",
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription: "O Willo usa a câmera para você fotografar comprovantes e faturas e lançar os gastos automaticamente.",
      NSPhotoLibraryUsageDescription: "O Willo acessa suas fotos para você enviar comprovantes, faturas, foto de perfil e capas das suas metas.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    "expo-sqlite",
    ["expo-splash-screen", { backgroundColor: "#0B0B0B", image: "./assets/splash-icon.png", imageWidth: 200 }],
  ],
  // Só para conferir as telas num navegador durante o desenvolvimento; o app é o iOS.
  web: { bundler: "metro", output: "single" },
  experiments: { typedRoutes: false },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? web.VITE_SUPABASE_URL ?? "",
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? web.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
};

export default config;
