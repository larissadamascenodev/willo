import { supabase } from "@/integrations/supabase/client";
import type { Template } from "~/lib/challenges";

/**
 * The photos on challenge cards.
 *
 * Each kind of challenge has one photo, made once by the challenge-cover function with
 * Gemini and kept in the public challenge-covers bucket under the kind's key — the week
 * and the month without delivery share one. A card asks for its photo by address; if
 * there is none yet, it shows its drawn scene and asks for the photo to be made, once
 * per session, and shows it as soon as it exists.
 *
 * What each photo shows is said here in plain words; the function adds the style and
 * the rules (realistic, dark enough for text, no text or faces).
 */

const BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/challenge-covers`;

const SUBJECTS: Record<string, string> = {
  delivery: "a food delivery courier's insulated backpack and takeaway boxes on a city street at dusk",
  online: "cardboard shipping boxes and parcels piled at an apartment door, evening light",
  rides: "a commuter riding a bicycle on a city bike lane at sunrise",
  writing: "a hand writing in a small notebook beside a cup of coffee on a wooden desk, morning light",
  bills: "neatly organised paper bills and envelopes with a pen on a desk under a warm lamp",
  impulse: "an unopened shopping bag resting on a chair in a calm room, soft window light",
  coffee: "coffee brewed at home in a moka pot on a kitchen counter, morning light",
  lunch: "a homemade lunch in a glass container on an office desk",
  streaming: "a cosy living room with a book and a blanket on the sofa, the tv switched off, evening",
  transport: "a city bus stop early in the morning, soft fog",
};

const THEME: Record<string, string> = {
  "delivery-7": "delivery",
  "delivery-30": "delivery",
  "online-30": "online",
  "rides-15": "rides",
  "record-7": "writing",
  "record-30": "writing",
  "bills-30": "bills",
  "impulse-30": "impulse",
  "coffee-15": "coffee",
  "lunch-30": "lunch",
  "streaming-7": "streaming",
  "transport-15": "transport",
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "desafio";

/** The photo's key: one per theme, or one per category or habit made one's own. */
export function photoKey(t: Template): string {
  if (THEME[t.key]) return THEME[t.key];
  if (t.key.startsWith("cat:")) return `cat-${slug(t.match?.categories[0] ?? t.name)}`;
  if (t.key.startsWith("habit:")) return `habit-${slug(t.name)}`;
  return `row-${slug(t.name)}`;
}

function subjectOf(t: Template): string {
  const theme = THEME[t.key];
  if (theme) return SUBJECTS[theme];
  if (t.key.startsWith("cat:")) return `an everyday scene in Brazil of spending on ${t.match?.categories[0] ?? t.name}, the kind of purchase someone is cutting back on`;
  return `an everyday scene in Brazil showing this healthy money habit: ${t.name}`;
}

export const coverUrl = (t: Template) => `${BASE}/${photoKey(t)}.jpg`;

/* Asked for once per session: a key that could not be made is not asked again. */
const asked = new Map<string, Promise<string | null>>();

/** Makes sure the photo exists; resolves to its address, or null if it could not be made. */
export function ensureCover(t: Template): Promise<string | null> {
  const key = photoKey(t);
  const going = asked.get(key);
  if (going) return going;
  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("challenge-cover", { body: { key, subject: subjectOf(t) } });
      if (error) return null;
      return (data as { url?: string } | null)?.url ?? null;
    } catch {
      return null;
    }
  })();
  asked.set(key, p);
  return p;
}
