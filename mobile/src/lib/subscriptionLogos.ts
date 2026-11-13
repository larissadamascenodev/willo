/**
 * The well-known subscriptions, found by name, with their real logo.
 *
 * Each is matched by the words people write ("netflix", "disney plus", "yt premium")
 * and carries the service's own site, whose icon is its logo — fetched by domain only,
 * nothing about the person goes with it — and its colour, for the tile behind it and
 * for when the picture cannot be loaded.
 */

export interface KnownSub {
  /** How the service calls itself. */
  name: string;
  domain: string;
  hex: string;
  /** Words in a name that mean this service, lowercase, accents removed. */
  match: string[];
  /** A usual price in Brazil, to start the amount from (the person corrects it). */
  price?: number;
}

export const KNOWN_SUBS: KnownSub[] = [
  { name: "Netflix", domain: "netflix.com", hex: "#E50914", match: ["netflix"], price: 44.9 },
  { name: "Spotify", domain: "spotify.com", hex: "#1DB954", match: ["spotify"], price: 23.9 },
  { name: "YouTube Premium", domain: "youtube.com", hex: "#FF0000", match: ["youtube", "yt premium"], price: 26.9 },
  { name: "Disney+", domain: "disneyplus.com", hex: "#113CCF", match: ["disney"], price: 43.9 },
  { name: "Prime Video", domain: "primevideo.com", hex: "#00A8E1", match: ["prime video", "amazon prime", "prime"], price: 19.9 },
  { name: "Max", domain: "max.com", hex: "#002BE7", match: ["hbo", "max"], price: 34.9 },
  { name: "Globoplay", domain: "globoplay.globo.com", hex: "#E21B22", match: ["globoplay"], price: 26.9 },
  { name: "Apple Music", domain: "music.apple.com", hex: "#FC3C44", match: ["apple music"], price: 21.9 },
  { name: "Apple TV+", domain: "tv.apple.com", hex: "#111111", match: ["apple tv"], price: 21.9 },
  { name: "iCloud+", domain: "icloud.com", hex: "#3693F3", match: ["icloud"], price: 5.9 },
  { name: "Google One", domain: "one.google.com", hex: "#4285F4", match: ["google one"], price: 9.99 },
  { name: "ChatGPT", domain: "chatgpt.com", hex: "#10A37F", match: ["chatgpt", "openai"], price: 99.9 },
  { name: "Claude", domain: "claude.ai", hex: "#D97757", match: ["claude", "anthropic"] },
  { name: "Deezer", domain: "deezer.com", hex: "#A238FF", match: ["deezer"], price: 22.9 },
  { name: "Paramount+", domain: "paramountplus.com", hex: "#0064FF", match: ["paramount"], price: 19.9 },
  { name: "Crunchyroll", domain: "crunchyroll.com", hex: "#F47521", match: ["crunchyroll"], price: 19.99 },
  { name: "Xbox Game Pass", domain: "xbox.com", hex: "#107C10", match: ["game pass", "xbox"] },
  { name: "PlayStation Plus", domain: "playstation.com", hex: "#003087", match: ["playstation", "psn", "ps plus"] },
  { name: "Canva", domain: "canva.com", hex: "#00C4CC", match: ["canva"] },
  { name: "Duolingo", domain: "duolingo.com", hex: "#58CC02", match: ["duolingo"] },
  { name: "Adobe", domain: "adobe.com", hex: "#FF0000", match: ["adobe", "photoshop", "lightroom"] },
  { name: "Microsoft 365", domain: "microsoft.com", hex: "#F25022", match: ["microsoft 365", "office 365"] },
  { name: "Dropbox", domain: "dropbox.com", hex: "#0061FF", match: ["dropbox"] },
  { name: "Notion", domain: "notion.so", hex: "#111111", match: ["notion"] },
  { name: "Wellhub", domain: "wellhub.com", hex: "#D4FF00", match: ["wellhub", "gympass"] },
  { name: "Smart Fit", domain: "smartfit.com.br", hex: "#FFD100", match: ["smart fit", "smartfit"] },
  { name: "Mercado Livre", domain: "mercadolivre.com.br", hex: "#FFE600", match: ["meli+", "mercado livre", "mercado"] },
  { name: "iFood", domain: "ifood.com.br", hex: "#EA1D2C", match: ["ifood"] },
  { name: "Uber One", domain: "uber.com", hex: "#111111", match: ["uber"] },
  { name: "Twitch", domain: "twitch.tv", hex: "#9146FF", match: ["twitch"] },
  { name: "LinkedIn Premium", domain: "linkedin.com", hex: "#0A66C2", match: ["linkedin"] },
];

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The well-known service a name means, or null. */
export function knownSub(name: string): KnownSub | null {
  const n = plain(name);
  /* The longest word first: "apple tv" before "apple", "prime video" before "prime". */
  let best: { sub: KnownSub; len: number } | null = null;
  for (const sub of KNOWN_SUBS) {
    for (const m of sub.match) {
      const hit = m.length <= 3 ? new RegExp(`\\b${m}\\b`).test(n) : n.includes(m);
      if (hit && (!best || m.length > best.len)) best = { sub, len: m.length };
    }
  }
  return best?.sub ?? null;
}

/** The service's own icon, by its site. */
export const logoUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
