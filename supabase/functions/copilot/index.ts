import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { amountOf, plain, readNotice } from "./notice.ts";
import { guessCategory } from "./category.ts";

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
 * - { code, action: "confirm" | "discard", id, method? }, from the confirmation card the
 *   iPhone shows over any screen: the waiting purchase written as a transaction (debit out of
 *   the account, credit onto the card's open invoice), or let go.
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

  /* What the confirmation card shows for a waiting purchase: the shop, the amount, where it was
     paid and its category, and whether debit or credit still has to be asked. */
  async function cardOf(id: string) {
    const { data } = await admin.from("copilot_pending").select("id, name, amount, category, raw").eq("id", id).maybeSingle();
    if (!data) return null;
    let raw: Record<string, unknown> = {};
    try {
      raw = data.raw ? JSON.parse(data.raw) : {};
    } catch {
      raw = {};
    }
    const text = `${raw.card ?? ""} ${raw.notice ?? ""}`;
    const known = /d[eé]bito|debit/i.test(text) ? "Débito" : /cr[eé]dito|credit/i.test(text) ? "Crédito" : "";
    const ask = !known && (await cardsOf()).length > 0;
    const where = String(raw.card ?? "").split(/\r?\n/)[0].replace(/\s*(d[eé]bito|cr[eé]dito)\s*/gi, " ").trim().slice(0, 30);
    return {
      id: data.id,
      name: String(data.name),
      amount: `R$ ${Number(data.amount).toFixed(2).replace(".", ",")}`,
      detail: [where, known || (ask ? "" : "Débito"), data.category].filter(Boolean).join(" · "),
      ask,
    };
  }

  /* The answer given on the confirmation card. */
  if (body.action === "confirm" || body.action === "discard") {
    const id = String(body.id ?? "");
    const { data: row } = await admin
      .from("copilot_pending")
      .select("id, name, amount, type, category, payment_method, account_id, credit_card_id, occurred_at, raw, status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return json({ error: "Essa compra não está mais no Willo Copilot." }, 404);
    const p = row as { id: string; name: string; amount: number; type: "despesa" | "receita"; category: string | null; payment_method: string | null; account_id: string | null; credit_card_id: string | null; occurred_at: string; raw: string | null; status: string };
    /* Answered already (tapped twice, or in the app): nothing new. */
    if (p.status !== "pendente") return json({ ok: true, already: p.status });
    if (body.action === "discard") {
      await admin.from("copilot_pending").update({ status: "descartado" }).eq("id", p.id);
      return json({ ok: true, message: "Não registrado." });
    }

    let raw: Record<string, unknown> = {};
    try {
      raw = p.raw ? JSON.parse(p.raw) : {};
    } catch {
      raw = {};
    }
    const walletText = `${raw.card ?? ""} ${raw.notice ?? ""}`;
    const asked = body.method === "conta" || body.method === "cartao" ? (body.method as "conta" | "cartao") : null;
    const cards = await cardsOf();
    const method: "conta" | "cartao" | null =
      p.type === "receita" ? "conta" : (asked ?? (/d[eé]bito|debit/i.test(walletText) ? "conta" : /cr[eé]dito|credit/i.test(walletText) ? "cartao" : cards.length ? null : "conta"));
    if (!method) return json({ error: "Escolha débito ou crédito." }, 400);

    const words = plain(walletText).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    let accountId: string | null = null;
    let cardId: string | null = null;
    if (method === "cartao") {
      cardId = p.credit_card_id ?? cards.find((c) => words.some((w) => plain(c.name).includes(w)))?.id ?? cards[0]?.id ?? null;
      if (!cardId) return json({ error: "Nenhum cartão de crédito no Willo para essa compra." }, 400);
    } else {
      const { data: accs } = await admin.from("accounts").select("id, name, type, is_default, is_active").eq("user_id", userId);
      const usable = ((accs ?? []) as { id: string; name: string; type: string | null; is_default: boolean | null; is_active: boolean | null }[]).filter((a) => a.type !== "investment" && a.is_active !== false);
      accountId = p.account_id ?? usable.find((a) => words.some((w) => plain(a.name).includes(w)))?.id ?? usable.find((a) => a.is_default)?.id ?? usable[0]?.id ?? null;
    }

    const category =
      p.category ??
      (await guessCategory(p.name, async () => {
        const { data } = await admin.from("transactions").select("category").eq("user_id", userId).ilike("name", p.name).order("created_at", { ascending: false }).limit(1);
        return (data?.[0]?.category as string | undefined) ?? null;
      })) ??
      "Outros";
    /* The day and the hour where the person is. */
    const at = new Date(p.occurred_at);
    const local = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", ...o }).format(at);
    const date = local({ year: "numeric", month: "2-digit", day: "2-digit" });
    const time = local({ hour: "2-digit", minute: "2-digit", hour12: false }).replace(/^24/, "00");
    const credit = method === "cartao";
    /* As the app writes names: "PADARIA CLEIDE" → "Padaria Cleide", "iFood" kept. */
    const name = p.name
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((w) => (/[a-zà-ý]/.test(w) && /[A-ZÀ-Ý]/.test(w.slice(1))) || /\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    const { data: tx, error: txError } = await admin
      .from("transactions")
      .insert({
        user_id: userId,
        name,
        type: p.type,
        amount: Number(p.amount),
        category,
        date,
        time,
        status: credit ? "pendente" : "pago",
        payment_method: credit ? "cartao" : "conta",
        account_id: credit ? null : accountId,
        credit_card_id: credit ? cardId : null,
        recurrence_type: "unica",
        observation: p.raw ? `Willo Copilot · ${p.raw}`.slice(0, 280) : "Willo Copilot",
      })
      .select("id")
      .single();
    if (txError || !tx) return json({ error: "Não foi possível registrar agora. A compra continua no Willo Copilot." }, 500);
    await admin
      .from("copilot_pending")
      .update({ status: "confirmado", transaction_id: tx.id, category, payment_method: credit ? "cartao" : "conta", account_id: accountId, credit_card_id: cardId })
      .eq("id", p.id);

    const value = `R$ ${Number(p.amount).toFixed(2).replace(".", ",")}`;
    const title = p.type === "receita" ? "Receita registrada" : /pix/i.test(walletText) ? "Pix registrado" : "Compra registrada";
    return json({ ok: true, title, message: `${value} ${p.type === "receita" ? "de" : "na"} ${name}, em ${category}.` });
  }

  /* A bank's notification. */
  if (typeof body.notice === "string") {
    /* "App do banco" may hold the notification's title ("Compra no débito aprovada") and "Aviso"
       its text ("Compra de R$ 15,50 em PADARIA"): both are read, and the title is a name only when
       it is short enough to be one ("Nubank"). */
    const second = typeof body.app === "string" ? body.app.trim() : "";
    const app = second.length <= 18 && !/\d/.test(second) && second.split(/\s+/).length <= 2 ? second : "";
    const whole = [second, String(body.notice)].filter(Boolean).join(". ");
    console.log("copilot notice", JSON.stringify({ notice: `text(${String(body.notice).length})`, app: `text(${second.length})` }));
    const n = readNotice(whole, app);
    /* Nothing a bank says is thrown away: a notice Willo could not read as money moving is kept
       (status "ignorado", never shown in the app) so the next ways banks word things can be
       learned from what actually came in. */
    if (!n) {
      const { error: keepError } = await admin.from("copilot_pending").insert({
        user_id: userId,
        name: "Aviso não lido",
        amount: 0,
        type: "despesa",
        occurred_at: new Date().toISOString(),
        source: "aviso",
        status: "ignorado",
        raw: JSON.stringify({ notice: whole.slice(0, 400), app: second }).slice(0, 500),
      });
      /* Until the table takes "ignorado", the notice is at least in the log, its digits hidden. */
      if (keepError) console.log("copilot notice unread", whole.replace(/\d/g, "#").slice(0, 300));
      return json({ ok: true, ignored: true });
    }

    /* Money between the person's own accounts: the bank that received it names the sender, and
       that is them; or both banks tell of it (one out, one in, the same amount, within minutes).
       Kept once, as a transfer of their own, never as spending and income twice. */
    const ownNames = await (async () => {
      const { data: prof } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const { data: who } = await admin.auth.admin.getUserById(userId);
      const meta = (who?.user?.user_metadata ?? {}) as Record<string, unknown>;
      return [prof?.display_name, meta.full_name, meta.name].filter((x): x is string => typeof x === "string" && x.trim().length > 1).map((x) => plain(x).split(/\s+/).filter((w) => w.length > 2));
    })();
    const isOwn = (name: string) => {
      const words = plain(name).split(/\s+/);
      /* The first name and, when known, one more of the person's names. */
      return ownNames.some((own) => own.length > 0 && words.includes(own[0]) && (own.length === 1 || own.slice(1).some((w) => words.includes(w))));
    };
    /* "Você depositou R$ 1 via Pix" (Mercado Pago): money the person put in themselves. */
    const ownTransfer = /voce depositou|recebemos sua transferencia/.test(plain(whole)) || (/transfer|pix|ted\b|doc\b/.test(plain(whole)) && isOwn(n.name));
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: other } = await admin
      .from("copilot_pending")
      .select("id, raw, type")
      .eq("user_id", userId)
      .eq("status", "pendente")
      .eq("source", "aviso")
      .eq("amount", Math.round(n.amount * 100) / 100)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(5);
    const mirror = ((other ?? []) as { id: string; raw: string | null; type: string }[]).find((o) => o.type !== n.type);
    if (mirror) {
      let raw: Record<string, unknown> = {};
      try {
        raw = mirror.raw ? JSON.parse(mirror.raw) : {};
      } catch {
        raw = {};
      }
      await admin
        .from("copilot_pending")
        .update({ name: "Transferência entre suas contas", raw: JSON.stringify({ ...raw, transfer: true, other: whole.slice(0, 200) }).slice(0, 500) })
        .eq("id", mirror.id);
      return json({ ok: true, merged: true, message: `Transferência entre suas contas · R$ ${n.amount.toFixed(2).replace(".", ",")} no Willo Copilot` });
    }
    const word = n.method === "conta" ? "Débito" : n.method === "cartao" ? "Crédito" : "";
    const cardText = [app, word].filter(Boolean).join(" ");
    const cards = n.method === "cartao" ? await cardsOf() : [];
    const creditCardId = n.method === "cartao" ? matchCard(whole, cards) : null;

    const seen = n.type === "despesa" ? await twin(n.amount, "atalho") : null;
    if (seen) {
      /* The Wallet told the shop and card; the bank tells debit or credit. Kept together. */
      let raw: Record<string, unknown> = {};
      try {
        raw = seen.raw ? JSON.parse(seen.raw) : {};
      } catch {
        raw = {};
      }
      const merged = { ...raw, card: [raw.card, word].filter(Boolean).join(" ").trim(), notice: whole.slice(0, 200) };
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
      name: (ownTransfer ? "Transferência entre suas contas" : n.name).slice(0, 80),
      amount: Math.round(n.amount * 100) / 100,
      type: n.type,
      payment_method: n.method === "cartao" && creditCardId ? "cartao" : n.method === "conta" ? "conta" : null,
      credit_card_id: creditCardId,
      occurred_at: new Date().toISOString(),
      source: "aviso",
      raw: JSON.stringify({ card: cardText, notice: whole.slice(0, 300), app, ...(ownTransfer ? { transfer: true } : {}) }).slice(0, 500),
    });
    if (error) return json({ error: "Não foi possível guardar o aviso" }, 500);
    if (ownTransfer) return json({ ok: true, message: `Transferência entre suas contas · R$ ${n.amount.toFixed(2).replace(".", ",")} no Willo Copilot` });
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
      const m = /R\$\s*-?\d(?:[\d.,]*\d)?/.exec(t) ?? /\d+[.,]\d{2}/.exec(t);
      if (m) {
        amount = amountOf(m[0]);
        if (amount > 0) break;
      }
    }
  }
  if (!(amount > 0)) return json({ error: "A compra chegou sem valor. Na automação, toque em Valor, escolha Transação (não Entrada do Atalho), toque nela de novo e escolha Valor." }, 400);
  const firstLine = (v: unknown) => String(v ?? "").split(/\r?\n/)[0].replace(/R\$\s*-?\d(?:[\d.,]*\d)?/g, "").trim();
  /* With the whole purchase in one field, the shop is its first line that is not the amount. */
  const fromWhole = texts
    .flatMap((t) => t.split(/\r?\n/))
    .map((l) => l.replace(/R\$\s*-?\d(?:[\d.,]*\d)?/g, "").replace(/[{}"\[\]]/g, "").trim())
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
    return json({ ok: true, merged: true, message: `${merchant} · R$ ${amount.toFixed(2).replace(".", ",")} no Willo Copilot`, pending: await cardOf(seen.id) });
  }

  const category = await guessCategory(merchant, async () => {
    const { data } = await admin.from("transactions").select("category").eq("user_id", userId).ilike("name", merchant).order("created_at", { ascending: false }).limit(1);
    return (data?.[0]?.category as string | undefined) ?? null;
  });
  const { data: made, error } = await admin.from("copilot_pending").insert({
    user_id: userId,
    name: merchant.slice(0, 80),
    amount: Math.round(amount * 100) / 100,
    type: "despesa",
    category,
    payment_method: creditCardId ? "cartao" : null,
    credit_card_id: creditCardId,
    occurred_at: new Date().toISOString(),
    source: "atalho",
    raw: JSON.stringify({ merchant: body.merchant ?? null, amount: body.amount ?? null, card: body.card ?? null, name: body.name ?? null }).slice(0, 500),
  }).select("id").single();
  if (error || !made) return json({ error: "Não foi possível guardar a compra" }, 500);

  return json({ ok: true, message: `${merchant} · R$ ${amount.toFixed(2).replace(".", ",")} no Willo Copilot`, pending: await cardOf(made.id) });
});
