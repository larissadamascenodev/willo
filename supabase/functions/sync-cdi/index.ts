import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Brings the CDI up to date.
 *
 * The Banco Central publishes the daily CDI (SGS series 12, in % per day, business days
 * only). This reads the last few weeks and keeps them in `cdi_rates`, where every
 * caixinha's yield is worked out on the server. It takes nothing from the caller — it
 * only copies public data — so being called often, or by anyone signed in, changes
 * nothing but a few rows that already exist.
 *
 * The service key lives only here, in the function's own environment; the app never has it.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERIES = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/45?formato=json";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** "28/10/2026" → "2026-10-28". */
const isoOf = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const res = await fetch(SERIES, { headers: { Accept: "application/json" } });
    if (!res.ok) return json({ error: "bcb_unavailable", status: res.status }, 502);

    const raw = (await res.json()) as { data: string; valor: string }[];
    const rows = raw
      .map((r) => ({ date: isoOf(r.data), daily_rate: Number(r.valor) }))
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.daily_rate) && r.daily_rate > 0 && r.daily_rate < 1);
    if (rows.length === 0) return json({ error: "empty" }, 502);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("cdi_rates").upsert(rows, { onConflict: "date" });
    if (error) return json({ error: "write_failed" }, 500);

    return json({ ok: true, days: rows.length, latest: rows[rows.length - 1].date });
  } catch {
    return json({ error: "unexpected" }, 500);
  }
});
