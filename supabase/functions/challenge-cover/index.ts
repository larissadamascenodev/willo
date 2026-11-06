import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * The photo on a challenge's card.
 *
 * One photo per kind of challenge ("30 dias sem delivery", "compras online", a
 * category someone made their own challenge from), kept in the public
 * challenge-covers bucket under the kind's key, so it is made once and every person
 * with that challenge sees the same picture. Asked for a key that already has one, it
 * hands that back without making another.
 *
 * Made by Gemini's image model: a realistic, editorial photograph of the subject, dark
 * and quiet enough for white text over it, with no text, logos or faces. The app sends
 * the subject in a sentence; the style and the rules are added here, so a card can
 * never ask for anything but a cover.
 *
 * Signed-in callers only. The key is checked to be a short slug, so the bucket holds
 * covers and nothing else.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "challenge-covers";
const KEY = /^[a-z0-9][a-z0-9-]{2,63}$/;
/* Tried in order; GEMINI_IMAGE_MODELS (comma separated) overrides. */
const DEFAULT_MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "imagen-4.0-generate-001"];
const TIMEOUT_MS = 45_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function prompt(subject: string) {
  return [
    `A realistic editorial photograph for a personal finance app's challenge card. Subject: ${subject}.`,
    "Natural, believable scene, shot on a full-frame camera, shallow depth of field, soft cinematic light, rich but muted colours, slightly dark and moody so white text placed over the lower half stays readable.",
    "Vertical 3:4 composition with the subject in the upper two thirds.",
    "No text, no letters, no numbers, no logos, no brand names, no watermarks, no recognisable faces, no screens showing apps.",
  ].join(" ");
}

async function withTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generate(subject: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const models = (Deno.env.get("GEMINI_IMAGE_MODELS") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const text = prompt(subject);
  let lastError = "";

  for (const model of models.length ? models : DEFAULT_MODELS) {
    try {
      if (model.startsWith("imagen")) {
        const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ instances: [{ prompt: text }], parameters: { sampleCount: 1, aspectRatio: "3:4" } }),
        });
        if (!res.ok) {
          lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 300)}`;
          console.error(lastError);
          continue;
        }
        const data = await res.json();
        const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
        if (b64) return { bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), mime: data.predictions[0].mimeType ?? "image/png" };
        lastError = `${model}: no image`;
        continue;
      }

      const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
        }),
      });
      if (!res.ok) {
        lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 300)}`;
        console.error(lastError);
        continue;
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const image = parts.find((p: { inlineData?: { data?: string } }) => p?.inlineData?.data)?.inlineData;
      if (image?.data) return { bytes: Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0)), mime: image.mimeType ?? "image/png" };
      lastError = `${model}: no image`;
    } catch (e) {
      lastError = `${model}: ${e instanceof Error ? e.message : "failed"}`;
      console.error(lastError);
    }
  }
  throw new Error(lastError || "no image model answered");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const key = String(body.key ?? "").toLowerCase();
    const subject = String(body.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    if (!KEY.test(key) || subject.length < 3) return json({ error: "Bad request" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const path = `${key}.jpg`;
    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    /* Made already: hand it back. */
    const { data: existing } = await admin.storage.from(BUCKET).list("", { search: path, limit: 1 });
    if (existing?.some((f) => f.name === path)) return json({ url: publicUrl, made: false });

    const { bytes, mime } = await generate(subject);
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
    /* Two people asking at once: the second finds the first's. */
    if (error && !/exists|duplicate/i.test(error.message)) throw error;

    return json({ url: publicUrl, made: true });
  } catch (e) {
    console.error("challenge-cover failed:", e);
    return json({ error: e instanceof Error ? e.message : "failed" }, 500);
  }
});
