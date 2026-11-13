import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Willo Copilot's door for the iPhone's Wallet shortcut.
 *
 * A Wallet "Transaction" automation on the person's iPhone runs a shortcut each time a
 * card in the Wallet is used; the shortcut posts the purchase here — the shop, the
 * amount, the card — with the person's own Copilot code. The purchase goes into their
 * waiting list (copilot_pending), never straight into their transactions: they confirm it
 * in the app.
 *
 * Two calls:
 * - { action: "code" }, signed in (the app's Authorization header): the person's Copilot
 *   code, to paste into the shortcut. It is their user id signed with the server's own
 *   key, so it needs no table and cannot be guessed or forged.
 * - { code, amount, merchant, card?, name? }, from the shortcut: one purchase, queued.
 *
 * Deployed with verify_jwt off: the shortcut has no session, only the code.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sign(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`copilot:${serviceKey}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 32);
}

/** "wl1.<user id>.<signature>" — the person's code. */
async function codeFor(userId: string) {
  return `wl1.${userId}.${await sign(userId)}`;
}

async function userFromCode(code: string): Promise<string | null> {
  const m = /^wl1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(code.trim());
  if (!m) return null;
  return (await sign(m[1])) === m[2] ? m[1] : null;
}

/** "R$ 1.234,56", "1234.56", "12,9" — whatever the shortcut hands over, as a number. */
function amountOf(raw: unknown): number {
  if (typeof raw === "number") return Math.abs(raw);
  const s = String(raw ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const normal = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  return Math.abs(Number(normal)) || 0;
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }

  const admin = createClient(url, serviceKey);

  /* The app asks for the person's code. */
  if (body.action === "code") {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return json({ error: "Entre de novo no app" }, 401);
    return json({ code: await codeFor(data.user.id) });
  }

  /* The shortcut sends a purchase. */
  const userId = await userFromCode(String(body.code ?? ""));
  if (!userId) return json({ error: "Código do Copilot inválido" }, 401);

  /* What the shortcut sent, by shape only (no values), so a broken setup can be seen in the logs. */
  console.log("copilot in", JSON.stringify(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, k === "code" ? "…" : typeof v === "string" ? `text(${v.length})` : typeof v]))));

  /* A field set to the whole "Entrada do Atalho" instead of one of its items arrives as
     the purchase's full description; the amount and the shop are read out of it then. */
  const texts = Object.entries(body)
    .filter(([k]) => k !== "code")
    .map(([, v]) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v)));
  /* Only a field that is just a number is read as one; anything longer is searched. */
  const justNumber = (v: unknown) => typeof v === "number" || /^\s*(R\$)?\s*-?[\d.,]+\s*$/.test(String(v ?? ""));
  let amount = justNumber(body.amount) ? amountOf(body.amount) : 0;
  if (!(amount > 0)) {
    for (const t of texts) {
      const m = /R\$\s*-?\d[\d.,]*/.exec(t) ?? /\d+[.,]\d{2}/.exec(t);
      if (m) {
        amount = amountOf(m[0]);
        if (amount > 0) break;
      }
    }
  }
  if (!(amount > 0)) return json({ error: "Valor não encontrado. No atalho, em amount, escolha Entrada do Atalho › Valor." }, 400);
  const firstLine = (v: unknown) => String(v ?? "").split(/\r?\n/)[0].replace(/R\$\s*-?\d[\d.,]*/g, "").trim();
  const merchant = firstLine(body.merchant ?? body.name) || "Compra no cartão";
  const card = firstLine(body.card);

  /* The Wallet names the card ("Nubank Mastercard"); matched to one of the person's cards
     by its name, so the purchase is already on the right invoice when it is confirmed. */
  let creditCardId: string | null = null;
  if (card) {
    const { data: cards } = await admin.from("credit_cards").select("id, name").eq("user_id", userId);
    const words = plain(card).split(/\s+/).filter((w) => w.length > 2);
    const hit = (cards ?? []).find((c: { name: string }) => words.some((w) => plain(c.name).includes(w)));
    creditCardId = hit?.id ?? null;
  }

  const { error } = await admin.from("copilot_pending").insert({
    user_id: userId,
    name: merchant.slice(0, 80),
    amount: Math.round(amount * 100) / 100,
    type: "despesa",
    payment_method: creditCardId ? "cartao" : null,
    credit_card_id: creditCardId,
    occurred_at: new Date().toISOString(),
    source: "atalho",
    raw: JSON.stringify({ merchant: body.merchant ?? null, amount: body.amount ?? null, card: body.card ?? null, name: body.name ?? null }).slice(0, 500),
  });
  if (error) return json({ error: "Não foi possível guardar a compra" }, 500);

  return json({ ok: true, message: `${merchant} · R$ ${amount.toFixed(2).replace(".", ",")} no Willo Copilot` });
});
