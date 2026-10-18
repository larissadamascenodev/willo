import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@/integrations/supabase/types";

/**
 * The same project, reached from a phone.
 *
 * Every shared service imports the client by the web app's path, and the bundler
 * answers that path with this file. So nothing under ../src knows it is running on a
 * phone: the URL and the key are the same, the tables are the same, the row-level
 * rules are the same, and a session started here is the same account as the one in
 * the browser.
 *
 * Two differences, both forced by where it runs. The session is kept in the phone's
 * own storage instead of a browser's, and the client is told not to look for a
 * session in the address bar, because there is no address bar.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY em mobile/.env",
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
