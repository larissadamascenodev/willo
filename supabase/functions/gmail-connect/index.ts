import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Connecting a mailbox: the authorization URL, the code exchange, the status, and
 * disconnecting.
 *
 * Two things shape this file. The client never sees the client secret or the refresh
 * token, so the URL is built here rather than in the browser and the tokens are written
 * with the service role into a table the browser cannot read. And read-only is the whole
 * point: the scope asked for is gmail.readonly, so nothing here can send, delete or
 * change anything in the mailbox even if something later goes wrong.
 */

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "openid", "email"].join(" ");

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // The caller is identified with their own token, so nobody can connect a mailbox
    // to someone else's account.
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // The credentials table has no policy for authenticated users, so only this key
    // reaches it.
    const asService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "status";

    if (action === "status") {
      const { data } = await asService
        .from("gmail_connections")
        .select("email,last_scan_at")
        .eq("user_id", user.id)
        .maybeSingle();

      return json({
        connected: !!data,
        email: data?.email ?? null,
        ultima_busca: data?.last_scan_at ?? null,
        // Lets the app say "falta configurar no servidor" instead of failing silently.
        configurado: !!(clientId && clientSecret),
      });
    }

    if (!clientId || !clientSecret) {
      return json({
        error:
          "O Gmail ainda não está configurado no servidor. Falta cadastrar as credenciais do Google.",
        reason: "sem_credenciais",
      }, 503);
    }

    if (action === "auth_url") {
      const redirectUri = String(body?.redirect_uri ?? "");
      const state = String(body?.state ?? "");
      if (!redirectUri || !state) return json({ error: "redirect_uri e state são obrigatórios" }, 400);

      const url = new URL(AUTH_ENDPOINT);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES);
      // offline + consent is what actually returns a refresh token; without them Google
      // hands back only an access token that dies in an hour and never comes back.
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("state", state);

      return json({ url: url.toString() });
    }

    if (action === "exchange") {
      const code = String(body?.code ?? "");
      const redirectUri = String(body?.redirect_uri ?? "");
      if (!code || !redirectUri) return json({ error: "code e redirect_uri são obrigatórios" }, 400);

      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();

      if (!tokenRes.ok) {
        console.error("gmail-connect token exchange failed:", tokens?.error, tokens?.error_description);
        return json({ error: "O Google recusou a autorização. Tente conectar de novo." }, 400);
      }
      if (!tokens.refresh_token) {
        // Google only returns one on the first consent; without it the connection would
        // silently stop working in an hour, so it is refused now rather than later.
        return json({
          error:
            "O Google não devolveu a permissão de longo prazo. Remova o acesso do Willo na sua conta Google e conecte de novo.",
        }, 400);
      }

      const profileRes = await fetch(USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = profileRes.ok ? await profileRes.json() : {};

      const { error } = await asService.from("gmail_connections").upsert({
        user_id: user.id,
        email: profile?.email ?? "conta do Google",
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? null,
        access_expires_at: tokens.expires_in
          ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      return json({ connected: true, email: profile?.email ?? null });
    }

    if (action === "disconnect") {
      const { data } = await asService
        .from("gmail_connections")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      // Tell Google first. Deleting the row alone would leave the grant standing on
      // their side, so the app would look disconnected while the access still existed.
      if (data?.refresh_token) {
        await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(data.refresh_token)}`, {
          method: "POST",
        }).catch(() => {});
      }

      await asService.from("gmail_connections").delete().eq("user_id", user.id);
      return json({ connected: false });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("gmail-connect error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
