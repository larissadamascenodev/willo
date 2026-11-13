import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { amountOf, plain, readNotice } from "./notice.ts";

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
 * - { code, notice, app? }, from a bank-notification automation: the notification's text,
 *   read for the amount, debit or credit, Pix sent or received and the shop or person.
 *   Anything that is not money moving is ignored. The same purchase arriving from the
 *   Wallet and from the bank within 2 minutes is kept once, with what each one knew.
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
  const cardsOf = async () => ((await admin.from("credit_cards").select("id, name").eq("user_id", userId)).data ?? []) as { id: string; name: string }[];
  const matchCard = (text: string, cards: { id: string; name: string }[]) => {
    const words = plain(text).split(/\s+/).filter((w) => w.length > 2);
    return cards.find((c) => words.some((w) => plain(c.name).includes(w)))?.id ?? null;
  };
  /* The same purchase seen twice: the same amount, from the other source (the Wallet for a
     bank notice, and the other way round), arriving within 2 minutes of each other — both
     notices of one tap come in the same minute or so. Five minutes apart, they are two
     purchases; and two from the same source are always two. */
  const TWIN_WINDOW_MS = 2 * 60_000;
  const twin = async (amount: number, from: "atalho" | "aviso") => {
    const since = new Date(Date.now() - TWIN_WINDOW_MS).toISOString();
    const { data } = await admin
      .from("copilot_pending")
      .select("id, raw, payment_method, credit_card_id")
      .eq("user_id", userId)
      .eq("status", "pendente")
      .eq("amount", Math.round(amount * 100) / 100)
      .eq("source", from)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(1);
    return (data?.[0] ?? null) as { id: string; raw: string | null; payment_method: string | null; credit_card_id: string | null } | null;
  };

  /* A bank's notification. */
  if (typeof body.notice === "string") {
    const app = typeof body.app === "string" ? body.app.trim() : "";
    const n = readNotice(body.notice, app);
    if (!n) return json({ ok: true, ignored: true });
    const word = n.method === "conta" ? "Débito" : n.method === "cartao" ? "Crédito" : "";
    const cardText = [app, word].filter(Boolean).join(" ");
    const cards = n.method === "cartao" ? await cardsOf() : [];
    const creditCardId = n.method === "cartao" ? matchCard(`${app} ${body.notice}`, cards) : null;

    const seen = n.type === "despesa" ? await twin(n.amount, "atalho") : null;
    if (seen) {
      /* The Wallet told the shop and card; the bank tells debit or credit. Kept together. */
      let raw: Record<string, unknown> = {};
      try {
        raw = seen.raw ? JSON.parse(seen.raw) : {};
      } catch {
        raw = {};
      }
      const merged = { ...raw, card: [raw.card, word].filter(Boolean).join(" ").trim(), notice: String(body.notice).slice(0, 200) };
      await admin
        .from("copilot_pending")
        .update({
          raw: JSON.stringify(merged).slice(0, 500),
          ...(n.method === "conta" ? { payment_method: "conta", credit_card_id: null } : {}),
          ...(n.method === "cartao" && !seen.credit_card_id && creditCardId ? { payment_method: "cartao", credit_card_id: creditCardId } : {}),
        })
        .eq("id", seen.id);
      return json({ ok: true, merged: true, message: `${n.name} · R$ ${n.amount.toFixed(2).replace(".", ",")} ${n.method === "conta" ? "no débito" : n.method === "cartao" ? "no crédito" : ""} no Willo Copilot`.replace("  ", " ") });
    }

    const { error } = await admin.from("copilot_pending").insert({
      user_id: userId,
      name: n.name.slice(0, 80),
      amount: Math.round(n.amount * 100) / 100,
      type: n.type,
      payment_method: n.method === "cartao" && creditCardId ? "cartao" : n.method === "conta" ? "conta" : null,
      credit_card_id: creditCardId,
      occurred_at: new Date().toISOString(),
      source: "aviso",
      raw: JSON.stringify({ card: cardText, notice: String(body.notice).slice(0, 300), app }).slice(0, 500),
    });
    if (error) return json({ error: "Não foi possível guardar o aviso" }, 500);
    const what = n.type === "receita" ? "entrada" : n.method === "conta" ? "no débito" : n.method === "cartao" ? "no crédito" : "";
    return json({ ok: true, message: `${n.name} · R$ ${n.amount.toFixed(2).replace(".", ",")} ${what} no Willo Copilot`.replace("  ", " ") });
  }

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
  /* With the whole purchase in one field, the shop is its first line that is not the amount. */
  const fromWhole = texts
    .flatMap((t) => t.split(/\r?\n/))
    .map((l) => l.replace(/R\$\s*-?\d[\d.,]*/g, "").replace(/[{}"\[\]]/g, "").trim())
    .find((l) => l.length >= 2 && !/^\d[\d.,\s]*$/.test(l));
  const merchant = firstLine(body.merchant ?? body.name) || fromWhole || "Compra no cartão";
  const card = firstLine(body.card) || texts.join(" ");

  /* The Wallet names the card ("Nubank Mastercard"); matched to one of the person's cards
     by its name, so the purchase is already on the right invoice when it is confirmed. */
  const creditCardId = card ? matchCard(card, await cardsOf()) : null;

  /* The bank's notice may have come first: then this only adds the shop and the card. */
  const seen = await twin(amount, "aviso");
  if (seen) {
    let raw: Record<string, unknown> = {};
    try {
      raw = seen.raw ? JSON.parse(seen.raw) : {};
    } catch {
      raw = {};
    }
    await admin
      .from("copilot_pending")
      .update({ name: merchant.slice(0, 80), raw: JSON.stringify({ ...raw, merchant: body.merchant ?? null, card: [body.card ?? "", raw.card ?? ""].join(" ").trim() }).slice(0, 500) })
      .eq("id", seen.id);
    return json({ ok: true, merged: true, message: `${merchant} · R$ ${amount.toFixed(2).replace(".", ",")} no Willo Copilot` });
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
