// Cliente do Supabase do celular (o do site é src/integrations/supabase/client.ts): as chaves
// vêm do app.config.ts e a sessão fica no localStorage em SQLite que o polyfills.ts instala.
import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabasePublishableKey?: string };

if (!extra.supabaseUrl || !extra.supabasePublishableKey) {
  throw new Error(
    "Chaves do Supabase não encontradas. Confira se o arquivo .env do site está na pasta acima de mobile/ (com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY).",
  );
}

export const supabase = createClient<Database>(extra.supabaseUrl, extra.supabasePublishableKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // o app não abre o login por link do navegador
    detectSessionInUrl: false,
  },
});

// Em segundo plano o JS pausa; renovar o token só com o app aberto evita erros de sessão ao voltar.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
