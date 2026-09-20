import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Deletes the signed-in person's account for good: every row they own, their
 * uploaded files and the auth user itself. Required by App Store guideline
 * 5.1.1(v) — an app that lets people create an account must let them delete
 * it from inside the app.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Child rows first, so nothing is left pointing at a deleted parent. */
const TABLES = [
  "invoice_items",
  "invoice_payments",
  "invoices",
  "recurring_exclusions",
  "finance_events",
  "transactions",
  "goal_transactions",
  "goals",
  "credit_cards",
  "accounts",
  "category_limits",
  "custom_categories",
  "challenge_checkins",
  "user_challenges",
  "health_scores",
  "notifications",
  "notification_settings",
  "login_days",
  "profiles",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Who is asking (their own token, never an id sent by the client)
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    for (const table of TABLES) {
      const column = table === "profiles" ? "id" : "user_id";
      const { error } = await admin.from(table).delete().eq(column, user.id);
      // A table that doesn't exist in this project shouldn't block the deletion
      if (error && !/does not exist/i.test(error.message)) {
        console.error(`delete-account: ${table}`, error.message);
      }
    }

    // Uploaded avatars and goal covers live under <user id>/
    const { data: files } = await admin.storage.from("avatars").list(user.id);
    if (files?.length) {
      await admin.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (err) {
    console.error("delete-account", err);
    return json({ error: err instanceof Error ? err.message : "Erro ao excluir a conta" }, 500);
  }
});
